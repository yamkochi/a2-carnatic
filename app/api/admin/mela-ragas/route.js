import { NextResponse } from "next/server"
import { getPool } from "@/lib/db"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { sessionOptions } from "@/lib/session"
import fs from "fs/promises"
import path from "path"

// GET ALL MELA RAGAS
export async function GET() {
  try {
    const pool = getPool()
    const [rows] = await pool.execute(
      "SELECT * FROM mela_raga ORDER BY mela_no ASC",
    )
    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    )
  }
}

// POST: CREATES A NEW RAGA ENTRY OR SEALS RAW AUDIO UPLOADS
export async function POST(request) {
  try {
    // 1. Authorize session context layer
    const session = await getIronSession(cookies(), sessionOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized access blocked." },
        { status: 403 },
      )
    }

    const formData = await request.formData()
    const actionType = formData.get("actionType") // "create" | "upload"
    const pool = getPool()

    if (actionType === "upload") {
      const file = formData.get("audioFile")
      const melaNo = formData.get("mela_no")

      if (!file || !melaNo) {
        return NextResponse.json(
          {
            success: false,
            error: "Missing file or target raga mapping index.",
          },
          { status: 400 },
        )
      }

      const originalName = file.name
      const extension = path.extname(originalName) // e.g., ".mp3"
      const targetFilename = `${melaNo}${extension}`

      // Resolve custom destination environment directory variables securely
      const storageDir =
        process.env.MELA_SONGS_STORAGE_DIR ||
        path.join(process.cwd(), "public", "api", "songs")
      await fs.mkdir(storageDir, { recursive: true })

      const destinationPath = path.join(storageDir, targetFilename)
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Commit physical stream write onto local server workspace disks
      await fs.writeFile(destinationPath, buffer)

      return NextResponse.json({ success: true, filename: targetFilename })
    }

    // CREATE DATA OBJECT TRANSACTION
    if (actionType === "create") {
      const mela_no = parseInt(formData.get("mela_no"))
      const chakra_no = parseInt(formData.get("chakra_no"))
      const chakra_name = formData.get("chakra_name")
      const mela_name = formData.get("mela_name")
      const swaram = formData.get("swaram")
      const song_path = formData.get("song_path") || ""

      const query =
        "INSERT INTO mela_raga (mela_no, chakra_no, chakra_name, mela_name, swaram, song_path) VALUES (?, ?, ?, ?, ?, ?)"
      await pool.execute(query, [
        mela_no,
        chakra_no,
        chakra_name,
        mela_name,
        swaram,
        song_path,
      ])

      return NextResponse.json({
        success: true,
        message: "Raga created successfully.",
      })
    }

    return NextResponse.json(
      { success: false, error: "Invalid execution parameter flag context." },
      { status: 400 },
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    )
  }
}
