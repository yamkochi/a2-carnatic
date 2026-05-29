import { NextResponse } from "next/server"
import { getPool } from "@/lib/db"
import bcrypt from "bcryptjs"
import nodemailer from "nodemailer"

export async function POST(req) {
  try {
    const { email, code } = await req.json()

    const pool = getPool()
    const [rows] = await pool.query(
      "SELECT * FROM raga_users WHERE email = ? AND verification_code = ? AND code_expires_at > NOW()",
      [email, code],
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid or expired pin code" },
        { status: 400 },
      )
    }

    const tempPassword = Math.random().toString(36).slice(-8)
    const hashedPassword = await bcrypt.hash(tempPassword, 10)

    await pool.query(
      "UPDATE raga_users SET password = ?, verification_code = NULL, code_expires_at = NULL WHERE email = ?",
      [hashedPassword, email],
    )

    let transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

    await transporter.sendMail({
      from: "Raga App<" + process.env.SMTP_USER + ">",
      to: email,
      subject: "Your New Password",
      text: `Your password has been reset successfully. Your temporary new password is: ${tempPassword}`,
    })

    return NextResponse.json({
      message:
        "Password reset complete. Your new credentials have been emailed.",
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
