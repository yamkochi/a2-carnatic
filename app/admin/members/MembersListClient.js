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

  // Real-time calculation loop counting all inactive directory members
  const totalInactiveMembers = users.filter(
    (u) =>
      !(u.user_active === 1 || u.user_active === true || u.user_active === "1"),
  ).length

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
  const handleToggleLocationVisibility = async (userId, currentStatus) => {
    const nextStatus = !currentStatus

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
        alert(`Success: ${data.message || "Visibility updated in database."}`)
        router.refresh()
      } else {
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u.id === userId ? { ...u, loc_visible: currentStatus ? 1 : 0 } : u,
          ),
        )
        alert(`Error: ${data.error || "Failed to update database table."}`)
      }
    } catch (err) {
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === userId ? { ...u, loc_visible: currentStatus ? 1 : 0 } : u,
        ),
      )
      alert("Network handshake connection error. Changes reverted.")
    }
  }

  // NEWLY ADDED: INSTANT USER ACCOUNT STATUS INSTANT TOGGLE HANDLER
  const handleToggleUserStatus = async (userId, currentStatus) => {
    const nextStatus = !currentStatus

    // Optimistically update the client row view setup using numerical values matching MySQL standards
    setUsers((prevUsers) =>
      prevUsers.map((u) =>
        u.id === userId ? { ...u, user_active: nextStatus ? 1 : 0 } : u,
      ),
    )

    try {
      const res = await fetch(`/api/admin/users/${userId}/toggle-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userActive: nextStatus }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        alert(`Success: ${data.message || "Account profile status committed."}`)
        router.refresh()
      } else {
        // Revert cleanly to previous true/false flag state on unexpected platform validation rejections
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u.id === userId ? { ...u, user_active: currentStatus ? 1 : 0 } : u,
          ),
        )
        alert(`Error: ${data.error || "Database transmission rejected."}`)
      }
    } catch (err) {
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === userId ? { ...u, user_active: currentStatus ? 1 : 0 } : u,
        ),
      )
      alert("Network handshake connection error. Status state reverted.")
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
      {/* FILTER & REAL-TIME STATS HEADER CONTAINER BLOCK */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
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

        {/* RE-ALIGNED: Fixed alignment push to the absolute right side using sm:ml-auto */}
        <div className="w-full sm:w-auto sm:ml-auto flex justify-end">
          <div className="px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-xl shadow-sm text-sm font-bold text-rose-700 tracking-wide select-none animate-fade-in whitespace-nowrap">
            Total Not_active Members ={" "}
            <span className="bg-rose-600 text-white font-black px-2 py-0.5 rounded-md text-xs ml-1.5 inline-block tabular-nums shadow-sm">
              {totalInactiveMembers}
            </span>
          </div>
        </div>
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
                <th className="p-4 bg-gray-900">Account Status</th>
                <th className="p-4 bg-gray-900 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-medium text-gray-700">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((member) => {
                  // Precise database evaluation for MySQL TINYINT/Boolean outputs
                  const isVisible =
                    member.loc_visible === 1 || member.loc_visible === true

                  // SAFE CORRECTION: Explicit fallback tracking to prevent default 'false' on page load
                  const isActive =
                    member.user_active === 1 ||
                    member.user_active === true ||
                    member.user_active === "1" ||
                    Boolean(member.user_active)

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-gray-50/70 transition-colors"
                    >
                      {/* 1. PHOTO COLUMN */}
                      <td className="p-4 w-16">
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

                      {/* 2. FIRST NAME COLUMN */}
                      <td className="p-4 whitespace-nowrap align-middle">
                        {member.first_name || (
                          <span className="text-gray-300 italic font-normal">
                            —
                          </span>
                        )}
                      </td>

                      {/* 3. LAST NAME COLUMN */}
                      <td className="p-4 whitespace-nowrap align-middle">
                        {member.last_name || (
                          <span className="text-gray-300 italic font-normal">
                            —
                          </span>
                        )}
                      </td>

                      {/* 4. EMAIL ADDRESS COLUMN */}
                      <td className="p-4 font-mono text-xs align-middle">
                        {member.email || (
                          <span className="text-gray-300 italic font-normal">
                            —
                          </span>
                        )}
                      </td>

                      {/* 5. PHONE NUMBER COLUMN */}
                      <td className="p-4 whitespace-nowrap text-xs text-gray-500 align-middle">
                        {member.phone_number || (
                          <span className="text-gray-300 italic font-normal">
                            —
                          </span>
                        )}
                      </td>

                      {/* 6. MAP VISIBILITY COLUMN */}
                      <td className="p-4 whitespace-nowrap align-middle">
                        {currentAdminStatus ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleLocationVisibility(
                                member.id,
                                isVisible,
                              )
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
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

                      {/* 7. ACCOUNT STATUS COLUMN */}
                      <td className="p-4 whitespace-nowrap align-middle">
                        {currentAdminStatus ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleUserStatus(member.id, isActive)
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              isActive
                                ? "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100"
                                : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                            }`}
                          >
                            {isActive ? "🟢 Active" : "🔴 Not-Active"}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">
                            {isActive ? "Active" : "Not-Active"}
                          </span>
                        )}
                      </td>

                      {/* 8. ACTIONS COLUMN */}
                      <td className="p-4 align-middle">
                        <div className="flex items-center justify-center gap-2">
                          {currentAdminStatus ? (
                            <>
                              <button
                                onClick={() => openActionModal(member, "edit")}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  openActionModal(member, "delete")
                                }
                                className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
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
                    colSpan="8"
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
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold cursor-pointer"
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
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label
                    htmlFor="admin_flag"
                    className="text-sm font-bold text-gray-700 select-none cursor-pointer"
                  >
                    Grant Administrator Privileges
                  </label>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={closeActionModal}
                    className="px-4 py-2 border rounded-xl text-sm font-bold hover:bg-gray-50 text-gray-500 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            )}

            {modalMode === "delete" && (
              <div className="space-y-4">
                {checkingConstraints ? (
                  <p className="text-sm text-gray-500 italic">
                    Analyzing relational system dependencies...
                  </p>
                ) : (
                  <div className="text-sm text-gray-600 space-y-2">
                    <p className="font-semibold text-red-600">
                      Warning: Removing this member will clear out the profile
                      completely.
                    </p>
                    {constraintData && (
                      <ul className="list-disc pl-5 space-y-1 text-xs text-gray-500">
                        <li>
                          Associated Tasks: {constraintData.tasksCount || 0}
                        </li>
                        <li>Log Audits: {constraintData.logsCount || 0}</li>
                      </ul>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={closeActionModal}
                    className="px-4 py-2 border rounded-xl text-sm font-bold hover:bg-gray-50 text-gray-500 cursor-pointer"
                  >
                    Keep Profile
                  </button>
                  <button
                    onClick={handleDeleteSubmit}
                    disabled={loading || checkingConstraints}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? "Deleting..." : "Confirm Deletion"}
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
