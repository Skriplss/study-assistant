# AI Study Assistant

## Features

-  **Material Management**: Upload and organize study materials (PDF, TXT, MD, PPTX, PNG, JPG, JPEG)
-  **AI-Powered Quizzes**: Generate adaptive quizzes with multiple difficulty levels and LaTeX math support
-  **Knowledge Graph**: Visualize connections between concepts
-  **Progress Analytics**: Track learning performance over time
-  **Intelligent Search**: Find information quickly across all materials
-  **LaTeX Support**: Render mathematical formulas in quiz questions and answers

## Tech Stack

- **Frontend**: React 18, Next.js 14 (App Router), TypeScript, TailwindCSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage), Next.js API Routes
- **AI**: Google Gemini (gemini-2.0-flash) primary, Groq (llama-3.1-8b-instant) fallback
- **Visualization**: React Flow (knowledge graph), Recharts (analytics)
- **File Processing**: pdf-parse, markdown-it, officeparser (PPTX), Gemini Vision API (images)
- **Math Rendering**: KaTeX

## AI Provider Setup

This application uses a dual-provider AI strategy for reliability:

- **Primary**: Google Gemini API (`gemini-2.0-flash`) - Higher token limits, good for large quiz generation
- **Fallback**: Groq API (`llama-3.1-8b-instant`) - Activated on rate limits or errors

### Features using AI:
- **Quiz Generation**: Gemini only (no fallback due to Groq's 6000 TPM limit)
- **Answer Verification** (open-ended): Gemini primary → Groq fallback
- **Knowledge Graph**: Gemini primary → Groq fallback for concept extraction
- **Image Text Extraction**: Gemini Vision API for PNG/JPG/JPEG files

### Supported File Formats:
- **Documents**: PDF, TXT, MD, PPTX
- **Images**: PNG, JPG, JPEG (text extraction via Gemini Vision API)
- **Math**: LaTeX formulas in quiz questions and answers (`$...$` inline, `$$...$$` block)

### Rate Limit Handling:
- Automatic retry with exponential backoff (1s, 2s, 4s)
- Graceful fallback between providers
- Detailed logging for debugging

### Getting API Keys:
- **Google AI API**: Get free tier key at https://ai.google.dev/
- **Groq API**: Get free tier key at https://console.groq.com/

## Project Structure

```
ai-study-assistant/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Main application pages
│   ├── api/               # API routes
│   └── components/        # React components
├── lib/                   # Shared utilities
│   └── supabase/          # Supabase client configuration
├── supabase/              # Database schema and migrations
└── public/                # Static assets
```

## Environment Variables

See `.env.example` for all required environment variables.

## License

MIT
