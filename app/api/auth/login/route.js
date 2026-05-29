import { NextResponse } from "next/server"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { getPool } from "@/lib/db"
import bcrypt from "bcryptjs"
import { sessionOptions } from "@/lib/session"

export async function POST(req) {
  try {
    const { email, password } = await req.json()
    const pool = getPool()

    const [rows] = await pool.query(
      "SELECT * FROM raga_users WHERE email = ?",
      [email],
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      )
    }

    const user = rows[0] // Extract the precise user record object from results array

    // FIX: Safely parse database password hash into a string if it was returned as a binary Buffer
    const databasePasswordHash = Buffer.isBuffer(user.password)
      ? user.password.toString("utf-8")
      : String(user.password)

    // Execute secure text comparison with guaranteed string types
    const match = await bcrypt.compare(password, databasePasswordHash)
    if (!match) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      )
    }

    // Direct clean evaluation for a true MySQL boolean flag type
    const isAdmin =
      user.admin === 1 || user.admin === true || Boolean(user.admin)

    const session = await getIronSession(cookies(), sessionOptions)
    session.user = {
      id: user.id,
      first_name: user.first_name,
      photo_path: user.photo_path,
      isAdmin: isAdmin,
    }
    await session.save()

    return NextResponse.json({ user: session.user })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
