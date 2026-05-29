"use client"

export default function UserGuideDrawer({ isOpen, onClose }) {
  return (
    <>
      {/* BACKGROUND OVERLAY CURTAIN SHADE */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* SLIDING PANEL CANVAS BODY */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-gray-900 border-l border-gray-800 text-gray-100 shadow-2xl z-50 transform transition-transform duration-300 ease-out p-6 overflow-y-auto flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* PANEL NAVIGATION CONTROLS BAR */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-6 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">📖</span>
            <h2 className="text-lg font-bold uppercase tracking-wider text-emerald-400">
              User Guide
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white text-xs uppercase tracking-tight transition-colors border border-gray-800"
          >
            ✕ Close
          </button>
        </div>

        {/* CONTAINER DOCUMENTATION LAYOUT SCROLL CONTAINER */}
        <div className="flex-1 space-y-6 text-sm leading-relaxed pr-1 custom-scrollbar">
          <section className="space-y-2">
            <h3 className="text-emerald-400 font-bold border-b border-gray-800/60 pb-1 text-xs uppercase tracking-wide">
              1. Master Control Panel
            </h3>
            <p className="text-gray-300 text-xs">
              <strong className="text-white">Tone:</strong> Changes the wave
              source engine model. Select{" "}
              <strong className="text-indigo-400">Tanpura Drone</strong> to
              activate multi-string Indian resonant frequency generation layer
              logic.
            </p>
            <p className="text-gray-300 text-xs">
              <strong className="text-white">Root & Octave:</strong> Sets your
              tonic base note pitch (
              <strong className="text-amber-400">Sa</strong>) and transposes
              registers across Low (Mandra), Middle (Madhya), or High (Tara)
              vocal frames.
            </p>
            <p className="text-gray-300 text-xs">
              <strong className="text-white">Volume & Release:</strong>{" "}
              Multipliers to fine-tune sound level balance mix ranges and
              tail-decay sustain lengths.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-emerald-400 font-bold border-b border-gray-800/60 pb-1 text-xs uppercase tracking-wide">
              2. Tanpura Simulator Mode
            </h3>
            <p className="text-gray-300 text-xs">
              Locks into your selected Root note to generate three continuous
              overlapping acoustic string layers automatically. Use the{" "}
              <strong className="text-white">Drone Tuning</strong> dropdown menu
              to toggle your overtone anchors cleanly between{" "}
              <strong className="text-amber-400">Pa, Ma, or Ni</strong>{" "}
              configurations.
            </p>
            <p className="text-gray-300 text-xs">
              Check the <strong className="text-indigo-400">Auto Drone</strong>{" "}
              box to run a hands-free looping backing track at a dedicated
              independent volume level.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-emerald-400 font-bold border-b border-gray-800/60 pb-1 text-xs uppercase tracking-wide">
              3. Keyboard Typing Mappings
            </h3>
            <p className="text-gray-400 text-[11px] uppercase tracking-tighter mb-2">
              Click inside the piano keys frame to grant active keyboard input
              browser focus:
            </p>

            <div className="bg-gray-950 p-2 rounded-lg border border-gray-800 space-y-2.5 font-mono text-[11px]">
              <div>
                <span className="text-amber-400 block mb-0.5">
                  White Keys Base Line:
                </span>
                <p className="text-gray-300 leading-normal">
                  <b className="text-white bg-gray-800 px-1 rounded">A</b>→C |{" "}
                  <b className="text-white bg-gray-800 px-1 rounded">S</b>→D |{" "}
                  <b className="text-white bg-gray-800 px-1 rounded">D</b>→E |{" "}
                  <b className="text-white bg-gray-800 px-1 rounded">F</b>→F |{" "}
                  <b className="text-white bg-gray-800 px-1 rounded">G</b>→G |{" "}
                  <b className="text-white bg-gray-800 px-1 rounded">H</b>→A |{" "}
                  <b className="text-white bg-gray-800 px-1 rounded">J</b>→B |{" "}
                  <b className="text-white bg-gray-800 px-1 rounded">K</b>→C+1
                </p>
              </div>
              <div className="border-t border-gray-800/60 pt-2">
                <span className="text-sky-400 block mb-0.5">
                  Black Keys Semi-Tones:
                </span>
                <p className="text-gray-300 leading-normal">
                  <b className="text-white bg-gray-800 px-1 rounded">W</b>→C# |{" "}
                  <b className="text-white bg-gray-800 px-1 rounded">E</b>→D# |{" "}
                  <b className="text-white bg-gray-800 px-1 rounded">T</b>→F# |{" "}
                  <b className="text-white bg-gray-800 px-1 rounded">Y</b>→G# |{" "}
                  <b className="text-white bg-gray-800 px-1 rounded">U</b>→A#
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-emerald-400 font-bold border-b border-gray-800/60 pb-1 text-xs uppercase tracking-wide">
              4. Automation Scales Guide
            </h3>
            <p className="text-gray-300 text-xs">
              Toggle the <strong className="text-white">Scale Guide</strong>{" "}
              checkbox to color-code raga-specific notes. Press the{" "}
              <strong className="text-white">Play Sequence</strong> button to
              run automated ascending and descending turnaround exercises at
              your chosen speed.
            </p>
          </section>
        </div>
      </div>
    </>
  )
}
