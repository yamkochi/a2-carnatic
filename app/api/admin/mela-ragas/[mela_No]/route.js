import { NextResponse } from "next/server"
import { getPool } from "@/lib/db"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { sessionOptions } from "@/lib/session"

export async function PUT(request, { params }) {
  try {
    const session = await getIronSession(cookies(), sessionOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden access tier restriction." },
        { status: 403 },
      )
    }

    const { melaNo } = await params
    const body = await request.json()
    const pool = getPool()

    const query = `
      UPDATE mela_raga 
      SET chakra_no = ?, chakra_name = ?, mela_name = ?, swaram = ?, song_path = ? 
      WHERE mela_no = ?
    `
    await pool.execute(query, [
      parseInt(body.chakra_no),
      body.chakra_name,
      body.mela_name,
      body.swaram,
      body.song_path,
      parseInt(melaNo),
    ])

    return NextResponse.json({
      success: true,
      message: "Mela raga modifications saved successfully.",
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    )
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getIronSession(cookies(), sessionOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden operation block." },
        { status: 403 },
      )
    }

    const { melaNo } = await params
    const pool = getPool()

    await pool.execute("DELETE FROM mela_raga WHERE mela_no = ?", [
      parseInt(melaNo),
    ])
    return NextResponse.json({
      success: true,
      message:
        "Raga item completely removed from master dataset table row records.",
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    )
  }
}
