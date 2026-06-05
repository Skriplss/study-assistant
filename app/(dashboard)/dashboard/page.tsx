import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="text-gray-600 max-w-xl">
        Upload study materials, organize them with tags and categories, and
        generate AI-powered quizzes once your files are parsed.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/materials"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          View materials
        </Link>
        <Link
          href="/materials/upload"
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium"
        >
          Upload new file
        </Link>
      </div>
    </div>
  )
}
