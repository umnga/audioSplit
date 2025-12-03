import { useState } from 'react'
import Head from 'next/head'
import { Upload, Music2, Disc3, Mic2 } from 'lucide-react'
import SeparateMode from '@/components/SeparateMode'
import MixMode from '@/components/MixMode'
import KaraokeMode from '@/components/KaraokeMode'

type Mode = 'separate' | 'mix' | 'karaoke'

export default function Home() {
  const [activeMode, setActiveMode] = useState<Mode>('separate')

  const modes = [
    { id: 'separate' as Mode, label: 'Separate', icon: Disc3, description: 'Split audio into stems' },
    { id: 'mix' as Mode, label: 'Mix', icon: Music2, description: 'Combine multiple tracks' },
    { id: 'karaoke' as Mode, label: 'Karaoke', icon: Mic2, description: 'Remove vocals' },
  ]

  return (
    <>
      <Head>
        <title>AudioSplit Pro - Professional Audio Processing</title>
        <meta name="description" content="Separate stems, mix tracks, create karaoke versions" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg p-2">
                  <Music2 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">AudioSplit Pro</h1>
                  <p className="text-sm text-gray-500">Professional Audio Processing</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Mode Selector */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {modes.map((mode) => {
                const Icon = mode.icon
                const isActive = activeMode === mode.id
                return (
                  <button
                    key={mode.id}
                    onClick={() => setActiveMode(mode.id)}
                    className={`p-6 rounded-lg border-2 transition-all ${
                      isActive
                        ? 'border-blue-600 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div
                        className={`p-3 rounded-full mb-3 ${
                          isActive ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-600'}`} />
                      </div>
                      <h3 className={`text-lg font-semibold mb-1 ${isActive ? 'text-blue-600' : 'text-gray-900'}`}>
                        {mode.label}
                      </h3>
                      <p className="text-sm text-gray-500">{mode.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Mode Content */}
          <div className="bg-white rounded-xl shadow-md p-8">
            {activeMode === 'separate' && <SeparateMode />}
            {activeMode === 'mix' && <MixMode />}
            {activeMode === 'karaoke' && <KaraokeMode />}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <p className="text-center text-sm text-gray-500">
              AudioSplit Pro - Powered by Demucs AI
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}
