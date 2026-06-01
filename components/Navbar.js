"use client"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"

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

  // NEWLY ADDED: Modal visibility state for Mela Raga Keyboard credits
  const [isCreditsOpen, setIsCreditsOpen] = useState(false)

  const navItems = [
    {
      label: "Mela Ragas ",
      href: "/",
      special: false,
      subItems: [
        { label: "Play & Feel ", href: "/" },
        { label: "Features", href: "/features" },
      ],
    },
    {
      label: "Member Accounts",
      href: "/admin/members",
      special: true, // Only visible/clickable by users with admin(true) privileges
      subItems: [{ label: "Members List", href: "/admin/members" }],
    },
    {
      label: "Projects",
      href: "/admin",
      special: true,
      subItems: [
        { label: "Assign Tasks", href: "/projects" },
        { label: "View Tasks", href: "/projects/tasks" },
      ],
    },
    {
      label: "Recite a 'SWARA'",
      href: "/health",
      special: false,
      subItems: [{ label: "I will find out..", href: "/note-detector" }],
    },
    {
      label: "Your Profile",
      href: "/profile",
      special: false,
      subItems: [{ label: "Edit Your Profile", href: "/profile" }],
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
          {/* REPLACED: EnterpriseApp heading is now an interactive text-button trigger */}
          <button
            onClick={() => setIsCreditsOpen(true)}
            className="text-left font-black text-xl md:text-2xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-emerald-400 to-sky-400 hover:brightness-110 transition-all duration-150 cursor-pointer px-2 focus:outline-none"
          >
            Mela Raga KeyBoard
          </button>

          <div className="flex flex-col space-y-1 overflow-y-auto">
            {navItems.map((item, index) => {
              const isSpecial = item.special
              const hasAccess = !isSpecial || user?.isAdmin

              if (!hasAccess) return null

              const isDropdownActive = openDropdown === index

              return (
                <div key={item.label} className="flex flex-col">
                  <button
                    onClick={() => toggleDropdown(index)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wide flex justify-between items-center transition-all ${
                      isDropdownActive
                        ? "bg-gray-800 text-indigo-400"
                        : "text-gray-300 hover:bg-gray-800/60 hover:text-white"
                    }`}
                  >
                    <span>{item.label}</span>
                    <span
                      className={`text-[10px] transform transition-transform duration-150 ${isDropdownActive ? "rotate-180" : ""}`}
                    >
                      ▼
                    </span>
                  </button>

                  {isDropdownActive && item.subItems && (
                    <div className="pl-4 mt-1 space-y-1 border-l border-gray-800 ml-3">
                      {item.subItems.map((sub) => (
                        <Link
                          key={sub.label}
                          href={sub.href}
                          onClick={() => setOpenDropdown(-1)}
                          className="block px-3 py-2 rounded-md text-xs font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </nav>

      {/* NEWLY ADDED: MODAL POPUP FOR MELA RAGA KEYBOARD CREDITS */}
      {isCreditsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-2xl text-white overflow-hidden transform transition-all">
            {/* Top Accented Border Line Decor */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-emerald-500 to-sky-500" />

            {/* Close Button Top Right corner */}
            <button
              onClick={() => setIsCreditsOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white font-bold text-xl cursor-pointer focus:outline-none"
            >
              &times;
            </button>

            {/* Profile Header Block */}
            <div className="flex flex-col items-center mb-5 mt-2">
              <div className="relative w-24 h-24 rounded-full border-4 border-gray-700 bg-gray-900 overflow-hidden shadow-inner flex items-center justify-center">
                <img
                  src="/appicons/anand02.png"
                  alt="Ananda Manoharan Profile Avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = "/default-avatar.png"
                  }}
                />
              </div>
              <h3 className="text-xl font-black mt-3 tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
                Project Credits
              </h3>
            </div>

            {/* Project Specifications Block */}
            <div className="space-y-4 text-sm leading-relaxed text-gray-300">
              <p>
                <strong className="text-gray-400 uppercase text-xs tracking-wider block mb-0.5">
                  Designed & Developed by:
                </strong>
                <span className="text-white font-bold text-base">
                  Ananda Manoharan & Google AI
                </span>
              </p>

              <div className="grid grid-cols-2 gap-3 bg-gray-900/50 border border-gray-700/50 p-3 rounded-xl">
                <div>
                  <strong className="text-gray-400 uppercase text-[10px] tracking-wider block mb-0.5">
                    SW Tools Used:
                  </strong>
                  <span className="text-emerald-400 font-semibold text-xs block mt-0.5">
                    Next-JS, JavaScript, Tailwind
                  </span>
                </div>
                <div>
                  <strong className="text-gray-400 uppercase text-[10px] tracking-wider block mb-0.5">
                    Time Spent:
                  </strong>
                  <span className="text-sky-400 font-semibold text-xs block mt-0.5">
                    5 days &times; 10 hrs
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-400 italic">
                Completed on :{" "}
                <span className="text-gray-300 font-semibold not-italic">
                  31 MAY 2026
                </span>
              </p>

              {/* Gratitude & Shoutouts Container Blocks */}
              <div className="border-t border-gray-700/60 pt-3 space-y-3">
                <p className="text-xs">
                  <strong className="text-amber-400 uppercase text-[10px] tracking-widest font-black block mb-0.5">
                    My Gratitude to:
                  </strong>
                  <span className="text-gray-200 font-medium">
                    &quot;Mr. Brad Schiff&quot;, Lecturer, Udemy Academy
                  </span>
                </p>

                <p className="text-xs">
                  <strong className="text-sky-400 uppercase text-[10px] tracking-widest font-black block mb-0.5">
                    Special Thanks to:
                  </strong>
                  <span className="text-gray-200 font-medium leading-relaxed block mt-0.5">
                    Mr. Raveendran P &amp; all{" "}
                    <span className="text-indigo-400 font-bold font-mono text-sm px-1 bg-gray-900 rounded">
                      கடைசி பக்கம்
                    </span>{" "}
                    Members who Encouraged me to study Carnatic Music Theory.
                  </span>
                </p>
              </div>
            </div>

            {/* Bottom Dismiss Action */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsCreditsOpen(false)}
                className="px-5 py-2 rounded-xl bg-gray-700 text-white font-bold text-sm tracking-wide hover:bg-gray-600 active:scale-95 transition-all duration-100 cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
