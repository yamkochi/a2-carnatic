import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { getPool } from "@/lib/db"
import { sessionOptions } from "@/lib/session"
import MembersListClient from "./MembersListClient"

export default async function MembersPage() {
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
  // Fetch columns directly out of MySQL
  const [users] = await pool.query(
    "SELECT id, first_name, last_name, email, phone_number, address, remark, admin, photo_path, loc_visible FROM raga_users ORDER BY id DESC",
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Members Directory
      </h1>
      <MembersListClient
        initialUsers={users}
        currentAdminStatus={!!session.user.isAdmin}
      />
    </div>
  )
}
