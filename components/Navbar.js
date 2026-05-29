"use client"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function Navbar({ initialUser }) {
  const router = useRouter()
  const [user, setUser] = useState(initialUser)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Auth Form State Fields
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  // Modal Flow Mode Indicators: 'login' | 'forgot' | 'register'
  const [authMode, setAuthMode] = useState("login")
  const [verificationStep, setVerificationStep] = useState(1) // 1: Collect Info / Email, 2: Collect Code
  const [verificationCode, setVerificationCode] = useState("")

  const [openDropdown, setOpenDropdown] = useState(-1)
  const navbarRef = useRef(null)

  const navItems = [
    {
      label: "Know 72 Mela Ragas ",
      href: "/",
      special: false,
      subItems: [
        { label: "Play & Learn ", href: "/" },
        { label: "Features", href: "/features" },
      ],
    },
    {
      label: "Manage System Accounts",
      href: "/admin/members",
      special: true, // Only visible/clickable by users with admin(true) privileges
      subItems: [{ label: "View Members List", href: "/admin/members" }],
    },

    {
      label: "Manage Projects",
      href: "/admin",
      special: true,
      subItems: [
        { label: "Manage Projects", href: "/projects" },
        { label: "Manage Location Icons", href: "/projects/iconmgr" },
      ],
    },
    {
      label: "Your Tone",
      href: "/health",
      special: false,
      subItems: [{ label: "Check", href: "/note-detector" }],
    },
    {
      label: "Your Profile",
      href: "/profile",
      special: false,
      subItems: [{ label: "Your Profile", href: "/profile" }],
    },
    {
      label: "Members Location",
      href: "/admin",
      special: false,
      subItems: [{ label: "View On Map", href: "/admin/employee-map" }],
    },
  ]

  useEffect(() => {
    setUser(initialUser)
  }, [initialUser])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("unauthorized") === "true") {
      setAuthMode("login")
      setIsModalOpen(true)
    }
  }, [])

  const resetFormFields = () => {
    setError("")
    setSuccessMsg("")
    setEmail("")
    setPassword("")
    setFirstName("")
    setLastName("")
    setVerificationCode("")
    setVerificationStep(1)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError("")
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const data = await response.json()
    if (response.ok) {
      setUser(data.user)
      setIsModalOpen(false)
      resetFormFields()
      router.refresh()
    } else {
      setError(data.error || "Login failed")
    }
  }

  // --- FORGOT PASSWORD SUBMIT HANDLERS ---
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccessMsg("")
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    const data = await response.json()
    if (response.ok) {
      setSuccessMsg(data.message)
      setVerificationStep(2)
    } else {
      setError(data.error || "Failed to request code.")
    }
  }

  const handleVerifyAndResetSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccessMsg("")
    const response = await fetch("/api/auth/verify-and-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: verificationCode }),
    })
    const data = await response.json()
    if (response.ok) {
      setSuccessMsg(data.message)
      setAuthMode("login")
      setVerificationStep(1)
      setVerificationCode("")
    } else {
      setError(data.error || "Invalid or expired code.")
    }
  }

  // --- ACCOUNT REGISTRATION SUBMIT HANDLERS ---
  const handleRegisterRequestSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccessMsg("")

    const response = await fetch("/api/auth/register/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    const data = await response.json()

    if (response.ok) {
      setSuccessMsg(data.message)
      setVerificationStep(2)
    } else {
      setError(data.error || "Registration initialization failed.")
    }
  }

  const handleRegisterConfirmSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccessMsg("")

    const response = await fetch("/api/auth/register/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        code: verificationCode,
        firstName,
        lastName,
        password,
      }),
    })
    const data = await response.json()

    if (response.ok) {
      setSuccessMsg(data.message)
      setTimeout(() => {
        setAuthMode("login")
        resetFormFields()
      }, 2000)
    } else {
      setError(data.error || "Invalid registration pin code.")
    }
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      setUser(null)
      setOpenDropdown(-1)
      router.push("/")
      router.refresh()
    } catch (error) {
      console.error(error)
    }
  }

  const toggleDropdown = (index) => {
    setOpenDropdown(openDropdown === index ? -1 : index)
  }

  return (
    <>
      {/* Top Header holding absolute Auth Action */}
      <div className="fixed top-0 right-0 h-16 flex items-center justify-end px-8 z-50">
        {user ? (
          <div className="flex items-center space-x-4 bg-gray-900/90 text-white py-1.5 px-3 rounded-full shadow">
            <img
              src={
                user.photo_path
                  ? `/api/photos/${user.photo_path}`
                  : "/default-avatar.png"
              }
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover border border-indigo-400"
              onError={(e) => {
                e.target.src = "/default-avatar.png"
              }}
            />
            <span className="text-sm font-medium">{user.first_name}</span>
            <button
              onClick={handleLogout}
              className="text-sm bg-red-600 hover:bg-red-700 px-3 py-1 rounded-full transition-colors"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setAuthMode("login")
              setIsModalOpen(true)
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-full font-medium transition-colors shadow"
          >
            Login
          </button>
        )}
      </div>

      {/* Left Vertical Side Navigation */}
      <nav
        ref={navbarRef}
        className="fixed top-0 left-0 h-screen w-64 bg-gray-900 text-white py-6 px-4 flex flex-col justify-between shadow-2xl z-40"
      >
        <div className="flex flex-col space-y-6">
          <Link
            href="/"
            className="font-bold text-2xl tracking-wider text-indigo-400 px-2"
          >
            EnterpriseApp
          </Link>

          <div className="flex flex-col space-y-1 overflow-y-auto">
            {navItems.map((item, index) => {
              const isSpecial = item.special
              const hasAccess = !isSpecial || user?.isAdmin

              return (
                <div key={item.label} className="w-full">
                  <button
                    onClick={() => toggleDropdown(index)}
                    className={`w-full text-left px-3 py-3 rounded-lg flex items-center justify-between text-base font-medium transition-all ${
                      !hasAccess
                        ? "opacity-40 bg-gray-950/20"
                        : "hover:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span>{item.label}</span>
                      {isSpecial && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${openDropdown === index ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Vertically expanding sub-menu options inside sidebar */}
                  {openDropdown === index && (
                    <div className="mt-1 ml-4 pl-2 border-l border-gray-700 space-y-1 flex flex-col">
                      {item.subItems.map((sub) => {
                        const canClickSub = !isSpecial || user?.isAdmin
                        return canClickSub ? (
                          <Link
                            key={sub.label}
                            href={sub.href}
                            className="text-sm text-gray-400 hover:text-white py-1.5 px-2 rounded hover:bg-gray-800/50 transition-colors"
                          >
                            {sub.label}
                          </Link>
                        ) : (
                          <span
                            key={sub.label}
                            className="text-sm text-gray-600 py-1.5 px-2 cursor-not-allowed select-none"
                          >
                            {sub.label} (Locked)
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Auth Dialog Modal Overlay System */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white text-gray-900 rounded-2xl max-w-sm w-full p-6 relative shadow-2xl">
            <button
              onClick={() => {
                setIsModalOpen(false)
                resetFormFields()
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-xl"
            >
              &times;
            </button>

            {/* Global Message Displayers */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded mb-2">
                {error}
              </p>
            )}
            {successMsg && (
              <p className="text-sm text-green-600 bg-green-50 p-2 rounded mb-2">
                {successMsg}
              </p>
            )}

            {/* SCENARIO A: SIGN IN VIEW MODE */}
            {authMode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800">
                  Account Login
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-semibold transition-colors shadow"
                >
                  Sign In
                </button>

                <div className="flex flex-col items-center gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("forgot")
                      resetFormFields()
                    }}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Forgot Password?
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("register")
                      resetFormFields()
                    }}
                    className="text-xs text-emerald-600 font-semibold hover:underline"
                  >
                    Create a New Account
                  </button>
                </div>
              </form>
            )}

            {/* SCENARIO B: RESET FORGOT PASSWORD MODE */}
            {authMode === "forgot" && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800">
                  Reset Password
                </h3>
                {verificationStep === 1 ? (
                  <form
                    onSubmit={handleForgotPasswordSubmit}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Enter Registered Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-semibold transition-colors"
                    >
                      Request Reset Pin
                    </button>
                  </form>
                ) : (
                  <form
                    onSubmit={handleVerifyAndResetSubmit}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        4-Digit Verification Code
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        required
                        className="w-full border p-2.5 rounded-lg text-center tracking-widest font-bold text-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-semibold transition-colors"
                    >
                      Verify Code & Reset
                    </button>
                  </form>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login")
                    resetFormFields()
                  }}
                  className="text-xs text-gray-500 hover:underline block text-center w-full mt-2"
                >
                  Back to Login
                </button>
              </div>
            )}

            {/* SCENARIO C: ONE-TIME 4-DIGIT REGISTRATION MODE */}
            {authMode === "register" && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800">
                  User Registration
                </h3>

                {verificationStep === 1 ? (
                  <form
                    onSubmit={handleRegisterRequestSubmit}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-semibold transition-colors shadow"
                    >
                      Send Verification Code
                    </button>
                  </form>
                ) : (
                  <form
                    onSubmit={handleRegisterConfirmSubmit}
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Choose Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-indigo-900 mb-1 text-center font-bold">
                        Enter 4-Digit Mail Code
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        required
                        placeholder="0000"
                        className="w-full border p-2.5 text-center tracking-widest font-extrabold text-2xl rounded-lg focus:ring-2 focus:ring-emerald-500 bg-emerald-50/50 outline-none text-emerald-950"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-bold transition-colors mt-2 shadow"
                    >
                      Confirm & Create Account
                    </button>
                  </form>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login")
                    resetFormFields()
                  }}
                  className="text-xs text-gray-500 hover:underline block text-center w-full mt-1"
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
