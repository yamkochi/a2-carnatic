"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { updateProfilePhoto } from "@/app/api/actions/user" // Imported database controller action layer

// Fix Leaflet marker icon asset mapping inside Next.js framework environment
import L from "leaflet"
const markerIcon = new L.Icon({
  iconUrl: "https://cloudflare.com",
  iconRetinaUrl: "https://cloudflare.com",
  shadowUrl: "https://cloudflare.com",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

export default function ProfileFormClient({ initialData }) {
  const router = useRouter()
  const fileInputRef = useRef(null)

  // FIXED: Changed currentUser references to use initialData properties cleanly
  const [profile, setProfile] = useState({
    id: initialData?.id || "",
    first_name: initialData?.first_name || "",
    last_name: initialData?.last_name || "",
    email: initialData?.email || "",
    address: initialData?.address || "",
    phone_number: initialData?.phone_number || "",
    password: "",
    loc_visible: initialData?.loc_visible ?? 1,
    lat: initialData?.lat || "",
    lon: initialData?.lon || "",
    photo_path: initialData?.photo_path || "",
  })

  const [message, setMessage] = useState({ type: "", text: "" })
  const [loading, setLoading] = useState(false)

  // Map Selection Logic Hooks
  const [showMap, setShowMap] = useState(false)
  const [tempCoords, setTempCoords] = useState(null)

  useEffect(() => {
    if (initialData) {
      setProfile({
        ...initialData,
        password: "",
        admin: initialData.admin === 1 || initialData.admin === true,
        loc_visible:
          initialData.loc_visible === 1 || initialData.loc_visible === true,
        lat: initialData.lat || "",
        lon: initialData.lon || "",
        photo_path: initialData.photo_path || "",
      })
      if (initialData.lat && initialData.lon) {
        setTempCoords({
          lat: parseFloat(initialData.lat),
          lon: parseFloat(initialData.lon),
        })
      } else {
        setTempCoords({ lat: 13.0827, lon: 80.2707 }) // Fallback Map Center (Chennai/Guindy region reference context)
      }
    }
  }, [initialData])

  // Leaflet Component to handle point-and-click operations
  function MapClickHandler() {
    useMapEvents({
      click(e) {
        // e.latlng contains { lat: ..., lng: ... }
        // Convert it to your naming format { lat: ..., lon: ... }
        setTempCoords({
          lat: e.latlng.lat,
          lon: e.latlng.lng, // Maps Leaflet 'lng' to your 'lon'
        })
      },
    })

    // Ensure the Marker uses the correct array format [lat, lon]
    return tempCoords && tempCoords.lat && tempCoords.lon ? (
      <Marker position={[tempCoords.lat, tempCoords.lon]} icon={markerIcon} />
    ) : null
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setProfile((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handlePhotoClick = () => {
    fileInputRef.current.click()
  }

  // FIXED: Consolidated text fields form submit, completely isolating photoPath updates
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: "", text: "" })

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.id,
          firstName: profile.first_name,
          lastName: profile.last_name,
          address: profile.address,
          phoneNumber: profile.phone_number,
          password: profile.password || null, // Sent plain-text; gets securely encrypted with bcrypt inside the route handler
          locVisible: profile.loc_visible ? 1 : 0,
          lat: profile.lat ? parseFloat(profile.lat) : null,
          lon: profile.lon ? parseFloat(profile.lon) : null,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setMessage({
          type: "success",
          text: "Profile details updated successfully!",
        })
        setProfile((prev) => ({ ...prev, password: "" })) // Clear out client state password input for security
        router.refresh()
      } else {
        setMessage({ type: "error", text: data.error || "Failed updates" })
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: "error", text: "Connection error" })
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = async (event) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const selectedFile = files[0]

    if (selectedFile.type !== "image/png") {
      alert("Only PNG format images are allowed.")
      return
    }

    // Local runtime blob presentation path setup
    const localPreviewUrl = URL.createObjectURL(selectedFile)
    setProfile((prev) => ({
      ...prev,
      photo_path: localPreviewUrl,
    }))

    try {
      const formData = new FormData()
      formData.append("photo", selectedFile)
      formData.append("id", profile.id)

      const response = await fetch("/api/upload-photo", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Runs our verified server action script to change column row values to 'userId.ext'
        const dbResult = await updateProfilePhoto(profile.id, data.photo_path)

        if (dbResult.success) {
          setProfile((prev) => ({
            ...prev,
            photo_path: data.photo_path,
          }))
          alert("Profile picture uploaded and saved successfully!")
          router.refresh()
        } else {
          alert(`Database Error: ${dbResult.error}`)
        }
      } else {
        alert(`Upload Error: ${data.error}`)
      }
    } catch (error) {
      console.error("The pipeline crashed:", error)
      alert("Connection error: Could not reach the server.")
    }
  }

  const confirmLocationSelection = () => {
    if (tempCoords) {
      setProfile((prev) => ({
        ...prev,
        lat: tempCoords.lat.toFixed(6),
        lon: tempCoords.lon.toFixed(6),
      }))
    }
    setShowMap(false)
  }

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-md border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Your Profile Settings
      </h2>

      {message.text && (
        <div
          className={`p-4 rounded-xl mb-6 text-sm font-medium ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Avatar Profile Section Element Container with Preview Pipeline */}
        <div className="flex flex-col items-center gap-4 mb-6">
          <div
            className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-indigo-500 bg-gray-100 cursor-pointer shadow-md group"
            onClick={handlePhotoClick}
          >
            <img
              src={
                !profile.photo_path
                  ? "/default-avatar.png"
                  : profile.photo_path.startsWith("blob:")
                    ? profile.photo_path
                    : `/api/photos/${profile.photo_path}?t=${Date.now()}` // Appends cache-buster timestamp
              }
              alt="Avatar"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = "/default-avatar.png"
              }}
            />

            <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold text-center px-1">
              Change Photo (PNG Only)
            </div>
          </div>
          <button
            type="button"
            onClick={handlePhotoClick}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Select Local PNG
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png"
            className="hidden"
          />
        </div>

        {/* Text Input Row Mappings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
              First Name
            </label>
            <input
              type="text"
              name="first_name"
              value={profile.first_name}
              onChange={handleChange}
              className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
              Last Name
            </label>
            <input
              type="text"
              name="last_name"
              value={profile.last_name}
              onChange={handleChange}
              className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
              Email (Read Only)
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full border p-3 rounded-xl bg-gray-50 text-gray-400 cursor-not-allowed outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
              Phone Number
            </label>
            <input
              type="text"
              name="phone_number"
              value={profile.phone_number}
              onChange={handleChange}
              className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
            Address
          </label>
          <textarea
            name="address"
            value={profile.address || ""}
            onChange={handleChange}
            rows="2"
            className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-gray-800"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
            New Password (Leave blank to keep current)
          </label>
          <input
            type="password"
            name="password"
            value={profile.password}
            onChange={handleChange}
            placeholder="••••••••"
            className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800"
          />
        </div>

        <div className="bg-gray-50 p-4 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">
              Account Privilege Level
            </span>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${profile.admin ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}
            >
              {profile.admin ? "Administrator" : "Standard User"}
            </span>
          </div>

          <div className="flex items-center space-x-3 pt-2 border-t border-gray-200">
            <input
              type="checkbox"
              id="loc_visible"
              name="loc_visible"
              checked={profile.loc_visible}
              onChange={handleChange}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label
              htmlFor="loc_visible"
              className="text-sm font-semibold text-gray-700 select-none"
            >
              Make My Location Visible
            </label>
          </div>
        </div>

        {/* Location Selector Action Sub-Layout Block */}
        {profile.loc_visible && (
          <div className="border border-indigo-100 p-4 rounded-xl bg-indigo-50/30 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide">
                Coordinates Tracking
              </span>
              <button
                type="button"
                onClick={() => setShowMap(!showMap)}
                className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm"
              >
                {showMap ? "Hide Map Box" : "📍 Mark Your Location"}
              </button>
            </div>

            {showMap && (
              <div className="space-y-3">
                <div className="h-64 w-full rounded-xl overflow-hidden border border-gray-300 z-10 relative">
                  <MapContainer
                    center={[
                      tempCoords?.lat || 13.0827,
                      tempCoords?.lon || 80.2707,
                    ]}
                    zoom={13}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
                    />
                    <MapClickHandler />
                  </MapContainer>
                </div>
                <button
                  type="button"
                  onClick={confirmLocationSelection}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow"
                >
                  Confirm Selected Map Pin Location
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Latitude (Read Only)
                </label>
                <input
                  type="text"
                  name="lat"
                  value={profile.lat}
                  readOnly
                  className="w-full border p-3 rounded-xl bg-gray-100 text-gray-500 font-mono cursor-not-allowed outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Longitude (Read Only)
                </label>
                <input
                  type="text"
                  name="lon"
                  value={profile.lon}
                  readOnly
                  className="w-full border p-3 rounded-xl bg-gray-100 text-gray-500 font-mono cursor-not-allowed outline-none"
                />
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white p-3.5 rounded-xl font-bold transition-all shadow-md"
        >
          {loading ? "Saving Alterations..." : "Save Changes"}
        </button>
      </form>
    </div>
  )
}
