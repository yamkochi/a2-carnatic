import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET(request, { params }) {
  const resolvedParams = await params
  const { filename } = resolvedParams

  // 1. Get the directory path from your .env file
  const envStorageDir = process.env.USER_PHOTO_STORAGE_DIR
  if (!envStorageDir) {
    return new NextResponse("Server Configuration Error", { status: 500 })
  }

  const safeStorageDir = path.resolve(envStorageDir)
  const safeStoragePath = path.join(safeStorageDir, filename)

  // 2. Directory Traversal Security Guard
  const resolvedPath = path.resolve(safeStoragePath)
  if (!resolvedPath.startsWith(safeStorageDir)) {
    return new NextResponse("Access Denied", { status: 403 })
  }

  // 3. File validation
  if (!fs.existsSync(safeStoragePath)) {
    return new NextResponse("Image not found", { status: 404 })
  }

  // 4. Content-Type mapping
  const ext = path.extname(filename).toLowerCase()
  let contentType = "image/jpeg"
  if (ext === ".png") contentType = "image/png"
  if (ext === ".webp") contentType = "image/webp"

  // 5. Read and stream file buffer
  const fileBuffer = fs.readFileSync(safeStoragePath)
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400", // Fast local caching
    },
  })
}
