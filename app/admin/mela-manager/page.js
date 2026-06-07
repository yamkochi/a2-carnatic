import { getPool } from "@/lib/db"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { sessionOptions } from "@/lib/session"
import MelaManagerClient from "./MelaManagerClient"

export const metadata = {
  title: "Mela Raga Administration Console",
}

export default async function MelaManagerPage() {
  const session = await getIronSession(cookies(), sessionOptions)
  const user = session?.user || null

  let initialRagas = []
  try {
    const pool = getPool()
    const [rows] = await pool.execute(
      "SELECT * FROM mela_raga ORDER BY mela_no ASC",
    )
    initialRagas = rows
  } catch (e) {
    console.error("Master table reading crash:", e)
  }

  return (
    <div className="p-6 bg-blue-950 min-h-screen text-white">
      <header className="mb-6 flex justify-between items-center border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
            Mela Raga Maintenance Hub
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Global dataset viewer, audio router management panel
          </p>
        </div>
      </header>
      <MelaManagerClient initialData={initialRagas} currentUser={user} />
    </div>
  )
}
