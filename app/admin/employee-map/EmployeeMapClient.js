"use client"
import { MapContainer, TileLayer, Marker } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

export default function EmployeeMapClient({ locations }) {
  // Center map on standard baseline region (Chennai/Guindy) if locations list is empty
  const defaultCenter = [13.0827, 80.2707]

  // Dynamically calculate center point based on first active user if available
  const center =
    locations.length > 0 && locations[0].lat && locations[0].lon
      ? [parseFloat(locations[0].lat), parseFloat(locations[0].lon)]
      : defaultCenter

  // Function to create a custom HTML/Tailwind marker for each user dynamically
  const createCustomUserIcon = (user) => {
    const imageUrl = user.photo_path
      ? `/api/photos/${user.photo_path}`
      : "/default-avatar.png"

    const nameText = user.first_name || "Anonymous"

    // Inject pure HTML structure with Tailwind CSS classes into the Leaflet canvas map space
    return L.divIcon({
      className: "custom-user-marker", // Clear default leaflet styles
      html: `
        <div class="flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2">
          <!-- Outer image wrapper bubble frame pin -->
          <div class="w-12 h-12 rounded-full border-2 border-indigo-600 bg-white shadow-lg overflow-hidden flex items-center justify-center transition-transform hover:scale-110 duration-200">
            <img 
              src="${imageUrl}" 
              alt="${nameText}" 
              class="w-full h-full object-cover m-0 p-0"
              onerror="this.src='/default-avatar.png';"
            />
          </div>
          <!-- Pointer pin triangle shape tail block under avatar bubble -->
          <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-indigo-600 -mt-[1px] shadow-sm"></div>
          
          <!-- Text panel label carrying first name printed right beneath frame tail -->
          <div class="mt-1 bg-gray-900/90 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md border border-gray-800 whitespace-nowrap tracking-wide select-none max-w-[100px] truncate">
            ${nameText}
          </div>
        </div>
      `,
      iconSize: [48, 70], // Configures the boundary sizing grid area
      iconAnchor: [0, 0], // Anchors structural node center calculation coordinates
    })
  }

  return (
    <div className="h-[600px] w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner z-10 relative">
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
        />

        {locations.map((user) => {
          const userLat = parseFloat(user.lat)
          const userLon = parseFloat(user.lon)

          // Prevent app breakage if invalid coordinate string data points exist in database rows
          if (isNaN(userLat) || isNaN(userLon)) return null

          return (
            <Marker
              key={user.id}
              position={[userLat, userLon]}
              icon={createCustomUserIcon(user)}
            />
          )
        })}
      </MapContainer>
    </div>
  )
}
