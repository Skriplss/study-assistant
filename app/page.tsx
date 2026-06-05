import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">AI Study Assistant</h1>
      <p className="mt-4 text-lg text-gray-600 text-center max-w-lg">
        Your intelligent companion for organizing and mastering study materials
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/auth/login"
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
        >
          Log in
        </Link>
        <Link
          href="/auth/signup"
          className="px-6 py-3 border border-gray-300 rounded-md hover:bg-gray-50 font-medium"
        >
          Sign up
        </Link>
      </div>
    </main>
  )
}
