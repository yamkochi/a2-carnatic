"use client"
import { useEffect, useRef, useState } from "react"
const PIANO_KEYS = [
  { name: "C", octave: 4, isBlack: false },
  { name: "C#", octave: 4, isBlack: true },
  { name: "D", octave: 4, isBlack: false },
  { name: "D#", octave: 4, isBlack: true },
  { name: "E", octave: 4, isBlack: false },
  { name: "F", octave: 4, isBlack: false },
  { name: "F#", octave: 4, isBlack: true },
  { name: "G", octave: 4, isBlack: false },
  { name: "G#", octave: 4, isBlack: true },
  { name: "A", octave: 4, isBlack: false },
  { name: "A#", octave: 4, isBlack: true },
  { name: "B", octave: 4, isBlack: false },
  { name: "C", octave: 5, isBlack: false },
  { name: "C#", octave: 5, isBlack: true },
  { name: "D", octave: 5, isBlack: false },
  { name: "D#", octave: 5, isBlack: true },
  { name: "E", octave: 5, isBlack: false },
  { name: "F", octave: 5, isBlack: false },
]

const CHROMATIC = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
]

// Mapping MIDI note number to Hz
function midiToHz(midiNote) {
  return 440 * Math.pow(2, (midiNote - 69) / 12)
}

// Find the closest note to a given frequency
function frequencyToNote(frequency) {
  if (frequency < 30 || frequency > 3000) return null

  // Calculate MIDI note number from frequency
  const midiNote = 69 + 12 * Math.log2(frequency / 440)
  const roundedMidi = Math.round(midiNote)

  // Get the note name and octave
  const noteIndex = (((roundedMidi - 12) % 12) + 12) % 12
  const octave = Math.floor((roundedMidi - 12) / 12) + 1
  const noteName = CHROMATIC[noteIndex]
  const cents = (midiNote - roundedMidi) * 100 // How many cents off

  return {
    name: noteName,
    octave: octave,
    frequency: frequency,
    midiNote: roundedMidi,
    cents: cents,
    displayName: `${noteName}${octave}`,
  }
}

// Autocorrelation-based pitch detection
function detectPitch(buffer, sampleRate) {
  const SIZE = buffer.length
  const MAX_SAMPLES = Math.floor(SIZE / 2)

  let best_offset = -1
  let best_correlation = 0

  // Implements autocorrelation algorithm
  for (let tau = 1; tau < MAX_SAMPLES; tau++) {
    let sum = 0
    let sum_sq_tau = 0
    let sum_sq_t = 0

    for (let t = 0; t < MAX_SAMPLES; t++) {
      const x = buffer[t]
      const y = buffer[t + tau]
      sum += x * y
      sum_sq_t += x * x
      sum_sq_tau += y * y
    }

    // Normalized cross-correlation
    const denom = Math.sqrt(sum_sq_t * sum_sq_tau)
    if (denom === 0) continue

    const correlation = Math.abs(sum) / denom

    if (correlation > best_correlation) {
      best_correlation = correlation
      best_offset = tau
    }
  }

  // Only return pitch if correlation is strong enough
  if (best_correlation > 0.1 && best_offset > 0) {
    return sampleRate / best_offset
  }

  return null
}

