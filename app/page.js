"use client"
import { useState } from "react"
import dynamic from "next/dynamic"
import RagaList from "../components/RagaList"
import UserGuideDrawer from "../components/UserGuideDrawer" // Import the new sidebar drawer

const Piano = dynamic(() => import("../components/Piano"), { ssr: false })

export default function Home() {
  // Simple layout hook state to control drawer toggle opening status flags
  const [isGuideOpen, setIsGuideOpen] = useState(false)

  return (
    <div className="p-6 max-w-6xl mx-auto relative min-h-screen">
      {/* PANEL UPPER MASTER CONTAINER TITLE WRAPPER HEADER BLOCK */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Mela Raga Keyboard</h1>

        {/* THE FLOATING ACTION INTERFACE TOGGLE ACCORDION SLIDER BUTTON TRIGGER ELEMENT */}
        <button
          onClick={() => setIsGuideOpen(true)}
          className="flex items-center gap-2 bg-gray-800 text-white hover:bg-gray-700 px-4 py-2 rounded-lg font-bold text-sm shadow transition-colors tracking-wide"
        >
          <span>📖</span> Open User Guide
        </button>
      </div>

      {/* RAGA METADATA LIST ACCORDION DROPDOWN ENGINE GRID FRAME VIEW */}
      <RagaList />

      {/* DETACHED ABSOLUTE POSITIONING KEYBOARD COMPONENT HOOK MATRIX */}
      <div className="mt-6">
        <Piano />
      </div>

      {/* INJECT CONTAINER DRAWER SLIDER CANVAS FOOTPRINT DIRECTLY INTO DOM BASE LEVEL */}
      <UserGuideDrawer
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  )
}
