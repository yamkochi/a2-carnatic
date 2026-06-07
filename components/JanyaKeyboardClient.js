"use client"
import { useState, useEffect, useRef } from "react"
const TAMIL_SWARA_MAP = {
  S: "ச",
  R: "ரி",
  G: "க",
  M: "ம",
  P: "ப",
  D: "த",
  N: "நி",
}

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

const NOTE_VALS = {
  S1: 1,
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
  S2: 13,
}

const DIRECTIONAL_COLORS = [
  "bg-emerald-600 border-emerald-500",
  "bg-rose-600 border-rose-500",
  "bg-sky-600 border-sky-500",
  "bg-amber-600 border-amber-500",
  "bg-indigo-600 border-indigo-500",
  "bg-purple-600 border-purple-500",
]

export default function JanyaKeyboardClient({ initialMelaRagas }) {
  const [melaRagas] = useState(initialMelaRagas)
  const [selectedChakra, setSelectedChakra] = useState("ALL")
  const [activeMela, setActiveMela] = useState(null)
  const [janyaList, setJanyaList] = useState([])
  const [loadingJanya, setLoadingJanya] = useState(false)
  const [activeJanya, setActiveJanya] = useState(null)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  // Piano Configuration States
  const [startIndex, setStartIndex] = useState(0)
  const [pianoKeys, setPianoKeys] = useState(
    Array.from({ length: 24 }, () => []),
  )
  const [activePlaybackKey, setActivePlaybackKey] = useState(null)
  const [tone, setTone] = useState("violin") // NEWLY ADDED: Active instrument state
  // NEW: Gamaka Performance Control States
  const [gamakaSpeedFactor, setGamakaSpeedFactor] = useState(1.0) // Sliders adjust playback wave speed
  const [currentLiveHz, setCurrentLiveHz] = useState(0) // Tracks real-time active oscillator frequency
  const [currentLiveNote, setCurrentLiveNote] = useState("") // Tracks active notation text letter name
  // Sequencer Engine States
  const [playbackSpeed, setPlaybackSpeed] = useState(500)
  const [isPlayingSequence, setIsPlayingSequence] = useState(false)
  const [currentSequenceStep, setCurrentSequenceStep] = useState(-1)
  // NEW: Global Performance Mode State Trigger
  const [isGamakaEnabled, setIsGamakaEnabled] = useState(true)
  // Media Tracking Stream States
  const [activeAudioUrl, setActiveAudioUrl] = useState(null)
  const [audioSourceLabel, setAudioSourceLabel] = useState("")

  const audioCtxRef = useRef(null)
  const voicesRef = useRef({})
  const mediaElementRef = useRef(null)
  const sequenceTimeoutRefs = useRef([])
  const scrollContainerRef = useRef(null)
  // Keep UI in sync if the audio url changes or resets externally
  useEffect(() => {
    if (mediaElementRef.current) {
      setIsAudioPlaying(!mediaElementRef.current.paused)
    }
  }, [activeAudioUrl])

  // NEW FIXED CODE (Case Insensitive & Auto-Formatted Layout)
  const uniqueChakras = [
    "ALL",
    ...new Set(
      melaRagas
        .map((m) => {
          const name = m.chakra_name?.trim()
          if (!name) return null
          // Normalize layout style: Capitalize First Letter, lowercase the rest (e.g. "INDU" -> "Indu")
          return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
        })
        .filter(Boolean),
    ),
  ]

  const filteredMela = melaRagas.filter((m) => {
    if (selectedChakra === "ALL") return true

    const currentChakraName = m.chakra_name?.trim().toUpperCase()
    const targetedChakraSelection = selectedChakra.trim().toUpperCase()

    return currentChakraName === targetedChakraSelection
  })

  const loadJanyaRagas = async (mela) => {
    // 1. Reset active visual tracking frameworks immediately
    stopSequence()
    setActiveMela(mela)
    setJanyaList([])
    setActiveJanya(null)
    setLoadingJanya(true)

    // ========================================================
    // FIXED: Compute URL directly from the fresh parameter 'mela'
    // instead of waiting for 'activeMela' state to update!
    // ========================================================
    const directMelaFile =
      mela?.song_path || mela?.audio_path || mela?.mela_audio || mela?.audio_url

    if (directMelaFile && directMelaFile.trim() !== "") {
      const generatedUrl = `/api/songs/${encodeURIComponent(directMelaFile)}`
      setActiveAudioUrl(generatedUrl)
      setAudioSourceLabel(`Parent Mela: ${mela.mela_name || "Unknown"}`)

      // Force native player cache layout mechanics to link the track immediately
      if (mediaElementRef.current) {
        mediaElementRef.current.pause()
        mediaElementRef.current.src = generatedUrl
        mediaElementRef.current.load()
      }
    } else {
      setActiveAudioUrl(null)
      setAudioSourceLabel("")
      if (mediaElementRef.current) {
        mediaElementRef.current.src = ""
      }
    }

    // 2. Proceed with loading sub-records safely
    try {
      const res = await fetch(`/api/janya-ragas/${mela.mela_no}`)
      const json = await res.json()
      if (json.success) setJanyaList(json.data)
    } catch (err) {
      console.error("Janya fetch pipeline execution exception:", err)
    } finally {
      setLoadingJanya(false)
    }
  }

  // WEB MIDI HARDWARE INTERFACE HOOK: Links external USB keyboards to the synth engine
  useEffect(() => {
    let midiAccessInstance = null

    // Helper function to map a physical MIDI note number to your 24-key layout index
    // Standard MIDI Note 60 is Middle C (mapped to index 0 + your root startIndex)
    const getLayoutIndexFromMidiNote = (noteNumber) => {
      const baseMiddleCNote = 60
      const calculatedTargetIndex = noteNumber - baseMiddleCNote - startIndex
      return calculatedTargetIndex
    }

    const handleMidiMessage = (message) => {
      const [statusByte, noteNumber, velocityByte] = message.data

      // statusByte 144 = Note On event, 128 = Note Off event
      const isNoteOn = statusByte === 144 && velocityByte > 0
      const isNoteOff =
        statusByte === 128 || (statusByte === 144 && velocityByte === 0)

      const targetKeyboardIndex = getLayoutIndexFromMidiNote(noteNumber)

      // Guard check: Ensure the pressed key physically sits inside your 24-note layout window
      if (targetKeyboardIndex >= 0 && targetKeyboardIndex < 24) {
        if (isNoteOn) {
          // Trigger the note audibly and light up the key on screen
          setActivePlaybackKey(targetKeyboardIndex)
          playSoundNode(targetKeyboardIndex)
        } else if (isNoteOff) {
          // Kill the note audibly and clear the screen highlight
          stopSoundNode(targetKeyboardIndex)
          setActivePlaybackKey((prev) =>
            prev === targetKeyboardIndex ? null : prev,
          )
        }
      }
    }

    const onMidiSuccess = (midiAccess) => {
      midiAccessInstance = midiAccess
      console.log(
        "SUCCESS: Web MIDI hardware framework initiated successfully.",
      )

      // Loop through all physically attached MIDI keyboards and assign the input listener
      const inputs = midiAccess.inputs.values()
      for (
        let input = inputs.next();
        input && !input.done;
        input = inputs.next()
      ) {
        input.value.onmidimessage = handleMidiMessage
      }

      // Automatically watch for newly hot-plugged devices while the page is open
      midiAccess.onstatechange = (e) => {
        if (e.port.type === "input" && e.port.state === "connected") {
          e.port.onmidimessage = handleMidiMessage
        }
      }
    }

    const onMidiFailure = (error) => {
      console.warn(
        "Web MIDI implementation initialization suspended or unsupported:",
        error,
      )
    }

    // Request direct access from the browser hardware layer
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(onMidiSuccess, onMidiFailure)
    } else {
      console.warn(
        "This web browser does not feature native Web MIDI driver connectivity pipelines.",
      )
    }

    // CLEANUP: Cleanly sever hardware ties when the component unmounts
    return () => {
      if (midiAccessInstance) {
        const inputs = midiAccessInstance.inputs.values()
        for (
          let input = inputs.next();
          input && !input.done;
          input = inputs.next()
        ) {
          input.value.onmidimessage = null
        }
        midiAccessInstance.onstatechange = null
      }
    }
  }, [tone, startIndex]) // Reloads triggers dynamically if instrument or Root Sa changes

  useEffect(() => {
    stopSequence()

    let targetUrl = null
    let targetLabel = ""

    // 1. If a Janya raga is selected, try to extract its audio path
    if (activeJanya) {
      // Check every common database spelling variant for child raga audio files
      const janyaFile =
        activeJanya.audio_path ||
        activeJanya.song_path ||
        activeJanya.audio_url ||
        activeJanya.filename

      if (janyaFile && janyaFile.trim() !== "") {
        targetUrl = `/api/songs/${encodeURIComponent(janyaFile)}`
        targetLabel = `Janya Track: ${activeJanya.raga_name}`
      }
    }

    // 2. If no Janya audio was found, fall back cleanly to the parent Melakarta track
    if (!targetUrl && activeMela) {
      // Check every common database spelling variant for parent raga audio files
      const melaFile =
        activeMela.song_path ||
        activeMela.audio_path ||
        activeMela.mela_audio ||
        activeMela.audio_url

      if (melaFile && melaFile.trim() !== "") {
        targetUrl = `/api/songs/${encodeURIComponent(melaFile)}`
        targetLabel = `Parent Mela: ${activeMela.mela_name}`
      }
    }

    // 3. Commit the discovered URL smoothly to your layout states
    setActiveAudioUrl(targetUrl)
    setAudioSourceLabel(targetLabel)

    // 4. Update the physical DOM player state
    if (mediaElementRef.current) {
      mediaElementRef.current.pause()
      if (targetUrl) {
        mediaElementRef.current.src = targetUrl
        mediaElementRef.current.load()
      } else {
        mediaElementRef.current.src = ""
      }
    }

    // 5. Layout rendering gate constraints
    if (!activeJanya) {
      setPianoKeys(Array.from({ length: 24 }, () => []))
      return
    }

    calculateRagaVisualLayout(activeJanya.aroganam, activeJanya.avaroganam)
  }, [activeJanya, activeMela, startIndex])

  const calculateRagaVisualLayout = (aroStr, avaStr) => {
    const freshKeys = Array.from({ length: 24 }, () => [])
    const aroTokens = (aroStr || "").trim().split(/\s+/).filter(Boolean)
    const avaTokens = (avaStr || "").trim().split(/\s+/).filter(Boolean)
    let currentRowIndex = 0

    if (aroTokens.length > 0) {
      let lastAroValue = null
      aroTokens.forEach((token) => {
        const baseLookupToken = token.replace(/[0-9]/g, "")
        let noteValue = NOTE_VALS[token] || NOTE_VALS[baseLookupToken]
        if (!noteValue) return
        if (lastAroValue !== null && noteValue < lastAroValue) {
          currentRowIndex = Math.min(currentRowIndex + 1, 5)
        }
        let targetKeyIndex = noteValue - 1 + startIndex
        if (targetKeyIndex >= 0 && targetKeyIndex < 24) {
          if (!freshKeys[targetKeyIndex][currentRowIndex])
            freshKeys[targetKeyIndex][currentRowIndex] = []
          freshKeys[targetKeyIndex][currentRowIndex].push({
            label: token,
            colorClass: DIRECTIONAL_COLORS[currentRowIndex],
            prefix: "▲",
          })
        }
        lastAroValue = noteValue
      })
    }

    if (avaTokens.length > 0) {
      currentRowIndex = Math.min(currentRowIndex + 1, 5)
      let lastAvaValue = null
      avaTokens.forEach((token) => {
        const baseLookupToken = token.replace(/[0-9]/g, "")
        let noteValue = NOTE_VALS[token] || NOTE_VALS[baseLookupToken]
        if (!noteValue) return
        if (lastAvaValue !== null && noteValue > lastAvaValue) {
          currentRowIndex = Math.min(currentRowIndex + 1, 5)
        }
        let targetKeyIndex = noteValue - 1 + startIndex
        if (targetKeyIndex >= 0 && targetKeyIndex < 24) {
          if (!freshKeys[targetKeyIndex][currentRowIndex])
            freshKeys[targetKeyIndex][currentRowIndex] = []
          freshKeys[targetKeyIndex][currentRowIndex].push({
            label: token,
            colorClass: DIRECTIONAL_COLORS[currentRowIndex],
            prefix: "▼",
          })
        }
        lastAvaValue = noteValue
      })
    }
    setPianoKeys(freshKeys)
  }

  const playScaleSequence = () => {
    if (isPlayingSequence) {
      stopSequence()
      return
    }
    if (!activeJanya) return

    setIsPlayingSequence(true)

    const aroTokens = (activeJanya.aroganam || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    const avaTokens = (activeJanya.avaroganam || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    const fullScaleSequence = [...aroTokens, ...avaTokens]

    // SAFE JSON PARSING: Pre-parse your incoming rule fields
    let aroGamakkams = []
    let avaGamakkams = []
    try {
      aroGamakkams =
        typeof activeJanya.aroganam_gamakkam === "string"
          ? JSON.parse(activeJanya.aroganam_gamakkam || "[]")
          : activeJanya.aroganam_gamakkam || []
      avaGamakkams =
        typeof activeJanya.avaroganam_gamakkam === "string"
          ? JSON.parse(activeJanya.avaroganam_gamakkam || "[]")
          : activeJanya.avaroganam_gamakkam || []
    } catch (e) {
      console.error("Malformed Gamakkam JSON dataset structures parsed:", e)
    }

    let step = 0
    function runNextStep() {
      if (step >= fullScaleSequence.length) {
        stopSequence()
        return
      }

      setCurrentSequenceStep(step)
      const token = fullScaleSequence[step]
      const baseLookupToken = token.replace(/[0-9]/g, "")
      let noteOffset = NOTE_VALS[token] || NOTE_VALS[baseLookupToken]

      if (noteOffset) {
        const targetKeyIndex = noteOffset - 1 + startIndex
        if (targetKeyIndex >= 0 && targetKeyIndex < 24) {
          setActivePlaybackKey(targetKeyIndex)

          // IDENTIFY APPROPRIATE CONFIGURATION
          const isAroganamPhase = step < aroTokens.length
          const activeGamakkamPool = isAroganamPhase
            ? aroGamakkams
            : avaGamakkams

          const matchedRule = activeGamakkamPool.find(
            (g) => g && g.swr?.toUpperCase() === token.toUpperCase(),
          )

          // Play sound note cleanly
          playSoundNode(targetKeyIndex, matchedRule)

          // TIME ADJUSTMENT RULE: If Gamaka switch is off, default back to standard flat beats (scalar 1)
          const scalarMultiplier =
            isGamakaEnabled && matchedRule ? matchedRule.dur || 1 : 1
          const holdDuration =
            playbackSpeed *
              scalarMultiplier *
              (isGamakaEnabled ? gamakaSpeedFactor : 1) -
            40

          const timeoutClear = setTimeout(() => {
            stopSoundNode(targetKeyIndex)
          }, holdDuration)
          sequenceTimeoutRefs.current.push(timeoutClear)

          step++
          const nextTimeoutId = setTimeout(
            runNextStep,
            playbackSpeed *
              scalarMultiplier *
              (isGamakaEnabled ? gamakaSpeedFactor : 1),
          )
          sequenceTimeoutRefs.current.push(nextTimeoutId)
          return
        }
      }

      // Fallback fallback step sequence progression if parsing errors hit
      step++
      const nextTimeoutId = setTimeout(runNextStep, playbackSpeed)
      sequenceTimeoutRefs.current.push(nextTimeoutId)
    }
    runNextStep()
  }

  const stopSequence = () => {
    setIsPlayingSequence(false)
    setCurrentSequenceStep(-1)
    setActivePlaybackKey(null)
    setCurrentLiveHz(0) // Reset visualizer values
    setCurrentLiveNote("")

    // Clears out both standard web timeouts and our custom visualizer tick loops simultaneously
    sequenceTimeoutRefs.current.forEach((id) => {
      clearTimeout(id)
      clearInterval(id)
    })
    sequenceTimeoutRefs.current = []
    Array.from({ length: 24 }).forEach((_, i) => stopSoundNode(i))
  }

  // ENHANCED ADVANCED SYNTHESIZER: Shapes instrument waveforms dynamically
  // DYNAMIC CARNATIC SYNTH ENGINE: Sweeps frequencies dynamically to render Gamakas
  const playSoundNode = (index, gamakkamRule = null) => {
    if (index < 0 || index >= 24) return
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (
        window.AudioContext || window.webkitAudioContext
      )()
    }
    const ctx = audioCtxRef.current
    if (ctx.state === "suspended") ctx.resume()

    // 1. Clear any active sound nodes running on this physical layout slot
    if (voicesRef.current[index]) {
      stopSoundNode(index)
    }

    // Helper function to calculate the absolute frequency of any notation token
    const getFrequencyForSwaraToken = (token) => {
      const baseLookupToken = token.replace(/[0-9]/g, "")
      const noteOffset = NOTE_VALS[token] || NOTE_VALS[baseLookupToken] || 1
      // Calibrate frequency calculation directly against your active Root Sa selection
      return 440 * Math.pow(2, (60 + (noteOffset - 1 + startIndex) - 69) / 12)
    }

    const now = ctx.currentTime
    const currentInstrumentNodes = []

    // Master Voice gain framework
    const voiceGainNode = ctx.createGain()
    voiceGainNode.gain.setValueAtTime(0, now)

    // Calculate baseline pitch from layout index as standard fallback
    const fallbackFrequency = 440 * Math.pow(2, (60 + index - 69) / 12)

    // ========================================================
    // CORE SOUND NODE MODIFIER GENERATOR LAYER
    // ========================================================
    const createOscillatorComponent = (
      type,
      freqFactor = 1.0,
      detuneVal = 0,
    ) => {
      const osc = ctx.createOscillator()
      osc.type = type

      // UPGRADED CONDITION: Gamaka only runs if both a rule exists AND the switch is turned ON
      if (
        isGamakaEnabled &&
        gamakkamRule &&
        Array.isArray(gamakkamRule.gmk) &&
        gamakkamRule.gmk.length > 0
      ) {
        // =============== FIX SELECTION HERE =================
        // Safely pull index [0] from your array to get the starting note token
        const startingNoteToken = gamakkamRule.gmk[0]
        const startFreq =
          getFrequencyForSwaraToken(startingNoteToken) * freqFactor
        // ====================================================

        osc.frequency.setValueAtTime(startFreq, now)

        const totalDurationSeconds =
          (gamakkamRule.dur || 1) * (playbackSpeed / 1000) * gamakaSpeedFactor
        const stepTimeDelta =
          totalDurationSeconds / (gamakkamRule.gmk.length - 1 || 1)

        gamakkamRule.gmk.forEach((swaraToken, stepIdx) => {
          if (stepIdx === 0) return
          const targetStepFreq =
            getFrequencyForSwaraToken(swaraToken) * freqFactor
          const targetStepTime = now + stepIdx * stepTimeDelta
          osc.frequency.linearRampToValueAtTime(targetStepFreq, targetStepTime)
        })

        if (freqFactor === 1.0) {
          let tickCount = 0
          const totalTicks = 30
          const trackingIntervalId = setInterval(
            () => {
              tickCount++
              const progressRatio = tickCount / totalTicks
              const currentSegmentIdx = Math.floor(
                progressRatio * (gamakkamRule.gmk.length - 1),
              )
              if (currentSegmentIdx < gamakkamRule.gmk.length - 1) {
                const fromSwara = gamakkamRule.gmk[currentSegmentIdx]
                const toSwara = gamakkamRule.gmk[currentSegmentIdx + 1]
                const fromHz = getFrequencyForSwaraToken(fromSwara)
                const toHz = getFrequencyForSwaraToken(toSwara)

                const segmentProgress =
                  progressRatio * (gamakkamRule.gmk.length - 1) -
                  currentSegmentIdx
                const movingHz = fromHz + (toHz - fromHz) * segmentProgress

                setCurrentLiveHz(Math.round(movingHz * 10) / 10)
                setCurrentLiveNote(`${fromSwara} ➔ ${toSwara}`)
              }
              if (tickCount >= totalTicks) clearInterval(trackingIntervalId)
            },
            (totalDurationSeconds * 1000) / totalTicks,
          )

          sequenceTimeoutRefs.current.push(trackingIntervalId)
        }
      } else {
        // FLAT KEYBOARD FALLBACK MODE (Runs when Gamaka Mode is turned OFF)
        osc.frequency.setValueAtTime(fallbackFrequency * freqFactor, now)
        if (freqFactor === 1.0) {
          setCurrentLiveHz(Math.round(fallbackFrequency * 10) / 10)
          setCurrentLiveNote("Static Hold")
        }
      }

      osc.detune.setValueAtTime(detuneVal, now)
      return osc
    }

    // ========================================================
    // INSTRUMENT SOUND MODELLING DISPATCH ROUTER
    // ========================================================
    if (tone === "tanpura") {
      const strings = [1.5, 1.0, 1.0, 0.5]
      const delays = [0.0, 0.12, 0.24, 0.36]

      strings.forEach((factor, idx) => {
        const osc = createOscillatorComponent(
          "triangle",
          factor,
          idx === 0 ? 5 : idx === 3 ? -4 : idx * 3 - 3,
        )
        const strGain = ctx.createGain()
        const pluckTime = now + delays[idx]

        strGain.gain.setValueAtTime(0, now)
        strGain.gain.linearRampToValueAtTime(0.25, pluckTime + 0.04)
        strGain.gain.exponentialRampToValueAtTime(0.005, pluckTime + 5.5)

        osc.connect(strGain)
        strGain.connect(voiceGainNode)
        osc.start(pluckTime)
        currentInstrumentNodes.push(osc)
      })

      voiceGainNode.gain.linearRampToValueAtTime(0.7, now + 0.04)
      voiceGainNode.gain.exponentialRampToValueAtTime(0.005, now + 6.0)
    } else if (tone === "violin") {
      const osc1 = createOscillatorComponent("sawtooth", 1.0, 0)
      const osc2 = createOscillatorComponent("sawtooth", 3.0, 8)

      const compGain1 = ctx.createGain()
      const compGain2 = ctx.createGain()
      compGain1.gain.setValueAtTime(0.3, now)
      compGain2.gain.setValueAtTime(0.08, now)

      osc1.connect(compGain1)
      osc2.connect(compGain2)
      compGain1.connect(voiceGainNode)
      compGain2.connect(voiceGainNode)

      osc1.start(now)
      osc2.start(now)
      currentInstrumentNodes.push(osc1, osc2)

      voiceGainNode.gain.linearRampToValueAtTime(0.5, now + 0.1)
      voiceGainNode.gain.setValueAtTime(0.5, now + 0.6)
    } else if (tone === "harmonium") {
      const osc1 = createOscillatorComponent("sawtooth", 1.0, -4)
      const osc2 = createOscillatorComponent("triangle", 2.0, 5)

      const g1 = ctx.createGain()
      const g2 = ctx.createGain()
      g1.gain.setValueAtTime(0.25, now)
      g2.gain.setValueAtTime(0.15, now)

      osc1.connect(g1)
      osc2.connect(g2)
      g1.connect(voiceGainNode)
      g2.connect(voiceGainNode)

      osc1.start(now)
      osc2.start(now)
      currentInstrumentNodes.push(osc1, osc2)

      voiceGainNode.gain.linearRampToValueAtTime(0.6, now + 0.06)
    } else {
      const osc = createOscillatorComponent("sine", 1.0, 0)
      osc.connect(voiceGainNode)
      osc.start(now)
      currentInstrumentNodes.push(osc)

      voiceGainNode.gain.linearRampToValueAtTime(0.5, now + 0.02)
      voiceGainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
    }

    voiceGainNode.connect(ctx.destination)
    voicesRef.current[index] = {
      oscillators: currentInstrumentNodes,
      gainNode: voiceGainNode,
    }
  }

  const stopSoundNode = (index) => {
    const activeVoice = voicesRef.current[index]
    if (!activeVoice) return

    try {
      const ctx = audioCtxRef.current
      const now = ctx ? ctx.currentTime : 0

      // Smoothly fade out volume to prevent hard audible audio speaker pops/clicks
      if (activeVoice.gainNode && ctx) {
        activeVoice.gainNode.gain.cancelScheduledValues(now)
        activeVoice.gainNode.gain.setValueAtTime(
          activeVoice.gainNode.gain.value,
          now,
        )
        activeVoice.gainNode.gain.exponentialRampToValueAtTime(
          0.0001,
          now + 0.05,
        )
      }

      // Safely kill all active sound source waves after fadeout finishes
      setTimeout(() => {
        if (activeVoice.oscillators) {
          activeVoice.oscillators.forEach((osc) => {
            try {
              osc.stop()
            } catch (e) {}
          })
        }
      }, 50)
    } catch (err) {
      console.error("Audio synth cleanup warning:", err)
    }

    // Delete the index key map tracker completely
    delete voicesRef.current[index]
  }

  const aroTokensList = activeJanya
    ? (activeJanya.aroganam || "").trim().split(/\s+/).filter(Boolean)
    : []
  const avaTokensList = activeJanya
    ? (activeJanya.avaroganam || "").trim().split(/\s+/).filter(Boolean)
    : []
  // Computes the active sequence string tokens to render the visual blocks safely
  const aroTokens = (activeJanya?.aroganam || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const avaTokens = (activeJanya?.avaroganam || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const totalSequenceTokens = [...aroTokens, ...avaTokens]
  const getTamilTransliteration = (token) => {
    if (!token) return ""

    // Extract the main alphabet character (e.g., 'R' from 'R1')
    const baseLetter = token.replace(/[0-9]/g, "").toUpperCase()

    // Extract any numbers attached (e.g., '1' from 'R1')
    const noteNumber = token.replace(/\D/g, "")

    const tamilChar = TAMIL_SWARA_MAP[baseLetter] || baseLetter

    // Combine them back together smoothly (e.g., 'ரி1')
    return `${tamilChar}${noteNumber}`
  }

  return (
    <div className="space-y-6">
      {/* Top Controls Filter Head Row */}
      <div className="p-6 max-w-7xl mx-auto space-y-6 bg-blue-900 border border-slate-800 rounded-2xl shadow-2xl text-white">
        <header className="border-b border-slate-700 pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              Select the Mela Raga and related Janya Raga to Explore
            </h1>
            <p className="text-xs text-pretty mt-1">
              Choose a chakra to shortlist the Mela ragas
            </p>
          </div>
        </header>{" "}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mr-2 block lg:inline">
            Chakra:
          </span>
          {uniqueChakras.map((chakra) => (
            <button
              key={chakra}
              onClick={() => setSelectedChakra(chakra)}
              className={`px-3 py-1.5 rounded-lg text-lg font-bold transition-all cursor-pointer ${
                selectedChakra === chakra
                  ? "bg-amber-500 text-gray-950"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {chakra}
            </button>
          ))}
        </div>
      </div>

      {/* DUAL SCROLLABLE TABLES ROW */}
      {/* DUAL SCROLLABLE TABLES ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* LEFT COLUMN: MASTER MELA RAGA LIST WINDOW */}
        <div className="bg-blue-900 border border-gray-800 rounded-xl p-3 shadow-md">
          <h3 className="text-sm font-black uppercase tracking-widest text-amber-400 mb-2 px-1">
            Mela Ragas
          </h3>
          <div
            className="overflow-y-auto pr-1 custom-scrollbar max-h-[280px]"
            style={{ height: "280px" }}
          >
            <table className="w-full text-left font-medium border-collapse">
              <thead className="bg-gray-950 text-gray-400 uppercase tracking-wider font-bold sticky top-0 z-10">
                <tr>
                  <th className="p-2.5 rounded-l-lg">No</th>
                  <th className="p-2.5">Chakra</th>
                  <th className="p-2.5">Mela Name</th>
                  <th className="p-2.5 text-center rounded-r-lg">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-gray-300 font-medium">
                {filteredMela.map((m) => (
                  <tr
                    key={m.mela_no}
                    className={`hover:bg-gray-800/40 transition-colors ${activeMela?.mela_no === m.mela_no ? "bg-gray-800/80 text-white" : ""}`}
                  >
                    <td className="p-2.5 font-bold text-amber-500">
                      {m.mela_no}
                    </td>
                    <td className="p-2.5 text-gray-400">{m.chakra_name}</td>
                    <td className="p-2.5 font-bold">{m.mela_name}</td>
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => loadJanyaRagas(m)}
                        className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-amber-600 text-gray-950 rounded-md font-bold hover:brightness-110 active:scale-95 transition-all text-[11px] cursor-pointer"
                      >
                        Janya Raga ➔
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN: SLAVE JANYA RAGA LIST WINDOW */}
        <div className="bg-blue-900 border border-gray-800 rounded-xl p-3 shadow-md">
          <h3 className="text-sm font-black uppercase tracking-widest text-white mb-2 px-1">
            <span className="text-blue-400">Janya Ragam List</span>{" "}
            {activeMela && `(Parent: ${activeMela.mela_name})`}
          </h3>
          <div
            className="overflow-y-auto pr-1 custom-scrollbar max-h-[200px]"
            style={{ height: "200px" }}
          >
            {loadingJanya ? (
              <div className="flex items-center justify-center h-full text-sm text-sky-400 font-semibold animate-pulse">
                Loading connected data tracks...
              </div>
            ) : janyaList.length > 0 ? (
              <table className="w-full text-left font-semibold border-collapse">
                <thead className="bg-gray-950 text-gray-400 uppercase tracking-wider font-bold sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5 rounded-l-lg">Janya Name</th>
                    <th className="p-2.5">Aroganam / Avaroganam </th>
                    <th className="p-2.5 text-center rounded-r-lg">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-gray-300 font-medium">
                  {janyaList.map((j) => (
                    <tr
                      key={j.janya_id}
                      className={`hover:bg-gray-800/40 transition-colors ${activeJanya?.janya_id === j.janya_id ? "bg-sky-950/40 text-white" : ""}`}
                    >
                      <td className="p-2.5 font-bold text-white text-lg align-middle">
                        {j.raga_name}
                      </td>
                      <td className="p-2.5 align-middle leading-tight font-mono text-[11px] text-gray-300">
                        <div className="text-emerald-400 font-bold">
                          <span className="opacity-50 mr-1">Aro:</span>
                          {j.aroganam}
                        </div>
                        <div className="text-rose-400 font-bold">
                          <span className="opacity-50 mr-1">Ava:</span>
                          {j.avaroganam}
                        </div>
                      </td>
                      <td className="p-2.5 text-center align-middle">
                        <button
                          onClick={() => setActiveJanya(j)}
                          className={`px-3 py-1 rounded-md font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer ${
                            activeJanya?.janya_id === j.janya_id
                              ? "bg-sky-500 text-white shadow-md"
                              : "bg-gray-800 text-sky-400 border border-sky-900/50 hover:bg-gray-700"
                          }`}
                        >
                          {activeJanya?.janya_id === j.janya_id
                            ? "Selected"
                            : "Select"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-gray-500 italic">
                {activeMela
                  ? "No nested Janya raga records mapped to this parent entry."
                  : "Click 'Janya Raga' on a parent row left to populate tracks."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FIXED HIGH-STABILITY AUDIO FEED INTERFACE WITH LIVE DIAGNOSTIC STREAM */}
      <div className="bg-blue-900 border border-gray-800 p-4 rounded-xl flex flex-col gap-3 shadow-md">
        {/* Row 1: Status Metadata Text Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-2">
          <div className="flex items-center gap-3">
            {/* Visual Status Indicator Node */}
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${activeAudioUrl ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}
            />
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Audio Feed:{" "}
              <span className="text-white font-black text-sm ml-1 normal-case">
                {audioSourceLabel || "System Standby (No Track Linked)"}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Native Audio Player System Node Wrapper */}
        {/* <div className="w-full flex items-center justify-between gap-4">
          <div className="text-[10px] text-gray-500 font-mono hidden md:block">
            URL: {activeAudioUrl ? activeAudioUrl : "null"}
          </div>

          <div className="w-full sm:w-auto block">
            <audio
              ref={mediaElementRef}
              controls
              src={activeAudioUrl || ""}
              crossOrigin="anonymous"
              preload="auto"
              className="h-9 w-full sm:w-80 block accent-amber-500 text-xs"
            />
          </div>
        </div> */}
      </div>

      {/* REAL-TIME CARNATIC NOTATION VISUALIZER CARD WITH LARGE HIGH-BRIGHTNESS TAMIL TRANSLITERATION */}
      <div className="p-4 bg-blue-900 rounded-2xl border border-gray-800 shadow-inner space-y-3">
        <div className="flex items-center justify-between border-b border-gray-900 pb-2">
          <div className="text-xs font-black uppercase tracking-widest text-w flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${isPlayingSequence ? "bg-emerald-500 animate-ping" : "bg-gray-700"}`}
            />
            Carnatic Notation Tracker / ஸ்வரக் குறியீடு
          </div>
          <div className="text-[10px] font-mono text-gray-500">
            {isPlayingSequence
              ? `Step ${currentSequenceStep + 1} of ${totalSequenceTokens.length}`
              : "Sequencer Idle"}
          </div>
        </div>

        {/* Notation Sequence Flex Wrap Grid */}
        {totalSequenceTokens.length === 0 ? (
          <div className="text-xs italic text-zinc-200 text-center py-3">
            Select a Janya Raga to activate the visual notation monitor tracker
            stream.
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5 py-1">
            {totalSequenceTokens.map((token, index) => {
              const isCurrentStep =
                isPlayingSequence && currentSequenceStep === index
              const isAroganamPhase = index < aroTokens.length

              // Calculate the Tamil equivalent label text string dynamically
              const tamilLabel = getTamilTransliteration(token)

              return (
                <div
                  key={`token-${index}`}
                  className="flex items-center gap-1.5"
                >
                  {/* Dynamic Symbol Card Layout - Expanded width and padding to support larger fonts */}
                  <div
                    className={`relative px-3.5 py-2.5 rounded-xl border transition-all duration-150 transform flex flex-col items-center min-w-[68px] ${
                      isCurrentStep
                        ? "bg-amber-500 border-amber-400 scale-110 shadow-[0_0_20px_rgba(245,158,11,0.6)] text-black font-black z-10"
                        : "bg-gray-900 border-gray-700 text-gray-300"
                    }`}
                  >
                    {/* Floating directional sub-indicator icon vector badge */}
                    <span
                      className={`text-[9px] absolute top-1 right-2 font-black ${
                        isCurrentStep
                          ? "text-black/70"
                          : isAroganamPhase
                            ? "text-emerald-400 font-bold"
                            : "text-rose-400 font-bold"
                      }`}
                    >
                      {isAroganamPhase ? "▲" : "▼"}
                    </span>

                    {/* Central English Swara Token */}
                    <span className="text-xs font-black tracking-wide text-gray-400 mb-1 leading-none uppercase">
                      {token}
                    </span>

                    {/* HIGH BRIGHTNESS & ENLARGED TAMIL TRANSLITERATION LAYER */}
                    <span
                      className={`text-sm font-black tracking-normal leading-none ${
                        isCurrentStep
                          ? "text-black drop-shadow-sm"
                          : "text-white text-shadow-glow" // Forced to bright white contrast color
                      }`}
                    >
                      {tamilLabel}
                    </span>
                  </div>

                  {/* Render a clear partition divider visual break point marker block right between the scales */}
                  {index === aroTokens.length - 1 && (
                    <div
                      className="h-12 w-[3px] bg-gray-700 mx-1 border-dashed shrink-0"
                      title="Scale Peak Transition"
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {/* LIVE CARNATIC GAMAKA PERFORMANCE TUNER & TUNER VISUALIZER PANEL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-950 rounded-2xl border border-gray-800 shadow-xl">
        {/* PANEL BLOCK 1 & 2: THE REAL-TIME MICROTONAL PITCH FREQUENCY OSCILLOSCOPE MONITOR */}
        <div className="md:col-span-2 bg-blue-800 border border-gray-900 rounded-xl p-3 flex items-center justify-between gap-4 relative overflow-hidden">
          {/* Decorative background visual sound grid matrix layer */}
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:14px_24px]" />

          <div className="space-y-1.5 z-10">
            <div className="text-[10px] font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full bg-cyan-400 ${isPlayingSequence ? "animate-ping" : "opacity-40"}`}
              />
              Microtonal Frequency Vector Monitor
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-white flex items-baseline gap-1">
              {currentLiveHz > 0 ? currentLiveHz : "000.0"}
              <span className="text-xs font-bold text-cyan-500/80 uppercase">
                Hz
              </span>
            </div>
          </div>

          {/* Center Dial Tracking target paths */}
          <div className="text-right z-10 space-y-0.5">
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
              Active Swara Path
            </div>
            <div className="text-sm font-black font-mono text-cyan-300 min-w-[110px] bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/30">
              {currentLiveNote || "SA STANDBY"}
            </div>
          </div>
        </div>

        {/* PANEL BLOCK 3: INTERACTIVE GAMAKA SPEED SPEED MODULATION CONTROLS */}
        <div className="bg-blue-800 border border-gray-800 rounded-xl p-3 flex flex-col justify-center space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black uppercase tracking-widest text-amber-500">
              Gamaka Glide Duration:
            </label>
            <span className="text-xs font-mono font-black text-amber-400 bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800">
              {Math.round(gamakaSpeedFactor * 100)}%
            </span>
          </div>

          <input
            type="range"
            min="0.3"
            max="2.5"
            step="0.1"
            value={gamakaSpeedFactor}
            onChange={(e) => setGamakaSpeedFactor(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none accent-amber-500 cursor-pointer transition-all hover:bg-gray-700 focus:outline-none"
          />

          <div className="flex justify-between text-[8px] font-bold font-mono text-gray-500 uppercase tracking-tight">
            <span>⚡ Brisk (Fast Shake)</span>
            <span>Meditative (Slow Slide) 🧘‍♂️</span>
          </div>
        </div>
      </div>
      {/* DYNAMIC PIANO HARDWARE CARDS WITH MOVED INTERACTIVE USER TOOLS */}
      <div className="mt-6 p-6 max-w-7xl mx-auto space-y-6 bg-cyan-600 border border-zinc-800 rounded-2xl shadow-2xl text-gray-200">
        {/* Integrated Control Panel Header */}
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-zinc-900/90 p-4 border border-zinc-800 rounded-xl shadow-md">
          <div className="flex flex-col gap-1">
            <div className="text-sm font-black uppercase tracking-widest text-amber-500">
              {activeJanya
                ? `Scale Keyboard Roll: ${activeJanya.raga_name}`
                : "Keyboard Standby"}
            </div>
            {/* Subtitle tracker telling the user exactly what audio is loaded in the player pipeline */}
            {audioSourceLabel && (
              <div className="text-[10px] text-white font-mono italic">
                🎵 Loaded: {audioSourceLabel}
              </div>
            )}
          </div>
          {/* PERFORMANCE ENGINE GAME-MODE TOGGLE SWITCH */}
          <button
            onClick={() => {
              stopSequence()
              setIsGamakaEnabled(!isGamakaEnabled)
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-md border cursor-pointer select-none ${
              isGamakaEnabled
                ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-cyan-400"
                : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
            }`}
          >
            {isGamakaEnabled ? "✨ Gamaka Mode: ON" : "🎹 Static Pitch: ON"}
          </button>

          <div className="flex flex-wrap items-center gap-3 justify-end w-full xl:w-auto">
            {/* HIDDEN HTML5 AUDIO ELEMENT INSTANCE HOOK */}
            <audio
              ref={mediaElementRef}
              src={activeAudioUrl || undefined} // Fixed warning: passing undefined instead of "" avoids reloading the page
              preload="auto"
              className="hidden"
              onPlay={() => setIsAudioPlaying(true)}
              onPause={() => setIsAudioPlaying(false)}
              onEnded={() => {
                setIsAudioPlaying(false)
                if (mediaElementRef.current) {
                  mediaElementRef.current.currentTime = 0 // Rewind track automatically
                }
                console.log("Audio track finished playing smoothly.")
              }}
            />

            {console.log("Active Audio URL:", activeAudioUrl)}

            {/* AUDIO_PATH PLAYER INTERFACE TOOLS */}
            <div className="flex items-center gap-2 bg-gray-950 px-3 py-1.5 rounded-lg border border-gray-800">
              <span className="text-[10px] uppercase font-bold text-white tracking-wider">
                Track Player:
              </span>

              {/* Audio Play Trigger Element */}
              <button
                onClick={() => {
                  if (!mediaElementRef.current || !activeAudioUrl) return

                  // Stop synth sequencer to avoid sonic clutter
                  if (isPlayingSequence) stopSequence()

                  if (mediaElementRef.current.paused) {
                    mediaElementRef.current
                      .play()
                      .then(() => setIsAudioPlaying(true))
                      .catch((err) =>
                        console.error("Audio playback blocked:", err),
                      )
                  } else {
                    mediaElementRef.current.pause()
                    setIsAudioPlaying(false)
                  }
                }}
                disabled={!activeAudioUrl}
                className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wide transition-all border ${
                  !activeAudioUrl
                    ? "bg-gray-900 text-gray-600 border-gray-800 opacity-40 cursor-not-allowed"
                    : isAudioPlaying
                      ? "bg-amber-600 text-white border-amber-500 hover:bg-amber-700 animate-pulse cursor-pointer"
                      : "bg-blue-600 text-white border-blue-500 hover:bg-blue-500 shadow-sm cursor-pointer"
                }`}
              >
                {isAudioPlaying ? "⏸ Pause Audio" : "▶ Play Audio"}
              </button>

              {/* Audio Stop/Reset Trigger Element */}
              <button
                onClick={() => {
                  if (!mediaElementRef.current) return
                  mediaElementRef.current.pause()
                  mediaElementRef.current.currentTime = 0
                  setIsAudioPlaying(false)
                }}
                disabled={!activeAudioUrl}
                className={`p-1 rounded text-xs transition-colors ${
                  !activeAudioUrl
                    ? "text-gray-700 cursor-not-allowed"
                    : "text-gray-400 hover:text-red-400 hover:bg-gray-800 cursor-pointer"
                }`}
                title="Reset Track"
              >
                ■ Reset
              </button>
            </div>

            {/* Tone Selector Dropdown */}
            <div className="flex items-center gap-1.5 border-l border-gray-800 pl-3">
              <span className="text-[10px] uppercase font-bold text-white tracking-wider">
                Tone:
              </span>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="bg-gray-800 text-white border border-gray-700 p-1.5 rounded-lg text-xs font-semibold focus:outline-none"
              >
                <option value="sine">Pure Sine</option>
                <option value="tanpura">🎻 Tanpura</option>
                <option value="violin">🎻 Violin</option>
                <option value="harmonium">🎹 Harmonium</option>
              </select>
            </div>
            {/* Speed selection element */}
            <div className="flex items-center gap-1.5 border-l border-gray-800 pl-3">
              <span className="text-[10px] uppercase font-bold text-white tracking-wider">
                Speed:
              </span>
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseInt(e.target.value))}
                className="bg-gray-800 text-white border border-gray-700 p-1.5 rounded-lg text-xs font-semibold focus:outline-none"
              >
                <option value={1500}>Drone Slow (1500ms)</option>
                <option value={800}>Slow (800ms)</option>
                <option value={500}>Medium (500ms)</option>
                <option value={300}>Fast (300ms)</option>
              </select>
            </div>
            {/* Root note selection element */}
            <div className="flex items-center gap-1.5 border-l border-gray-800 pl-3">
              <span className="text-[10px] uppercase font-bold text-white tracking-wider">
                Root Sa:
              </span>
              <select
                value={startIndex}
                onChange={(e) => setStartIndex(parseInt(e.target.value))}
                className="bg-gray-800 text-white border border-gray-700 p-1.5 rounded-lg text-xs font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {CHROMATIC.map((note, i) => (
                  <option key={note} value={i}>
                    {note}
                  </option>
                ))}
              </select>
            </div>
            {/* Play scale synthesizer sequencer button */}
            <button
              onClick={playScaleSequence}
              disabled={!activeJanya}
              className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all select-none cursor-pointer border-l border-gray-800 ${
                !activeJanya
                  ? "bg-gray-800 text-gray-600 opacity-40 pointer-events-none"
                  : isPlayingSequence
                    ? "bg-red-600 text-white hover:bg-red-700 animate-pulse shadow-md"
                    : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-md"
              }`}
            >
              {isPlayingSequence ? "■ Stop Scale" : "▶ Play Scale"}
            </button>
          </div>
        </div>

        {/* PIANO ELEMENT ENGINE CONTAINER WITH MULTI-TOUCH PAN SUPPORT */}
        <div
          ref={scrollContainerRef}
          onTouchStart={(e) => {
            const touchInstance = e.touches[0]
            scrollContainerRef.current.dataset.isDragging = "true"
            scrollContainerRef.current.dataset.startX =
              touchInstance.pageX - scrollContainerRef.current.offsetLeft
            scrollContainerRef.current.dataset.scrollLeft =
              scrollContainerRef.current.scrollLeft
          }}
          onTouchMove={(e) => {
            if (scrollContainerRef.current.dataset.isDragging !== "true") return
            const touchInstance = e.touches[0]
            const activeXPosition =
              touchInstance.pageX - scrollContainerRef.current.offsetLeft
            const travelDistanceDelta =
              (activeXPosition -
                parseFloat(scrollContainerRef.current.dataset.startX)) *
              1.5
            scrollContainerRef.current.scrollLeft =
              parseFloat(scrollContainerRef.current.dataset.scrollLeft) -
              travelDistanceDelta
          }}
          onTouchEnd={() => {
            scrollContainerRef.current.dataset.isDragging = "false"
          }}
          className="relative flex overflow-x-auto p-2 bg-black/60 rounded-xl border-2 border-gray-800 select-none touch-pan-y h-[324px]"
          style={{ maxWidth: "100%", scrollBehavior: "auto" }}
        >
          {/* Absolute layout frame holding our 14 white notes smoothly mapping across a 924px viewport width */}
          <div
            className="relative flex flex-row shrink-0 bg-gray-950"
            style={{ width: "924px", height: "100%" }}
          >
            {/* SINGLE CLEAN ITERATION LOOP MAPPING ALL 24 REAL MUSICAL PITCHES */}
            {Array.from({ length: 24 }).map((_, index) => {
              const realPitchOffset = (index + startIndex) % 12
              const noteName = CHROMATIC[realPitchOffset]
              const isSharp = ["C#", "D#", "F#", "G#", "A#"].includes(noteName)

              const isPressed = activePlaybackKey === index
              const rowLabelBlocks = pianoKeys[index] || []

              // Calculate the physical horizontal positions so everything stays aligned
              let whiteKeyCountBefore = 0
              for (let i = 0; i < index; i++) {
                const checkPitch = (i + startIndex) % 12
                if (
                  !["C#", "D#", "F#", "G#", "A#"].includes(
                    CHROMATIC[checkPitch],
                  )
                ) {
                  whiteKeyCountBefore++
                }
              }

              if (isSharp) {
                const leftOffsetPosition = whiteKeyCountBefore * 66 - 18
                return (
                  <div
                    key={`sharp-${index}`}
                    onMouseDown={() => playSoundNode(index)}
                    onMouseUp={() => stopSoundNode(index)}
                    onMouseLeave={() => stopSoundNode(index)}
                    onTouchStart={(e) => {
                      e.preventDefault()
                      playSoundNode(index)
                    }}
                    onTouchEnd={() => stopSoundNode(index)}
                    className="absolute z-20 flex flex-col justify-between items-center pt-2 pb-4 transition-colors duration-75 select-none shadow-md"
                    style={{
                      left: `${leftOffsetPosition}px`,
                      width: "36px",
                      height: "60%",
                      backgroundColor: isPressed ? "#f59e0b" : "#1f2937",
                      border: "1px solid #111827",
                      borderRadius: "0 0 4px 4px",
                      cursor: "pointer",
                    }}
                  >
                    <div className="text-[8px] font-black text-gray-300 pointer-events-none uppercase">
                      {noteName}
                    </div>
                    <div className="w-full flex flex-col gap-0.5 text-center mb-1 pointer-events-none">
                      {rowLabelBlocks.flat().map((noteObj, lblIdx) => (
                        <span
                          key={lblIdx}
                          className={`text-[9px] font-bold px-1 rounded-sm text-white ${noteObj.colorClass}`}
                        >
                          {noteObj.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              }

              const leftOffsetPosition = whiteKeyCountBefore * 66
              return (
                <div
                  key={`white-${index}`}
                  onMouseDown={() => playSoundNode(index)}
                  onMouseUp={() => stopSoundNode(index)}
                  onMouseLeave={() => stopSoundNode(index)}
                  onTouchStart={(e) => {
                    e.preventDefault()
                    playSoundNode(index)
                  }}
                  onTouchEnd={() => stopSoundNode(index)}
                  className="absolute z-10 flex flex-col justify-between items-center pt-2 pb-3 transition-colors duration-75 select-none"
                  style={{
                    left: `${leftOffsetPosition}px`,
                    width: "66px",
                    height: "100%",
                    backgroundColor: isPressed ? "#f59e0b" : "#ffffff",
                    borderRight: "1px solid rgba(0, 0, 0, 0.2)",
                    borderRadius: "0 0 6px 6px",
                    cursor: "pointer",
                  }}
                >
                  <div className="text-[10px] font-black text-gray-800 px-1 bg-gray-100 rounded border border-gray-300 shadow-sm pointer-events-none uppercase">
                    {noteName}
                  </div>

                  <div className="w-full flex flex-col gap-1 px-0.5 mb-14 text-sm pointer-events-none select-none font-bold text-center">
                    {Array.from({ length: 6 }).map((_, rowIdx) => {
                      const labelsInRow = rowLabelBlocks[rowIdx] || []
                      return (
                        <div
                          key={rowIdx}
                          className="flex flex-wrap justify-center gap-0.5 h-4 items-center"
                        >
                          {labelsInRow.map((noteObj, lblIdx) => (
                            <span
                              key={lblIdx}
                              className={`px-1.5 py-0.5 rounded-[3px] leading-none shadow-sm text-xs font-black text-white border border-black/10 ${noteObj.colorClass}`}
                            >
                              {noteObj.label}
                            </span>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
