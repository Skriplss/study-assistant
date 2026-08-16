/**
 * @jest-environment node
 *
 * The guard runs server-side and the tests lean on real Response/ReadableStream;
 * jsdom supplies neither.
 */
import { assertPublicHttpUrl, fetchExternalPage } from '../url-guard'

jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}))

import { lookup } from 'node:dns/promises'

const mockLookup = lookup as jest.MockedFunction<typeof lookup>

/** Resolve every hostname to one address, the way dns.lookup({all:true}) does. */
const resolvesTo = (...addresses: string[]) => {
  mockLookup.mockResolvedValue(
    addresses.map((address) => ({
      address,
      family: address.includes(':') ? 6 : 4,
    })) as never
  )
}

const htmlResponse = (body: string, init: ResponseInit = {}) =>
  new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    ...init,
  })

beforeEach(() => {
  jest.resetAllMocks()
  resolvesTo('93.184.216.34')
})

describe('assertPublicHttpUrl — scheme', () => {
  it.each([
    'file:///etc/passwd',
    'ftp://example.com/x',
    'gopher://example.com',
  ])('rejects %s', async (raw) => {
    await expect(assertPublicHttpUrl(raw)).rejects.toThrow(/http/i)
  })

  it('rejects a string that is not a URL at all', async () => {
    await expect(assertPublicHttpUrl('not a url')).rejects.toThrow()
  })

  it('accepts a public https URL', async () => {
    const url = await assertPublicHttpUrl('https://example.com/article')
    expect(url.hostname).toBe('example.com')
  })
})

describe('assertPublicHttpUrl — literal addresses', () => {
  // The classic SSRF targets. These never reach dns.lookup: they are already IPs.
  it.each([
    ['loopback', 'http://127.0.0.1/'],
    ['loopback (other octet)', 'http://127.9.9.9/'],
    ['cloud metadata', 'http://169.254.169.254/latest/meta-data/'],
    ['private 10/8', 'http://10.0.0.5/'],
    ['private 172.16/12', 'http://172.20.1.1/'],
    ['private 192.168/16', 'http://192.168.1.1/'],
    ['this-host 0.0.0.0', 'http://0.0.0.0/'],
    ['CGNAT 100.64/10', 'http://100.64.0.1/'],
    ['multicast', 'http://224.0.0.1/'],
    ['IPv6 loopback', 'http://[::1]/'],
    ['IPv6 unique-local', 'http://[fd00::1]/'],
    ['IPv6 link-local', 'http://[fe80::1]/'],
    ['IPv4-mapped IPv6 loopback', 'http://[::ffff:127.0.0.1]/'],
  ])('rejects %s', async (_name, raw) => {
    await expect(assertPublicHttpUrl(raw)).rejects.toThrow(/public/i)
  })

  it('accepts a public literal address', async () => {
    await expect(
      assertPublicHttpUrl('http://93.184.216.34/')
    ).resolves.toBeInstanceOf(URL)
  })
})

describe('assertPublicHttpUrl — DNS', () => {
  it('rejects a hostname that resolves into private space', async () => {
    resolvesTo('10.1.2.3')
    await expect(
      assertPublicHttpUrl('http://internal.example.com/')
    ).rejects.toThrow(/public/i)
  })

  it('rejects when any one of several answers is private', async () => {
    // A split-horizon answer must not be usable by picking the good address.
    resolvesTo('93.184.216.34', '169.254.169.254')
    await expect(
      assertPublicHttpUrl('http://mixed.example.com/')
    ).rejects.toThrow(/public/i)
  })

  it('rejects a hostname that does not resolve', async () => {
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'))
    await expect(
      assertPublicHttpUrl('http://nope.example.com/')
    ).rejects.toThrow()
  })
})

describe('fetchExternalPage', () => {
  it('returns the body of a public page', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(htmlResponse('<h1>hi</h1>')) as never

    await expect(fetchExternalPage('https://example.com/a')).resolves.toBe(
      '<h1>hi</h1>'
    )
  })

  it('re-checks the target after a redirect and refuses a private hop', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data/' },
      })
    ) as never

    await expect(fetchExternalPage('https://example.com/a')).rejects.toThrow(
      /public/i
    )
  })

  it('follows a redirect to another public page', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { location: 'https://example.org/b' },
        })
      )
      .mockResolvedValueOnce(htmlResponse('<p>moved</p>')) as never

    await expect(fetchExternalPage('https://example.com/a')).resolves.toBe(
      '<p>moved</p>'
    )
  })

  it('gives up rather than following a redirect chain forever', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://example.com/loop' },
      })
    ) as never

    await expect(fetchExternalPage('https://example.com/a')).rejects.toThrow(
      /redirect/i
    )
  })

  it('refuses a non-HTML body instead of feeding it to the reader', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('%PDF-1.7', {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      })
    ) as never

    await expect(fetchExternalPage('https://example.com/a')).rejects.toThrow(
      /text/i
    )
  })

  it('stops reading once the body exceeds the cap', async () => {
    const chunk = 'x'.repeat(64 * 1024)
    let sent = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        // Far more than the cap; the reader must stop on its own.
        if (sent++ > 500) return controller.close()
        controller.enqueue(new TextEncoder().encode(chunk))
      },
    })
    global.fetch = jest.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    ) as never

    const text = await fetchExternalPage('https://example.com/a')
    expect(text.length).toBeLessThanOrEqual(5 * 1024 * 1024)
    expect(sent).toBeLessThan(500)
  })

  it('surfaces a failing status without exposing the body', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response('internal detail', { status: 500 })
      ) as never

    await expect(fetchExternalPage('https://example.com/a')).rejects.toThrow(
      /status 500/
    )
  })
})
