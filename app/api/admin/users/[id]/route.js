import { NextResponse } from "next/server"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { getPool } from "@/lib/db"
import { sessionOptions } from "@/lib/session"
import bcrypt from "bcryptjs"

// GUARD: Verify user session is authenticated and holds administrator privileges
async function verifyAdminAccess() {
  const session = await getIronSession(cookies(), sessionOptions)
  if (!session.user || !session.user.id || !session.user.isAdmin) {
    throw new Error("Unauthorized: Administrator access required.")
  }
  return session
}

// GET: Checks for dynamic constraint data across specific application tracking tables
export async function GET(req, { params }) {
  try {
    await verifyAdminAccess()
    const { id } = params
    const pool = getPool()

    // 1. Scan dependent application tables to count constraints
    // (Adjust these table and column names to match your actual database schema)
    const [logsCount] = await pool.query(
      "SELECT COUNT(*) as count FROM user_activity_logs WHERE user_id = ?",
      [id],
    )
    const [bookmarksCount] = await pool.query(
      "SELECT COUNT(*) as count FROM user_raga_bookmarks WHERE user_id = ?",
      [id],
    )
    const [scoresCount] = await pool.query(
      "SELECT COUNT(*) as count FROM detector_scores WHERE user_id = ?",
      [id],
    )

    const constraints = {
      activity_logs: logsCount[0].count,
      raga_bookmarks: bookmarksCount[0].count,
      detector_scores: scoresCount[0].count,
    }

    // Calculate aggregate rows flagged for deletion
    const totalLinkedRows = Object.values(constraints).reduce(
      (a, b) => a + b,
      0,
    )

    return NextResponse.json({
      success: true,
      hasConstraints: totalLinkedRows > 0,
      totalLinkedRows,
      constraints,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 })
  }
}

// PUT: Admin update on restricted fields (Password, Admin Flag, Remark)
export async function PUT(req, { params }) {
  try {
    await verifyAdminAccess()
    const { id } = params
    const { password, admin, remark } = await req.json()

    const pool = getPool()
    let query = "UPDATE raga_users SET admin = ?, remark = ?"
    let queryParams = [admin ? 1 : 0, remark || ""]

    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password.trim(), 10)
      query += ", password = ?"
      queryParams.push(hashedPassword)
    }

    query += " WHERE id = ?"
    queryParams.push(id)

    await pool.query(query, queryParams)

    return NextResponse.json({
      success: true,
      message: "User privileges updated successfully.",
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 })
  }
}

// DELETE: Executes a programmatic atomic cascading sweep across all tables
export async function DELETE(req, { params }) {
  try {
    await verifyAdminAccess()
    const { id } = params
    const pool = getPool()

    // 1. Initialize safe database sequential lock transaction
    await pool.query("START TRANSACTION")

    try {
      // 2. Programmatic cascade: Purge all nested dependencies first to clear constraints
      await pool.query("DELETE FROM user_activity_logs WHERE user_id = ?", [id])
      await pool.query("DELETE FROM user_raga_bookmarks WHERE user_id = ?", [
        id,
      ])
      await pool.query("DELETE FROM detector_scores WHERE user_id = ?", [id])

      // 3. Purge the main master parent row record
      const [result] = await pool.query("DELETE FROM raga_users WHERE id = ?", [
        id,
      ])

      if (result.affectedRows === 0) {
        throw new Error("Target user profile was not found.")
      }

      await pool.query("COMMIT")
      return NextResponse.json({
        success: true,
        message: "User account and all relational history wiped.",
      })
    } catch (transactionError) {
      // Rollback database changes to original states if any tracking query crashes
      await pool.query("ROLLBACK")
      throw transactionError
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
