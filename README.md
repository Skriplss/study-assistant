# AI Study Assistant

## Features

-  **Material Management**: Upload and organize study materials (PDF, TXT, MD)
-  **AI-Powered Quizzes**: Generate adaptive quizzes with multiple difficulty levels
-  **Knowledge Graph**: Visualize connections between concepts
-  **Progress Analytics**: Track learning performance over time
-  **Intelligent Search**: Find information quickly across all materials

## Tech Stack

- **Frontend**: React 18, Next.js 14 (App Router), TypeScript, TailwindCSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage), Next.js API Routes
- **AI**: Groq API (mixtral-8x7b-32768 or llama2-70b-4096)
- **Visualization**: React Flow (knowledge graph), Recharts (analytics)
- **File Processing**: pdf-parse, markdown-it

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
