import { StudyMaterial, Quiz, Question } from '@/lib/types'

// Test data generators for seeding tests

export const generateMockMaterial = (
  overrides?: Partial<StudyMaterial>
): StudyMaterial => ({
  id: 'material-1',
  userId: 'test-user-id',
  title: 'Test Material',
  fileName: 'test.pdf',
  fileType: 'pdf',
  fileSize: 1024000,
  filePath: 'test-user-id/material-1/original.pdf',
  parsedContent: 'This is test content for the study material.',
  parsingStatus: 'completed',
  parsingError: null,
  category: 'Computer Science',
  tags: ['javascript', 'testing'],
  language: 'en',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

export const generateMockQuiz = (overrides?: Partial<Quiz>): Quiz => ({
  id: 'quiz-1',
  userId: 'test-user-id',
  materialId: 'material-1',
  title: 'Test Quiz',
  difficulty: 'medium',
  totalQuestions: 5,
  status: 'draft',
  score: null,
  questions: [],
  completedAt: null,
  createdAt: new Date().toISOString(),
  ...overrides,
})

export const generateMockQuestion = (
  overrides?: Partial<Question>
): Question => ({
  id: 'question-1',
  quizId: 'quiz-1',
  questionText: 'What is the capital of France?',
  questionType: 'multiple_choice',
  difficulty: 'easy',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctAnswer: 'Paris',
  explanation: 'Paris is the capital and largest city of France.',
  orderIndex: 0,
  ...overrides,
})

// Database seeding utilities
export const seedTestDatabase = async (supabaseClient: any) => {
  // Create test user profile
  await supabaseClient.from('user_profiles').insert({
    id: 'test-user-id',
    preferences: {},
  })

  // Create test materials
  const materials = [
    generateMockMaterial({ id: 'material-1', title: 'JavaScript Basics' }),
    generateMockMaterial({
      id: 'material-2',
      title: 'React Advanced',
      category: 'Frontend',
      tags: ['react', 'hooks'],
    }),
  ]

  await supabaseClient.from('study_materials').insert(materials)

  // Create test quizzes
  const quiz = generateMockQuiz()
  await supabaseClient.from('quizzes').insert(quiz)

  // Create test questions
  const questions = [
    generateMockQuestion({ id: 'question-1', orderIndex: 0 }),
    generateMockQuestion({
      id: 'question-2',
      orderIndex: 1,
      questionText: 'What is 2 + 2?',
      correctAnswer: '4',
    }),
  ]

  await supabaseClient.from('questions').insert(questions)
}

export const cleanTestDatabase = async (supabaseClient: any) => {
  // Clean up test data in reverse order of dependencies
  await supabaseClient.from('answers').delete().eq('quiz_id', 'quiz-1')
  await supabaseClient.from('questions').delete().eq('quiz_id', 'quiz-1')
  await supabaseClient.from('quizzes').delete().eq('user_id', 'test-user-id')
  await supabaseClient
    .from('material_tags')
    .delete()
    .in('material_id', ['material-1', 'material-2'])
  await supabaseClient
    .from('study_materials')
    .delete()
    .eq('user_id', 'test-user-id')
  await supabaseClient.from('user_profiles').delete().eq('id', 'test-user-id')
}
