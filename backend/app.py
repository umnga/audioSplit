from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import uuid
import os
from pathlib import Path
import shutil

app = FastAPI(title="AudioSplit API")

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS = Path(__file__).parent.parent / 'uploads'
SEPARATED = Path(__file__).parent.parent / 'separated'
MIXED = Path(__file__).parent.parent / 'mixed'
KARAOKE = Path(__file__).parent.parent / 'karaoke'
os.makedirs(UPLOADS, exist_ok=True)
os.makedirs(SEPARATED, exist_ok=True)
os.makedirs(MIXED, exist_ok=True)
os.makedirs(KARAOKE, exist_ok=True)

# Limit uploads to prevent abuse (bytes)
MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB

# In-memory job store: job_id -> {status, stems:list, error}
jobs = {}


def run_separation(job_id: str, file_path: str):
    """Run separation using existing script's function."""
    try:
        from testSeparation import separate_audio

        out_dir = SEPARATED / job_id
        separate_audio(file_path, output_dir=str(out_dir), verbose=False)
        # Collect stems
        stems = []
        for f in sorted(out_dir.iterdir()):
            if f.suffix in ('.wav', '.mp3'):
                stems.append(f.name)
        jobs[job_id]['status'] = 'done'
        jobs[job_id]['stems'] = stems
    except Exception as e:
        jobs[job_id]['status'] = 'error'
        jobs[job_id]['error'] = str(e)


@app.post('/api/upload')
async def upload_audio(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Upload audio file for stem separation."""
    if not file.filename.lower().endswith(('.mp3', '.wav')):
        raise HTTPException(status_code=400, detail='Only .mp3 and .wav files are supported')
    
    job_id = uuid.uuid4().hex[:8]
    dest = UPLOADS / f"{job_id}_{file.filename}"
    
    with open(dest, 'wb') as out:
        shutil.copyfileobj(file.file, out)
    
    # Enforce size limit
    size = dest.stat().st_size
    if size > MAX_UPLOAD_BYTES:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=413, detail=f'File too large. Max allowed is {MAX_UPLOAD_BYTES // (1024*1024)} MB')
    
    jobs[job_id] = {'status': 'processing', 'stems': []}
    background_tasks.add_task(run_separation, job_id, str(dest))
    
    return JSONResponse({'job_id': job_id})


@app.get('/api/status/{job_id}')
def get_status(job_id: str):
    """Get job status."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')
    return job


@app.get('/api/download/{job_id}/{filename}')
def download_file(job_id: str, filename: str):
    """Download separated stem."""
    folder = SEPARATED / job_id
    file_path = folder / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail='File not found')
    return FileResponse(str(file_path), media_type='audio/wav', filename=filename)


def run_mix(job_id: str, file_paths: List[str]):
    """Mix multiple audio files into a single output."""
    try:
        import soundfile as sf
        import numpy as np
        
        audio_data = []
        max_length = 0
        samplerate = None
        
        for path in file_paths:
            data, sr = sf.read(path)
            if samplerate is None:
                samplerate = sr
            elif sr != samplerate:
                jobs[job_id]['status'] = 'error'
                jobs[job_id]['error'] = f'All files must have the same sample rate. Got {sr} but expected {samplerate}'
                return
            
            # Convert to stereo if mono
            if len(data.shape) == 1:
                data = np.stack([data, data], axis=1)
            
            audio_data.append(data)
            max_length = max(max_length, len(data))
        
        # Pad all audio to same length
        padded = []
        for data in audio_data:
            if len(data) < max_length:
                padding = np.zeros((max_length - len(data), data.shape[1]))
                data = np.vstack([data, padding])
            padded.append(data)
        
        # Mix by averaging
        mixed = np.mean(padded, axis=0)
        
        # Normalize to prevent clipping
        max_val = np.abs(mixed).max()
        if max_val > 1.0:
            mixed = mixed / max_val
        
        # Save mixed output
        out_dir = MIXED / job_id
        out_dir.mkdir(exist_ok=True)
        output_path = out_dir / 'mixed.wav'
        sf.write(str(output_path), mixed, samplerate)
        
        jobs[job_id]['status'] = 'done'
        jobs[job_id]['output'] = 'mixed.wav'
        
    except Exception as e:
        jobs[job_id]['status'] = 'error'
        jobs[job_id]['error'] = str(e)


