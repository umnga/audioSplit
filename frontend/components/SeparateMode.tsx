import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Upload, Loader2, Download, Play, Pause } from 'lucide-react'
import WaveSurfer from 'wavesurfer.js'

const API_URL = 'http://localhost:8000'

interface Stem {
  name: string
  filename: string
  color: string
}

export default function SeparateMode() {
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('idle')
  const [stems, setStems] = useState<Stem[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const wavesurfers = useRef<Record<string, WaveSurfer>>({})

  const stemColors: Record<string, string> = {
    vocals: '#a78bfa',
    drums: '#f87171',
    bass: '#fbbf24',
    other: '#34d399',
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setStems([])
      setJobId(null)
      setStatus('idle')
    }
  }

  const handleUpload = async () => {
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    setUploadProgress(0)

    try {
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0
          setUploadProgress(progress)
        },
      })

      setJobId(response.data.job_id)
      setStatus('processing')
      setUploading(false)
    } catch (error) {
      console.error('Upload failed:', error)
      setStatus('error')
      setUploading(false)
    }
  }

  useEffect(() => {
    if (!jobId || status !== 'processing') return

    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`${API_URL}/api/status/${jobId}`)
        const data = response.data

        if (data.status === 'done') {
          setStatus('done')
          const stemsList = data.stems.map((filename: string) => {
            const name = filename.replace('.wav', '')
            return {
              name,
              filename,
              color: stemColors[name] || '#9aa4b2',
            }
          })
          setStems(stemsList)
          clearInterval(interval)
        } else if (data.status === 'error') {
          setStatus('error')
          clearInterval(interval)
        }
      } catch (error) {
        console.error('Status check failed:', error)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [jobId, status])

  useEffect(() => {
    stems.forEach((stem) => {
      const container = document.getElementById(`wave-${stem.name}`)
      if (container && !wavesurfers.current[stem.name]) {
        const ws = WaveSurfer.create({
          container,
          waveColor: stem.color,
          progressColor: '#1e40af',
          height: 60,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
        })
        ws.load(`${API_URL}/api/download/${jobId}/${stem.filename}`)
        wavesurfers.current[stem.name] = ws
      }
    })
  }, [stems, jobId])

  const togglePlay = (name: string) => {
    if (wavesurfers.current[name]) {
      wavesurfers.current[name].playPause()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Separate Stems</h2>
        <p className="text-gray-600">Upload an audio file to split it into vocals, drums, bass, and other.</p>
      </div>

      {/* Upload Area */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700">
            {file ? file.name : 'Click to upload or drag and drop'}
          </p>
          <p className="text-sm text-gray-500 mt-2">MP3 or WAV (max 100MB)</p>
        </label>
      </div>

      {file && !uploading && status === 'idle' && (
        <button
          onClick={handleUpload}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Process Audio
        </button>
      )}

      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {status === 'processing' && (
        <div className="flex items-center justify-center py-8 space-x-3">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          <span className="text-gray-600">Processing audio... this may take a few minutes</span>
        </div>
      )}

      {status === 'done' && stems.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Separated Stems</h3>
          {stems.map((stem) => (
            <div key={stem.name} className="bg-gray-50 rounded-lg p-4 border-l-4" style={{ borderLeftColor: stem.color }}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900 capitalize">{stem.name}</h4>
                <div className="flex space-x-2">
                  <button
                    onClick={() => togglePlay(stem.name)}
                    className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                  >
                    <Play className="w-4 h-4 text-blue-600" />
                  </button>
                  <a
                    href={`${API_URL}/api/download/${jobId}/${stem.filename}`}
                    download
                    className="p-2 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4 text-green-600" />
                  </a>
                </div>
              </div>
              <div id={`wave-${stem.name}`} className="w-full" />
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-semibold">Error processing audio</p>
          <p className="text-sm">Please try again with a different file.</p>
        </div>
      )}
    </div>
  )
}
