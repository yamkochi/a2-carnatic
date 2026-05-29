import { NextResponse } from "next/server"
import { getPool } from "@/lib/db" // Use your named function import
import bcrypt from "bcryptjs"

export async function POST(req) {
  try {
    const { email, code, firstName, lastName, password } = await req.json()

    if (!email || !code || !password) {
      return NextResponse.json(
        { error: "Email, code, and password are required fields." },
        { status: 400 },
      )
    }

    // Initialize the active database connection pool instance
    const pool = getPool()

    // 1. Validate the code and check expiration timelines
    const [rows] = await pool.query(
      "SELECT * FROM raga_users WHERE email = ? AND verification_code = ? AND code_expires_at > NOW()",
      [email, code],
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid or expired registration code." },
        { status: 400 },
      )
    }

    // 2. Encrypt the password securely prior to database update
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    const defaultAdmin = 0
    const defaultPhotoPath = "" // Left empty so they can upload it later on their profile page

    // 3. Finalize profile update and clear verification states
    await pool.query(
      `UPDATE raga_users 
       SET first_name = ?, last_name = ?, password = ?, admin = ?, photo_path = ?, 
           verification_code = NULL, code_expires_at = NULL 
       WHERE email = ?`,
      [
        firstName || "",
        lastName || "",
        hashedPassword,
        defaultAdmin,
        defaultPhotoPath,
        email,
      ],
    )

    return NextResponse.json({
      success: true,
      message: "Registration successful! You can now log into your account.",
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
