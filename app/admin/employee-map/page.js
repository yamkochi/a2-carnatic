import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { getPool } from "@/lib/db"
import { sessionOptions } from "@/lib/session"
import dynamic from "next/dynamic"

// Disable Server-Side Rendering (SSR) for Leaflet map component dependencies
const EmployeeMapClient = dynamic(() => import("./EmployeeMapClient"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center font-semibold text-gray-600 animate-pulse">
        Initializing Spatial Tracking Systems...
      </div>
    </div>
  ),
})

export default async function EmployeeMapPage() {
  const session = await getIronSession(cookies(), sessionOptions)

  // 1. Session Access Control Guard
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

  // 2. EXPLICIT SECURITY FILTER: Only fetch rows where loc_visible is true (1)
  const [locations] = await pool.query(
    "SELECT id, first_name, photo_path, lat, lon, email, attend FROM raga_users WHERE loc_visible = 1 AND lat IS NOT NULL AND lon IS NOT NULL",
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Employee Location Map
        </h1>
        <p className="text-sm text-gray-500">
          Real-time spatial visualization of active team members with enabled
          tracking privileges.
        </p>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-md border border-gray-100">
        {locations.length > 0 ? (
          <EmployeeMapClient locations={locations} />
        ) : (
          <div className="h-[600px] w-full bg-gray-50 rounded-xl flex items-center justify-center text-sm font-medium text-gray-400 italic border border-dashed">
            No active member profiles currently have location visibility
            enabled.
          </div>
        )}
      </div>
    </div>
  )
}
