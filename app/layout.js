import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { sessionOptions } from "@/lib/session"
import Navbar from "@/components/Navbar"
import "@/app/globals.css"

export default async function RootLayout({ children }) {
  // 1. Fetch cookie session data on server-side initial load
  const session = await getIronSession(cookies(), sessionOptions)

  // 2. Fallback initialization mapping for safety matching Navbar properties
  const currentUser = session.user ? session.user : null

  return (
    <html lang="en">
      <body className="flex min-h-screen bg-gray-100">
        {/* Pass server-side session variable as initial state data to Client Navbar */}
        <Navbar initialUser={currentUser} />
        <main className="flex-1 p-8 ml-64 min-h-screen overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  )
}
