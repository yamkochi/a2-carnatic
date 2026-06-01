import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getPool } from "@/lib/db"
import { getIronSession } from "iron-session"
import { sessionOptions } from "@/lib/session" // Adjust this path if your session options are located elsewhere
import bcrypt from "bcryptjs"

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required fields." },
        { status: 400 },
      )
    }

    const pool = getPool()

    // 1. Fetch user data along with the active status flag from raga_users table
    const query = "SELECT * FROM raga_users WHERE email = ?"
    const [rows] = await pool.execute(query, [email.trim()])

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid email credentials or account does not exist." },
        { status: 401 },
      )
    }

    const user = rows[0]

    // 2. Verify password match
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid password credentials." },
        { status: 401 },
      )
    }

    // 3. CRITICAL EVALUATION: Block login if the account status is disabled (0 or false)
    const isActive =
      user.user_active === 1 ||
      user.user_active === true ||
      Boolean(user.user_active)
    if (!isActive) {
      return NextResponse.json(
        { error: "Contact Admin .. Your  Membership status is Not-Active" },
        { status: 403 }, // 403 Forbidden safely blocks inactive restrictions
      )
    }

    // 4. Direct clean evaluation for a true MySQL boolean flag type
    const isAdmin =
      user.admin === 1 || user.admin === true || Boolean(user.admin)

    // 5. Initialize, append data parameters, and save the active iron-session state
    const session = await getIronSession(cookies(), sessionOptions)
    session.user = {
      id: user.id,
      first_name: user.first_name,
      photo_path: user.photo_path,
      isAdmin: isAdmin,
    }
    await session.save()

    // Return the verified active user profile dataset to the client app window layout
    return NextResponse.json({
      success: true,
      user: session.user,
    })
  } catch (error) {
    console.error("LOGIN SYSTEM EXECUTION ERROR:", error)
    return NextResponse.json(
      { error: "An unexpected server-side validation error occurred." },
      { status: 500 },
    )
  }
}