@app.post('/api/mix')
async def mix_audio(background_tasks: BackgroundTasks, files: List[UploadFile] = File(...)):
    """Mix multiple audio files."""
    if len(files) < 2:
        raise HTTPException(status_code=400, detail='At least 2 audio files are required for mixing')
    
    for file in files:
        if not file.filename.lower().endswith(('.mp3', '.wav')):
            raise HTTPException(status_code=400, detail='Only .mp3 and .wav files are supported')
    
    job_id = uuid.uuid4().hex[:8]
    saved_paths = []
    
    for i, file in enumerate(files):
        dest = UPLOADS / f"{job_id}_{i}_{file.filename}"
        with open(dest, 'wb') as out:
            shutil.copyfileobj(file.file, out)
        
        size = dest.stat().st_size
        if size > MAX_UPLOAD_BYTES:
            for p in saved_paths:
                Path(p).unlink(missing_ok=True)
            dest.unlink(missing_ok=True)
            raise HTTPException(status_code=413, detail=f'File too large. Max allowed is {MAX_UPLOAD_BYTES // (1024*1024)} MB')
        
        saved_paths.append(str(dest))
    
    jobs[job_id] = {'status': 'processing', 'output': None}
    background_tasks.add_task(run_mix, job_id, saved_paths)
    
    return JSONResponse({'job_id': job_id})


@app.get('/api/download_mixed/{job_id}')
def download_mixed(job_id: str):
    """Download mixed audio."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')
    if job['status'] != 'done':
        raise HTTPException(status_code=400, detail='Job not completed yet')
    
    file_path = MIXED / job_id / job['output']
    if not file_path.exists():
        raise HTTPException(status_code=404, detail='File not found')
    
    return FileResponse(str(file_path), media_type='audio/wav', filename='mixed.wav')


def run_karaoke(job_id: str, file_path: str):
    """Extract instrumental track (remove vocals) using Demucs."""
    try:
        from testSeparation import separate_audio
        import soundfile as sf
        import numpy as np
        
        temp_out = SEPARATED / f"karaoke_{job_id}"
        separate_audio(file_path, output_dir=str(temp_out), verbose=False)
        
        # Load all non-vocal stems
        stems_to_mix = []
        samplerate = None
        
        for stem_name in ['drums', 'bass', 'other']:
            stem_path = temp_out / f"{stem_name}.wav"
            if stem_path.exists():
                data, sr = sf.read(str(stem_path))
                if samplerate is None:
                    samplerate = sr
                stems_to_mix.append(data)
        
        if not stems_to_mix:
            jobs[job_id]['status'] = 'error'
            jobs[job_id]['error'] = 'No instrumental stems found'
            return
        
        # Mix instrumental stems
        instrumental = np.sum(stems_to_mix, axis=0)
        
        # Normalize
        max_val = np.abs(instrumental).max()
        if max_val > 1.0:
            instrumental = instrumental / max_val
        
        # Save karaoke output
        out_dir = KARAOKE / job_id
        out_dir.mkdir(exist_ok=True)
        output_path = out_dir / 'karaoke.wav'
        sf.write(str(output_path), instrumental, samplerate)
        
        # Cleanup temp separation files
        shutil.rmtree(temp_out, ignore_errors=True)
        
        jobs[job_id]['status'] = 'done'
        jobs[job_id]['output'] = 'karaoke.wav'
        
    except Exception as e:
        jobs[job_id]['status'] = 'error'
        jobs[job_id]['error'] = str(e)


@app.post('/api/karaoke')
async def karaoke_mode(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Create karaoke track (remove vocals)."""
    if not file.filename.lower().endswith(('.mp3', '.wav')):
        raise HTTPException(status_code=400, detail='Only .mp3 and .wav files are supported')
    
    job_id = uuid.uuid4().hex[:8]
    dest = UPLOADS / f"karaoke_{job_id}_{file.filename}"
    
    with open(dest, 'wb') as out:
        shutil.copyfileobj(file.file, out)
    
    size = dest.stat().st_size
    if size > MAX_UPLOAD_BYTES:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=413, detail=f'File too large. Max allowed is {MAX_UPLOAD_BYTES // (1024*1024)} MB')
    
    jobs[job_id] = {'status': 'processing', 'output': None}
    background_tasks.add_task(run_karaoke, job_id, str(dest))
    
    return JSONResponse({'job_id': job_id})


@app.get('/api/download_karaoke/{job_id}')
def download_karaoke(job_id: str):
    """Download karaoke track."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')
    if job['status'] != 'done':
        raise HTTPException(status_code=400, detail='Job not completed yet')
    
    file_path = KARAOKE / job_id / job['output']
    if not file_path.exists():
        raise HTTPException(status_code=404, detail='File not found')
    
    return FileResponse(str(file_path), media_type='audio/wav', filename='karaoke.wav')


@app.get('/api/health')
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


