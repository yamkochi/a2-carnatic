import { NextResponse } from "next/server"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { getPool } from "@/lib/db"
import bcrypt from "bcryptjs"
import { sessionOptions } from "@/lib/session"

export async function PUT(req) {
  try {
    // 1. Verify user identity using iron-session
    const session = await getIronSession(cookies(), sessionOptions)
    if (!session.user || !session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 },
      )
    }

    const sessionUserId = session.user.id
    const body = await req.json()

    // Extract parameters sent by ProfileFormClient
    const {
      userId,
      firstName,
      lastName,
      address,
      phoneNumber,
      password,
      locVisible,
      lat,
      lon,
    } = body

    // Security check: Ensure the logged-in user is only editing their own profile
    if (parseInt(userId) !== parseInt(sessionUserId)) {
      return NextResponse.json(
        { error: "Forbidden operation" },
        { status: 403 },
      )
    }

    const pool = getPool()

    // 2. Formulate the dynamic SQL query base
    let query = `
      UPDATE raga_users 
      SET first_name = ?, last_name = ?, address = ?, phone_number = ?, 
          loc_visible = ?, lat = ?, lon = ?
    `

    let queryParams = [
      firstName,
      lastName,
      address,
      phoneNumber,
      locVisible ? 1 : 0,
      lat || null,
      lon || null,
    ]

    // 3. SECURE ENCRYPTION STEP:
    // Check if a new password string has been provided by the user
    if (password && password.trim() !== "") {
      // Hash the plain-text password using 10 salt rounds before saving
      const hashedPassword = await bcrypt.hash(password.trim(), 10)

      // Append the encrypted password to the SQL string modification statement
      query += ", password = ? "
      queryParams.push(hashedPassword)
    }

    // Append the limiting condition
    query += " WHERE id = ?"
    queryParams.push(sessionUserId)

    // 4. Commit values directly to MySQL
    const [result] = await pool.query(query, queryParams)

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "User profile update failed" },
        { status: 404 },
      )
    }

    // 5. Sync and save the modified data back into the cookie session state
    session.user.first_name = firstName
    await session.save()

    return NextResponse.json({
      success: true,
      message: "Profile details and encrypted password updated successfully!",
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
