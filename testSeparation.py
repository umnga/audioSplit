import os
import torch
from demucs import pretrained
from demucs.apply import apply_model
import soundfile as sf
import torchaudio

def separate_audio(input_file, output_dir="separated"):
    """
    Separate audio into stems using Demucs
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Processing: {input_file}")
    
    print("Loading model...")
    model = pretrained.get_model('htdemucs')
    model.to(device)
    model.eval()
    
    print("Loading audio...")
    wav, sr = sf.read(input_file)
    import numpy as np
    if wav.ndim == 1:
        wav = np.expand_dims(wav, axis=1)
    wav = torch.from_numpy(wav.T).float()  # shape (channels, samples)
    if sr != model.samplerate:
        wav = torchaudio.functional.resample(wav, sr, model.samplerate)
    wav = wav.unsqueeze(0).to(device)

    print("Separating audio... this may take a few minutes")
    with torch.no_grad():
        sources = apply_model(model, wav)
    
    sources = sources.cpu()
    
    source_names = model.sources
    
    for i, name in enumerate(source_names):
        output_file = os.path.join(output_dir, f"{name}.mp3")
        # sources[0, i] is (channels, samples), torchaudio expects (channels, samples)
        torchaudio.save(output_file, sources[0, i], model.samplerate)
        print(f"Saved: {output_file}")
    
    print("Separation complete!")

if __name__ == "__main__":
    input_file = "test_song.mp3"
    
    if os.path.exists(input_file):
        separate_audio(input_file)
    else:
        print(f"File not found: {input_file}")
        print("Please add an audio file and update the filename")