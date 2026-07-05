# AI Study Assistant

## Features

- **Material Management**: Upload and organize study materials (PDF, TXT, MD, PPTX, PNG, JPG, JPEG), import from **YouTube** (transcripts) and **web pages** (article extraction)
- **AI-Powered Quizzes**: Generate adaptive quizzes with multiple difficulty levels, open-ended answer verification, and LaTeX math support
- **AI Chat**: Ask questions across all your materials with a context-aware chat assistant
- **Knowledge Graph**: Visualize connections between concepts, with search and interactive navigation
- **Progress Analytics**: Track learning performance over time
- **Tags & Categories**: Organize materials with AI-suggested tags and categories
- **Intelligent Search**: Find information quickly across all materials
- **LaTeX Support**: Render mathematical formulas in quiz questions and answers
- **Dark Mode**: Full light/dark theme support

## Tech Stack

- **Frontend**: React 19, Next.js 16 (App Router), TypeScript, TailwindCSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage), Next.js API Routes
- **AI**: Google Gemini (`gemini-2.0-flash`) primary, Groq (`llama-3.1-8b-instant`) fallback
- **Visualization**: react-force-graph-2d (knowledge graph), Recharts (analytics)
- **File Processing**: pdf-parse, markdown-it, officeparser (PPTX), Gemini Vision API (images)
- **Content Import**: youtube-transcript (YouTube), @mozilla/readability + linkedom (web pages)
- **Language Detection**: franc
- **Math Rendering**: KaTeX
- **Testing**: Jest + React Testing Library

## AI Provider Setup

This application uses a dual-provider AI strategy for reliability:

- **Primary**: Google Gemini API (`gemini-2.0-flash`) — higher token limits, good for large quiz generation
- **Fallback**: Groq API (`llama-3.1-8b-instant`) — activated on rate limits or errors

AI logic is centralized in `lib/services/AIService.ts` — the file to edit when model IDs change.

### Features using AI:
- **Quiz Generation**: Gemini only (no fallback due to Groq's TPM limit)
- **Answer Verification** (open-ended): Gemini primary → Groq fallback
- **Chat**: Gemini primary → Groq fallback over material context
- **Knowledge Graph**: Gemini primary → Groq fallback for concept extraction
- **Tag/Category Suggestions**: AI-generated metadata for uploaded materials
- **Image Text Extraction**: Gemini Vision API for PNG/JPG/JPEG files

### Supported Sources:
- **Documents**: PDF, TXT, MD, PPTX
- **Images**: PNG, JPG, JPEG (text extraction via Gemini Vision API)
- **YouTube**: video transcripts
- **Web pages**: article text extraction
- **Math**: LaTeX formulas in quiz questions and answers (`$...$` inline, `$$...$$` block)

### Rate Limit Handling:
- Automatic retry with exponential backoff (1s, 2s, 4s)
- Graceful fallback between providers
- Detailed logging for debugging

### Getting API Keys:
- **Google AI API**: get a free-tier key at https://ai.google.dev/
- **Groq API**: get a free-tier key at https://console.groq.com/

## Project Structure

```
ai-study-assistant/
├── app/                    # Next.js App Router
│   ├── auth/               # Authentication pages
│   ├── (dashboard)/        # Main app pages (dashboard, materials, quizzes, chat, graph)
│   └── api/                # API routes
├── components/             # React components (by feature)
├── lib/
│   ├── ai/                 # Prompts, context building, language detection
│   ├── auth/               # Session & password handling
│   ├── materials/          # File validation, YouTube import
│   ├── services/           # Core services (AIService, MaterialParser, QuizService, ...)
│   └── supabase/           # Supabase client configuration
├── supabase/               # Database schema and migrations
└── proxy.ts                # Auth gate for routed requests
```

## Environment Variables

See `.env.example` for all required environment variables.

## License

MIT
