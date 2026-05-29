import { NextResponse } from "next/server"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { sessionOptions } from "@/lib/session"
import fs from "fs"
import path from "path"

export async function POST(req) {
  try {
    // 1. Enforce Server Session Security Guard
    const session = await getIronSession(cookies(), sessionOptions)
    if (!session.user || !session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized upload attempt" },
        { status: 401 },
      )
    }

    // 2. Parse Multipart FormData from request stream
    const formData = await req.formData()
    const file = formData.get("photo")
    const clientUserId = formData.get("id")

    // Cross-verify that the client isn't trying to forge another user's ID
    if (
      !file ||
      !clientUserId ||
      parseInt(clientUserId) !== parseInt(session.user.id)
    ) {
      return NextResponse.json(
        { error: "Invalid upload parameters" },
        { status: 400 },
      )
    }

    // 3. Strict File Format Extensions Filter
    const originalName = file.name
    const fileExt = path.extname(originalName).toLowerCase()

    if (fileExt !== ".png") {
      return NextResponse.json(
        { error: "Only strict PNG format images are allowed." },
        { status: 400 },
      )
    }

    // 4. Resolve Absolute Storage Target from Environment
    const storageDir =
      process.env.USER_PHOTO_STORAGE_DIR ||
      "/home/yuva/Anand/a2-carnatic-kb-photos"
    const resolvedStorageDir = path.resolve(storageDir)

    // Bootstrap directory system safely if folder structure does not exist yet on the Linux host
    if (!fs.existsSync(resolvedStorageDir)) {
      fs.mkdirSync(resolvedStorageDir, { recursive: true })
    }

    const userIdString = String(session.user.id)

    // 5. HOUSEKEEPING CLEANUP STEP: Scan and purge old extensions for this user
    // Read all filenames inside the directory to catch legacy types (.jpg, .webp, .jpeg)
    const existingFiles = fs.readdirSync(resolvedStorageDir)

    existingFiles.forEach((filename) => {
      const ext = path.extname(filename).toLowerCase()
      const nameWithoutExt = path.basename(filename, path.extname(filename))

      // If the filename (without extension) exactly matches the user's ID string,
      // but it is an old file (or an old png we want to clean out clean before rewriting), purge it
      if (nameWithoutExt === userIdString) {
        const fileToPurgePath = path.join(resolvedStorageDir, filename)
        try {
          if (fs.existsSync(fileToPurgePath)) {
            fs.unlinkSync(fileToPurgePath)
            console.log(`Successfully purged old legacy asset: ${filename}`)
          }
        } catch (purgeError) {
          console.error(`Failed to clear file ${filename}:`, purgeError)
        }
      }
    })

    // 6. Unique Deterministic Filename Mapping Strategy
    const savedFileName = `${userIdString}${fileExt}`
    const absoluteDestinationPath = path.join(resolvedStorageDir, savedFileName)

    // Security Check: Block directory traversal attempts
    if (!absoluteDestinationPath.startsWith(resolvedStorageDir)) {
      return NextResponse.json(
        { error: "Directory access restricted" },
        { status: 403 },
      )
    }

    // 7. Convert file stream into buffer memory array and write to disk
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    fs.writeFileSync(absoluteDestinationPath, fileBuffer)

    // 8. Sync new profile string to the user's active cookie session state object
    session.user.photo_path = savedFileName
    await session.save()

    return NextResponse.json({
      success: true,
      message: "Legacy files cleaned and new PNG asset uploaded successfully!",
      photo_path: savedFileName,
    })
  } catch (err) {
    console.error("Critical Upload Error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
