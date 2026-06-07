"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { updateProfilePhoto } from "@/app/api/actions/user"

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

  const [profile, setProfile] = useState({
    id: initialData?.id || "",
    first_name: initialData?.first_name || "",
    last_name: initialData?.last_name || "",
    email: initialData?.email || "",
    address: initialData?.address || "",
    phone_number: initialData?.phone_number || "",
    password: "",
    loc_visible: initialData?.loc_visible ?? 1,
    attend: initialData?.attend ?? 0, // 👈 Added attend to state initialization
    lat: initialData?.lat || "",
    lon: initialData?.lon || "",
    photo_path: initialData?.photo_path || "",
  })

  const [message, setMessage] = useState({ type: "", text: "" })
  const [loading, setLoading] = useState(false)
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
        attend: initialData.attend === 1 || initialData.attend === true, // 👈 Added boolean conversion
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
        setTempCoords({ lat: 13.0827, lon: 80.2707 })
      }
    }
  }, [initialData])

  function MapClickHandler() {
    useMapEvents({
      click(e) {
        setTempCoords({
          lat: e.latlng.lat,
          lon: e.latlng.lng,
        })
      },
    })
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

  // 🔄 Dedicated toggle click handler for your attendance status button
  const toggleAttendance = () => {
    setProfile((prev) => ({
      ...prev,
      attend: !prev.attend,
    }))
  }

  const handlePhotoClick = () => {
    fileInputRef.current.click()
  }

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
          password: profile.password || null,
          locVisible: profile.loc_visible ? 1 : 0,
          attend: profile.attend ? 1 : 0, // 👈 Added attend parameter to PUT body payload
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
        setProfile((prev) => ({ ...prev, password: "" }))
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

    const localPreviewUrl = URL.createObjectURL(selectedFile)
    setProfile((prev) => ({ ...prev, photo_path: localPreviewUrl }))

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
        const dbResult = await updateProfilePhoto(profile.id, data.photo_path)
        if (dbResult.success) {
          setProfile((prev) => ({ ...prev, photo_path: data.photo_path }))
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
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl mx-auto bg-white p-6 rounded-2xl shadow-md border space-y-6"
    >
      {/* Profile Photo Display Block */}
      <div className="flex flex-col items-center space-y-2">
        <div
          onClick={handlePhotoClick}
          className="w-24 h-24 rounded-full border-4 border-indigo-100 overflow-hidden cursor-pointer hover:opacity-80 relative group"
        >
          <img
            src={
              profile.photo_path
                ? profile.photo_path.startsWith("blob:")
                  ? profile.photo_path
                  : `/api/photos/${profile.photo_path}`
                : "/default-avatar.png"
            }
            alt="Profile Avatar"
            className="w-full h-full object-cover"
          />
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png"
          className="hidden"
        />
        <p className="text-xs text-gray-400">
          Click avatar frame block to upload a new PNG profile image
        </p>
      </div>

      {/* Input Form Fields Grid Grid Frame */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            First Name
          </label>
          <input
            type="text"
            name="first_name"
            value={profile.first_name}
            onChange={handleChange}
            className="w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Last Name
          </label>
          <input
            type="text"
            name="last_name"
            value={profile.last_name}
            onChange={handleChange}
            className="w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Email Address
          </label>
          <input
            type="email"
            name="email"
            value={profile.email}
            disabled
            className="w-full p-2.5 border rounded-lg text-sm bg-gray-100 cursor-not-allowed text-gray-500"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Physical Address
          </label>
          <input
            type="text"
            name="address"
            value={profile.address}
            onChange={handleChange}
            className="w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Phone Number
          </label>
          <input
            type="text"
            name="phone_number"
            value={profile.phone_number}
            onChange={handleChange}
            className="w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            New Password (Leave empty to keep current)
          </label>
          <input
            type="password"
            name="password"
            value={profile.password}
            onChange={handleChange}
            className="w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white"
          />
        </div>
      </div>

      {/* 🚀 TOGGLE BUTTON: New Attendance Control Section Block */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">
            Attendance Status
          </h3>
          <p className="text-xs text-gray-500">
            Toggle whether you are currently active on duty or out of office.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleAttendance}
          className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm tracking-wide transition-all duration-200 cursor-pointer ${
            profile.attend
              ? "bg-emerald-600 text-white hover:bg-emerald-700 ring-4 ring-emerald-50"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300 ring-4 ring-gray-50"
          }`}
        >
          {profile.attend ? "👍 Attending" : "👎 Not-Attending"}
        </button>
      </div>

      {/* Configuration Switches Panel (Location Visibility Control Switch) */}
      <div className="flex items-center space-x-3 p-2">
        <input
          type="checkbox"
          id="loc_visible"
          name="loc_visible"
          checked={profile.loc_visible}
          onChange={handleChange}
          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
        />
        <label
          htmlFor="loc_visible"
          className="text-xs font-medium text-gray-700 select-none"
        >
          Allow background coordinate polling visibility on administrative
          tracking dashboard modules
        </label>
      </div>

      {/* Spatial Location Coordinate Picker Blocks Component Frame Container */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">
            Geospatial Tracking Anchors:
          </span>
          <button
            type="button"
            onClick={() => setShowMap(!showMap)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
          >
            {showMap ? "Close Map Canvas" : "Select Coordinates on Map"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            Latitude:
            <span className="font-mono bg-gray-100 px-2 py-1 rounded block mt-1">
              {profile.lat || "Not Set"}
            </span>
          </div>
          <div>
            Longitude:
            <span className="font-mono bg-gray-100 px-2 py-1 rounded block mt-1">
              {profile.lon || "Not Set"}
            </span>
          </div>
        </div>

        {showMap && (
          <div className="space-y-2">
            <div className="h-[300px] w-full rounded-xl overflow-hidden border">
              <MapContainer
                center={
                  tempCoords
                    ? [tempCoords.lat, tempCoords.lon]
                    : [13.0827, 80.2707]
                }
                zoom={13}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
                />
                <MapClickHandler />
              </MapContainer>
            </div>
            <button
              type="button"
              onClick={confirmLocationSelection}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Confirm Coordinate Anchor Points
            </button>
          </div>
        )}
      </div>

      {/* Feedback Message Block */}
      {message.text && (
        <div
          className={`p-3 rounded-lg text-xs font-medium ${
            message.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Footer Form Submission Block Buttons Wrapper Layout Panel */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-gray-900 text-white text-xs font-bold rounded-xl tracking-wide hover:bg-gray-800 disabled:opacity-50 transition-opacity cursor-pointer"
      >
        {loading ? "Saving Profile Modifications..." : "Save Profile Details"}
      </button>
    </form>
  )
}
