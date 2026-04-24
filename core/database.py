import sqlite3
import os
from core.state import DB_PATH, logger

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    try:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Create table for sensor logs
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sensor_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                moisture REAL,
                temp REAL,
                humidity REAL,
                co2 REAL,
                action TEXT,
                img_path TEXT
            )
        ''')
        
        # Add CO2 column if it doesn't exist (for migration of existing SQLite DB)
        try:
            cursor.execute('ALTER TABLE sensor_logs ADD COLUMN co2 REAL DEFAULT 0')
        except sqlite3.OperationalError:
            pass # Column likely already exists

        # Indexing for performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON sensor_logs(timestamp)')
        
        conn.commit()
        conn.close()
        logger.info(f"🗄️ Database initialized at {DB_PATH}")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")

def insert_sensor_data(moisture, temp, humidity, co2, action, img_path):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO sensor_logs (moisture, temp, humidity, co2, action, img_path)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (moisture, temp, humidity, co2, action, img_path))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"❌ Failed to insert sensor data: {e}")

def get_latest_history(limit=20):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT timestamp, moisture, temp, humidity, co2, action, img_path 
            FROM sensor_logs 
            ORDER BY timestamp DESC 
            LIMIT ?
        ''', (limit,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"❌ Failed to fetch history: {e}")
        return []
