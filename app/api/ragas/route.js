import { NextResponse } from "next/server"
import { getPool } from "../../../lib/db"

export async function GET(request) {
  try {
    const pool = getPool()
    const url = new URL(request.url)
    const chakra = url.searchParams.get("chakra")
    const params = []
    let sql =
      "SELECT mela_no, mela_name, swaram, song_path, chakra_no, chakra_name FROM mela_raga"
    if (chakra) {
      sql += " WHERE chakra_no = ?"
      params.push(chakra)
    }
    sql += " ORDER BY mela_no LIMIT 200"
    const [rows] = await pool.query(sql, params)
    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
