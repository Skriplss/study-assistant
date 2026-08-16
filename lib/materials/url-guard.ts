import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * Guards for fetching a URL the user typed in.
 *
 * Without them `POST /api/materials` is a read-SSRF: the server fetches whatever
 * address it is handed and hands the extracted text back to the caller, which
 * turns "import a web page" into "read anything my server can reach" — cloud
 * metadata, localhost, the private network.
 *
 * Known limit: the address is validated, then `fetch` resolves the hostname
 * again on its own, so a DNS entry that flips between the two answers (rebinding)
 * can still slip through. Closing that needs connecting to the pinned IP, which
 * breaks TLS certificate validation. Literal-address and redirect attacks — the
 * ones that actually get used — are blocked.
 */

const TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 3
export const MAX_PAGE_BYTES = 5 * 1024 * 1024

/** Message is user-visible (it lands in `parsing_error`), so keep it generic. */
const NOT_PUBLIC = 'Only public web addresses can be imported'

function isBlockedIPv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) {
    return true
  }
  const [a, b] = parts

  return (
    a === 0 || // 0.0.0.0/8 "this host"
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 0) || // 192.0.0/24 + 192.0.2/24
    (a === 192 && b === 168) || // private
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast, reserved, broadcast
  )
}

function isBlockedIPv6(address: string): boolean {
  const ip = address.toLowerCase().split('%')[0] // drop any zone index

  // IPv4-mapped forms are IPv4 targets wearing a costume. Both spellings have to
  // be caught: `new URL()` rewrites `::ffff:127.0.0.1` into hextets (`::ffff:7f00:1`),
  // so matching only the dotted tail lets loopback straight through.
  const embedded = ip.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (embedded) return isBlockedIPv4(embedded[1])

  const mapped = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (mapped) {
    const hi = parseInt(mapped[1], 16)
    const lo = parseInt(mapped[2], 16)
    return isBlockedIPv4(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`)
  }

  if (ip === '::' || ip === '::1') return true
  if (/^f[cd]/.test(ip)) return true // unique-local fc00::/7
  if (/^fe[89ab]/.test(ip)) return true // link-local fe80::/10
  if (/^ff/.test(ip)) return true // multicast

  return false
}

function isBlockedAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return isBlockedIPv4(address)
  if (family === 6) return isBlockedIPv6(address)
  return true
}

/**
 * Parse `raw`, require http(s), and verify every address it resolves to is
 * routable on the public internet. Rejects if *any* answer is private — picking
 * the good one out of a split answer would defeat the check.
 */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Invalid URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs can be imported')
  }

  // A literal address never goes near the resolver.
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) throw new Error(NOT_PUBLIC)
    return url
  }

  // The resolver's own error text (`getaddrinfo EAI_AGAIN …`) would be echoed
  // straight back to the user by the create-material route. Say what happened
  // instead of forwarding node's wording.
  let answers
  try {
    answers = await lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new Error('Could not resolve that address')
  }

  if (
    answers.length === 0 ||
    answers.some((a) => isBlockedAddress(a.address))
  ) {
    throw new Error(NOT_PUBLIC)
  }

  return url
}

/** Read at most MAX_PAGE_BYTES, then stop pulling — an endless body must not OOM us. */
async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ''

  const decoder = new TextDecoder()
  let text = ''
  let size = 0

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      text += decoder.decode(value, { stream: true })
      if (size >= MAX_PAGE_BYTES) break
    }
  } finally {
    await reader.cancel().catch(() => {})
  }

  return text
}

/**
 * Fetch a user-supplied page: public addresses only, redirects re-checked hop by
 * hop, bounded time and size. Returns the raw HTML.
 */
export async function fetchExternalPage(raw: string): Promise<string> {
  let url = await assertPublicHttpUrl(raw)

  for (let hop = 0; ; hop++) {
    const response = await fetch(url, {
      // Automatic redirects would follow the chain past our check — the whole
      // point is to re-validate every hop ourselves.
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StudyAssistant/1.0)' },
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location)
        throw new Error(`Fetch failed with status ${response.status}`)
      if (hop >= MAX_REDIRECTS) throw new Error('Too many redirects')

      url = await assertPublicHttpUrl(new URL(location, url).toString())
      continue
    }

    if (!response.ok)
      throw new Error(`Fetch failed with status ${response.status}`)

    const contentType = response.headers.get('content-type') ?? ''
    if (!/^text\/(html|plain)/i.test(contentType)) {
      throw new Error('That address does not return a text page')
    }

    return readCapped(response)
  }
}
