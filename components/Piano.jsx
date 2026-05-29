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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false) // Slide-out User Guide state

  const audioCtxRef = useRef(null)
  const audioRef = useRef(null)
  const [songUrl, setSongUrl] = useState(null)
  const sequenceTimeoutRefs = useRef([])
  const droneIntervalRef = useRef(null)
  const liveVoiceRegistryRef = useRef({})

  useEffect(() => {
    window.addEventListener("raga-selected", handleRaga)
    return () => {
      window.removeEventListener("raga-selected", handleRaga)
      stopSequence()
      stopContinuousDrone()
      killAllActiveVoices()
    }
  }, [])

  useEffect(() => {
    if (continuousDrone && tone === "tanpura") {
      startContinuousDrone()
    } else {
      stopContinuousDrone()
    }
  }, [
    continuousDrone,
    tone,
    startIndex,
    tanpuraTuning,
    volume,
    octaveShift,
    droneVolume,
  ])

  function handleRaga(e) {
    stopSequence()
    const r = e?.detail
    if (!r) return

    const targetUrl = r.song_path || null
    setSongUrl(targetUrl)

    if (audioRef.current) {
      audioRef.current.pause()
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.load()
        }
      }, 0)
    }

    const tokens = (r.swaram || "").trim().split(/\s+/)
    const positionLabels = Array.from({ length: 12 }, () => [])

    tokens.forEach((token) => {
      const num = SWARAM_MAP[token]
      if (!num) return
      const pos = (num - 1) % 12
      positionLabels[pos].push(token)
    })

    const firstOctaveLabels = positionLabels.map((arr) => arr.join(", "))
    setLabels([...firstOctaveLabels, ...firstOctaveLabels])
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
        volume,
        now,
        duration,
        "sawtooth",
        0.08,
      )
      currentNodes.push(node1)

      const node2 = createTanpuraStringNode(
        ctx,
        baseFreq / 2,
        volume * 0.6,
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
        volume * 0.4,
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

    const rootFreq = noteFrequency(startIndex + octaveShift)

    function playDronePulse() {
      const now = ctx.currentTime
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

  function stopSequence() {
    sequenceTimeoutRefs.current.forEach(clearTimeout)
    sequenceTimeoutRefs.current = []
    setIsPlayingSequence(false)
    setActiveKey(null)
  }

  function playSequence() {
    if (isPlayingSequence) {
      stopSequence()
      return
    }

    const validKeyIndices = []
    for (let i = 0; i < 24; i++) {
      if (labels[i] && labels[i].trim() !== "") {
        validKeyIndices.push(i)
      }
    }

    const first8Notes = validKeyIndices.slice(0, 8)
    if (first8Notes.length === 0) return

    const ascending = [...first8Notes]
    const descending = [...first8Notes].reverse()
    const fullSequence = [...ascending, ...descending]

    setIsPlayingSequence(true)
    sequenceTimeoutRefs.current = []

    fullSequence.forEach((keyIndex, step) => {
      const timeoutId = setTimeout(() => {
        const noteDuration = playbackSpeed / 1000
        playKey(keyIndex, noteDuration)

        if (step === fullSequence.length - 1) {
          setTimeout(() => setIsPlayingSequence(false), playbackSpeed)
        }
      }, step * playbackSpeed)

      sequenceTimeoutRefs.current.push(timeoutId)
    })
  }

  function handleKeyDown(e) {
    if (e.repeat) return
    const targetPianoIndex = KEYBOARD_KEY_MAP[e.key.toLowerCase()]
    if (targetPianoIndex !== undefined && targetPianoIndex < 24) {
      e.preventDefault()
      playKey(targetPianoIndex)
    }
  }

  function handleKeyUp(e) {
    const targetPianoIndex = KEYBOARD_KEY_MAP[e.key.toLowerCase()]
    if (targetPianoIndex !== undefined) {
      e.preventDefault()
      stopKeySound(targetPianoIndex)
    }
  }

  const totalKeys = 24
  const keysArray = []
  let whiteKeyCounter = 0

  for (let i = 0; i < totalKeys; i++) {
    const currentAbsoluteNote = (startIndex + i) % 12
    const noteName = CHROMATIC[currentAbsoluteNote]
    const isBlack = noteName.includes("#")

    keysArray.push({
      index: i,
      noteName,
      isBlack,
      labelText: labels[i] || "",
      whiteIndex: isBlack ? whiteKeyCounter - 1 : whiteKeyCounter,
    })

    if (!isBlack) whiteKeyCounter++
  }

  const whiteKeyWidth = 60
  const blackKeyWidth = 36
  const totalWidth = whiteKeyCounter * whiteKeyWidth

  return (
    <div className="mt-4 p-4 bg-gray-900 rounded-xl shadow-2xl select-none max-w-fit">
      {/* Control Panel Layout */}
      <div className="flex flex-wrap items-center gap-6 mb-6 text-white bg-gray-800 p-4 rounded-lg">
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">
            Tone
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="bg-gray-700 text-white border border-gray-600 px-3 py-1.5 rounded text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="sine">Sine</option>
            <option value="square">Square</option>
            <option value="sawtooth">Sawtooth</option>
            <option value="triangle">Triangle</option>
            <option value="tanpura">🎻 Tanpura Drone</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">
            Root
          </label>
          <select
            value={startIndex}
            onChange={(e) => setStartIndex(parseInt(e.target.value))}
            className="bg-gray-700 text-white border border-gray-600 px-3 py-1.5 rounded text-sm focus:outline-none focus:border-indigo-500"
          >
            {CHROMATIC.map((n, i) => (
              <option key={n} value={i}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {/* Tanpura Tuning & Volume Control Layer */}
        {tone === "tanpura" && (
          <>
            <div className="flex items-center gap-2 border-l border-gray-700 pl-4 transition-all">
              <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">
                Drone Tuning
              </label>
              <select
                value={tanpuraTuning}
                onChange={(e) => setTanpuraTuning(e.target.value)}
                className="bg-gray-700 text-white border border-gray-600 px-3 py-1.5 rounded text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="Pa">Pa (Perfect 5th)</option>
                <option value="Ma">Ma (Perfect 4th)</option>
                <option value="Ni">Ni (Major 7th)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 border-l border-gray-700 pl-4 transition-all">
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
                onChange={(e) => setContinuousDrone(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 border-l border-gray-700 pl-4 transition-all">
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
                className="w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </>
        )}

        {/* Octave Shift Transposition Control Layout Block */}
        <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
          <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">
            Octave
          </label>
          <select
            value={octaveShift}
            onChange={(e) => setOctaveShift(parseInt(e.target.value))}
            className="bg-gray-700 text-white border border-gray-600 px-3 py-1.5 rounded text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value={-12}>Low (Mandra Sthayi)</option>
            <option value={0}>Middle (Madhya Sthayi)</option>
            <option value={12}>High (Tara Sthayi)</option>
          </select>
        </div>

        {/* Master Volume Control */}
        <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
          <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">
            Volume
          </label>
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-24 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {/* Release Envelope Parameter Control Slider */}
        <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
          <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">
            Release
          </label>
          <input
            type="range"
            min="0.02"
            max="1.0"
            step="0.02"
            value={releaseTime}
            onChange={(e) => setReleaseTime(parseFloat(e.target.value))}
            className="w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>

        {/* Speed Option Selector */}
        <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
          <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">
            Speed
          </label>
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseInt(e.target.value))}
            className="bg-gray-700 text-white border border-gray-600 px-3 py-1.5 rounded text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value={1000}>1 sec / note</option>
            <option value={500}>1/2 sec / note</option>
            <option value={250}>1/4 sec / note</option>
          </select>
        </div>

        {/* Play Sequence Button */}
        <button
          onClick={playSequence}
          className={`px-4 py-1.5 rounded text-sm font-bold tracking-wide uppercase transition-colors duration-150
            ${
              isPlayingSequence
                ? "bg-red-600 text-white hover:bg-red-700 animate-pulse"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
        >
          {isPlayingSequence ? "■ Stop Sequence" : "▶ Play Sequence"}
        </button>

        {/* Highlight Guide Toggle Switch */}
        <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
          <label
            className="text-xs uppercase tracking-wider text-gray-400 font-bold cursor-pointer select-none"
            htmlFor="guide-toggle"
          >
            Scale Guide
          </label>
          <input
            id="guide-toggle"
            type="checkbox"
            checked={showHighlight}
            onChange={(e) => setShowHighlight(e.target.checked)}
            className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
          />
        </div>

        {songUrl && (
          <div className="ml-auto bg-gray-800 p-1 rounded-lg border border-gray-700 flex items-center shadow-md">
            <audio
              controls
              src={songUrl}
              ref={audioRef}
              className="h-9 w-64 block accent-emerald-500 rounded"
            />
          </div>
        )}
      </div>

      {/* Keyboard Display Panel Container */}
      <div
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        tabIndex={0}
        className="overflow-x-auto p-2 bg-gray-950 rounded-lg custom-scrollbar focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
      >
        <div
          className="relative h-64 shadow-inner"
          style={{ width: `${totalWidth}px` }}
        >
          {/* Layer 1: White Keys */}
          {keysArray
            .filter((k) => !k.isBlack)
            .map((key) => {
              const isActive = activeKey === key.index
              const hasSwaram = key.labelText.trim() !== ""

              const matchingComputerKey =
                Object.keys(KEYBOARD_KEY_MAP).find(
                  (k) =>
                    KEYBOARD_KEY_MAP[k] === key.index &&
                    !["w", "e", "t", "y", "u", "o", "p"].includes(k),
                ) || ""

              let whiteBgClass =
                "bg-gradient-to-b from-gray-100 to-white hover:from-white hover:to-gray-50 text-gray-800"
              if (isActive) {
                whiteBgClass =
                  "bg-gray-200 translate-y-0.5 shadow-none text-gray-900"
              } else if (showHighlight && hasSwaram) {
                whiteBgClass =
                  "bg-gradient-to-b from-emerald-50 to-emerald-100/70 hover:from-white hover:to-emerald-100 shadow-[inset_0_-8px_0_#d1fae5,0_4px_3px_rgba(0,0,0,0.3)]"
              } else {
                whiteBgClass =
                  "bg-gradient-to-b from-gray-100 to-white hover:from-white hover:to-gray-50 shadow-[inset_0_-8px_0_#f0f0f0,0_4px_3px_rgba(0,0,0,0.3)]"
              }

              return (
                <button
                  key={key.index}
                  onMouseDown={() => playKey(key.index)}
                  onMouseUp={() => stopKeySound(key.index)}
                  onMouseLeave={() => stopKeySound(key.index)}
                  style={{
                    left: `${key.whiteIndex * whiteKeyWidth}px`,
                    width: `${whiteKeyWidth}px`,
                  }}
                  className={`absolute top-0 h-full border-r border-b border-gray-300 rounded-b-md flex flex-col justify-between p-2 pb-4 transition-all duration-75 origin-top ${whiteBgClass}`}
                >
                  <div
                    style={{ transform: "translateY(2.5rem)" }}
                    className="text-center w-full flex flex-col items-center"
                  >
                    <span className="text-xs font-bold text-gray-400">
                      {key.noteName}
                    </span>
                    {matchingComputerKey && (
                      <span className="inline-flex items-center justify-center text-[10px] font-bold bg-white text-black border border-gray-300 rounded-full w-5 h-5 mt-1 shadow-sm uppercase">
                        {matchingComputerKey}
                      </span>
                    )}
                  </div>
                  <SwaramLabel text={key.labelText} isBlack={false} />
                </button>
              )
            })}

          {/* Layer 2: Black Keys */}
          {keysArray
            .filter((k) => k.isBlack)
            .map((key) => {
              const isActive = activeKey === key.index
              const hasSwaram = key.labelText.trim() !== ""
              const leftPosition =
                key.whiteIndex * whiteKeyWidth +
                whiteKeyWidth -
                blackKeyWidth / 2

              const matchingComputerKey =
                Object.keys(KEYBOARD_KEY_MAP).find(
                  (k) =>
                    KEYBOARD_KEY_MAP[k] === key.index &&
                    ["w", "e", "t", "y", "u", "o", "p"].includes(k),
                ) || ""

              let blackBgClass = ""
              if (isActive) {
                blackBgClass = "bg-gray-800 scale-95"
              } else if (showHighlight && hasSwaram) {
                blackBgClass =
                  "bg-gradient-to-b from-slate-900 via-indigo-950 to-indigo-900 hover:from-indigo-900 shadow-[0_4px_5px_rgba(0,0,0,0.6),inset_0_-4px_0_#312e81]"
              } else {
                blackBgClass =
                  "bg-gradient-to-b from-gray-900 via-gray-800 to-black hover:from-gray-800 hover:to-gray-900 shadow-[0_4px_5px_rgba(0,0,0,0.6),inset_0_-4px_0_#222]"
              }

              return (
                <button
                  key={key.index}
                  onMouseDown={() => playKey(key.index)}
                  onMouseUp={() => stopKeySound(key.index)}
                  onMouseLeave={() => stopKeySound(key.index)}
                  style={{
                    left: `${leftPosition}px`,
                    width: `${blackKeyWidth}px`,
                  }}
                  className={`absolute top-0 h-40 rounded-b border-x border-b border-black z-10 flex flex-col justify-between p-1 pb-3 transition-all duration-75 origin-top ${blackBgClass}`}
                >
                  <div
                    style={{ transform: "translateY(1.5rem)" }}
                    className="text-center w-full flex flex-col items-center drop-shadow"
                  >
                    <span className="text-[10px] font-bold text-white tracking-wide">
                      {key.noteName}
                    </span>
                    {matchingComputerKey && (
                      <span className="inline-flex items-center justify-center text-[9px] font-bold bg-white text-black border border-gray-400 rounded-full w-4 h-4 mt-1 shadow-sm uppercase">
                        {matchingComputerKey}
                      </span>
                    )}
                  </div>
                  <SwaramLabel text={key.labelText} isBlack={true} />
                </button>
              )
            })}
        </div>
      </div>
    </div>
  )
}

// Extracted Component for Swaram Notation Layout
function SwaramLabel({ text, isBlack }) {
  if (!text) return <div className="h-6"></div>
  return (
    <div className="text-center w-full font-extrabold text-sm tracking-tighter leading-tight drop-shadow-sm z-20">
      {text.split(", ").map((part, idx) => {
        if (!part) return null
        const isAnanya = part === "S" || part === "P"
        let colorClass = isBlack ? "text-white" : "text-gray-800"

        if (isAnanya) {
          colorClass = isBlack
            ? "text-amber-300 font-black"
            : "text-red-600 font-black"
        }

        return (
          <span key={idx} className={colorClass}>
            {part}
            {idx < text.split(", ").length - 1 ? "," : ""}
          </span>
        )
      })}
    </div>
  )
}
