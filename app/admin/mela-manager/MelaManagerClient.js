"use client"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"

export default function MelaManagerClient({ initialData, currentUser }) {
  const router = useRouter()
  const [ragas, setRagas] = useState(initialData)
  const [activeRaga, setActiveRaga] = useState(null)
  const [modalMode, setModalMode] = useState(null) // "view" | "edit" | "add"
  const [selectedChakra, setSelectedChakra] = useState("ALL")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const [formFields, setFormFields] = useState({
    mela_no: "",
    chakra_no: "",
    chakra_name: "",
    mela_name: "",
    swaram: "",
    song_path: "",
  })

  // Janya Sub-System States
  const [janyaList, setJanyaList] = useState([])
  const [activeJanya, setActiveJanya] = useState(null)
  const [janyaModalMode, setJanyaModalMode] = useState(null) // "view" | "edit" | "add"
  const [janyaUploading, setJanyaUploading] = useState(false)
  const janyaFileInputRef = useRef(null)

  const [janyaFormFields, setJanyaFormFields] = useState({
    janya_id: "",
    mela_no: "",
    raga_name: "",
    aroganam: "",
    avaroganam: "",
    aroganam_gamakkam: "",
    avaroganam_gamakkam: "",
    audio_path: "",
  })

  // CORE OPERATION HANDLER FOR FORMS
  const openFormModal = async (raga, mode) => {
    console.log(
      "Entering openFormModal with mode:",
      mode,
      "and raga data:",
      raga,
    )
    setJanyaList([])
    setJanyaModalMode(null)

    if (mode === "add") {
      setFormFields({
        mela_no: "",
        chakra_no: "",
        chakra_name: "",
        mela_name: "",
        swaram: "",
        song_path: "",
      })
      setActiveRaga(null)
      setModalMode("add")
      return
    }

    const mappedFields = {
      mela_no:
        raga?.mela_no !== undefined && raga?.mela_no !== null
          ? String(raga.mela_no)
          : "",
      chakra_no:
        raga?.chakra_no !== undefined && raga?.chakra_no !== null
          ? String(raga.chakra_no)
          : "",
      chakra_name: raga?.chakra_name ?? "",
      mela_name: raga?.mela_name ?? "",
      swaram: raga?.swaram ?? "",
      song_path: raga?.song_path ?? "",
    }

    console.log("Defensively mapped fields for form state:", mappedFields)
    setFormFields(mappedFields)
    setActiveRaga(raga)
    setModalMode(mode) // This opens the worksheet block instantly

    if (raga?.mela_no) {
      try {
        const res = await fetch(`/api/janya-ragas/${raga.mela_no}`)
        if (res.ok) {
          const json = await res.json()
          if (json.success && Array.isArray(json.data)) {
            setJanyaList(json.data)
          }
        }
      } catch (err) {
        console.warn("Could not fetch child Janya scales:", err.message)
      }
    }
  }

  const closeFormModal = () => {
    setModalMode(null)
    setActiveRaga(null)
    setJanyaList([])
  }

  const openJanyaModal = (janya, mode, melaNoFallback = "") => {
    setActiveJanya(janya)
    setJanyaModalMode(mode)

    if (mode === "edit" || mode === "view") {
      setJanyaFormFields({ ...janya })
    } else if (mode === "add") {
      setJanyaFormFields({
        janya_id: "",
        mela_no: melaNoFallback || activeRaga?.mela_no || "",
        raga_name: "",
        aroganam: "",
        avaroganam: "",
        aroganam_gamakkam: "",
        avaroganam_gamakkam: "",
        audio_path: "",
      })
    }
  }

  const closeJanyaModal = () => {
    setJanyaModalMode(null)
    setActiveJanya(null)
  }

  const handleSongPathClick = () => {
    if (modalMode !== "edit" && modalMode !== "add") return
    if (!formFields.mela_no) {
      alert("Please designate a numerical Mela No first.")
      return
    }
    fileInputRef.current?.click()
  }

  const handleJanyaAudioPathClick = () => {
    if (janyaModalMode !== "edit" && janyaModalMode !== "add") return
    if (!janyaFormFields.raga_name) {
      alert("Please specify the Janya Raga Name first.")
      return
    }
    janyaFileInputRef.current?.click()
  }

  const handleFileChangeAndUpload = async (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setUploading(true)
    const formData = new FormData()
    formData.append("actionType", "upload")
    formData.append("mela_no", formFields.mela_no)
    formData.append("audioFile", selectedFile)

    try {
      const res = await fetch("/api/admin/mela-ragas", {
        method: "POST",
        body: formData,
      })
      const json = await res.json()
      if (json.success) {
        setFormFields((prev) => ({ ...prev, song_path: json.filename }))
        alert(`Success: File saved as: ${json.filename}`)
      } else {
        alert(`Upload Rejected: ${json.error}`)
      }
    } catch (err) {
      alert("Network exception writing file stream to server.")
    } finally {
      setUploading(false)
    }
  }

  const handleCRUDSubmit = async (e) => {
    e.preventDefault()
    if (
      !confirm(
        "Are you sure you want to execute and save these configuration settings?",
      )
    )
      return

    const method = modalMode === "add" ? "POST" : "PUT"
    const targetUrl =
      modalMode === "add"
        ? "/api/admin/mela-ragas"
        : `/api/admin/mela-ragas/${activeRaga.mela_no}`

    const payload = new FormData()
    if (modalMode === "add") {
      payload.append("actionType", "create")
      Object.entries(formFields).forEach(([k, v]) => payload.append(k, v))
    }

    try {
      const res = await fetch(targetUrl, {
        method,
        headers:
          modalMode === "edit"
            ? { "Content-Type": "application/json" }
            : undefined,
        body: modalMode === "add" ? payload : JSON.stringify(formFields),
      })
      const json = await res.json()

      if (json.success) {
        alert("Action successfully committed to master database table.")
        window.location.reload()
      } else {
        alert(`Execution Failure: ${json.error}`)
      }
    } catch (err) {
      alert("Handshake network layer failure.")
    }
  }

  const handleDeleteTrigger = async (melaNo) => {
    if (
      !confirm(`⚠️ WARNING: Purge Mela Raga entry row [${melaNo}] completely?`)
    )
      return
    try {
      const res = await fetch(`/api/admin/mela-ragas/${melaNo}`, {
        method: "DELETE",
      })
      const json = await res.json()
      if (json.success) {
        alert("Mela raga record permanently removed.")
        window.location.reload()
      }
    } catch (err) {
      alert("Error reaching endpoint.")
    }
  }

  // Extract unique Chakra group names for the filter bar
  const uniqueChakras = [
    "ALL",
    ...new Set(ragas.map((m) => m.chakra_name?.trim()).filter(Boolean)),
  ]

  // Filter ragas dynamically based on selection
  const filteredMela = ragas.filter(
    (m) => selectedChakra === "ALL" || m.chakra_name?.trim() === selectedChakra,
  )

  return (
    <div className="space-y-6 w-full select-none text-white bg-gray-950 p-2 rounded-2xl">
      {/* Hidden Upload Triggers */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChangeAndUpload}
        accept="audio/*"
        className="hidden"
      />

      <input
        type="file"
        ref={janyaFileInputRef}
        onChange={async (e) => {
          const selectedFile = e.target.files?.[0]
          if (!selectedFile) return
          setJanyaUploading(true)
          const formData = new FormData()
          formData.append("actionType", "uploadJanya")
          formData.append("raga_name", janyaFormFields.raga_name)
          formData.append("mela_no", janyaFormFields.mela_no)
          formData.append(
            "aroganam",
            janyaFormFields.aroganam.toUpperCase().trim(),
          )
          formData.append(
            "avaroganam",
            janyaFormFields.avaroganam.toUpperCase().trim(),
          )
          formData.append(
            "aroganam_gamakkam",
            JSON.parse(
              janyaFormFields.aroganam_gamakkam.trim().replace(/\u00a0/g, " "),
            ),
          )
          formData.append(
            "avaroganam_gamakkam",
            JSON.parse(
              janyaFormFields.avaroganam_gamakkam
                .trim()
                .replace(/\u00a0/g, " "),
            ),
          )

          formData.append("audioFile", selectedFile)

          try {
            const res = await fetch("/api/admin/janya-ragas", {
              method: "POST",
              body: formData,
            })
            const json = await res.json()
            if (json.success) {
              setJanyaFormFields((prev) => ({
                ...prev,
                audio_path: json.filename,
              }))
              alert(`Success: Janya track saved as: ${json.filename}`)
            } else {
              alert(`Upload Failed: ${json.error}`)
            }
          } catch (err) {
            alert("Network connection error handling Janya track write stream.")
          } finally {
            setJanyaUploading(false)
          }
        }}
        accept="audio/*"
        className="hidden"
      />

      {/* ENHANCED HIGH-BRIGHTNESS CHAKRA FILTER TOOLBAR BAR */}
      <div className="bg-orange-800 border-2 border-orange-500 p-3 rounded-xl flex flex-wrap items-center gap-3 shadow-xl">
        <span className="text-sm font-black uppercase tracking-widest text-amber mr-2">
          Filter By Chakra:
        </span>
        {uniqueChakras.map((chakra) => (
          <button
            key={chakra}
            type="button"
            onClick={() => setSelectedChakra(chakra)}
            className={`px-2 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-2 shadow-sm transform active:scale-95 ${
              selectedChakra === chakra
                ? "bg-amber-500 text-gray-950 border-amber-400 font-black"
                : "bg-gray-800 text-gray-200 border-gray-600 hover:bg-gray-700 hover:text-white"
            }`}
          >
            {chakra}
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center pt-1">
        <h2 className="text-sm uppercase font-black text-gray-400 tracking-widest">
          Master Mela Directory Panel
        </h2>
        <button
          type="button"
          onClick={() => openFormModal(null, "add")}
          className="bg-emerald-600 hover:bg-emerald-500 font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-widest border-2 border-emerald-500 shadow-xl transition-all transform active:scale-95"
        >
          + Add New Mela Raga
        </button>
      </div>

      {/* FIXED MAX-HEIGHT DISPLAY WINDOW (Restricted strictly to 6 rows with custom high-contrast styling) */}
      <div className="bg-blue-900 border-2 border-gray-700 rounded-xl overflow-hidden shadow-2xl">
        <div
          className="overflow-y-auto max-h-[400px] custom-scrollbar"
          style={{ height: "auto" }}
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-950 text-gray-200 font-black uppercase text-xs tracking-wider border-b-2 border-gray-700 sticky top-0 z-20 shadow-md">
              <tr>
                <th className="p-3 pl-5">No</th>
                <th className="p-3">Chakra Group</th>
                <th className="p-3">Mela Raga Name</th>
                <th className="p-3">Scale Notes (Swaram)</th>
                {/* <th className="p-3">Assigned Audio Filename</th> */}
                <th className="p-3 text-center pr-5">Action Maintenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/80 font-semibold text-gray-200 text-sm">
              {filteredMela.length > 0 ? (
                filteredMela.map((r) => (
                  <tr
                    key={r.mela_no}
                    className={`hover:bg-gray-800/50 transition-colors ${activeRaga?.mela_no === r.mela_no ? "bg-gray-800 text-white border-l-4 border-amber-400" : ""}`}
                  >
                    <td className="p-3 pl-5 text-amber-400 font-extrabold text-base tabular-nums">
                      {r.mela_no}
                    </td>
                    <td className="p-3 text-gray-300 font-medium">
                      {r.chakra_name} ({r.chakra_no})
                    </td>
                    <td className="p-3 font-black text-white text-base">
                      {r.mela_name}
                    </td>
                    <td className="p-3 font-mono text-cyan-300 text-sm font-bold tracking-wide">
                      {r.swaram}
                    </td>
                    {/* <td className="p-3 font-mono text-sm text-emerald-400 font-semibold italic">
                      {r.song_path || "— unassigned —"}
                    </td> */}
                    <td className="p-3 text-center pr-5">
                      <div className="flex items-center justify-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => openFormModal(r, "view")}
                          className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-2 border-gray-600 hover:border-gray-500 shadow-md active:scale-95"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => openFormModal(r, "edit")}
                          className="px-3.5 py-2 bg-indigo-900 text-indigo-200 border-2 border-indigo-700 hover:bg-indigo-800 hover:border-indigo-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTrigger(r.mela_no)}
                          className="px-3.5 py-2 bg-rose-950 text-rose-300 border-2 border-rose-800 hover:bg-rose-900 hover:border-rose-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    className="p-10 text-center text-gray-400 font-bold italic bg-gray-950/60 text-sm"
                  >
                    No matching records found in this selected chakra pool.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* HIGH-BRIGHTNESS DASHBOARD INTEGRATED MELA WORKSHEET CARD FORM */}
      {modalMode && (
        <div className="mt-8 bg-lime-600 border-2 border-gray-700 rounded-2xl p-7 shadow-2xl text-white relative animate-fade-in w-full overflow-hidden block">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400" />

          <div className="flex items-center justify-between border-b-2 border-gray-700 pb-4 mb-6">
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-white">
                Mela Profile Worksheet Card
              </h3>
              <p className="text-xs text-gray-300 font-semibold mt-1 uppercase tracking-wider">
                Operation Terminal:{" "}
                <span className="text-amber-400 font-black px-1.5 py-0.5 bg-black rounded">
                  {modalMode} sheet
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={closeFormModal}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 border-gray-600 hover:border-gray-500 cursor-pointer shadow-md active:scale-95"
            >
              ✕ Close Card
            </button>
          </div>

          <form
            onSubmit={handleCRUDSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm font-bold "
          >
            <div className="md:col-span-2 w-full flex flex-col gap-4">
              {/* ROW 1: Mela No & Mela Name (50/50 Split) */}
              <div className="flex flex-row gap-6 w-full items-center">
                <div className="flex flex-row items-center gap-3 flex-1">
                  <label className="text-xs font-black text-amber-400 uppercase tracking-widest whitespace-nowrap min-w-[110px]">
                    Mela No
                  </label>
                  <input
                    type="number"
                    disabled={modalMode !== "add"}
                    value={formFields.mela_no}
                    onChange={(e) =>
                      setFormFields({ ...formFields, mela_no: e.target.value })
                    }
                    required
                    className="w-full bg-black border-2 border-gray-700 focus:border-amber-400 p-3 rounded-xl font-black text-amber-400 text-base outline-none disabled:opacity-60 disabled:bg-gray-950/80 tracking-wide"
                  />
                </div>

                <div className="flex flex-row items-center gap-3 flex-1">
                  <label className="text-xs font-black text-gray-300 uppercase tracking-widest whitespace-nowrap min-w-[110px]">
                    Mela Name
                  </label>
                  <input
                    type="text"
                    disabled={modalMode === "view"}
                    value={formFields.mela_name}
                    onChange={(e) =>
                      setFormFields({
                        ...formFields,
                        mela_name: e.target.value,
                      })
                    }
                    required
                    className="w-full bg-black border-2 border-gray-700 focus:border-amber-400 p-3 rounded-xl font-black text-white text-base outline-none disabled:opacity-60 disabled:bg-gray-950/80 tracking-wide"
                  />
                </div>
              </div>

              {/* ROW 2: Chakra No & Chakra Name (50/50 Split) */}
              <div className="flex flex-row gap-6 w-full items-center">
                <div className="flex flex-row items-center gap-3 flex-1">
                  <label className="text-xs font-black text-gray-300 uppercase tracking-widest whitespace-nowrap min-w-[110px]">
                    Chakra No
                  </label>
                  <input
                    type="number"
                    disabled={modalMode === "view"}
                    value={formFields.chakra_no}
                    onChange={(e) =>
                      setFormFields({
                        ...formFields,
                        chakra_no: e.target.value,
                      })
                    }
                    required
                    className="w-full bg-black border-2 border-gray-700 focus:border-amber-400 p-3 rounded-xl font-extrabold text-white outline-none disabled:opacity-60 disabled:bg-gray-950/80 tracking-wide"
                  />
                </div>

                <div className="flex flex-row items-center gap-3 flex-1">
                  <label className="text-xs font-black text-gray-300 uppercase tracking-widest whitespace-nowrap min-w-[110px]">
                    Chakra Name
                  </label>
                  <input
                    type="text"
                    disabled={modalMode === "view"}
                    value={formFields.chakra_name}
                    onChange={(e) =>
                      setFormFields({
                        ...formFields,
                        chakra_name: e.target.value,
                      })
                    }
                    required
                    className="w-full bg-black border-2 border-gray-700 focus:border-amber-400 p-3 rounded-xl font-extrabold text-white outline-none disabled:opacity-60 disabled:bg-gray-950/80 tracking-wide"
                  />
                </div>
              </div>

              {/* ROW 3: Swaram Map Formula (3/4 Width) & Attach Audio (1/4 Width) */}
              <div className="flex flex-row gap-6 w-full items-center">
                {/* First div occupies 75% row space */}
                <div className="flex flex-row items-center gap-3 w-3/4">
                  <label className="text-xs font-black text-cyan-400 uppercase tracking-widest whitespace-nowrap min-w-[110px]">
                    Swaram Map
                  </label>
                  <input
                    type="text"
                    disabled={modalMode === "view"}
                    value={formFields.swaram}
                    onChange={(e) =>
                      setFormFields({ ...formFields, swaram: e.target.value })
                    }
                    required
                    className="w-full bg-black border-2 border-gray-700 focus:border-cyan-400 p-3 rounded-xl font-mono text-sm font-bold text-cyan-300 tracking-widest outline-none disabled:opacity-60 disabled:bg-gray-950/80 uppercase"
                  />
                </div>

                {/* Second div occupies 25% row space */}
                <div className="flex flex-row items-center gap-3 w-1/4">
                  <label className="text-xs font-black text-emerald-400 uppercase tracking-widest whitespace-nowrap min-w-[110px]">
                    Audio
                  </label>
                  <div className="relative group w-full">
                    <input
                      type="text"
                      readOnly
                      onClick={handleSongPathClick}
                      value={
                        uploading
                          ? "📡 ..."
                          : formFields.song_path
                            ? "🎵 Track"
                            : "No File"
                      }
                      className={`w-full bg-black border-2 p-3 rounded-xl font-mono text-sm text-emerald-400 font-bold outline-none select-none text-center transition-colors truncate
            ${modalMode === "view" ? "border-gray-800 opacity-60 bg-gray-950/40" : "border-gray-700 hover:border-emerald-400 cursor-pointer"}`}
                    />
                    {modalMode !== "view" && !uploading && (
                      <span className="absolute right-3 top-3.5 text-[10px] font-black uppercase text-gray-400 pointer-events-none group-hover:text-emerald-400 tracking-wider bg-gray-900 px-1.5 py-0.5 rounded border border-gray-700">
                        📁
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 p-2 border-t-2 border-gray-700 flex justify-end gap-3 w-full">
              <button
                type="button"
                onClick={closeFormModal}
                className="px-5 py-2.5 text-xs font-black uppercase tracking-wider text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl border border-gray-600 transition-colors shadow-sm"
              >
                {modalMode === "view" ? "Dismiss Card" : "Cancel"}
              </button>
              {modalMode !== "view" && (
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:brightness-110 disabled:opacity-40 font-black text-xs uppercase tracking-widest text-gray-950 rounded-xl shadow-lg cursor-pointer transition-transform active:scale-95"
                >
                  Commit Configuration
                </button>
              )}
            </div>
          </form>

          {/* HIGH-CONTRAST NESTED JANYA SUB-TABLE GRID VIEW */}
          {(modalMode === "view" || modalMode === "edit") && (
            <div className="mt-10 border-t-2 border-gray-700 pt-3 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm uppercase font-black tracking-widest text-cyan-400">
                  Connected Slave Janya Ragas
                </h4>
                {modalMode === "edit" && (
                  <button
                    type="button"
                    onClick={() =>
                      openJanyaModal(null, "add", formFields.mela_no)
                    }
                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-cyan-500 shadow-md active:scale-95"
                  >
                    + Link New Janya
                  </button>
                )}
              </div>
              <div className="bg-black border-2 border-gray-700 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto custom-scrollbar shadow-inner">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-950 text-gray-300 font-black uppercase text-xs tracking-wider sticky top-0 border-b-2 border-gray-700 z-10">
                    <tr>
                      <th className="p-3 pl-4">Janya Raga Name</th>
                      <th className="p-3">Aroganam Scale</th>
                      <th className="p-3">Avaroganam Scale</th>
                      <th className="p-3">Audio String</th>
                      {modalMode === "edit" && (
                        <th className="p-3 text-center pr-4">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700 text-white font-bold text-sm">
                    {janyaList.length > 0 ? (
                      janyaList.map((j) => (
                        <tr
                          key={j.janya_id}
                          className="hover:bg-gray-800/60 transition-colors"
                        >
                          <td className="p-3 pl-4 font-black text-cyan-400 text-base">
                            {j.raga_name}
                          </td>
                          <td className="p-3 font-mono text-emerald-400 text-sm tracking-wide bg-emerald-950/20">
                            {j.aroganam}
                          </td>
                          <td className="p-3 font-mono text-rose-400 text-sm tracking-wide bg-rose-950/20">
                            {j.avaroganam}
                          </td>
                          <td className="p-3 font-mono text-gray-300 italic font-medium">
                            {j.audio_path || "—"}
                          </td>
                          {modalMode === "edit" && (
                            <td className="p-3 text-center pr-4">
                              <button
                                type="button"
                                onClick={() => openJanyaModal(j, "edit")}
                                className="px-3 py-1.5 bg-cyan-950 text-cyan-300 hover:bg-cyan-900 border border-cyan-700 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                              >
                                Edit
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={modalMode === "edit" ? 5 : 4}
                          className="p-6 text-center text-gray-400 font-bold italic bg-gray-950/40"
                        >
                          No slave Janya tracks linked to this mela category
                          node.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* INTEGRATED SUB-SYSTEM DISK CONFIGURATION CARD FOR JANYA PROFILES */}

      {/* INTEGRATED SUB-SYSTEM DISK CONFIGURATION CARD FOR JANYA PROFILES */}
      {janyaModalMode && (
        <div className="mt-8 w-full bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 shadow-2xl text-white relative animate-fade-in block">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400" />

          <div className="flex items-center justify-between border-b-2 border-gray-700 pb-3 mb-5">
            <div>
              <h4 className="text-base font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-200 to-white">
                Janya Profile Modification Card 222
              </h4>
              <p className="text-xs text-gray-300 font-semibold mt-1 uppercase tracking-wider">
                Operational Task:{" "}
                <span className="text-cyan-400 font-black px-1.5 py-0.5 bg-black rounded">
                  {janyaModalMode} properties
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={closeJanyaModal}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 border-gray-600 hover:border-gray-500 cursor-pointer shadow-md active:scale-95"
            >
              ✕ Collapse Sheet
            </button>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (
                !confirm(
                  "Are you sure you want to commit these parameters to the Janya Raga database entry?",
                )
              )
                return
              const isAdd = janyaModalMode === "add"
              const method = isAdd ? "POST" : "PUT"
              const targetUrl = isAdd
                ? "/api/admin/janya-ragas"
                : `/api/admin/janya-ragas/${activeJanya.janya_id}`
              try {
                const res = await fetch(targetUrl, {
                  method,
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(janyaFormFields),
                })
                const json = await res.json()
                if (json.success) {
                  alert("Janya row configurations saved successfully.")
                  window.location.reload()
                } else {
                  alert(`Execution Error: ${json.error}`)
                }
              } catch (err) {
                alert("Network boundary connection timeout.")
              }
            }}
            className="space-y-5 text-sm font-bold"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-black text-amber-400 uppercase tracking-widest">
                  Associated Mela No
                </label>
                <input
                  type="number"
                  disabled
                  value={janyaFormFields.mela_no}
                  className="w-full bg-black border-2 border-gray-700 p-3 rounded-xl text-amber-400 font-black text-base outline-none disabled:opacity-60 disabled:bg-gray-950/80 tracking-wide"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-black text-gray-300 uppercase tracking-widest">
                  Janya Raga Title Name
                </label>
                <input
                  type="text"
                  disabled={janyaModalMode === "view"}
                  value={janyaFormFields.raga_name}
                  onChange={(e) =>
                    setJanyaFormFields({
                      ...janyaFormFields,
                      raga_name: e.target.value,
                    })
                  }
                  required
                  placeholder="Enter raga string label..."
                  className="w-full bg-black border-2 border-gray-700 focus:border-cyan-400 p-3 rounded-xl text-white font-black text-base outline-none disabled:opacity-50 tracking-wide"
                />
              </div>
            </div>

            <div className="flex flex-row gap-4 w-full">
              {/* First Block: Input Field */}
              <div className="flex flex-col gap-2 flex-1">
                <label className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                  Aroganam Scale Formula (Ascending)
                </label>
                <input
                  type="text"
                  disabled={janyaModalMode === "view"}
                  value={janyaFormFields.aroganam}
                  onChange={(e) =>
                    setJanyaFormFields({
                      ...janyaFormFields,
                      aroganam: e.target.value,
                    })
                  }
                  required
                  placeholder="e.g. S G3 R2 G3 M1 P D2 P S2"
                  className="w-full bg-black border-2 border-gray-700 focus:border-emerald-400 p-3 rounded-xl font-mono text-emerald-400 text-sm font-bold tracking-widest outline-none disabled:opacity-50 uppercase"
                />
              </div>

              {/* Second Block: Paragraph Element */}
              <div className="flex flex-col gap-2 flex-1">
                <label className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                  Aroganam GAMAKKAM Formula
                </label>
                <p
                  contentEditable={janyaModalMode !== "view"}
                  suppressContentEditableWarning={true}
                  onBlur={(e) =>
                    setJanyaFormFields({
                      ...janyaFormFields,
                      aroganam_gamakkam: e.target.textContent,
                    })
                  }
                  placeholder="e.g. S G3 R2 G3 M1 P D2 P S2"
                  className="w-full bg-black border-2 border-gray-700 focus:border-emerald-400 focus:outline-none p-3 rounded-xl font-mono text-emerald-400 text-sm font-bold tracking-widest min-h-[52px] flex items-center empty:before:content-[attr(placeholder)] empty:before:text-gray-600 empty:before:normal-case empty:before:font-sans empty:before:tracking-normal empty:before:font-normal read-only:opacity-50"
                  style={{
                    contentEditable:
                      janyaModalMode === "view" ? "false" : "true",
                  }}
                >
                  {janyaFormFields.aroganam_gamakkam}
                </p>
              </div>
            </div>

            <div className="flex flex-row gap-4 w-full">
              {/* First Block: Input Field */}
              <div className="flex flex-col gap-2 flex-1">
                <label className="text-xs font-black text-rose-400 uppercase tracking-widest">
                  Avaroganam Scale Formula (Descending)
                </label>
                <input
                  type="text"
                  disabled={janyaModalMode === "view"}
                  value={janyaFormFields.avaroganam}
                  onChange={(e) =>
                    setJanyaFormFields({
                      ...janyaFormFields,
                      avaroganam: e.target.value,
                    })
                  }
                  required
                  placeholder="e.g. S2 P M1 R3 S1"
                  className="w-full bg-black border-2 border-gray-700 focus:border-rose-400 p-3 rounded-xl font-mono text-rose-400 text-sm font-bold tracking-widest outline-none disabled:opacity-50 uppercase"
                />
              </div>

              {/* Second Block: Paragraph Element */}
              <div className="flex flex-col gap-2 flex-1">
                <label className="text-xs font-black text-rose-400 uppercase tracking-widest">
                  Avaroganam GAMAKKAM Formula
                </label>
                <p
                  contentEditable={janyaModalMode !== "view"}
                  suppressContentEditableWarning={true}
                  onBlur={(e) =>
                    setJanyaFormFields({
                      ...janyaFormFields,
                      avaroganam_gamakkam: e.target.textContent,
                    })
                  }
                  placeholder="e.g. S G3 R2 G3 M1 P D2 P S2"
                  className="w-full bg-black border-2 border-gray-700 focus:border-rose-400 focus:outline-none p-3 rounded-xl font-mono text-rose-400 text-sm font-bold tracking-widest min-h-[52px] flex items-center empty:before:content-[attr(placeholder)] empty:before:text-gray-600 empty:before:normal-case empty:before:font-sans empty:before:tracking-normal empty:before:font-normal read-only:opacity-50"
                  style={{
                    contentEditable:
                      janyaModalMode === "view" ? "false" : "true",
                  }}
                >
                  {janyaFormFields.avaroganam_gamakkam}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-cyan-400 uppercase tracking-widest">
                Audio asset Stream Path (audio_path)
              </label>
              <div className="relative group w-full">
                <input
                  type="text"
                  readOnly
                  onClick={handleJanyaAudioPathClick}
                  value={
                    janyaUploading
                      ? "📡 Transmitting media file asset data..."
                      : janyaFormFields.audio_path
                  }
                  placeholder={
                    janyaModalMode === "view"
                      ? "— unassigned —"
                      : "🖱️ Click here to select local drive track..."
                  }
                  className={`w-full bg-black border-2 p-3 rounded-xl font-mono text-sm text-cyan-400 font-bold text-center outline-none select-none transition-colors
                    ${janyaModalMode === "view" ? "border-gray-800 opacity-60 bg-gray-950/40" : "border-gray-700 hover:border-cyan-400 cursor-pointer"}`}
                />
                {janyaModalMode !== "view" && !janyaUploading && (
                  <span className="absolute right-4 top-3 text-xs font-black uppercase text-gray-400 pointer-events-none group-hover:text-cyan-400 tracking-wider bg-gray-900 px-2 py-0.5 rounded border border-gray-700">
                    📁 Browse
                  </span>
                )}
              </div>
            </div>

            <div className="pt-4 border-t-2 border-gray-700 flex justify-end gap-3 w-full">
              <button
                type="button"
                onClick={closeJanyaModal}
                className="px-5 py-2.5 text-xs font-black uppercase tracking-wider text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl border border-gray-600 transition-colors shadow-sm"
              >
                {janyaModalMode === "view" ? "Dismiss Sheet" : "Cancel"}
              </button>
              {janyaModalMode !== "view" && (
                <button
                  type="submit"
                  disabled={janyaUploading}
                  className="px-6 py-2.5 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 hover:brightness-110 disabled:opacity-40 font-black text-xs uppercase tracking-widest text-white rounded-xl shadow-lg cursor-pointer transition-transform active:scale-95"
                >
                  Save Janya Track Profile
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
