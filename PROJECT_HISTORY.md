# Demeter AI Agronomist - Project Context History

This document serves as a _"Context Loader"_ designed specifically to be ingested by subsequent AI assistants (such as Claude, GPT, or Devin) to rapidly adapt and continue the codebase development of this project without losing historical context.

## 1. Project Objective (Primary Goal)

Demeter is an autonomous IoT server monitoring and intelligent agronomy system. The primary goal is to provide a fully decentralized, self-healing "Garden Guardian" that tracks telemetry (moisture, temperature), utilizes computer vision (via RTSP cameras) to analyze plant health using an LLM, and provides a modern web dashboard ("Wise Design" aesthetics) along with Telegram bot interactions for human administrators.

## 2. System Architecture & Tech Stack

Demeter is built around a lightweight, modular architecture designed to run on a Linux Ubuntu server (with Gunicorn) or as a standalone Python process.

**Core Tech Stack:**
- **Frontend / UI**: HTML5, Vanilla JS (AJAX Polling), Vanilla CSS ("Wise Design" system), Chart.js
- **Backend / Core Engine**: Python, Flask, Gunicorn
- **Computer Vision**: OpenCV (RTSP Stream Capture), FFmpeg
- **AI Integration**: LiteLLM (for generic LLM API rotation such as Gemini/OpenRouter), LangChain, ChromaDB (for local RAG/Vector memory)
- **Database / Persistence**: CSV data logs (`garden_history.csv`), JSON (`demeter_state.json`) for short-term memory
- **External Integrations**: Telegram Bot API

## 3. Current Directory Structure

- `/core` : Contains the main operational packages (`state.py`, `ai_consultant.py`, `telegram_bot.py`, `vision.py`, `utils.py`, `memory_manager.py`).
- `/templates` : Contains the HTML frontend assets (`index.html`, `login.html`).
- `/static` : Contains the CSS and JS assets (`index.css`).
- `/data_logs` : Where local database (`garden_history.csv`) is stored.
- `/vision_capture` : Where RTSP camera captures are stored.
- `demeter_main.py` : The central Orchestrator (Flask routes and thread management).
- `persona_demeter.md` : The dynamic prompt instructions shaping Demeter's AI logic.

## 4. Key Mechanisms & Core Workflows

### A. Hardware Sensor Polling & Webhook (`/lapor`)
ESP32 hardware sends POST requests to `/lapor` containing moisture and temperature data. The orchestrator checks if a cooldown is active. If moisture is below the safety limit, it triggers the `AUTO` analysis task.

### B. Visual Agronomy & AI Decision Making
When triggered (either autonomously or via Telegram manual override), `core/vision.py` connects to the RTSP URL, captures an image frame, and passes it to `core/ai_consultant.py`. The AI (LiteLLM) compares the image against the telemetry and the `persona_demeter.md` prompt to decide whether to "SIRAM" (water) or "DIAM" (do nothing).

### C. Telegram Sync & Command Queue
Users can chat with Demeter via Telegram. If a user asks for a `/status`, the request is placed into `COMMAND_QUEUE` (in `core/state.py`). The next time the ESP32 pings the `/lapor` endpoint, the system catches the queued command, interrupts the normal cooldown, and forces an immediate AI visual analysis.

### D. RAG Memory & Data Persistence
Every significant action (AI decisions, user chat) is embedded and stored locally via `ChromaDB` (inside `core/memory_manager.py`). Hourly heartbeats are logged to CSV but aggressively filtered out of the AI memory context to prevent spam.

## 5. AI Assistant Instructions & Gotchas

> **AI INSTRUCTION**: Subsequent AI assistants MUST read and obey these project-specific rules to maintain codebase integrity.

- **Architecture Rule**: `demeter_main.py` is strictly an orchestrator for Flask and Threading. ALL heavy logic MUST go into the respective modules inside the `core/` folder. Do not create spaghetti code.
- **State Management Rule**: Never instantiate global state individually. Use `core.state` to hold globals (`COMMAND_QUEUE`, `LATEST_DATA`, `AI_PROCESSING_LOCK`) to prevent Thread collisions.
- **Aesthetic Rule**: The frontend MUST strictly adhere to the "Wise Design" language defined in the project. Use `#9fe870` (Lime Green) accents, dark backgrounds (`#121212`), and rounded pill buttons.
- **Environment Rule**: Always use `.env` format for secrets (`LLM_BASE_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`).

## 6. Human-Centric Coding Standards

- Keep variables descriptive.
- Preserve existing comments unless obsolete.
- Keep the UI dynamic, modern, and beautiful.

---

## 7. Chronological Development History

### Milestone 1: Initial Standalone Agronomy
**Date**: Pre-2026
**Changes**:
- Created a standalone Python script handling Telegram bots and local logging.

### Milestone 2: Web Dashboard & Wise Design
**Date**: 2026-04-24
**Changes**:
- Transformed from a CLI/Telegram bot into a full Web Dashboard (`/` and `/login`).
- Implemented "Wise Design" aesthetics with real-time AJAX polling.
- Added Flask session-based password authentication.

### Milestone 3: Core Modularization Refactoring
**Date**: 2026-04-24
**Changes**:
- Split the monolithic `demeter_main.py` (>1100 lines) into smaller, manageable packages inside the `/core/` directory (`state.py`, `ai_consultant.py`, `telegram_bot.py`, `vision.py`, `utils.py`).
- Established Thread-safe `TimeoutLock` and centralized state managers.
- Standardized `LLM_BASE_MODEL` and `LLM_BASE_URL` environment variables for open-source AI support.
