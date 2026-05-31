import { readFileSync, statSync, existsSync, readdirSync } from "fs"
import path from "path"
import { NextResponse } from "next/server"

export async function GET(request, { params }) {
  const { filename } = params
  const storageDir = process.env.MELA_SONGS_STORAGE_DIR

  if (!storageDir) {
    return new NextResponse("Server Configuration Missing", { status: 500 })
  }

  // Define fallback target parameters
  let safeFilename = path.basename(filename)
  let filePath = path.join(storageDir, safeFilename)

  // 1. LINUX CASE-SENSITIVITY ENFORCEMENT
  if (!existsSync(filePath)) {
    try {
      // Natively read the exact items inside your production folder
      const files = readdirSync(storageDir)

      // Look for a match by forcing both strings to lowercase
      const matchedFile = files.find(
        (f) => f.toLowerCase() === safeFilename.toLowerCase(),
      )

      if (matchedFile) {
        filePath = path.join(storageDir, matchedFile)
        safeFilename = matchedFile
      } else {
        // Fallback info text if file is completely missing from the directory
        return new NextResponse(`Audio File Not Found: ${safeFilename}`, {
          status: 404,
        })
      }
    } catch (e) {
      return new NextResponse("Target Storage Directory Inaccessible", {
        status: 404,
      })
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

      // Read binary buffer subarray directly to prevent memory pipe leaks on Hostinger
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
    console.error("Production API Streaming Exception:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
