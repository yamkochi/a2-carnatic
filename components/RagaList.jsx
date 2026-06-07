"use client"
import { useEffect, useState } from "react"

export default function RagaList() {
  const [chakraList, setChakraList] = useState([])
  const [chakraFilter, setChakraFilter] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [ragas, setRagas] = useState([])
  const [selected, setSelected] = useState(null)

  const [error, setError] = useState(null)

  useEffect(() => {
    fetchChakras()
    fetchRagas()
  }, [])

  useEffect(() => {
    fetchRagas(chakraFilter)
  }, [chakraFilter])

  async function fetchChakras() {
    try {
      //  console.log("Fetching chakra list...")
      const res = await fetch("/api/chakras")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load chakras")
      setChakraList(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setError(err.message)
    }
  }

  async function fetchRagas(chakra = "") {
    try {
      setError(null)
      const query = chakra ? `?chakra=${encodeURIComponent(chakra)}` : ""
      const res = await fetch(`/api/ragas${query}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load ragas")
      if (!Array.isArray(data))
        throw new Error("Unexpected raga response format")
      setRagas(data)
    } catch (err) {
      console.error(err)
      setError(err.message)
      setRagas([])
    }
  }

  const filteredRagas = ragas.filter((r) => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return true
    return (
      r.mela_name.toLowerCase().includes(term) ||
      String(r.mela_no).includes(term) ||
      r.swaram.toLowerCase().includes(term)
    )
  })

  return (
    <div className="bg-blue-900 p-4 rounded shadow">
      <h2 className="font-semibold text-white text-xl mb-4">Select Raga</h2>

      <div className="grid gap-4 md:grid-cols-[1fr_240px] mb-4">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <div>
            <label className="block text-xl font-medium text-white mb-1">
              Search by Raga Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type a melody name"
                className="flex-1 border border-gray-300 rounded px-3 py-2 bg-sky-300"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("")
                  setChakraFilter("")
                  setSelected(null)
                }}
                className="border border-gray-300 rounded px-3 py-2 bg-sky-300 text-gray-700 hover:bg-gray-100"
              >
                Clear
              </button>
            </div>
          </div>
          <div>
            <label className="block text-lg font-medium text-white mb-1">
              Filter by Chakra
            </label>
            <select
              value={chakraFilter}
              onChange={(e) => setChakraFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 bg-sky-300"
            >
              <option value="">All Chakras</option>
              {chakraList.map((chakra) => (
                <option key={chakra.chakra_no} value={chakra.chakra_no}>
                  {chakra.chakra_no} — {chakra.chakra_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="text-sm text-gray-500 self-end md:self-center">
          {chakraFilter
            ? `${filteredRagas.length} ragas found for chakra ${chakraFilter}`
            : `${filteredRagas.length} total ragas`}
        </div>
      </div>

      <div className="space-y-1 max-h-[16.5rem] overflow-y-auto">
        {filteredRagas.map((r, idx) => (
          <div
            key={r.mela_no}
            className={`grid grid-cols-[1fr_auto]  items-center gap-2 rounded-lg px-2 py-2 ${idx % 2 === 0 ? "bg-sky-200" : "bg-sky-300"} shadow-sm min-h-[2.75rem]`}
          >
            <div className="h-auto">
              <div className="grid grid-cols-3 w-full text-sm font-semibold text-gray-900 truncate">
                <span className="truncate">
                  {r.mela_no} — {r.mela_name}
                </span>
                <span className="text-black truncate">
                  Chakra: {r.chakra_no} — {r.chakra_name}
                </span>
                {/* <span className="text-blue-600">Swaram :</span> */}
                <span className="text-black truncate flex-wrap gap-1">
                  {"SWARAM  :  "}
                  {r.swaram.split(" ").map((note, noteIdx) => {
                    const isHighlight = note === "S" || note === "P"
                    return (
                      <span
                        key={`${note}-${noteIdx}`}
                        className={
                          isHighlight ? "text-red-600 font-semibold" : undefined
                        }
                      >
                        {note}
                        {"  "}
                      </span>
                    )
                  })}
                  <span className="text-red-600">S</span>
                </span>
              </div>
            </div>
            <button
              className="px-2 py-1 bg-blue-600 text-white rounded-md font-semibold text-xs whitespace-nowrap"
              onClick={() => {
                setSelected(r)
                window.dispatchEvent(
                  new CustomEvent("raga-selected", { detail: r }),
                )
              }}
            >
              Choose
            </button>
          </div>
        ))}
      </div>
      {error && <div className="mt-3 text-sm text-red-600">Error: {error}</div>}
      {selected && (
        <div className="mt-3 text-xl text-white">
          Selected: {selected.mela_name}
        </div>
      )}
    </div>
  )
}
