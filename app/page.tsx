import { redirect } from 'next/navigation'

// The proxy redirects `/` based on auth; this is the fallback if it's ever hit.
export default function Home() {
  redirect('/auth/login')
}
