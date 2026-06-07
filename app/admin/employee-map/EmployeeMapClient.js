"use client"
import { useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet" // 👈 Added Popup to imports

import L from "leaflet"

function MapResizeTrigger() {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 200)
    return () => clearTimeout(timer)
  }, [map])
  return null
}

export default function EmployeeMapClient({ locations }) {
  const defaultCenter = [13.0827, 80.2707]
  const center =
    locations.length > 0 && locations[0].lat && locations[0].lon
      ? [parseFloat(locations[0].lat), parseFloat(locations[0].lon)]
      : defaultCenter

  const createCustomUserIcon = (user) => {
    const imageUrl = user.photo_path
      ? `/api/photos/${user.photo_path}`
      : "/default-avatar.png"
    const nameText = user.first_name || "Anonymous"

    return L.divIcon({
      className: "custom-user-marker",
      html: `
        <div class="flex flex-col items-center justify-center">
          <div class="w-12 h-12 rounded-full border-2 border-indigo-600 bg-white shadow-lg overflow-hidden flex items-center justify-center transition-transform hover:scale-110 duration-200">
            <img src="${imageUrl}" alt="${nameText}" class="w-full h-full object-cover m-0 p-0" onerror="this.src='/default-avatar.png';"/>
          </div>
          <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-indigo-600 -mt-[1px] shadow-sm"></div>
          <div class="mt-1 bg-gray-900/90 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md border border-gray-800 whitespace-nowrap tracking-wide select-none max-w-[100px] truncate">
            ${nameText}
          </div>
        </div>
      `,
      iconSize: [48, 70],
      iconAnchor: [24, 70],
    })
  }

  return (
    <div className="h-[600px] w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner relative">
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
      >
        <MapResizeTrigger />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
        />

        {locations.map((user) => {
          const userLat = parseFloat(user.lat)
          const userLon = parseFloat(user.lon)
          if (isNaN(userLat) || isNaN(userLon)) return null

          // Parse database boolean (handles 1/0 or true/false formats safely)
          const isAttending = Boolean(user.attend)

          return (
            <Marker
              key={user.id}
              position={[userLat, userLon]}
              icon={createCustomUserIcon(user)}
            >
              {/* 🎯 Interactive Conditional Popup Block */}
              <Popup className="custom-leaflet-popup">
                <div className="flex items-center gap-2 p-1 font-sans">
                  <span className="text-sm font-medium text-gray-700">
                    {user.email || "No Email Provided"}
                  </span>
                  {isAttending ? (
                    <span className="text-base" title="Attending">
                      👍
                    </span>
                  ) : (
                    <span className="text-base" title="Absent">
                      👎
                    </span>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
