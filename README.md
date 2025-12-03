# AudioSplit Pro

Professional audio processing web application built with Next.js and FastAPI.

## Features

- 🎼 **Separate** - Split audio into stems (vocals, drums, bass, other)
- 🎚️ **Mix** - Combine multiple audio files into one
- 🎤 **Karaoke** - Remove vocals to create instrumental tracks

## Setup

### Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at http://localhost:3000
The backend API will be available at http://localhost:8000

## Requirements

- Python 3.8+ with venv activated (demucs, torch, torchaudio, soundfile installed)
- Node.js 18+
- ffmpeg (for audio processing)

## Usage

1. Start the backend server
2. Start the frontend development server
3. Open http://localhost:3000 in your browser
4. Select a mode and upload your audio files
5. Wait for processing to complete
6. Download or play the results
