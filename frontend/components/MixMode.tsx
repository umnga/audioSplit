import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Upload, Loader2, Download, Play } from 'lucide-react'
import WaveSurfer from 'wavesurfer.js'

const API_URL = 'http://localhost:8000'

export default function MixMode() {
  const [files, setFiles] = useState<File[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('idle')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const wavesurferRef = useRef<WaveSurfer | null>(null)

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
      setJobId(null)
      setStatus('idle')
    }
  }

  const handleUpload = async () => {
    if (files.length < 2) return

    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))

    setUploading(true)
    setUploadProgress(0)

    try {
      const response = await axios.post(`${API_URL}/api/mix`, formData, {
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
          clearInterval(interval)

          // Load waveform
          const container = document.getElementById('wave-mixed')
          if (container && !wavesurferRef.current) {
            const ws = WaveSurfer.create({
              container,
              waveColor: '#3b82f6',
              progressColor: '#1e40af',
              height: 80,
              barWidth: 2,
              barGap: 1,
              barRadius: 2,
            })
            ws.load(`${API_URL}/api/download_mixed/${jobId}`)
            wavesurferRef.current = ws
          }
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

  const togglePlay = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Mix Tracks</h2>
        <p className="text-gray-600">Upload multiple audio files to combine them into a single track.</p>
      </div>

      {/* Upload Area */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
        <input
          type="file"
          accept="audio/*"
          multiple
          onChange={handleFilesChange}
          className="hidden"
          id="files-upload"
        />
        <label htmlFor="files-upload" className="cursor-pointer">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700">
            {files.length > 0 ? `${files.length} files selected` : 'Click to upload multiple files'}
          </p>
          <p className="text-sm text-gray-500 mt-2">Select 2 or more MP3/WAV files (max 100MB each)</p>
        </label>
      </div>

      {files.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Selected Files:</h4>
          <ul className="space-y-1">
            {files.map((file, index) => (
              <li key={index} className="text-sm text-gray-600">
                {index + 1}. {file.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {files.length >= 2 && !uploading && status === 'idle' && (
        <button
          onClick={handleUpload}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Mix Audio Files
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
          <span className="text-gray-600">Mixing audio files...</span>
        </div>
      )}

      {status === 'done' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Mixed Audio</h3>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">Mixed Track</h4>
              <div className="flex space-x-2">
                <button
                  onClick={togglePlay}
                  className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                >
                  <Play className="w-4 h-4 text-blue-600" />
                </button>
                <a
                  href={`${API_URL}/api/download_mixed/${jobId}`}
                  download
                  className="p-2 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4 text-green-600" />
                </a>
              </div>
            </div>
            <div id="wave-mixed" className="w-full" />
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-semibold">Error mixing audio</p>
          <p className="text-sm">Please ensure all files have the same sample rate.</p>
        </div>
      )}
    </div>
  )
}
