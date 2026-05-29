"use client"

export default function RootError({ error, reset }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 text-gray-900 p-6">
      <div className="max-w-2xl w-full bg-white shadow-xl rounded-3xl border border-red-200 p-8">
        <h1 className="text-3xl font-bold text-red-700 mb-4">
          Something went wrong
        </h1>
        <p className="text-gray-700 mb-4">
          The application failed to render. This error boundary is showing the
          actual error message.
        </p>
        <div className="bg-red-100 border border-red-200 rounded-xl p-4 mb-4">
          <p className="font-semibold text-red-700">Error:</p>
          <pre className="whitespace-pre-wrap text-sm text-gray-800">
            {error?.message}
          </pre>
        </div>
        <button
          className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-3 rounded-lg"
          onClick={() => reset()}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
