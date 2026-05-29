import { promises as fs } from "fs"
import path from "path"
import { NextResponse } from "next/server"

export async function GET(request, { params }) {
  // Await params as required by newer Next.js versions
  const { filename } = await params

  // Retrieve path from your environment variables
  const storageDir = process.env.MELA_SONGS_STORAGE_DIR

  if (!storageDir) {
    return new NextResponse(
      "Server Error: MELA_SONGS_STORAGE_DIR is not configured in .env",
      { status: 500 },
    )
  }

  // Prevent directory traversal attacks for safety
  const safeFilename = path.basename(filename)
  const filePath = path.join(storageDir, safeFilename)

  try {
    const fileBuffer = await fs.readFile(filePath)

    // Automatically detect content type matching the file extension
    let contentType = "audio/mpeg"
    if (safeFilename.endsWith(".wav")) contentType = "audio/wav"
    if (safeFilename.endsWith(".ogg")) contentType = "audio/ogg"
    if (safeFilename.endsWith(".flac")) contentType = "audio/flac"

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length.toString(),
        "Accept-Ranges": "bytes",
      },
    })
  } catch (error) {
    return new NextResponse("Audio file not found or inaccessible", {
      status: 404,
    })
  }
}
