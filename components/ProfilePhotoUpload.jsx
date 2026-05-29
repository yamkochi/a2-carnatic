"use client"

import { useState } from "react"
import { updateProfilePhoto } from "@/app/actions/user" // 1. Import your new action

export default function ProfilePhotoUpload({ currentUser }) {
  const [photoPath, setPhotoPath] = useState(currentUser.photo_path || "")
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = async (event) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("photo", files[0])
      formData.append("id", currentUser.id)

      // 2. Upload and save the file to your secure Hostinger directory
      const response = await fetch("/api/upload-photo", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // 3. File is safe on disk! Now save the pure filename ("123.jpg") to the database
        const dbResult = await updateProfilePhoto(
          currentUser.id,
          data.photo_path,
        )

        if (dbResult.success) {
          setPhotoPath(data.photo_path) // Update UI view
          alert("Profile picture updated and saved successfully!")
        } else {
          alert(dbResult.error || "File uploaded, but database update failed.")
        }
      } else {
        alert(data.error || "File upload failed")
      }
    } catch (error) {
      console.error("Error during upload pipeline:", error)
      alert("An unexpected error occurred.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6 border rounded-lg max-w-sm mx-auto">
      <div className="relative w-32 h-32 rounded-full overflow-hidden border bg-gray-100">
        {photoPath ? (
          <img
            src={`/api/photos/${photoPath}`}
            alt="User Profile"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No Photo
          </div>
        )}
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm">
            Uploading...
          </div>
        )}
      </div>

      <label className="cursor-pointer bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
        Change Photo
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />
      </label>
    </div>
  )
}
