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
  // FIXED: Next.js catch-all parameters return an array. Extract the first item.
  const filenameArray = params.filename
  const filename = Array.isArray(filenameArray)
    ? filenameArray[0]
    : filenameArray

  if (!filename) {
    return new NextResponse("Missing file name target parameter", {
      status: 400,
    })
  }

  const storageDir = process.env.MELA_SONGS_STORAGE_DIR

  if (!storageDir) {
    return new NextResponse(
      "Server Configuration Missing: check your .env variables",
      { status: 500 },
    )
  }

  const safeFilename = path.basename(filename)
  let filePath = path.join(storageDir, safeFilename)

  // ─── DIAGNOSTIC EXPERIMENT: Test path write access ───
  try {
    const testFileName = `${safeFilename}.txt`
    const testFilePath = path.join(storageDir, testFileName)
    writeFileSync(
      testFilePath,
      `Production path confirmed at: ${new Date().toISOString()}`,
      "utf8",
    )
  } catch (writeError) {
    console.error(`DIAGNOSTIC BLOCK: ${writeError.message}`)
  }

  // Case-Insensitive verification layer
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
          `Audio file not found in storage folder: ${safeFilename}`,
          { status: 404 },
        )
      }
    } catch (dirError) {
      return new NextResponse(`Directory Read Exception: ${dirError.message}`, {
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
      const start = parseInt(parts[0], 10)
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
    return new NextResponse(`Internal Streaming Crash: ${error.message}`, {
      status: 500,
    })
  }
}
