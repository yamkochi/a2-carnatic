import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { getPool } from "@/lib/db"
import { sessionOptions } from "@/lib/session"
import dynamic from "next/dynamic"

const ProfileFormClient = dynamic(() => import("./ProfileFormClient"), {
  ssr: false,
  loading: () => (
    <div className="text-center p-8 font-semibold">
      Loading Map & Profile Components...
    </div>
  ),
})

export default async function ProfilePage() {
  const session = await getIronSession(cookies(), sessionOptions)

  if (!session.user || !session.user.id) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl font-medium shadow-sm max-w-md text-center">
          🔒 You must login to access this menu.
        </div>
      </div>
    )
  }

  const pool = getPool()
  const [rows] = await pool.query(
    "SELECT id, first_name, last_name, email, address, phone_number, admin, photo_path, loc_visible, lat, lon FROM raga_users WHERE id = ?",
    [session.user.id],
  )

  if (rows.length === 0) {
    return <div className="text-center p-8">User profile not found.</div>
  }

  // CRITICAL FIX: Extract the precise user row object index 0 from the array
  const dbUser = rows[0]

  return (
    <div className="container mx-auto py-6">
      {/* Passing down the database record object where photo_path is just the filename */}
      <ProfileFormClient initialData={dbUser} />
    </div>
  )
}
