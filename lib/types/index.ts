// Study Material Types
export interface StudyMaterial {
  id: string
  userId: string
  title: string
  fileName: string
  fileType: 'pdf' | 'txt' | 'md' | 'pptx' | 'png' | 'jpg' | 'jpeg'
  fileSize: number
  filePath: string
  parsedContent: string | null
  parsingStatus: 'pending' | 'processing' | 'completed' | 'failed'
  parsingError: string | null
  category: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface MaterialMetadata {
  title: string
  category?: string
  tags?: string[]
}

export interface ParsedContent {
  text: string
  metadata: {
    pageCount?: number
    wordCount: number
    structure?: any
  }
}

// Quiz Types
export interface Quiz {
  id: string
  userId: string
  materialId: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
  totalQuestions: number
  status: 'draft' | 'in_progress' | 'completed'
  score: number | null
  questions: Question[]
  completedAt: string | null
  createdAt: string
}

export interface Question {
  id: string
  quizId: string
  questionText: string
  questionType: 'multiple_choice' | 'open_ended'
  difficulty: 'easy' | 'medium' | 'hard'
  options: string[] | null
  correctAnswer: string
  explanation: string | null
  orderIndex: number
}

export interface Answer {
  id: string
  quizId: string
  questionId: string
  userAnswer: string
  isCorrect: boolean
  feedback: string | null
  answeredAt: string
}

export interface QuizConfig {
  questionCount: number // 5-50
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
  questionTypes: ('multiple_choice' | 'open_ended')[]
}

export interface QuizResults {
  quizId: string
  score: number
  correctCount: number
  totalQuestions: number
  answers: Answer[]
  completedAt: string
}

export interface AnswerVerification {
  isCorrect: boolean
  feedback: string
  correctAnswer?: string
}

export interface GeneratedQuestion {
  questionText: string
  questionType: 'multiple_choice' | 'open_ended'
  difficulty: 'easy' | 'medium' | 'hard'
  options: string[] | null
  correctAnswer: string
  explanation: string
}

export interface GeneratedQuiz {
  title: string
  questions: GeneratedQuestion[]
}

// Knowledge Graph Types
export interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GraphNode {
  id: string // materialId
  label: string // material title
  type: 'material'
  data: {
    materialId: string
    title: string
    category: string | null
    tags: string[]
  }
}

export interface GraphEdge {
  id: string
  source: string // materialId
  target: string // materialId
  strength: number // 0-1
  sharedConcepts: string[]
}

export interface Connection {
  materialId1: string
  materialId2: string
  connectionStrength: number
  sharedConcepts: string[]
}

export interface ConnectionDetails extends Connection {
  material1: StudyMaterial
  material2: StudyMaterial
}

// Analytics Types
export interface ProgressData {
  totalMaterials: number
  totalQuizzes: number
  totalQuestions: number
  averageScore: number
  scoreHistory: ScoreDataPoint[]
  performanceByTag: TagPerformance[]
  performanceByCategory: CategoryPerformance[]
}

export interface ScoreDataPoint {
  date: string
  score: number
  quizId: string
}

export interface TagPerformance {
  tag: string
  averageScore: number
  quizCount: number
  questionCount: number
}

export interface CategoryPerformance {
  category: string
  averageScore: number
  quizCount: number
  questionCount: number
}

export interface TopicAnalysis {
  strengths: TopicScore[]
  weaknesses: TopicScore[]
  improving: TopicScore[]
  declining: TopicScore[]
}

export interface TopicScore {
  topic: string // tag or category
  score: number
  trend: number // positive or negative
}

// Search Types
export interface SearchFilters {
  fileTypes?: ('pdf' | 'txt' | 'md' | 'pptx' | 'png' | 'jpg' | 'jpeg')[]
  tags?: string[]
  categories?: string[]
}

export interface SearchResult {
  material: StudyMaterial
  relevanceScore: number
  matchedTerms: string[]
  snippet: string
}

// AI Service Types
export interface GroqOptions {
  model: string
  temperature: number
  maxTokens: number
  timeout: number
}

export interface Concept {
  term: string
  frequency: number
  importance: number
}
