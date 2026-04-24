import os
import time
import threading
import glob
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template, send_from_directory, session, redirect, url_for
from functools import wraps
from dotenv import load_dotenv

import core.state
from core.state import (
    logger, MOISTURE_SAFETY_LIMIT, HARD_COOLDOWN_HOURS, SOFT_COOLDOWN_HOURS, CAPTURE_DIR, DB_FILE
)
from core.utils import update_short_memory, start_midnight_cleanup_scheduler, log_data
from core.vision import capture_visual, get_previous_image
from core.ai_consultant import consult_demeter
from core.telegram_bot import run_telegram_bot, kirim_telegram_sync
from core.database import init_db, get_latest_history

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "demeter-secret-key-123")

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# --- IOT ENDPOINT ---
@app.route('/lapor', methods=['POST'])
def handle_report():
    try:
        data = request.json
        moist = data.get("moisture", 0)
        temp = data.get("temp", 0)
        humidity = data.get("humidity", 0)
        co2 = data.get("co2", 0)
        
        current_time = datetime.now()
        
        logger.info(f"📥 [ESP32] Laporan: Moisture={moist}%, Temp={temp}°C, Hum={humidity}%, CO2={co2}ppm")
        
        # Priority 1: User Request
        if core.state.COMMAND_QUEUE:
            logger.info("⚡ [OVERRIDE] Telegram Command detected in queue!")
            cmd = core.state.COMMAND_QUEUE
            core.state.COMMAND_QUEUE = None
            
            try:
                with core.state.AI_PROCESSING_LOCK:
                    img_path = capture_visual()
                    prev_img = get_previous_image(img_path) if img_path else None
                    
                    ai_result = consult_demeter(moist, temp, img_path, prev_img)
                    action = ai_result.get('action', 'DIAM')
                    duration = ai_result.get('duration_sec', 0)
                    
                    if action == "SIRAM":
                        core.state.NEXT_ANALYSIS_TIME = current_time + timedelta(hours=HARD_COOLDOWN_HOURS)
                        status_msg = f"User Request: Watering (+{HARD_COOLDOWN_HOURS}h)"
                    else:
                        core.state.NEXT_ANALYSIS_TIME = current_time + timedelta(hours=SOFT_COOLDOWN_HOURS)
                        status_msg = f"User Request: Analyzed (+{SOFT_COOLDOWN_HOURS}h)"
                        
                    log_data(moist, temp, action, img_path, humidity, co2)
                    
                    reasoning = ai_result.get("reason", "Manual Override Evaluated")
                    update_short_memory("User Commanded Check", f"Result: {action} | {reasoning}")
                    
                    core.state.LATEST_DATA = {
                        "moisture": moist, "temp": temp, "last_seen": current_time,
                        "action": action, "status": status_msg
                    }
                    
                    pesan = f"🟢 **Laporan Analisa Manual**\n💦 Tanah: {moist}%\n🌡️ Suhu: {temp}°C\n🤖 Keputusan AI: **{action}**\n\n*Catatan*: {reasoning}"
                    kirim_telegram_sync(pesan, img_path)
                    
                    return jsonify({"action": action, "duration_sec": duration})
                    
            except TimeoutError:
                logger.warning("[BUSY] Server memproses perintah. Mengabaikan perintah baru.")
                core.state.LATEST_DATA = {
                    "moisture": moist, "temp": temp, "last_seen": current_time,
                    "action": "DIAM", "status": "Server Busy"
                }
                kirim_telegram_sync("⚠️ Demeter sedang sibuk memproses analisa lain. Harap tunggu.")
                return jsonify({"action": "DIAM", "duration_sec": 0})
        
        # Priority 2: Cooldown check
        if current_time < core.state.NEXT_ANALYSIS_TIME:
            time_left = core.state.NEXT_ANALYSIS_TIME - current_time
            minutes_left = int(time_left.total_seconds() / 60)
            status_msg = f"Cooldown (Wait {minutes_left}m)"
            
            core.state.LATEST_DATA = {
                "moisture": moist, "temp": temp, "last_seen": current_time,
                "action": "DIAM", "status": status_msg
            }
            return jsonify({"action": "DIAM", "duration_sec": 0})

        # Priority 3: Determine task
        task_type = None
        
        if moist < MOISTURE_SAFETY_LIMIT:
            task_type = 'AUTO'
        elif (current_time - core.state.LAST_LOG_TIME).total_seconds() > 3600:
            task_type = 'HEARTBEAT'

        # Execute task
        if task_type:
            try:
                with core.state.AI_PROCESSING_LOCK:
                    if task_type == 'HEARTBEAT':
                        logger.info("[HEARTBEAT] Memulai log rutin...")
                        core.state.LAST_LOG_TIME = current_time
                        status_msg = "Hourly Log"
                    
                    elif task_type == 'AUTO':
                        logger.info(f"[AUTO] Sensor ({moist}%) -> Memulai Analisa...")
                        status_msg = "AI Analyzing..."

                    img_path = capture_visual()
                    save_to_disk = False
                    action = "DIAM"
                    duration = 0

                    if task_type == 'AUTO':
                        prev_img = get_previous_image(img_path) if img_path else None
                        ai_result = consult_demeter(moist, temp, img_path, prev_img)
                        action = ai_result.get('action', 'DIAM')
                        duration = ai_result.get('duration_sec', 0)
                        
                        logger.info(f"[AI DECISION] Gemini: {action}")
                        
                        if action == "SIRAM":
                            core.state.NEXT_ANALYSIS_TIME = current_time + timedelta(hours=HARD_COOLDOWN_HOURS)
                            status_msg = f"AI: Watering (Next: +{HARD_COOLDOWN_HOURS}h)"
                            save_to_disk = True
                        else:
                            core.state.NEXT_ANALYSIS_TIME = current_time + timedelta(hours=SOFT_COOLDOWN_HOURS)
                            status_msg = f"AI: Skipped (Next: +{SOFT_COOLDOWN_HOURS}h)"
                            save_to_disk = True
                    
                    elif task_type == 'HEARTBEAT':
                        save_to_disk = True

                    if save_to_disk:
                        log_data(moist, temp, action, img_path, humidity, co2)
                        
                        if task_type == 'AUTO':
                            reason = ai_result.get('reason', 'Routine check')
                            clean_reason = ' '.join(reason.replace('\n', ' ').replace('*', '').replace('`', '').replace('_', ' ').split())
                            reason_snip = clean_reason[:4000] + '...' if len(clean_reason) > 4000 else clean_reason
                            update_short_memory(f"Autonomous Action ({task_type})", f"Dec: {action} (M:{moist}%, T:{temp}C) | AI: {reason_snip}")
                        
                        if action == "SIRAM":
                            pesan = f"💦 **DEMETER ACTIVE** ({status_msg})\n🌱 Tanah: {moist}%\n🌡️ Suhu: {temp}°C"
                            try:
                                kirim_telegram_sync(pesan, img_path)
                            except Exception as tg_err:
                                logger.error(f"[ERROR] Telegram fail: {tg_err}")

            except TimeoutError:
                logger.info(f"[BUSY] Server sibuk memproses {task_type}. Skip.")
                status_msg = "Server Busy (Timeout)"
                action = "DIAM"

            except Exception as e:
                logger.error(f"[PROCESS ERROR] {e}")
                core.state.NEXT_ANALYSIS_TIME = current_time + timedelta(hours=SOFT_COOLDOWN_HOURS)
                status_msg = "Error Cooldown"
                update_short_memory("System Error", str(e))

            core.state.LATEST_DATA = {
                "moisture": moist, "temp": temp, "humidity": humidity, "co2": co2, "last_seen": current_time,
                "action": action, "status": status_msg
            }

            return jsonify({"action": action, "duration_sec": duration})

        status_msg = "Sistem Sehat"
        core.state.LATEST_DATA = {
            "moisture": moist, "temp": temp, "humidity": humidity, "co2": co2, "last_seen": current_time,
            "action": "DIAM", "status": status_msg
        }

        return jsonify({"action": "DIAM", "duration_sec": 0})

    except Exception as e:
        logger.error(f"[CRITICAL ERROR] {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"action": "DIAM", "duration_sec": 0}), 500

# --- WEB DASHBOARD ROUTES ---
@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        correct_username = os.getenv('DASHBOARD_USERNAME', 'admin')
        correct_password = os.getenv('DASHBOARD_PASSWORD', 'admin123')
        if username == correct_username and password == correct_password:
            session['logged_in'] = True
            return redirect(url_for('index'))
        else:
            error = "Invalid username or password."
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    return render_template('index.html')

@app.route('/api/status')
@login_required
def api_status():
    latest_img = None
    list_files = sorted(glob.glob(os.path.join(CAPTURE_DIR, "*.jpg")))
    if list_files:
        latest_img = os.path.basename(list_files[-1])
        
    return jsonify({
        "moisture": core.state.LATEST_DATA.get("moisture", 0),
        "temp": core.state.LATEST_DATA.get("temp", 0),
        "humidity": core.state.LATEST_DATA.get("humidity", 0),
        "co2": core.state.LATEST_DATA.get("co2", 0),
        "last_seen": core.state.LATEST_DATA.get("last_seen").isoformat() if isinstance(core.state.LATEST_DATA.get("last_seen"), datetime) else None,
        "action": core.state.LATEST_DATA.get("action", "WAITING"),
        "status": core.state.LATEST_DATA.get("status", "BOOT"),
        "latest_image": latest_img
    })

@app.route('/api/history')
@login_required
def api_history():
    history = get_latest_history(limit=20)
    # The database already returns the records in DESC order (newest first)
    # The frontend app.js reverses it again to append to the bottom of the table
    # So we are good.
    return jsonify(history)

@app.route('/vision_capture/<path:filename>')
@login_required
def serve_capture(filename):
    return send_from_directory(CAPTURE_DIR, filename)

def run_flask():
    logger.info("[SYSTEM] Starting Flask Server (Daemon)...")
    logger.info("💡 [PRODUCTION TIP] Untuk Ubuntu, jalankan: gunicorn -w 4 -b 0.0.0.0:5000 demeter_main:app")
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)

# --- MAIN EXECUTION ---
if __name__ == '__main__':
    logger.info("--- DEMETER V6.2 (MODULAR) ONLINE ---")
    
    # Initialize Database
    init_db()
    
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    
    try:
        start_midnight_cleanup_scheduler()
        run_telegram_bot()
    except KeyboardInterrupt:
        logger.info("[SYSTEM] Shutting down...")
