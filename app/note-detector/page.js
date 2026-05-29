import dynamic from "next/dynamic"

const VoiceNoteDetector = dynamic(
  () => import("../../components/VoiceNoteDetector"),
  {
    ssr: false,
    loading: () => <p className="text-center py-20">Loading voice detector…</p>,
  },
)

export default function NoteDetectorPage() {
  return <VoiceNoteDetector />
}