export default function VoiceNoteDetector() {
  const [isGuideOpen, setIsGuideOpen] = useState(false)

  const [noteHistory, setNoteHistory] = useState([])

  const [lastValidNote, setLastValidNote] = useState(null)

  const [isListening, setIsListening] = useState(false)
  const [detectedNote, setDetectedNote] = useState(null)
  const [frequency, setFrequency] = useState(null)
  const [confidence, setConfidence] = useState(0)
  const [permission, setPermission] = useState(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState(null)
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [micDevices, setMicDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState("")
  const [selectedDeviceLabel, setSelectedDeviceLabel] = useState("Default")
  const [gainValue, setGainValue] = useState(1)
  const [isEnumerating, setIsEnumerating] = useState(false)
  const [debugMode, setDebugMode] = useState(false)

  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const processorRef = useRef(null)
  const streamRef = useRef(null)
  const sourceRef = useRef(null)
  const gainNodeRef = useRef(null)
  const animationIdRef = useRef(null)
  const silenceCountRef = useRef(0)

  const getUserMediaStream = async (deviceId) => {
    const constraints = {
      audio: deviceId
        ? { deviceId: { exact: deviceId }, channelCount: 1 }
        : { channelCount: 1 },
    }
    return await navigator.mediaDevices.getUserMedia(constraints)
  }
  const playReferenceTone = (noteName, octave) => {
    try {
      // 1. Convert note + octave into a temporary frequency number
      const noteIndex = CHROMATIC.indexOf(noteName)
      if (noteIndex === -1) return

      // Standard MIDI calculation formula
      const midiNote = (octave - 1) * 12 + noteIndex + 12
      const frequencyHz = 440 * Math.pow(2, (midiNote - 69) / 12)

      // 2. Initialize a transient AudioContext for output audio
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioContextClass()

      // 3. Create synthesizer nodes
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.type = "sine" // Smooth, pure tuning-fork style sound
      oscillator.frequency.value = frequencyHz

      // 4. Create an automatic volume envelope (fade out cleanly after 0.8 seconds)
      gainNode.gain.setValueAtTime(0.15, ctx.currentTime) // Comfortable listening volume
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8)

      // 5. Connect the audio graph and play
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.start()
      oscillator.stop(ctx.currentTime + 0.8)
    } catch (err) {
      console.error("Failed to output audio tone:", err)
    }
  }

  const enumerateMicDevices = async () => {
    try {
      setError(null)
      setIsEnumerating(true)
      const tempStream = await getUserMediaStream(selectedDeviceId || undefined)
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(
        (device) => device.kind === "audioinput",
      )
      setMicDevices(audioInputs)
      if (audioInputs.length > 0) {
        const currentDevice =
          audioInputs.find((device) => device.deviceId === selectedDeviceId) ||
          audioInputs[0]
        setSelectedDeviceId(currentDevice.deviceId)
        setSelectedDeviceLabel(currentDevice.label || "Default microphone")
      }
      tempStream.getTracks().forEach((track) => track.stop())
      setPermission("granted")
      if (debugMode)
        console.debug("enumerateMicDevices -> devices:", audioInputs)
    } catch (err) {
      console.error("Error enumerating microphones:", err)
      setError(
        "Unable to access microphone devices. Please allow mic permission and try again.",
      )
    } finally {
      setIsEnumerating(false)
    }
  }

  const cleanupAudio = () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current)
      animationIdRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    analyserRef.current = null
    sourceRef.current = null
    gainNodeRef.current = null
  }

  const initializeAudio = async (stream) => {
    const audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )()
    audioContextRef.current = audioContext

    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 4096
    analyser.smoothingTimeConstant = 0.85
    analyser.minDecibels = -100
    analyser.maxDecibels = -10
    analyserRef.current = analyser

    const microphone = audioContext.createMediaStreamSource(stream)
    sourceRef.current = microphone
    const gainNode = audioContext.createGain()
    gainNode.gain.value = gainValue
    gainNodeRef.current = gainNode

    console.log(
      "initializeAudio: gainNode.gain.value =",
      gainNode.gain.value,
      "gainValue =",
      gainValue,
    )

    microphone.connect(gainNode)
    gainNode.connect(analyser)

    // Connect analyser to destination - required for audio data to flow
    //analyser.connect(audioContext.destination)

    console.log("initializeAudio: audio graph connected", {
      microphone,
      gainNode,
      analyser,
      destination: audioContext.destination,
    })

    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume()
      } catch (resumeError) {
        console.warn("AudioContext resume failed:", resumeError)
      }
    }
    if (debugMode) {
      console.debug("initializeAudio: sampleRate", audioContext.sampleRate)
      console.debug("initializeAudio: analyser FFT", analyser.fftSize)
    }
  }

  const requestMicrophonePermission = async (deviceId = selectedDeviceId) => {
    try {
      cleanupAudio()
      const stream = await getUserMediaStream(deviceId || undefined)
      streamRef.current = stream
      console.log(
        "requestMicrophonePermission: stream tracks:",
        stream.getTracks().map((t) => ({
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
        })),
      )
      setPermission("granted")
      await initializeAudio(stream)
      if (debugMode) {
        console.debug(
          "requestMicrophonePermission: got stream",
          streamRef.current,
        )
        console.debug(
          "requestMicrophonePermission: tracks",
          streamRef.current
            .getTracks()
            .map((t) => ({ kind: t.kind, id: t.id })),
        )
      }
      return true
    } catch (err) {
      console.error("Microphone permission denied:", err)
      setPermission("denied")
      setError("Microphone access denied. Please allow access and try again.")
      return false
    }
  }

  const startListening = async () => {
    setError(null)
    setDetectedNote(null)
    setConfidence(0)
    silenceCountRef.current = 0

    console.log(
      "startListening called, permission:",
      permission,
      "audioContext:",
      audioContextRef.current,
    )

    if (permission !== "granted" || !audioContextRef.current) {
      const granted = await requestMicrophonePermission()
      if (!granted) return
    }

    if (
      audioContextRef.current &&
      audioContextRef.current.state === "suspended"
    ) {
      try {
        await audioContextRef.current.resume()
      } catch (resumeError) {
        console.warn("AudioContext resume failed:", resumeError)
      }
    }

    console.log("About to call analyzeAudio, analyser:", analyserRef.current)
    setIsListening(true)
    setIsSessionActive(true)
    analyzeAudio(true)

    // Append this to the bottom of your existing startListening() function:
    //setIsListening(true);
    //setIsSessionActive(true);
    updatePitch() // Kickoff loop
  }

  // Add this new function to stop the stream:
  const stopListening = () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current)
      animationIdRef.current = null
    }
    setIsListening(false)
    setDetectedNote(null)
    setFrequency(null)
    setConfidence(0)
  }

  //newly addesed by me to handle device change while listening
  const updatePitch = () => {
    if (!analyserRef.current || !audioContextRef.current) return

    const bufferLength = analyserRef.current.fftSize
    const dataArray = new Float32Array(bufferLength)

    // Get time-domain data for autocorrelation
    analyserRef.current.getFloatTimeDomainData(dataArray)

    // 1. Calculate RMS volume level
    let sumSquares = 0
    for (const sample of dataArray) {
      sumSquares += sample * sample
    }
    const rms = Math.sqrt(sumSquares / dataArray.length)
    setAudioLevel(rms)

    // 2. Detect pitch if volume is high enough to ignore background noise
    if (rms > 0.01) {
      silenceCountRef.current = 0
      const sampleRate = audioContextRef.current.sampleRate
      const pitchHz = detectPitch(dataArray, sampleRate)

      if (pitchHz) {
        setFrequency(pitchHz)
        const noteInfo = frequencyToNote(pitchHz)
        if (noteInfo) {
          setDetectedNote(noteInfo)
          setConfidence(
            Math.min(
              100,
              Math.floor((1 - Math.abs(noteInfo.cents) / 50) * 100),
            ),
          )
        }
      }
    } else {
      // Handle silence fading
      silenceCountRef.current += 1
      if (silenceCountRef.current > 20) {
        // ~300ms of silence
        setDetectedNote(null)
        setFrequency(null)
        setConfidence(0)
      }
    }

    // Loop the animation frame
    animationIdRef.current = requestAnimationFrame(updatePitch)
  }

  const handleDeviceChange = async (event) => {
    const deviceId = event.target.value
    setSelectedDeviceId(deviceId)
    const selected = micDevices.find((device) => device.deviceId === deviceId)
    setSelectedDeviceLabel(selected?.label || "Selected microphone")
    if (isListening) {
      await requestMicrophonePermission(deviceId)
    }
  }

  const handleGainChange = (event) => {
    const gain = Number(event.target.value)
    setGainValue(gain)
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = gain
    }
  }

  const analyzeAudio = (running = isListening) => {
    console.log("analyzeAudio called, analyser exists:", !!analyserRef.current)
    const analyser = analyserRef.current
    if (!analyser) {
      console.warn("analyser is null, returning")
      return
    }

    const timeDomainData = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(timeDomainData)

    // Use frequency data for more reliable audio level
    const frequencyData = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(frequencyData)

    // Check stream status
    const streamTracks = streamRef.current?.getTracks() || []
    const audioTracks = streamTracks.filter((t) => t.kind === "audio")

    const maxFreqValue = Math.max(...frequencyData)
    const firstTenFreqs = Array.from(frequencyData.slice(0, 10))

    console.log(
      "analyzeAudio check: stream tracks:",
      streamTracks.length,
      "audio tracks:",
      audioTracks.length,
      "audio track enabled:",
      audioTracks[0]?.enabled,
      "readyState:",
      audioTracks[0]?.readyState,
      "maxFreq:",
      maxFreqValue,
      "firstTen:",
      firstTenFreqs,
    )

    // Calculate RMS audio level from time-domain signal
    let sumSquares = 0
    for (let i = 0; i < timeDomainData.length; i++) {
      const sample = timeDomainData[i]
      sumSquares += sample * sample
    }
    const amplitudeRms = Math.sqrt(sumSquares / timeDomainData.length)

    // Calculate average frequency magnitude (0-255 scale)
    const avgFrequency =
      frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length

    // Map RMS to a perceptual audio level using dB scaling
    // const db = amplitudeRms > 0 ? 20 * Math.log10(amplitudeRms) : -100
    // const level = Math.max(0, Math.min(100, Math.round((db + 80) * 1.25)))
    // const freqLevel = Math.round(avgFrequency * 0.39) // Scale 0-255 to 0-100
    // const audioLevel = Math.max(level, freqLevel)
    const level = Math.round(amplitudeRms * 1200) // Amplifies the float data cleanly
    const audioLevel = Math.max(0, Math.min(100, level)) // Clamps strictly between 0 and 100
    setAudioLevel(audioLevel)

    setAudioLevel(audioLevel)

    setAudioLevel(audioLevel)

    // 🔵 Update this log to remove "db"
    setAudioLevel(audioLevel)

    // 🔵 Replace the entire log with this line:
    console.log(
      "analyzeAudio: RMS =",
      amplitudeRms,
      "level =",
      level,
      "finalLevel =",
      audioLevel,
    )

    const isQuiet = audioLevel < 1
    if (isQuiet) {
      silenceCountRef.current++

      if (silenceCountRef.current > 30) {
        // 1. Only show error if a user hasn't successfully sung a note yet
        if (!lastValidNote) {
          setError(
            "🔇 No sound detected - Try speaking or singing closer to the mic",
          )
        }
        // 2. Clear current realtime note, but DO NOT clear lastValidNote here!
        setDetectedNote(null)
      }
      setFrequency(null)
      setConfidence(0)
    } else {
      // ... Keep all your existing pitch detection logic inside the "else" block exactly the same ...

      silenceCountRef.current = 0
      setError(null)
      const pitch = detectPitch(
        timeDomainData,
        audioContextRef.current.sampleRate,
      )

      let maxValue = 0
      let maxIndex = 0
      for (let i = 0; i < frequencyData.length; i++) {
        if (frequencyData[i] > maxValue) {
          maxValue = frequencyData[i]
          maxIndex = i
        }
      }
      const nyquist = audioContextRef.current.sampleRate / 2
      const peakFrequency = frequencyData.length
        ? (maxIndex * nyquist) / frequencyData.length
        : null
      const finalFrequency = pitch || (maxValue > 15 ? peakFrequency : null)

      if (debugMode) {
        console.debug("analyzeAudio:", {
          amplitudeRms,
          db,
          level,
          pitch,
          peakFrequency,
          maxValue,
          finalFrequency,
        })
      }

      if (finalFrequency) {
        setFrequency(finalFrequency)
        const note = frequencyToNote(finalFrequency)
        if (note) {
          const expectedFreq = midiToHz(note.midiNote)
          const error = Math.abs(finalFrequency - expectedFreq) / expectedFreq
          const conf = Math.max(0, 1 - error)
          const noteConfidence = Math.round(conf * 100)

          if (noteConfidence > 15) {
            setDetectedNote(note)
            setConfidence(noteConfidence)

            // 🔵 Check if this note is different from the previous one, then save it
            setLastValidNote((prevNote) => {
              // Only update history if it's a completely new note name (e.g., changing from C4 to E4)
              if (!prevNote || prevNote.displayName !== note.displayName) {
                setNoteHistory((prevHistory) => {
                  const newHistory = [note, ...prevHistory]
                  return newHistory.slice(0, 7) // Strictly keep only the last 7 notes
                })
              }
              return note
            })
          } else {
            setDetectedNote(null)
            setConfidence(0)
          }
        } else {
          setDetectedNote(null)
          setConfidence(0)
        }
      } else {
        setDetectedNote(null)
        setConfidence(0)
      }
    }

    if (isListening) {
      animationIdRef.current = requestAnimationFrame(analyzeAudio)
    }
    if (running) {
      animationIdRef.current = requestAnimationFrame(() => analyzeAudio(true))
    }
  }

  // const stopListening = () => {
  //   setIsListening(false)
  //   if (animationIdRef.current) {
  //     cancelAnimationFrame(animationIdRef.current)
  //   }
  //   cleanupAudio()
  // }

  const resetSession = () => {
    stopListening()
    setDetectedNote(null)
    setLastValidNote(null)
    setNoteHistory([]) // 🧹 Clear out your history list here
    setFrequency(null)
    setConfidence(0)
    setError(null)
    setAudioLevel(0)
    setIsSessionActive(false)
    silenceCountRef.current = 0
  }

  const cleanup = () => {
    cleanupAudio()
  }

  useEffect(() => {
    return cleanup
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
          Voice Note Detector
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Sing or play a note and detect its pitch
        </p>

        {/* Listening Indicator */}
        <div className="mb-6 flex items-center justify-center">
          {isListening ? (
            <div className="flex items-center gap-2 bg-green-100 border-2 border-green-500 rounded-full px-4 py-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-700 font-bold text-sm">
                🎤 Actively Listening
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-gray-100 border-2 border-gray-400 rounded-full px-4 py-2">
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              <span className="text-gray-600 font-bold text-sm">⏸ Standby</span>
            </div>
          )}
        </div>

        {/* Microphone Permission Status */}
        <div className="mb-6 p-4 bg-gray-100 rounded-lg space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              Microphone Permission:{" "}
              <span
                className={
                  permission === "granted"
                    ? "text-green-600 font-bold"
                    : "text-red-600 font-bold"
                }
              >
                {permission === "granted"
                  ? "✓ Granted"
                  : permission === "denied"
                    ? "✗ Denied"
                    : "⚠ Not Requested"}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={enumerateMicDevices}
                disabled={isEnumerating}
                className="bg-slate-600 hover:bg-slate-700 disabled:bg-gray-400 text-white font-semibold py-2 px-3 rounded-lg transition-colors"
              >
                {isEnumerating ? "Detecting mic..." : "Select Default Mic"}
              </button>

              <button
                onClick={() => setDebugMode((d) => !d)}
                type="button"
                aria-pressed={debugMode}
                className={`py-2 px-3 rounded-lg font-semibold transition-colors border ${
                  debugMode
                    ? "bg-yellow-600 text-black border-yellow-700"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                {debugMode ? "Debug: On" : "Debug: Off"}
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Selected device:{" "}
            <span className="font-semibold">{selectedDeviceLabel}</span>
          </p>
          {micDevices.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Choose microphone
              </label>
              <select
                value={selectedDeviceId}
                onChange={handleDeviceChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              >
                {micDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Mic volume boost:{" "}
              <span className="font-semibold">{gainValue.toFixed(1)}x</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.1"
              value={gainValue}
              onChange={handleGainChange}
              className="w-full"
            />
          </div>

          {/* 📘 Expandable User Guide Accordion */}
          <div className="mt-6 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setIsGuideOpen(!isGuideOpen)}
              className="w-full flex items-center justify-between py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors outline-none cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span>📖</span>
                <span>How to Use This App</span>
              </div>
              <span
                className={`transform transition-transform duration-200 ${isGuideOpen ? "rotate-180" : ""}`}
              >
                ▼
              </span>
            </button>

            {isGuideOpen && (
              <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-4 max-h-80 overflow-y-auto animate-fade-in">
                <div>
                  <p className="font-bold text-slate-800 mb-1">
                    🎛️ 1. Getting Started & Controls
                  </p>
                  <p className="pl-4 leading-relaxed">
                    Click{" "}
                    <strong className="text-slate-700">Start Listening</strong>{" "}
                    and allow microphone permissions. Sing or hum a steady tone
                    near your mic. Use{" "}
                    <strong className="text-slate-700">Stop</strong> to pause or{" "}
                    <strong className="text-slate-700">Reset Session</strong> to
                    wipe clean.
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-800 mb-1">
                    🎙️ 2. Pitch Detection & Memory
                  </p>
                  <p className="pl-4 leading-relaxed">
                    The app measures your vocal frequency in Hertz (Hz) and
                    calculates your{" "}
                    <strong className="text-slate-700">
                      Tuning Deviation Cents
                    </strong>{" "}
                    (how sharp + or flat - you are). Your last sung note locks
                    on screen permanently even when you stop humming.
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-800 mb-1">
                    🎹 3. Interactive Piano Visualizer
                  </p>
                  <p className="pl-4 leading-relaxed">
                    Keys light up automatically to match your voice (
                    <span className="text-indigo-600 font-bold">Indigo</span>{" "}
                    for natural notes,{" "}
                    <span className="text-amber-600 font-bold">Amber</span> for
                    sharps/flats).{" "}
                    <strong className="text-slate-700">Click any key</strong> to
                    play a pure 0.8-second audio tone to find your starting
                    pitch.
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-800 mb-1">
                    🎼 4. 7-Note Performance History
                  </p>
                  <p className="pl-4 leading-relaxed">
                    The list logs transitions when you move to a completely new
                    note name. Your absolute latest note (
                    <strong className="text-indigo-600">#1</strong>) is
                    highlighted at the top, and older notes cascade downwards up
                    to a max of 7.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Note Display Container */}
        <div className="my-8 p-6 bg-indigo-50 border border-indigo-100 rounded-2xl text-center shadow-inner">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-500 mb-1">
            {isListening && audioLevel >= 3
              ? "🎤 Detecting Tone..."
              : "💾 Last Captured Note"}
          </p>

          <h2 className="text-6xl font-extrabold text-indigo-900 my-2 tracking-tighter">
            {/* 🔵 Make sure this says lastValidNote, NOT detectedNote */}
            {lastValidNote ? lastValidNote.displayName : "—"}
          </h2>

          {lastValidNote ? (
            <div className="mt-3 space-y-1">
              <p className="text-sm font-medium text-gray-700">
                Frequency:{" "}
                <span className="font-mono font-bold text-indigo-700">
                  {Math.round(lastValidNote.frequency)} Hz
                </span>
              </p>
              <p className="text-xs text-gray-500">
                Tuning Dev:{" "}
                <span
                  className={`font-bold ${Math.abs(lastValidNote.cents) < 10 ? "text-green-600" : "text-amber-600"}`}
                >
                  {lastValidNote.cents > 0
                    ? `+${Math.round(lastValidNote.cents)}`
                    : Math.round(lastValidNote.cents)}{" "}
                  cents
                </span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic mt-2">
              Hum a steady note to lock it here
            </p>
          )}
        </div>

        {/* 🎹 Real-Time Piano Keyboard Visualizer */}
        {/* 🎹 Interactive Piano Keyboard Visualizer */}
        <div className="my-6 p-4 bg-slate-900 rounded-2xl shadow-xl border border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 text-center">
            🎹 Virtual Pitch Board Visualizer
          </p>
          <p className="text-[9px] text-slate-500 text-center mb-3">
            Click any key to hear a reference tuning tone
          </p>

          <div className="relative flex justify-center h-28 bg-slate-950 p-2 rounded-xl overflow-x-auto select-none">
            {PIANO_KEYS.map((key, i) => {
              const keyId = `${key.name}${key.octave}`
              const isActive =
                lastValidNote && lastValidNote.displayName === keyId

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => playReferenceTone(key.name, key.octave)}
                  className={`relative transition-all duration-150 cursor-pointer outline-none ${
                    key.isBlack
                      ? "w-6 h-16 bg-slate-800 border border-slate-950 z-10 -mx-3 rounded-b-md active:bg-slate-700"
                      : "w-9 h-24 bg-white border border-slate-200 rounded-b-lg active:bg-slate-100"
                  } ${
                    isActive
                      ? key.isBlack
                        ? "!bg-amber-400 border-amber-500 shadow-[0_0_12px_rgba(251,191,36,0.6)]"
                        : "!bg-indigo-500 border-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.5)] z-0"
                      : ""
                  }`}
                >
                  {/* Label white keys subtly at the bottom */}
                  {!key.isBlack && (
                    <span
                      className={`absolute bottom-1 left-0 right-0 text-center text-[9px] font-bold font-mono transition-colors pointer-events-none ${
                        isActive ? "text-white" : "text-slate-400"
                      }`}
                    >
                      {keyId}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 📜 Note History List Container */}
        {noteHistory.length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-2xl shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 text-center">
              🎼 Recent Note History (Last 7)
            </p>
            <div className="flex flex-col gap-2">
              {noteHistory.map((histNote, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    index === 0
                      ? "bg-indigo-600 border-indigo-700 text-white font-bold scale-[1.02] shadow-sm"
                      : "bg-white border-gray-100 text-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded-md ${index === 0 ? "bg-indigo-700 text-white" : "bg-gray-100 text-gray-500"}`}
                    >
                      #{index + 1}
                    </span>
                    <span className="text-lg tracking-tight font-black">
                      {histNote.displayName}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-mono ${index === 0 ? "text-indigo-200" : "text-gray-400"}`}
                  >
                    {Math.round(histNote.frequency)} Hz
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Notification Alert */}
        {error && !lastValidNote && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm text-center font-medium animate-fade-in">
            {error}
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={startListening}
            disabled={isListening}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            {isListening ? "Listening..." : "Start"}
          </button>
          <button
            onClick={stopListening}
            disabled={!isListening}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Stop
          </button>
          {isSessionActive && !isListening && (
            <button
              onClick={resetSession}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        {/* Detected Note Display */}
        {error && (
          <div className="bg-red-50 border-2 border-red-400 rounded-lg p-6 text-center mb-4">
            <p className="text-red-700 font-semibold">{error}</p>
            <p className="text-sm text-red-600 mt-2">
              Audio Level: {audioLevel}%
            </p>
          </div>
        )}

        {detectedNote && !isListening && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-400 rounded-lg p-6 text-center mb-4">
            <p className="text-sm text-green-600 mb-2">✓ Detected Note</p>
            <p className="text-5xl font-bold mb-4 text-green-700">
              {detectedNote.displayName}
            </p>
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                <span className="font-semibold">Frequency:</span>{" "}
                {detectedNote.frequency.toFixed(1)} Hz
              </p>
              <p>
                <span className="font-semibold">Cents Off:</span>{" "}
                {detectedNote.cents.toFixed(1)} cents
              </p>
              <p>
                <span className="font-semibold">Confidence:</span>{" "}
                <span
                  className={
                    confidence > 80 ? "text-green-600" : "text-orange-600"
                  }
                >
                  {confidence}%
                </span>
              </p>
            </div>
            <div className="mt-4 w-full bg-gray-300 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-green-600"
                style={{ width: `${confidence}%` }}
              ></div>
            </div>
          </div>
        )}

        {detectedNote && isListening && (
          <div className="border-2 rounded-lg p-6 text-center mb-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-400">
            <p className="text-sm text-gray-600 mb-2">🎤 Detected Note</p>
            <p className="text-5xl font-bold mb-4" style={{ color: "#059669" }}>
              {detectedNote.displayName}
            </p>

            <div className="space-y-2 text-sm text-gray-700">
              <p>
                <span className="font-semibold">Frequency:</span>{" "}
                {detectedNote.frequency.toFixed(1)} Hz
              </p>
              <p>
                <span className="font-semibold">Cents Off:</span>{" "}
                {detectedNote.cents.toFixed(1)} cents
              </p>
              <p>
                <span className="font-semibold">Confidence:</span>{" "}
                <span
                  className={
                    confidence > 80 ? "text-green-600" : "text-orange-600"
                  }
                >
                  {confidence}%
                </span>
              </p>
              <p>
                <span className="font-semibold">Audio Level:</span> {audioLevel}
                %
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${audioLevel}%` }}
                ></div>
              </div>
              <p className="text-xs text-slate-500">
                Mic level shows how much sound the detector is receiving.
              </p>
              {audioLevel < 30 && (
                <p className="text-xs text-red-600">
                  Low mic level detected — speak louder or move closer to the
                  mic for better pitch detection.
                </p>
              )}
            </div>

            <div className="mt-4 w-full bg-gray-300 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-green-600 transition-all duration-200"
                style={{ width: `${confidence}%` }}
              ></div>
            </div>
          </div>
        )}

        {!detectedNote && isListening && !error && (
          <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-6 text-center mb-4">
            <p className="text-gray-700 font-semibold">
              Listening... Sing or play a note
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Audio Level: {audioLevel}%
            </p>
            <div className="mt-4 w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-200 ${
                  audioLevel > 60
                    ? "bg-emerald-500"
                    : audioLevel > 30
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${audioLevel}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Aim for a strong mic level before singing so the detector can lock
              in notes.
            </p>
            {audioLevel < 30 && (
              <p className="text-xs text-red-600 mt-2">
                Mic level is too low right now — increase volume or move the mic
                closer.
              </p>
            )}
            <div className="mt-4 flex gap-1 justify-center">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-1 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s` }}
                ></div>
              ))}
            </div>
          </div>
        )}

        {!isSessionActive && (
          <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-6 text-center mb-4">
            <p className="text-gray-600 font-semibold">
              👂 Press Start and sing a note to begin
            </p>
          </div>
        )}

        {isSessionActive && !isListening && !detectedNote && !error && (
          <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-6 text-center">
            <p className="text-orange-700 font-semibold">⏸ Recording Stopped</p>
            <p className="text-sm text-orange-600 mt-2">
              No note was detected. Try again or check your microphone.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
