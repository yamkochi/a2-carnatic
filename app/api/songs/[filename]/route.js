import { createReadStream, statSync, existsSync } from "fs"
import path from "path"
import { NextResponse } from "next/server"

export async function GET(request, { params }) {
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
      // Cleanly parse "bytes=0-" or "bytes=0-1048576"
      const parts = rangeHeader.replace(/bytes=/, "").split("-")
      const start = parseInt(parts[0], 10)

      // FIXED: Ensure we check parts[1] correctly for the end chunk boundary
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1

      if (start >= totalSize || end >= totalSize) {
        return new NextResponse("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${totalSize}` },
        })
      }

      const chunkSize = end - start + 1
      const fileStream = createReadStream(filePath, { start, end })

      // Convert stream chunks directly into standard Web Uint8Arrays
      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) =>
            controller.enqueue(new Uint8Array(chunk)),
          )
          fileStream.on("end", () => controller.close())
          fileStream.on("error", (err) => controller.error(err))
        },
        cancel() {
          fileStream.destroy()
        },
      })

      return new NextResponse(webStream, {
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
      // Standard full file response fallback
      const fileStream = createReadStream(filePath)
      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) =>
            controller.enqueue(new Uint8Array(chunk)),
          )
          fileStream.on("end", () => controller.close())
          fileStream.on("error", (err) => controller.error(err))
        },
        cancel() {
          fileStream.destroy()
        },
      })

      return new NextResponse(webStream, {
        status: 200,
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Length": totalSize.toString(),
          "Content-Type": contentType,
        },
      })
    }
  } catch (error) {
    console.error("Pipeline streaming crash:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
