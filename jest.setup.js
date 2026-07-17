import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'
import { ReadableStream } from 'node:stream/web'

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
// @google/genai touches ReadableStream at import time and jsdom has no such
// global. AIService pulls the SDK in transitively, so every suite that reaches
// it (MaterialParser, MaterialService, ...) needs this.
global.ReadableStream = ReadableStream

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

// next/jest loads .env, so the real GROQ_API_KEY was reaching the test run. Every
// suite mocks AIService or injects a fetch, so nothing spent quota — but that was
// discipline, not a guarantee, and one unmocked test would bill a real call
// against a free-tier TPM budget. Overwrite rather than delete: code paths branch
// on the key being *present* (streamChat falls back to buffered chat without it),
// so tests should see a key that simply cannot authenticate.
process.env.GROQ_API_KEY = 'test-groq-key'

// Force the deterministic Groq path in AIService tests: without a Google key,
// generateQuiz/verifyAnswer skip Gemini and hit the (mockable) Groq fetch client.
delete process.env.GOOGLE_AI_API_KEY
