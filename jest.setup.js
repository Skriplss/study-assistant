import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

// Force the deterministic Groq path in AIService tests: without a Google key,
// generateQuiz/verifyAnswer skip Gemini and hit the (mockable) Groq fetch client.
delete process.env.GOOGLE_AI_API_KEY
