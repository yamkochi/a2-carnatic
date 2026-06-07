import { NextResponse } from "next/server"
import { getPool } from "@/lib/db"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { sessionOptions } from "@/lib/session"
import fs from "fs/promises"
import path from "path"

// POST: COVERS CREATING NEW JANYA RAGAS AND MULTIPART TRACK UPLOADS
export async function POST(request) {
  try {
    // 1. Enforce strict server-side session role check
    const session = await getIronSession(cookies(), sessionOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access Denied." },
        { status: 403 },
      )
    }

    const pool = getPool()
    const contentType = request.headers.get("content-type") || ""

    // Case A: Multipart Form Data Handler for renaming and writing files to target disk directories
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const actionType = formData.get("actionType")

      if (actionType === "uploadJanya") {
        const file = formData.get("audioFile")
        const ragaName = formData.get("raga_name")
        const melaNo = formData.get("mela_no")
        const aroganam = formData.get("aroganam")?.toString().toUpperCase()
        const avaroganam = formData.get("avaroganam")?.toString().toUpperCase()
        const aroganam_gamakkam = JSON.parse(
          formData
             .get("aroganam_gamakkam")
             ?.toString()
             .replace(/\u00a0/g, " ") )

        const avaroganam_gamakkam = JSON.parse(
          formData
            .get("avaroganam_gamakkam")
            ?.toString()
            .replace(/\u00a0/g, " ")
        )

        if (
          !file ||
          !ragaName ||
          !melaNo ||
          !aroganam ||
          !avaroganam ||
          !aroganam_gamakkam ||
          !avaroganam_gamakkam
        ) {
          return NextResponse.json(
            { success: false, error: "Missing required tracking tokens." },
            { status: 400 },
          )
        }

        // Clean out spaces from the raga name to keep file pathways completely safe
        const cleanRagaString = ragaName
          .trim()
          .replace(/\s+/g, "_")
          .toLowerCase()
        const extension = path.extname(file.name) // Extracts e.g. '.mp3' or '.wav'

        // Formats filename strictly: janya_{mela_no}_{raga_name}.{extension}
        const targetFilename = `janya_${melaNo}_${cleanRagaString}${extension}`

        // Resolve destination environment paths
        const storageDir =
          process.env.MELA_SONGS_STORAGE_DIR ||
          path.join(process.cwd(), "public", "api", "songs")
        await fs.mkdir(storageDir, { recursive: true })

        const destinationPath = path.join(storageDir, targetFilename)
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Write the track safely to disk
        await fs.writeFile(destinationPath, buffer)

        return NextResponse.json({ success: true, filename: targetFilename })
      }
    }

    // Case B: Standard JSON payload parsing for row creation entries
    const body = await request.json()
    console.log(
      "INSERT Received POST body for new janya raga:",
      body.aroganam,
      body.aroganam_gamakkam,
    )
    const insertQuery = `
      INSERT INTO janya_raga (mela_no, raga_name, aroganam, avaroganam, aroganam_gamakkam, avaroganam_gamakkam, audio_path) 
      VALUES (?, ?, ?, ?, ?,?, ?)
    `
    await pool.execute(insertQuery, [
      parseInt(body.mela_no),
      body.raga_name,
      body.aroganam,
      body.avaroganam,
      body.aroganam_gamakkam || "",
      body.avaroganam_gamakkam || "",
      body.audio_path || "",
    ])

    return NextResponse.json({
      success: true,
      message: "Janya raga entry created successfully.",
    })
  } catch (error) {
    console.error("❌ CRITICAL JANYA BACKEND TRANSACTION DROP:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    )
  }
}
