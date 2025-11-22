# audioSplit

Small project to separate music stems using Demucs.

Backend Quickstart

1. Activate the project virtualenv (created previously):

```bash
source venv/bin/activate
```

2. Install backend requirements (if needed):

```bash
pip install -r backend/requirements.txt
```

3. Start the FastAPI server from the repo root (use the venv python):

```bash
uvicorn backend.app:app --reload --port 8000
```

4. Open http://127.0.0.1:8000/ to access the simple upload page.
