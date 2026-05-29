import { NextResponse } from "next/server"
import { getPool } from "../../../lib/db"

export async function GET() {
  try {
    const pool = getPool()
    const [rows] = await pool.query(
      "SELECT DISTINCT chakra_no, chakra_name FROM mela_raga ORDER BY chakra_no",
    )
    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
