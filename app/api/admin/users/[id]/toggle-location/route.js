import { NextResponse } from "next/server"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { getPool } from "@/lib/db"
import { sessionOptions } from "@/lib/session"

export async function PATCH(req, { params }) {
  try {
    // 1. Verify user session is authenticated and holds administrator privileges
    const session = await getIronSession(cookies(), sessionOptions)
    if (!session.user || !session.user.id || !session.user.isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: Administrator access required." },
        { status: 401 },
      )
    }

    const { id } = params
    const { locVisible } = await req.json()

    const pool = getPool()

    // 2. Explicit conversion cast to ensure MySQL TINYINT receives a precise numerical 1 or 0 flag
    const numericFlag = locVisible ? 1 : 0

    // 3. Execute update statement on target user profile identifier row
    const [result] = await pool.query(
      "UPDATE raga_users SET loc_visible = ? WHERE id = ?",
      [numericFlag, id],
    )

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "Target user not found or database update failed." },
        { status: 404 },
      )
    }

    // 4. CRITICAL FIX: Return a definitive 'success: true' object property back to match client validation hooks
    return NextResponse.json({
      success: true,
      message: `Location visibility successfully saved as ${locVisible ? "Visible" : "Hidden"}.`,
    })
  } catch (err) {
    console.error("Location Toggle Endpoint Error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
