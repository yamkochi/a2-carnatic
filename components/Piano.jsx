"use client"
import { useEffect, useRef, useState } from "react"

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

const SWARAM_MAP = {
  S: 1,
  R1: 2,
  R2: 3,
  R3: 4,
  G1: 3,
  G2: 4,
  G3: 5,
  M1: 6,
  M2: 7,
  P: 8,
  D1: 9,
  D2: 10,
  D3: 11,
  N1: 10,
  N2: 11,
  N3: 12,
}

const KEYBOARD_KEY_MAP = {
  a: 0,
  s: 2,
  d: 4,
  f: 5,
  g: 7,
  h: 9,
  j: 11,
  k: 12,
  l: 14,
  ";": 16,
  w: 1,
  e: 3,
  t: 6,
  y: 8,
  u: 10,
  o: 13,
  p: 15,
}

function noteFrequency(noteIndex) {
  const midi = 60 + noteIndex
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export default function Piano() {
  const [tone, setTone] = useState("sine")
  const [startIndex, setStartIndex] = useState(0)
  const [labels, setLabels] = useState(Array(24).fill(""))
  const [activeKey, setActiveKey] = useState(null)
  const [playbackSpeed, setPlaybackSpeed] = useState(500)
  const [isPlayingSequence, setIsPlayingSequence] = useState(false)
  const [showHighlight, setShowHighlight] = useState(true)
  const [volume, setVolume] = useState(0.2)
  const [tanpuraTuning, setTanpuraTuning] = useState("Pa")
  const [continuousDrone, setContinuousDrone] = useState(false)
  const [octaveShift, setOctaveShift] = useState(0)
  const [releaseTime, setReleaseTime] = useState(0.1)
  const [droneVolume, setDroneVolume] = useState(0.08)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const audioCtxRef = useRef(null)
  const audioRef = useRef(null)
  const [songUrl, setSongUrl] = useState(null)
  // ADDED: Track the active raga object to enable dynamic root note shifting
  const [currentRaga, setCurrentRaga] = useState(null)

  const sequenceTimeoutRefs = useRef([])
  const droneIntervalRef = useRef(null)
  const liveVoiceRegistryRef = useRef({})

  // 1. Structural window event hook pipeline
  useEffect(() => {
    const catchRagaEvent = (e) => {
      stopSequence()
      if (e?.detail) {
        setCurrentRaga(e.detail)
      }
    }

    window.addEventListener("raga-selected", catchRagaEvent)

    const handleKeyDown = (e) => {
      if (e.repeat) return
      const key = e.key.toLowerCase()
      if (KEYBOARD_KEY_MAP[key] !== undefined) playKey(KEYBOARD_KEY_MAP[key])
    }
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase()
      if (KEYBOARD_KEY_MAP[key] !== undefined)
        stopKeySound(KEYBOARD_KEY_MAP[key])
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("raga-selected", catchRagaEvent)
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      stopSequence()
      stopContinuousDrone()
      killAllActiveVoices()
    }
  }, [tone, tanpuraTuning, volume, releaseTime]) // Removed startIndex dependency here

  // 2. FIXED: Dynamic calculation loop that recalculates swaram layouts
  // This triggers automatically whenever a new raga is picked OR the root note changes!
  useEffect(() => {
    if (!currentRaga) {
      setLabels(Array(24).fill(""))
      setSongUrl(null)
      return
    }

    const tokens = (currentRaga.swaram || "").trim().split(/\s+/)
    const updatedPositions = Array.from({ length: 24 }, () => [])

    tokens.forEach((token) => {
      const naturalSwaramOffset = SWARAM_MAP[token]
      if (!naturalSwaramOffset) return

      // Shift the target key index calculation relative to our dynamic root note choice
      const absoluteTargetKeyIndex = naturalSwaramOffset - 1 + startIndex

      // Place the swaram label in the primary octave
      if (absoluteTargetKeyIndex >= 0 && absoluteTargetKeyIndex < 24) {
        updatedPositions[absoluteTargetKeyIndex].push(token)
      }

      // Mirror the swaram label into the upper octave if it fits inside our 24-key hardware window
      const highOctaveKeyIndex = absoluteTargetKeyIndex + 12
      if (highOctaveKeyIndex >= 0 && highOctaveKeyIndex < 24) {
        updatedPositions[highOctaveKeyIndex].push(token)
      }
    })

    // Map label arrays into flat strings
    const finalLabelsStringArray = updatedPositions.map((arr) => arr.join(", "))
    setLabels(finalLabelsStringArray)

    // Manage audio tracking states safely
    const targetUrl = currentRaga.song_path
      ? `/api/songs/${encodeURIComponent(currentRaga.song_path)}`
      : null
    setSongUrl(targetUrl)

    if (audioRef.current) {
      audioRef.current.pause()
      if (targetUrl) {
        audioRef.current.src = targetUrl
        audioRef.current.load()
      } else {
        audioRef.current.src = ""
      }
    }
  }, [currentRaga, startIndex]) // 👈 CRITICAL: Recalculates whenever root note choice shifts!

  // Legacy fallback placeholder function to prevent event errors
  function handleRaga(e) {
    // Left empty since our fresh useEffect now safely handles everything dynamically above
  }

  function killAllActiveVoices() {
    const now = audioCtxRef.current ? audioCtxRef.current.currentTime : 0
    Object.keys(liveVoiceRegistryRef.current).forEach((keyIndex) => {
      const voiceNodes = liveVoiceRegistryRef.current[keyIndex]
      if (voiceNodes) {
        voiceNodes.forEach(({ osc, gain }) => {
          try {
            gain.gain.cancelScheduledValues(now)
            osc.stop(now)
          } catch (e) {}
        })
      }
    })
    liveVoiceRegistryRef.current = {}
  }

  function playKey(index, customDuration = null) {
    if (index < 0 || index >= 24) return
    const semitoneOffset = startIndex + index + octaveShift
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (
        window.AudioContext || window.webkitAudioContext
      )()
    }
    const ctx = audioCtxRef.current
    if (ctx.state === "suspended") ctx.resume()

    const now = ctx.currentTime
    stopKeySound(index)

    setActiveKey(index)
    if (customDuration) {
      const visualDuration = Math.min(customDuration * 1000, 150)
      setTimeout(
        () => setActiveKey((prev) => (prev === index ? null : prev)),
        visualDuration,
      )
    }

    const baseFreq = noteFrequency(semitoneOffset)
    const currentNodes = []

    if (tone === "tanpura") {
      const duration = customDuration || 999
      const node1 = createTanpuraStringNode(
        ctx,
        baseFreq,
        droneVolume,
        now,
        duration,
        "sawtooth",
        0.08,
      )
      currentNodes.push(node1)

      const node2 = createTanpuraStringNode(
        ctx,
        baseFreq / 2,
        droneVolume * 0.6,
        now,
        duration,
        "triangle",
        0.05,
      )
      currentNodes.push(node2)

      let droneMultiplier = 1.5
      if (tanpuraTuning === "Ma") droneMultiplier = 4 / 3
      if (tanpuraTuning === "Ni") droneMultiplier = 15 / 8

      const node3 = createTanpuraStringNode(
        ctx,
        baseFreq * droneMultiplier,
        droneVolume * 0.4,
        now,
        duration,
        "sine",
        0.02,
      )
      currentNodes.push(node3)
    } else {
      const duration = customDuration || 999
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()
      osc.type = tone
      osc.frequency.setValueAtTime(baseFreq, now)

      gainNode.gain.setValueAtTime(0.0001, now)
      gainNode.gain.exponentialRampToValueAtTime(volume, now + 0.01)

      osc.connect(gainNode)
      gainNode.connect(ctx.destination)
      osc.start(now)

      if (customDuration) {
        gainNode.gain.setValueAtTime(volume, now + duration - releaseTime)
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration)
        osc.stop(now + duration + 0.01)
      }

      currentNodes.push({ osc, gain: gainNode })
    }

    liveVoiceRegistryRef.current[index] = currentNodes
  }

  function stopKeySound(index) {
    if (!audioCtxRef.current) return
    const ctx = audioCtxRef.current
    const now = ctx.currentTime
    const voiceNodes = liveVoiceRegistryRef.current[index]

    if (voiceNodes) {
      voiceNodes.forEach(({ osc, gain }) => {
        try {
          gain.gain.cancelScheduledValues(now)
          gain.gain.setValueAtTime(gain.gain.value, now)
          gain.gain.linearRampToValueAtTime(0.0001, now + releaseTime)
          osc.stop(now + releaseTime + 0.02)
        } catch (e) {}
      })
      delete liveVoiceRegistryRef.current[index]
    }
    setActiveKey((prev) => (prev === index ? null : prev))
  }

  function createTanpuraStringNode(
    ctx,
    frequency,
    maxVolume,
    startTime,
    duration,
    type,
    detuneValue,
  ) {
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(frequency, startTime)
    osc.frequency.linearRampToValueAtTime(
      frequency + detuneValue,
      startTime + duration,
    )

    gainNode.gain.setValueAtTime(0.0001, startTime)
    gainNode.gain.linearRampToValueAtTime(maxVolume, startTime + 0.1)

    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    osc.start(startTime)

    if (duration < 50) {
      gainNode.gain.setValueAtTime(maxVolume, startTime + duration - 0.2)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
      osc.stop(startTime + duration + 0.01)
    }

    return { osc, gain: gainNode }
  }

  function startContinuousDrone() {
    stopContinuousDrone()
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (
        window.AudioContext || window.webkitAudioContext
      )()
    }
    const ctx = audioCtxRef.current
    if (ctx.state === "suspended") ctx.resume()

    const loopDuration = 4.0
    const overlapTime = 1.5
    const scheduleInterval = (loopDuration - overlapTime) * 1000

    // FIXED: Natively captures the active shifted Root Note frequency
    const rootFreq = noteFrequency(startIndex + octaveShift)

    function playDronePulse() {
      if (!audioCtxRef.current) return
      const now = audioCtxRef.current.currentTime

      // FIXED: Maps maximum volume strictly to your active 'droneVolume' slider state
      createTanpuraStringNode(
        ctx,
        rootFreq,
        droneVolume,
        now,
        loopDuration,
        "sawtooth",
        0.08,
      )
      createTanpuraStringNode(
        ctx,
        rootFreq / 2,
        droneVolume * 0.6,
        now,
        loopDuration,
        "triangle",
        0.05,
      )

      let droneMultiplier = 1.5
      if (tanpuraTuning === "Ma") droneMultiplier = 4 / 3
      if (tanpuraTuning === "Ni") droneMultiplier = 15 / 8

      createTanpuraStringNode(
        ctx,
        rootFreq * droneMultiplier,
        droneVolume * 0.4,
        now,
        loopDuration,
        "sine",
        0.02,
      )
    }

    playDronePulse()
    droneIntervalRef.current = setInterval(playDronePulse, scheduleInterval)
  }

  function stopContinuousDrone() {
    if (droneIntervalRef.current) {
      clearInterval(droneIntervalRef.current)
      droneIntervalRef.current = null
    }
  }

  function playSequence() {
    if (isPlayingSequence) {
      stopSequence()
      return
    }
    setIsPlayingSequence(true)

    const activeIndices = []
    labels.forEach((lbl, idx) => {
      if (lbl !== "") activeIndices.push(idx)
    })

    if (activeIndices.length === 0) {
      setIsPlayingSequence(false)
      return
    }

    const forwardScale = activeIndices.slice(0, 8)
    const reverseScale = [...forwardScale].reverse()
    const fullMelodyLoop = [...forwardScale, ...reverseScale]

    let step = 0
    function runNextStep() {
      if (step >= fullMelodyLoop.length) {
        setIsPlayingSequence(false)
        return
      }
      const keyIndex = fullMelodyLoop[step]
      const durationSeconds = playbackSpeed / 1000

      playKey(keyIndex, durationSeconds)
      step++

      const timeoutId = setTimeout(runNextStep, playbackSpeed)
      sequenceTimeoutRefs.current.push(timeoutId)
    }

    runNextStep()
  }

  function stopSequence() {
    setIsPlayingSequence(false)
    sequenceTimeoutRefs.current.forEach((id) => clearTimeout(id))
    sequenceTimeoutRefs.current = []
    killAllActiveVoices()
  }

  // Structural arrays to map layouts of standard keys
  const WHITE_KEY_INDICES = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23]
  const BLACK_KEY_MAP = {
    0: 1, // C# overlay right of C
    2: 3, // D# overlay right of D
    5: 6, // F# overlay right of F
    7: 8, // G# overlay right of G
    9: 10, // A# overlay right of A
    12: 13, // High C#
    14: 15, // High D#
    17: 18, // High F#
    19: 20, // High G#
    21: 22, // High A#
  }

  const scrollContainerRef = useRef(null)

  // Automatically slides the viewport window horizontally when the Root note shifts
  useEffect(() => {
    if (scrollContainerRef.current) {
      // Find where our selected root note lives on the physical keyboard layout
      const targetWhiteKeyIndex = WHITE_KEY_INDICES.indexOf(
        WHITE_KEY_INDICES.find((idx) => idx >= startIndex) || 0,
      )

      if (targetWhiteKeyIndex !== -1) {
        const keyWidthEstimate = 53 // Accurate horizontal spacing weight per key element
        const calculateScrollOffset = targetWhiteKeyIndex * keyWidthEstimate

        // Smoothly scroll the view to bring the selected root note to the left edge
        scrollContainerRef.current.scrollTo({
          left: calculateScrollOffset,
          behavior: "smooth",
        })
      }
    }
  }, [startIndex])
  // EFFECT 1: Automatically updates the drone pitch whenever Root Note or Tuning shifts
  useEffect(() => {
    if (continuousDrone && tone === "tanpura") {
      startContinuousDrone()
    }
  }, [startIndex, tanpuraTuning, octaveShift])

  // EFFECT 2: Automatically updates the drone volume in real-time when you drag the slider
  useEffect(() => {
    if (continuousDrone && tone === "tanpura") {
      startContinuousDrone()
    }
  }, [droneVolume])

  return (
    <div className="mt-4 p-3 md:p-4 bg-black rounded-xl shadow-2xl select-none w-full max-w-full overflow-hidden">
      {/* Responsive Control Panel Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap items-center gap-4 md:gap-6 mb-6 text-white bg-blue-800 p-3 md:p-4 rounded-lg">
        <div className="flex items-center justify-between md:justify-start gap-2 w-full md:w-auto">
          <label className="text-xs uppercase tracking-wider text-white font-bold">
            Tone
          </label>
          <select
            value={tone}
            onChange={(e) => {
              const selectedTone = e.target.value
              setTone(selectedTone)

              // Direct user click context securely unblocks browser audio engine rules
              if (selectedTone === "tanpura" && continuousDrone) {
                setTimeout(() => startContinuousDrone(), 30)
              } else {
                stopContinuousDrone()
              }
            }}
            className="bg-gray-700 text-white border border-gray-600 px-3 py-1.5 rounded text-sm focus:outline-none focus:border-indigo-500 w-2/3 md:w-auto"
          >
            <option value="sine">Sine</option>
            <option value="square">Square</option>
            <option value="sawtooth">Sawtooth</option>
            <option value="triangle">Triangle</option>
            <option value="tanpura">🎻 Tanpura Drone</option>
          </select>
        </div>

        <div className="flex items-center justify-between md:justify-start gap-2 w-full md:w-auto md:border-l md:border-gray-700 md:pl-4">
          <label className="text-xs uppercase tracking-wider text-white font-bold">
            Root
          </label>
          <select
            value={startIndex}
            onChange={(e) => setStartIndex(parseInt(e.target.value))}
            className="bg-gray-700 text-white border border-gray-600 px-3 py-1.5 rounded text-sm focus:outline-none focus:border-indigo-500 w-2/3 md:w-auto"
          >
            {CHROMATIC.map((n, i) => (
              <option key={n} value={i}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {tone === "tanpura" && (
          <>
            <div className="flex items-center justify-between md:justify-start gap-2 w-full md:w-auto md:border-l md:border-gray-700 md:pl-4 transition-all">
              <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">
                Drone Tuning
              </label>
              <select
                value={tanpuraTuning}
                onChange={(e) => setTanpuraTuning(e.target.value)}
                className="bg-gray-700 text-white border border-gray-600 px-3 py-1.5 rounded text-sm focus:outline-none focus:border-indigo-500 w-2/3 md:w-auto"
              >
                <option value="Pa">Pa (Perfect 5th)</option>
                <option value="Ma">Ma (Perfect 4th)</option>
                <option value="Ni">Ni (Major 7th)</option>
              </select>
            </div>

            <div className="flex items-center justify-between md:justify-start gap-2 w-full md:w-auto md:border-l md:border-gray-700 md:pl-4 transition-all">
              <label
                className="text-xs uppercase tracking-wider text-gray-400 font-bold cursor-pointer select-none"
                htmlFor="drone-toggle"
              >
                Auto Drone
              </label>
              <input
                id="drone-toggle"
                type="checkbox"
                checked={continuousDrone}
                onChange={(e) => {
                  const isChecked = e.target.checked
                  setContinuousDrone(isChecked)

                  // Direct user click context securely unblocks browser audio engine rules
                  if (isChecked && tone === "tanpura") {
                    setTimeout(() => startContinuousDrone(), 30)
                  } else {
                    stopContinuousDrone()
                  }
                }}
                className="w-5 h-5 rounded accent-indigo-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between md:justify-start gap-2 w-full md:w-auto md:border-l md:border-gray-700 md:pl-4 transition-all">
              <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">
                Drone Vol
              </label>
              <input
                type="range"
                min="0"
                max="0.4"
                step="0.01"
                value={droneVolume}
                onChange={(e) => setDroneVolume(parseFloat(e.target.value))}
                className="w-32 md:w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </>
        )}

        <div className="flex items-center justify-between md:justify-start gap-2 w-full md:w-auto md:border-l md:border-gray-700 md:pl-4">
          <label className="text-xs uppercase tracking-wider text-white font-bold">
            Octave
          </label>
          <select
            value={octaveShift}
            onChange={(e) => setOctaveShift(parseInt(e.target.value))}
            className="bg-gray-700 text-white border border-gray-600 px-3 py-1.5 rounded text-sm focus:outline-none focus:border-indigo-500 w-2/3 md:w-auto"
          >
            <option value={-12}>Low (Mandra Sthayi)</option>
            <option value={0}>Middle (Madhya Sthayi)</option>
            <option value={12}>High (Tara Sthayi)</option>
          </select>
        </div>

        <div className="flex items-center justify-between md:justify-start gap-2 w-full md:w-auto md:border-l md:border-gray-700 md:pl-4">
          <label className="text-xs uppercase tracking-wider text-white font-bold">
            Volume
          </label>
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-32 md:w-24 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        <div className="flex items-center justify-between md:justify-start gap-2 w-full md:w-auto md:border-l md:border-gray-700 md:pl-4">
          <label className="text-xs uppercase tracking-wider text-white font-bold">
            Release
          </label>
          <input
            type="range"
            min="0.02"
            max="1.0"
            step="0.02"
            value={releaseTime}
            onChange={(e) => setReleaseTime(parseFloat(e.target.value))}
            className="w-32 md:w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>

        <div className="flex items-center justify-between md:justify-start gap-2 w-full md:w-auto md:border-l md:border-gray-700 md:pl-4">
          <label className="text-xs uppercase tracking-wider text-white font-bold">
            Speed
          </label>
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseInt(e.target.value))}
            className="bg-gray-700 text-white border border-gray-600 px-3 py-1.5 rounded text-sm focus:outline-none focus:border-indigo-500 w-2/3 md:w-auto"
          >
            <option value={1000}>1 sec / note</option>
            <option value={500}>1/2 sec / note</option>
            <option value={250}>1/4 sec / note</option>
          </select>
        </div>

        <div className="flex items-center justify-between md:justify-start gap-2 w-full md:w-auto md:border-l md:border-gray-700 md:pl-4">
          <label
            className="text-xs uppercase tracking-wider text-white font-bold cursor-pointer select-none"
            htmlFor="guide-toggle"
          >
            Scale Guide
          </label>
          <input
            id="guide-toggle"
            type="checkbox"
            checked={showHighlight}
            onChange={(e) => setShowHighlight(e.target.checked)}
            className="w-5 h-5 rounded accent-emerald-500 cursor-pointer"
          />
        </div>

        <button
          onClick={playSequence}
          className={`w-full md:w-auto px-4 py-2 md:py-1.5 rounded text-sm font-bold tracking-wide uppercase transition-colors duration-150 order-first md:order-none
            ${isPlayingSequence ? "bg-red-600 text-white hover:bg-red-700 animate-pulse" : "bg-emerald-600 text-white hover:bg-emerald-500"}`}
        >
          {isPlayingSequence ? "■ Stop Sequence" : "▶ Play Sequence"}
        </button>

        <div
          className={`w-full md:w-auto md:ml-auto bg-gray-800 p-1 rounded-lg border border-gray-700 flex items-center justify-center shadow-md ${!songUrl ? "opacity-30 pointer-events-none" : ""}`}
        >
          <audio
            controls
            preload="auto"
            src={songUrl || ""}
            ref={audioRef}
            className="h-9 w-full sm:w-64 block accent-emerald-500 rounded"
          />
        </div>
      </div>

      {/* Touch-Friendly Swipeable Piano Keyboard Container Wrapper */}
      {/* PIANO INTERFACE CONTAINER */}
      <div
        ref={scrollContainerRef}
        className="w-full overflow-x-auto touch-pan-x pb-4 pt-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800"
      >
        <div className="flex relative bg-gray-950 p-3 rounded-xl border border-gray-800 h-64 min-w-[950px] select-none">
          {WHITE_KEY_INDICES.map((whiteIndex) => {
            const blackIndex = BLACK_KEY_MAP[whiteIndex]

            const westernWhiteName = CHROMATIC[whiteIndex % 12]
            const westernBlackName =
              blackIndex !== undefined ? CHROMATIC[blackIndex % 12] : ""

            // Operational evaluation checks to see if this key is part of the raga scale guide
            const isWhiteGuided = showHighlight && labels[whiteIndex]
            const isBlackGuided =
              blackIndex !== undefined && showHighlight && labels[blackIndex]

            return (
              <div
                key={`white-wrapper-${whiteIndex}`}
                className="relative flex-1 min-w-[45px] max-w-[60px] h-full"
              >
                {/* White Key Rendering Layer */}
                <div
                  onMouseDown={() => playKey(whiteIndex)}
                  onMouseUp={() => stopKeySound(whiteIndex)}
                  onMouseLeave={() => stopKeySound(whiteIndex)}
                  onTouchStart={(e) => {
                    e.preventDefault()
                    playKey(whiteIndex)
                  }}
                  onTouchEnd={() => stopKeySound(whiteIndex)}
                  className={`w-full h-full border-r border-l border-gray-300 rounded-b-md flex flex-col justify-between items-center pt-2 pb-4 cursor-pointer select-none transition-all duration-75
                    ${
                      activeKey === whiteIndex
                        ? "bg-gray-100 translate-y-[3px] shadow-none border-b-[1px] border-t border-t-gray-400"
                        : isWhiteGuided
                          ? "bg-amber-100 shadow-[0_4px_0_rgba(0,0,0,0.15)] border-b-[6px] border-b-amber-500"
                          : "bg-white shadow-[0_4px_0_rgba(0,0,0,0.15)] border-b-[5px] border-b-gray-200"
                    }`}
                >
                  {/* Fixed Western Key Label in a square badge */}
                  <div className="w-6 h-6 rounded bg-gray-100 border border-gray-300 flex items-center justify-center shadow-sm pointer-events-none">
                    <span className="text-[10px] font-black text-gray-800 tracking-tighter">
                      {westernWhiteName}
                    </span>
                  </div>

                  {/* Carnatic Swaram Label in a circular badge */}
                  {labels[whiteIndex] ? (
                    <div className="w-7 h-7 rounded-full bg-white border border-gray-300 flex items-center justify-center shadow-sm pointer-events-none animate-fade-in">
                      <span className="text-xs font-black text-black tracking-tighter text-center truncate px-0.5">
                        {labels[whiteIndex]}
                      </span>
                    </div>
                  ) : (
                    <div className="h-7 w-7 pointer-events-none" />
                  )}
                </div>

                {/* Overlaid Layer: Black accidental keys anchored to relative parent spaces */}
                {blackIndex !== undefined && (
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      playKey(blackIndex)
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation()
                      stopKeySound(blackIndex)
                    }}
                    onMouseLeave={() => stopKeySound(blackIndex)}
                    onTouchStart={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      playKey(blackIndex)
                    }}
                    onTouchEnd={() => stopKeySound(blackIndex)}
                    style={{
                      left: "100%",
                      transform: "translateX(-50%)",
                    }}
                    className={`absolute top-0 w-7 border-l border-r rounded-b shadow-md z-20 cursor-pointer flex flex-col justify-between items-center pt-2 pb-3 transition-all duration-75 h-36
                      ${
                        activeKey === blackIndex
                          ? "bg-sky-500 border-b border-b-sky-600 translate-y-[2px] shadow-none"
                          : isBlackGuided
                            ? "bg-sky-400 border-b-[6px] border-b-sky-600 border-l-sky-500 border-r-sky-500 shadow-md"
                            : "bg-gray-900 border-b-[4px] border-b-gray-950 border-black"
                      }`}
                  >
                    {/* Fixed Western Key Label in a square badge offset higher */}
                    <div className="w-5 h-5 rounded bg-gray-200 border border-gray-400 flex items-center justify-center shadow-sm pointer-events-none -mt-1">
                      <span className="text-[9px] font-black text-gray-900 tracking-tighter">
                        {westernBlackName}
                      </span>
                    </div>

                    {/* Carnatic Swaram Label in a circular badge */}
                    {labels[blackIndex] ? (
                      <div className="w-[22px] h-[22px] rounded-full bg-white flex items-center justify-center shadow-md border border-gray-400 pointer-events-none animate-fade-in">
                        <span className="text-[10px] font-black text-black tracking-tighter text-center truncate px-0.5">
                          {labels[blackIndex]}
                        </span>
                      </div>
                    ) : (
                      <div className="h-[22px] w-[22px] pointer-events-none" />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Dynamic Version Label Indicator */}
      <div className="text-right text-[10px] text-stone-50 mt-2 font-semibold pr-2">
        v1.2.8
      </div>
    </div>
  )
}
