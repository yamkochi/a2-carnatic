import { NextResponse } from "next/server"
import { getPool } from "@/lib/db"
import nodemailer from "nodemailer"

export async function POST(req) {
  try {
    const { email } = await req.json()
    const code = Math.floor(1000 + Math.random() * 9000).toString()
    const expires = new Date(Date.now() + 15 * 60 * 1000) // 15 mins expiry
    const pool = getPool()
    const [result] = await pool.query(
      "UPDATE raga_users SET verification_code = ?, code_expires_at = ? WHERE email = ?",
      [code, expires, email],
    )

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    let transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

    await transporter.sendMail({
      from: 'Raga App<' + process.env.SMTP_USER + '>',
      to: email,
      subject: "Your Password Reset Pin Code",
      text: `Your 4 digit verification code is: ${code}`,
    })

    return NextResponse.json({
      message: "Verification pin sent to your email.",
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
