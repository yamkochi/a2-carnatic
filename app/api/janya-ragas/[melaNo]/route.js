import { NextResponse } from "next/server"
import { getPool } from "@/lib/db"

export async function GET(request, { params }) {
  try {
    const { melaNo } = await params
    const pool = getPool()
    // console.log(`Received request for janya ragas with melaNo: ${melaNo}`)

    const query = `
  SELECT 
    janya_id, 
    mela_no, 
    raga_name, 
    aroganam, 
    avaroganam, 
    audio_path,
    aroganam_gamakkam,   -- FIX: Added column
    avaroganam_gamakkam  -- FIX: Added column
  FROM janya_raga 
  WHERE mela_no = ? 
  ORDER BY raga_name ASC
`

    const [rows] = await pool.execute(query, [parseInt(melaNo)])
    //  console.log(`Fetched ${rows.length} janya ragas for melaNo ${melaNo}`)

    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error("Janya Raga Fetch Error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    )
  }
}
