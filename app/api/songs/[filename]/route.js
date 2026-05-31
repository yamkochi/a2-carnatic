import {
  readFileSync,
  statSync,
  existsSync,
  readdirSync,
  writeFileSync,
} from "fs"
import path from "path"
import { NextResponse } from "next/server"

export async function GET(request, { params }) {
  const { filename } = params
  const storageDir = process.env.MELA_SONGS_STORAGE_DIR

  if (!storageDir) {
    return new NextResponse(
      "Server Configuration Missing: check your .env variables",
      { status: 500 },
    )
  }

  const safeFilename = path.basename(filename)
  let filePath = path.join(storageDir, safeFilename)

  // ─── DIAGNOSTIC TEST: Attempt to write a test text file ───
  try {
    const testFileName = `${safeFilename}.txt`
    const testFilePath = path.join(storageDir, testFileName)
    const timestamp = new Date().toISOString()

    // Attempt to write the text file to the raga_uploads/mela_songs folder
    writeFileSync(
      testFilePath,
      `Path write test success at: ${timestamp}`,
      "utf8",
    )
    console.log(
      `✅ DIAGNOSTIC SUCCESS: Successfully created test file -> ${testFilePath}`,
    )
  } catch (writeError) {
    console.error(
      `❌ DIAGNOSTIC CRASH: Failed to write test file! Error: ${writeError.message}`,
    )
    // We don't return here so the application still tries to read the song file if it exists
  }
  // ─────────────────────────────────────────────────────────

  // Case-Sensitivity Safe Check for Linux Environments
  if (!existsSync(filePath)) {
    try {
      const files = readdirSync(storageDir)
      const matchedFile = files.find(
        (f) => f.toLowerCase() === safeFilename.toLowerCase(),
      )

      if (matchedFile) {
        filePath = path.join(storageDir, matchedFile)
      } else {
        return new NextResponse(
          `Audio File Completely Missing From Directory: ${safeFilename}`,
          { status: 404 },
        )
      }
    } catch (dirError) {
      return new NextResponse(
        `Storage Directory Inaccessible or Permissions Blocked. Error: ${dirError.message}`,
        { status: 404 },
      )
    }
  }

  try {
    const stats = statSync(filePath)
    const totalSize = stats.size

    let contentType = "audio/mpeg"
    if (safeFilename.toLowerCase().endsWith(".wav")) contentType = "audio/wav"
    if (safeFilename.toLowerCase().endsWith(".ogg")) contentType = "audio/ogg"

    const rangeHeader = request.headers.get("range")

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-")
      const start = parseInt(parts, 10)
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1

      if (start >= totalSize || end >= totalSize) {
        return new NextResponse("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${totalSize}` },
        })
      }

      const chunkSize = end - start + 1
      const fullBuffer = readFileSync(filePath)
      const chunkBuffer = fullBuffer.subarray(start, end + 1)

      return new NextResponse(chunkBuffer, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
        },
      })
    } else {
      const fileBuffer = readFileSync(filePath)
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Length": totalSize.toString(),
          "Content-Type": contentType,
        },
      })
    }
  } catch (error) {
    console.error("Production Stream Crash:", error)
    return new NextResponse(`Internal Server Error: ${error.message}`, {
      status: 500,
    })
  }
}
