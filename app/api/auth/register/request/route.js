import { NextResponse } from "next/server"
import { getPool } from "@/lib/db" // Use your named function import
import nodemailer from "nodemailer"

export async function POST(req) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Initialize the active database connection pool instance
    const pool = getPool()

    // 1. Verify if user already exists
    const [existingUsers] = await pool.query(
      "SELECT id FROM raga_users WHERE email = ?",
      [email],
    )

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: "Email is already registered" },
        { status: 400 },
      )
    }

    // 2. Generate 4-digit code and expiration window (15 minutes)
    const code = Math.floor(1000 + Math.random() * 9000).toString()
    const expires = new Date(Date.now() + 15 * 60 * 1000)

    // 3. Stage the email and verification parameters directly in raga_users
    await pool.query(
      `INSERT INTO raga_users (email, verification_code, code_expires_at, first_name, last_name, password, admin, photo_path) 
   VALUES (?, ?, ?, '', '', '', 0, '') 
   ON DUPLICATE KEY UPDATE verification_code = ?, code_expires_at = ?`,
      [email, code, expires, code, expires],
    )

    // 4. Configure email transporter using your custom SMTP settings
    let transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    // 5. Dispatch confirmation email using your verified SMTP identity
    await transporter.sendMail({
      from: `"Raga App" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Verify Your Raga Registration",
      text: `Your 4-digit registration verification code is: ${code}. This code expires in 15 minutes.`,
    })

    return NextResponse.json({
      message: "Verification pin code sent to your email.",
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
