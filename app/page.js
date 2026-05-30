import dynamic from "next/dynamic"

// Dynamically import your components with SSR turned off
const Piano = dynamic(() => import("@/components/Piano"), { ssr: false })
const RagaList = dynamic(() => import("@/components/RagaList"), { ssr: false })

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <h1 className="text-2xl font-bold mb-4 text-center">
        Carnatic Music Keyboard
      </h1>

      <div className="space-y-6 max-w-6xl mx-auto">
        {/* These will safely mount only on the browser */}
        <RagaList />
        <Piano />
      </div>
    </main>
  )
}
