import { NextResponse } from "next/server"
import { getPool } from "@/lib/db"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { sessionOptions } from "@/lib/session"

// PUT: HANDLES METADATA UPDATES FOR AN EXISTING CHILD JANYA RAGA
export async function PUT(request, { params }) {
  try {
    // 1. Authenticate user context and restrict access to administrators only
    const session = await getIronSession(cookies(), sessionOptions)
    const isAdmin = session?.user?.isAdmin || session?.isAdmin

    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized access tier restriction. Admin rights required.",
        },
        { status: 403 },
      )
    }

    // 2. CORRECTED: Safely resolve dynamic routing params as an asynchronous promise
    const resolvedParams = await params
    const janyaId = parseInt(resolvedParams.janyaId)

    if (isNaN(janyaId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or missing Janya Identification parameter.",
        },
        { status: 400 },
      )
    }

    // 3. Extract the updated form data parameters sent from the client component dashboard
    const body = await request.json()

    console.log({ ...body })

    const {
      raga_name,
      aroganam,
      avaroganam,
      aroganam_gamakkam,
      avaroganam_gamakkam,
      audio_path,
    } = body

    if (
      !raga_name ||
      !aroganam ||
      !avaroganam ||
      !aroganam_gamakkam ||
      !avaroganam_gamakkam
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: raga_name, aroganam, or avaroganam.",
        },
        { status: 400 },
      )
    }

    // 4. Connect to your native MySQL database pool engine
    const pool = getPool()
    // console.log("Attempting ID:", janyaId, aroganam)
    // 5. Execute prepared statement to modify data fields strictly based on the unique auto-incrementing janya_id
    const updateQuery = `
      UPDATE janya_raga 
      SET raga_name = ?, aroganam = ?, avaroganam = ?,aroganam_gamakkam = ? ,avaroganam_gamakkam = ?, audio_path = ?
      WHERE janya_id = ?
    `
    await pool.execute(updateQuery, [
      raga_name.trim(),
      aroganam.trim(),
      avaroganam.trim(),
      JSON.parse(aroganam_gamakkam?.trim().replace(/\u00a0/g, " ")) || "",
      JSON.parse(avaroganam_gamakkam?.trim().replace(/\u00a0/g, " ")) || "",
      audio_path || "",
      janyaId,
    ])

    return NextResponse.json({
      success: true,
      message: "Janya raga configuration parameters committed successfully.",
    })
  } catch (error) {
    console.error("❌ CRITICAL JANYA ID UPDATE EXCEPTION:", error)
    return NextResponse.json(
      {
        success: false,
        error: `Database transmission failure: ${error.message}`,
      },
      { status: 500 },
    )
  }
}

// DELETE: COMPLETELY REMOVES A SPECIFIC JANYA RAGA ROW BY ID
export async function DELETE(request, { params }) {
  try {
    const session = await getIronSession(cookies(), sessionOptions)
    const isAdmin = session?.user?.isAdmin || session?.isAdmin

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden operation block." },
        { status: 403 },
      )
    }

    const resolvedParams = await params
    const janyaId = parseInt(resolvedParams.janyaId)

    if (isNaN(janyaId)) {
      return NextResponse.json(
        { success: false, error: "Invalid dynamic removal target index." },
        { status: 400 },
      )
    }

    const pool = getPool()
    await pool.execute("DELETE FROM janya_raga WHERE janya_id = ?", [janyaId])

    return NextResponse.json({
      success: true,
      message: "Janya record purged completely from database master dataset.",
    })
  } catch (error) {
    console.error("❌ JANYA REJECTION TERMINATION FAILED:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    )
  }
}
