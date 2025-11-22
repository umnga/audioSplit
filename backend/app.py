from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uuid
import os
from pathlib import Path
import shutil

app = FastAPI(title="AudioSplit API")

# serve the simple frontend from ../web
web_dir = Path(__file__).parent.parent / 'web'
if web_dir.exists():
    # Mount static files under /static to avoid shadowing API paths (POST/PUT/etc.)
    app.mount("/static", StaticFiles(directory=str(web_dir), html=True), name="static")

    # Serve index.html at root so the single-page app is accessible at /
    @app.get("/", include_in_schema=False)
    def read_index():
        index = web_dir / 'index.html'
        if index.exists():
            return FileResponse(str(index), media_type='text/html')
        raise HTTPException(status_code=404, detail='Index not found')

UPLOADS = Path(__file__).parent.parent / 'uploads'
SEPARATED = Path(__file__).parent.parent / 'separated'
os.makedirs(UPLOADS, exist_ok=True)
os.makedirs(SEPARATED, exist_ok=True)

# Limit uploads to prevent abuse (bytes)
MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB

# simple in-memory job store: job_id -> {status, stems:list, error}
jobs = {}


def run_separation(job_id: str, file_path: str):
    """Run separation using existing script's function.
    This imports the repo-level `testSeparation.separate_audio` to reuse logic.
    """
    try:
        # Lazy import to keep startup fast
        from testSeparation import separate_audio

        out_dir = SEPARATED / job_id
        separate_audio(file_path, output_dir=str(out_dir))
        # collect stems
        stems = []
        for f in out_dir.iterdir():
            if f.suffix in ('.wav', '.mp3'):
                stems.append(f.name)
        jobs[job_id]['status'] = 'done'
        jobs[job_id]['stems'] = stems
    except Exception as e:
        jobs[job_id]['status'] = 'error'
        jobs[job_id]['error'] = str(e)


@app.post('/upload')
async def upload_audio(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    # accept only mp3 or wav
    if not file.filename.lower().endswith(('.mp3', '.wav')):
        raise HTTPException(status_code=400, detail='Only .mp3 and .wav files are supported')
    job_id = uuid.uuid4().hex[:8]
    dest = UPLOADS / f"{job_id}_{file.filename}"
    with open(dest, 'wb') as out:
        shutil.copyfileobj(file.file, out)
    # enforce size limit after saving
    size = dest.stat().st_size
    if size > MAX_UPLOAD_BYTES:
        # remove file and return 413 Payload Too Large
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=413, detail=f'File too large. Max allowed is {MAX_UPLOAD_BYTES // (1024*1024)} MB')
    jobs[job_id] = {'status': 'pending', 'stems': []}
    # run in background
    background_tasks.add_task(run_separation, job_id, str(dest))
    jobs[job_id]['status'] = 'processing'
    return JSONResponse({'job_id': job_id})


@app.get('/status/{job_id}')
def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')
    return job


@app.get('/download/{job_id}/{filename}')
def download_file(job_id: str, filename: str):
    folder = SEPARATED / job_id
    file_path = folder / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail='File not found')
    return FileResponse(str(file_path), media_type='audio/wav', filename=filename)
