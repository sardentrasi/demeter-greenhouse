# Demeter AI Agronomist - Project Documentation

## 1. Project Overview
Demeter is an autonomous IoT server monitoring and intelligent agronomy system. The primary goal is to provide a fully decentralized, self-healing "Garden Guardian" that tracks telemetry (moisture, temperature), utilizes computer vision (via RTSP cameras) to analyze plant health using an LLM, and provides a modern web dashboard ("Wise Design" aesthetics) along with Telegram bot interactions for human administrators.

## 2. System Architecture & Tech Stack
Demeter is built around a lightweight, modular architecture designed to run on a Linux Ubuntu server (with Gunicorn) or as a standalone Python process.

**Core Tech Stack:**
- **Frontend / UI**: HTML5, Vanilla JS (AJAX Polling), Tailwind CSS v4 ("Wise Design" system), Chart.js
- **Backend / Core Engine**: Python, Flask, Gunicorn
- **Computer Vision**: OpenCV (RTSP Stream Capture), FFmpeg
- **AI Integration**: LiteLLM (for generic LLM API rotation such as Gemini/OpenRouter), LangChain, ChromaDB (for local RAG/Vector memory)
- **Database / Persistence**: SQLite (`demeter.db`), CSV data logs (`garden_history.csv`), JSON (`demeter_state.json`) for short-term memory
- **External Integrations**: Telegram Bot API
- **Hardware**: ESP32 DevKitC v4 WROOM-32D, various environmental sensors

## 3. System Requirements
To run the Demeter server, ensure the following requirements are met:
- **Operating System**: Linux (Ubuntu recommended) or Windows/macOS for development.
- **Python**: Version 3.10 or higher.
- **Media Processing**: FFmpeg must be installed and accessible in the system PATH (required for RTSP snapshots).
- **Disk Space**: Sufficient space for data logs, ChromaDB vector store, and vision captures.
- **Network**: Internet access for LLM APIs (LiteLLM) and Telegram Bot communication.

## 4. Installation & Setup Guide

### 1. Clone & Dependencies
Clone the repository and install the required Python packages:
```bash
git clone <repository_url>
cd demeter
pip install -r requirements.txt
```

### 2. Environment Configuration
Create a `.env` file in the root directory and configure the following variables:
```env
# Server Configuration
SECRET_KEY=your_flask_secret_key
ADMIN_PASSWORD=your_dashboard_password

# AI & LLM
LLM_API_KEY=your_api_key
LLM_BASE_MODEL=gemini/gemini-1.5-pro
LLM_BASE_URL=

# Vision (RTSP Camera)
RTSP_URL=rtsp://user:pass@camera_ip:port/stream

# Telegram Bot
BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Thresholds
MOISTURE_SAFETY_LIMIT=30
```

### 3. Running the Server
You can run the server directly using Python:
```bash
python demeter_main.py
```
For production environments, it is recommended to use **Gunicorn**:
```bash
gunicorn --workers 4 --bind 0.0.0.0:5000 demeter_main:app
```

## 5. Directory Structure
- `/core`: Main operational packages (`state.py`, `ai_consultant.py`, `telegram_bot.py`, `vision.py`, `utils.py`, `memory_manager.py`, `database.py`).
- `/templates`: Jinja2 HTML templates (`base.html`, `index.html`, `login.html`, `climatic.html`, `reports.html`, `controls.html`, `settings.html`, `growth_log.html`).
- `/static`: Frontend assets and `app.js` logic.
- `/data_logs`: SQLite database (`demeter.db`) and legacy CSV backups.
- `/vision_capture`: Storage for RTSP camera captures.
- `/esp32`: Arduino/C++ firmware (`esp32_firmware.ino`).
- `demeter_main.py`: Central Orchestrator (Flask routes and thread management).
- `persona_demeter.md`: Dynamic prompt instructions for Demeter's AI logic.

## 6. Hardware Setup & ESP32 Cabling
The hardware side runs on an **ESP32 DevKitC v4 WROOM-32D** microcontroller. It polls sensor data and sends POST requests to the server's `/lapor` webhook.

### Pinout & Cabling Guide
| Component | ESP32 Pin | Type | Notes |
| :--- | :--- | :--- | :--- |
| **Capacitive Soil Moisture** | `GPIO36` (VP) | Analog (ADC1_CH0) | Inverted reading (High = Dry, Low = Wet). Requires calibration. |
| **DHT22 (Temp/Hum)** | `GPIO4` | Digital | Make sure to use a 10K pull-up resistor between VCC and Data pin if your module doesn't include one. |
| **MQ-135 (CO₂)** | `GPIO39` (VN) | Analog (ADC1_CH3) | Measures Air Quality/CO₂. Requires calibration and burn-in time. |
| **Relay Module (Pump)** | `GPIO5` | Digital | Active LOW (Low = ON, High = OFF). Connects to a water pump. |
| **Status LED** | `GPIO2` | Digital | Onboard LED. Blinks during WiFi connection and server reporting. |

### Hardware Calibration Constants
You must calibrate the following values in `esp32_firmware.ino` to ensure accurate readings:
- `SOIL_DRY_VALUE` (Default: `4095`): ADC reading when the sensor is completely dry in the air.
- `SOIL_WET_VALUE` (Default: `1200`): ADC reading when submerged in water.
- `MQ135_RZERO` (Default: `76.63`): Sensor resistance in clean air.

## 7. Core Workflows

### Hardware Sensor Polling
1. The ESP32 gathers data from its sensors every 30 seconds (`REPORT_INTERVAL_MS`).
2. It constructs a JSON payload containing `moisture`, `temp`, `humidity`, and `co2`.
3. It sends a POST request to `http://<SERVER_IP>:5000/lapor`.
4. The server evaluates if the moisture is below the safety threshold. If so, it can trigger an `AUTO` visual analysis.
5. The server responds with a JSON command containing an `action` (e.g., `SIRAM` or `DIAM`) and a `duration_sec`. If `SIRAM` is received, the ESP32 activates the relay (water pump) for the specified duration.

### Visual Agronomy & AI Decision Making
When an analysis is triggered (autonomously or via manual Telegram/Dashboard override), the system captures an RTSP frame and passes it to the AI Consultant (`LiteLLM`). The AI compares the image against the telemetry and dictates the appropriate action (watering or doing nothing) based on its defined persona instructions.

### RAG Memory & Growth Log
Significant events, AI decisions, and Telegram interactions are stored locally in `ChromaDB` (Memory Manager). The AI automatically logs plant height and health into the Growth Log based on its visual analyses. Hourly background heartbeats are filtered to avoid memory spam.

## 8. Deployment Considerations
- Demeter uses a stateful architecture. Global state (`COMMAND_QUEUE`, `LATEST_DATA`, `AI_PROCESSING_LOCK`) is handled centrally via `core/state.py` to ensure thread safety within Gunicorn or multi-threaded Flask.
- Environmental variables (e.g., `LLM_API_KEY`, `LLM_BASE_MODEL`, WiFi credentials) must be properly defined in the `.env` file on the server and within the `esp32_firmware.ino` on the ESP32.
