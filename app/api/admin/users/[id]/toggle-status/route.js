import { NextResponse } from "next/server"
// CORRECTED: Imported getPool strictly matching your database configuration pipeline
import { getPool } from "@/lib/db"

export async function PATCH(request, { params }) {
  try {
    // 1. Resolve dynamic routing properties safely
    const { id } = await params
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid User Identification parameter provided.",
        },
        { status: 400 },
      )
    }

    // 2. Parse the payload body variables sent by the frontend click handler
    const body = await request.json()
    const { userActive } = body

    if (userActive === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameter body payload: userActive.",
        },
        { status: 400 },
      )
    }

    // 3. Convert explicit JS true/false flags into standard 1/0 MySQL bits
    const databaseActiveBitValue = userActive ? 1 : 0

    // 4. Aquire connection pool and update the record instantly inside the database
    const pool = getPool()
    const query = "UPDATE raga_users SET user_active = ? WHERE id = ?"
    await pool.query(query, [databaseActiveBitValue, userId])

    // 5. Respond back with a verification success status code to satisfy the client component
    return NextResponse.json({
      success: true,
      message: `Account system state set to: ${userActive ? "Active" : "Not-Active"}.`,
    })
  } catch (error) {
    console.error("CRITICAL STATUS UPDATE FAILURE:", error)
    return NextResponse.json(
      {
        success: false,
        error:
          "Internal processing database error occurred while committing state changes.",
      },
      { status: 500 },
    )
  }
}
