import { readFileSync, statSync, existsSync } from "fs"
import path from "path"
import { NextResponse } from "next/server"

export async function GET(request, { params }) {
  // Synchronous extraction matching Next.js 13.4 standards
  const { filename } = params
  const storageDir = process.env.MELA_SONGS_STORAGE_DIR

  if (!storageDir) {
    return new NextResponse("Server Configuration Missing", { status: 500 })
  }

  const safeFilename = path.basename(filename)
  const filePath = path.join(storageDir, safeFilename)

  if (!existsSync(filePath)) {
    return new NextResponse("Audio File Not Found", { status: 404 })
  }

  try {
    const stats = statSync(filePath)
    const totalSize = stats.size

    let contentType = "audio/mpeg"
    if (safeFilename.endsWith(".wav")) contentType = "audio/wav"
    if (safeFilename.endsWith(".ogg")) contentType = "audio/ogg"

    const rangeHeader = request.headers.get("range")

    if (rangeHeader) {
      // Parse layout "bytes=start-end"
      const parts = rangeHeader.replace(/bytes=/, "").split("-")
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1

      if (start >= totalSize || end >= totalSize) {
        return new NextResponse("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${totalSize}` },
        })
      }

      const chunkSize = end - start + 1

      // Open file buffer partition natively for Hostinger
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
      // Standard full block delivery fallback
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
    console.error("Production Audio Pipeline Exception:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
