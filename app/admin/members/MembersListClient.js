"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function MembersListClient({
  initialUsers,
  currentAdminStatus,
}) {
  const router = useRouter()
  const [users, setUsers] = useState(initialUsers)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const [activeUser, setActiveUser] = useState(null)
  const [modalMode, setModalMode] = useState(null)
  const [editFields, setEditFields] = useState({
    password: "",
    admin: false,
    remark: "",
  })

  const [constraintData, setConstraintData] = useState(null)
  const [checkingConstraints, setCheckingConstraints] = useState(false)

  // Real-time search filter matching logic
  const filteredUsers = users.filter((member) => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true

    const matchFirstName = member.first_name
      ? member.first_name.toLowerCase().includes(query)
      : false
    const matchLastName = member.last_name
      ? member.last_name.toLowerCase().includes(query)
      : false
    const matchEmail = member.email
      ? member.email.toLowerCase().includes(query)
      : false

    return matchFirstName || matchLastName || matchEmail
  })

  // DYNAMIC LIVE LOCATION VISIBILITY TOGGLE HANDLER
  // DYNAMIC LIVE LOCATION VISIBILITY TOGGLE HANDLER (STANDARDISED FOR BOOLEAN DEPLOYMENTS)
  const handleToggleLocationVisibility = async (userId, currentStatus) => {
    // Determine the next state based on the active status
    const nextStatus = !currentStatus

    // 1. Optimistically update local state using the numeric flags expected by the render block
    setUsers((prevUsers) =>
      prevUsers.map((u) =>
        u.id === userId ? { ...u, loc_visible: nextStatus ? 1 : 0 } : u,
      ),
    )

    try {
      const res = await fetch(`/api/admin/users/${userId}/toggle-location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locVisible: nextStatus }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        // 2. Alert the admin upon verified database change success
        alert(`Success: ${data.message || "Visibility updated in database."}`)
        router.refresh()
      } else {
        // 3. Rollback local state to old value if database rejection occurs
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u.id === userId ? { ...u, loc_visible: currentStatus ? 1 : 0 } : u,
          ),
        )
        alert(`Error: ${data.error || "Failed to update database table."}`)
      }
    } catch (err) {
      // 4. Rollback local state on network connection failure
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === userId ? { ...u, loc_visible: currentStatus ? 1 : 0 } : u,
        ),
      )
      alert("Network handshake connection error. Changes reverted.")
    }
  }

  const openActionModal = async (user, mode) => {
    setActiveUser(user)
    setModalMode(mode)
    setConstraintData(null)

    if (mode === "edit") {
      setEditFields({
        password: "",
        admin: user.admin === 1 || user.admin === true,
        remark: user.remark || "",
      })
    } else if (mode === "delete") {
      setCheckingConstraints(true)
      try {
        const res = await fetch(`/api/admin/users/${user.id}`)
        if (res.ok) {
          const data = await res.json()
          setConstraintData(data)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setCheckingConstraints(false)
      }
    }
  }

  const closeActionModal = () => {
    setActiveUser(null)
    setModalMode(null)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${activeUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFields),
      })

      if (res.ok) {
        alert("Member settings committed successfully.")
        setUsers(
          users.map((u) =>
            u.id === activeUser.id
              ? {
                  ...u,
                  admin: editFields.admin ? 1 : 0,
                  remark: editFields.remark,
                }
              : u,
          ),
        )
        closeActionModal()
        router.refresh()
      } else {
        const errData = await res.json()
        alert(`Failed: ${errData.error}`)
      }
    } catch (err) {
      alert("An execution error occurred.")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSubmit = async () => {
    if (
      !confirm(
        "⚠️ CASCADE WARNING: Erase this profile and all nested database history records?",
      )
    )
      return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${activeUser.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        alert("Account completely removed.")
        setUsers(users.filter((u) => u.id !== activeUser.id))
        closeActionModal()
        router.refresh()
      } else {
        const errData = await res.json()
        alert(`Deletion Error: ${errData.error}`)
      }
    } catch (err) {
      alert("Connection failure.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* INSTANT INTERFACE FILTER ENGINE */}
      <div className="relative max-w-md w-full group">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <svg
            className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Instant search by first name, last name, or email..."
          className="w-full pl-10 pr-4 py-3 bg-white text-gray-800 text-sm font-medium border border-gray-200 rounded-xl outline-none shadow-sm transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-900 text-white sticky top-0 z-10 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="p-4 bg-gray-900">Photo</th>
                <th className="p-4 bg-gray-900">First Name</th>
                <th className="p-4 bg-gray-900">Last Name</th>
                <th className="p-4 bg-gray-900">Email Address</th>
                <th className="p-4 bg-gray-900">Phone Number</th>
                <th className="p-4 bg-gray-900">Map Visibility</th>
                <th className="p-4 bg-gray-900 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-medium text-gray-700">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((member) => {
                  // Evaluates true if loc_visible is 1 or true, accommodating the native MySQL boolean return
                  const isVisible =
                    member.loc_visible === 1 || member.loc_visible === true
                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-gray-50/70 transition-colors"
                    >
                      <td className="p-4">
                        <img
                          src={
                            member.photo_path
                              ? `/api/photos/${member.photo_path}`
                              : "/default-avatar.png"
                          }
                          alt="Avatar"
                          className="w-10 h-10 rounded-full object-cover border border-gray-200"
                          onError={(e) => {
                            e.target.src = "/default-avatar.png"
                          }}
                        />
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {member.first_name || "—"}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {member.last_name || "—"}
                      </td>
                      <td className="p-4 font-mono text-xs">{member.email}</td>
                      <td className="p-4 whitespace-nowrap text-xs text-gray-500">
                        {member.phone_number || "—"}
                      </td>

                      {/* NEW: DYNAMIC QUICK-TOGGLE SWAP CELL CONTAINER */}
                      <td className="p-4 whitespace-nowrap">
                        {currentAdminStatus ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleLocationVisibility(
                                member.id,
                                isVisible,
                              )
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                              isVisible
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                            }`}
                          >
                            {isVisible
                              ? "🟢 Visible on Map"
                              : "⚫ Hidden on Map"}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">
                            {isVisible ? "Visible" : "Hidden"}
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          {currentAdminStatus ? (
                            <>
                              <button
                                onClick={() => openActionModal(member, "edit")}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  openActionModal(member, "delete")
                                }
                                className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 font-normal italic">
                              Locked
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="p-8 text-center text-sm font-medium text-gray-400 italic bg-gray-50/50"
                  >
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OVERLAY DISMISSAL MODALS INJECTION SECTION */}
      {modalMode && activeUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white text-gray-900 rounded-2xl max-w-md w-full p-6 relative shadow-2xl">
            <button
              onClick={closeActionModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              &times;
            </button>
            <div className="flex items-center space-x-4 border-b border-gray-100 pb-4 mb-4">
              <img
                src={
                  activeUser.photo_path
                    ? `/api/photos/${activeUser.photo_path}`
                    : "/default-avatar.png"
                }
                alt="Avatar"
                className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500"
                onError={(e) => {
                  e.target.src = "/default-avatar.png"
                }}
              />
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  {modalMode === "edit"
                    ? "Modify System Settings"
                    : "Review Profile Before Deletion"}
                </h3>
                <p className="text-xs text-gray-500">
                  {activeUser.first_name} {activeUser.last_name} (
                  {activeUser.email})
                </p>
              </div>
            </div>

            {modalMode === "edit" && (
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Set New Password
                  </label>
                  <input
                    type="password"
                    value={editFields.password}
                    onChange={(e) =>
                      setEditFields({ ...editFields, password: e.target.value })
                    }
                    placeholder="Leave blank to retain old hash"
                    className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Internal Administrative Remarks
                  </label>
                  <textarea
                    rows="2"
                    value={editFields.remark}
                    onChange={(e) =>
                      setEditFields({ ...editFields, remark: e.target.value })
                    }
                    className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 resize-none"
                  />
                </div>
                <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-xl">
                  <input
                    type="checkbox"
                    id="admin_flag"
                    checked={editFields.admin}
                    onChange={(e) =>
                      setEditFields({ ...editFields, admin: e.target.checked })
                    }
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="admin_flag"
                    className="text-sm font-bold text-gray-700 select-none cursor-pointer"
                  >
                    Grant Administrator Privileges
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-sm shadow-md transition-all"
                >
                  Save Member Adjustments
                </button>
              </form>
            )}

            {modalMode === "delete" && (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-xs font-medium space-y-1.5">
                  <p className="font-bold border-b border-amber-200 pb-1 mb-1">
                    📋 Identity Profile Summary:
                  </p>
                  <p>
                    <strong>Phone:</strong>{" "}
                    {activeUser.phone_number || "None Specified"}
                  </p>
                  <p>
                    <strong>Address:</strong>{" "}
                    {activeUser.address || "No Registered Address"}
                  </p>
                  <p>
                    <strong>Remark:</strong> {activeUser.remark || "Empty"}
                  </p>
                </div>
                <div className="bg-red-50 border border-red-100 text-red-950 p-4 rounded-xl text-xs space-y-2">
                  <p className="font-bold text-red-800 uppercase tracking-wide text-[10px]">
                    ⚠️ Dynamic Cascade Dependencies Check:
                  </p>
                  {checkingConstraints ? (
                    <p className="text-gray-500 animate-pulse font-medium">
                      Scanning parameters on server...
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <ul className="list-disc pl-4 space-y-0.5 font-mono text-[11px] text-red-900">
                        <li>
                          Activity Logs:{" "}
                          {constraintData?.constraints?.activity_logs || 0} rows
                        </li>
                        <li>
                          Saved Bookmarks:{" "}
                          {constraintData?.constraints?.raga_bookmarks || 0}{" "}
                          rows
                        </li>
                        <li>
                          Detector Scores:{" "}
                          {constraintData?.constraints?.detector_scores || 0}{" "}
                          rows
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={closeActionModal}
                    className="py-2.5 border rounded-xl text-sm font-bold hover:bg-gray-50 text-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSubmit}
                    disabled={loading || checkingConstraints}
                    className="py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors shadow-md"
                  >
                    Execute Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
