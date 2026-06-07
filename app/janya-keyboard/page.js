import { getPool } from "@/lib/db"
import JanyaKeyboardClient from "@/components/JanyaKeyboardClient"

export const metadata = {
  title: "Janya Raga Keyboard Layout",
}

export default async function JanyaKeyboardPage() {
  let melaRagas = []
  try {
    const pool = getPool()
    const [rows] = await pool.execute(
      "SELECT mela_no, chakra_no, chakra_name, mela_name, swaram FROM mela_raga ORDER BY mela_no ASC",
    )
    melaRagas = rows
  } catch (e) {
    console.error("Database connection failure fetching Mela Ragas:", e)
  }

  return (
    <main className="p-4 bg-gray-950 min-h-screen text-white">
      <h1 className="text-2xl font-black mb-4 tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-sky-400">
        Janya Raga KeyBoard Explorer
      </h1>
      <JanyaKeyboardClient initialMelaRagas={melaRagas} />
    </main>
  )
}
