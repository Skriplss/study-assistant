export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          preferences: Json
        }
        Insert: {
          id: string
          created_at?: string
          updated_at?: string
          preferences?: Json
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          preferences?: Json
        }
      }
      study_materials: {
        Row: {
          id: string
          user_id: string
          title: string
          file_name: string
          file_type: 'pdf' | 'txt' | 'md'
          file_size: number
          file_path: string
          parsed_content: string | null
          parsing_status: 'pending' | 'processing' | 'completed' | 'failed'
          parsing_error: string | null
          category: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          file_name: string
          file_type: 'pdf' | 'txt' | 'md'
          file_size: number
          file_path: string
          parsed_content?: string | null
          parsing_status?: 'pending' | 'processing' | 'completed' | 'failed'
          parsing_error?: string | null
          category?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          file_name?: string
          file_type?: 'pdf' | 'txt' | 'md'
          file_size?: number
          file_path?: string
          parsed_content?: string | null
          parsing_status?: 'pending' | 'processing' | 'completed' | 'failed'
          parsing_error?: string | null
          category?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      material_tags: {
        Row: {
          id: string
          material_id: string
          tag: string
          created_at: string
        }
        Insert: {
          id?: string
          material_id: string
          tag: string
          created_at?: string
        }
        Update: {
          id?: string
          material_id?: string
          tag?: string
          created_at?: string
        }
      }
      quizzes: {
        Row: {
          id: string
          user_id: string
          material_id: string
          title: string
          difficulty: 'easy' | 'medium' | 'hard' | 'mixed' | null
          total_questions: number
          status: 'draft' | 'in_progress' | 'completed'
          score: number | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          material_id: string
          title: string
          difficulty?: 'easy' | 'medium' | 'hard' | 'mixed' | null
          total_questions: number
          status?: 'draft' | 'in_progress' | 'completed'
          score?: number | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          material_id?: string
          title?: string
          difficulty?: 'easy' | 'medium' | 'hard' | 'mixed' | null
          total_questions?: number
          status?: 'draft' | 'in_progress' | 'completed'
          score?: number | null
          completed_at?: string | null
          created_at?: string
        }
      }
      questions: {
        Row: {
          id: string
          quiz_id: string
          question_text: string
          question_type: 'multiple_choice' | 'open_ended'
          difficulty: 'easy' | 'medium' | 'hard' | null
          options: Json | null
          correct_answer: string
          explanation: string | null
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          quiz_id: string
          question_text: string
          question_type: 'multiple_choice' | 'open_ended'
          difficulty?: 'easy' | 'medium' | 'hard' | null
          options?: Json | null
          correct_answer: string
          explanation?: string | null
          order_index: number
          created_at?: string
        }
        Update: {
          id?: string
          quiz_id?: string
          question_text?: string
          question_type?: 'multiple_choice' | 'open_ended'
          difficulty?: 'easy' | 'medium' | 'hard' | null
          options?: Json | null
          correct_answer?: string
          explanation?: string | null
          order_index?: number
          created_at?: string
        }
      }
      answers: {
        Row: {
          id: string
          quiz_id: string
          question_id: string
          user_answer: string
          is_correct: boolean
          feedback: string | null
          answered_at: string
        }
        Insert: {
          id?: string
          quiz_id: string
          question_id: string
          user_answer: string
          is_correct: boolean
          feedback?: string | null
          answered_at?: string
        }
        Update: {
          id?: string
          quiz_id?: string
          question_id?: string
          user_answer?: string
          is_correct?: boolean
          feedback?: string | null
          answered_at?: string
        }
      }
      material_connections: {
        Row: {
          id: string
          user_id: string
          material_id_1: string
          material_id_2: string
          connection_strength: number
          shared_concepts: Json | null
          analysis_version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          material_id_1: string
          material_id_2: string
          connection_strength: number
          shared_concepts?: Json | null
          analysis_version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          material_id_1?: string
          material_id_2?: string
          connection_strength?: number
          shared_concepts?: Json | null
          analysis_version?: number
          created_at?: string
          updated_at?: string
        }
      }
      progress_snapshots: {
        Row: {
          id: string
          user_id: string
          quiz_id: string
          material_id: string
          score: number
          questions_count: number
          correct_count: number
          tags: Json | null
          category: string | null
          completed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          quiz_id: string
          material_id: string
          score: number
          questions_count: number
          correct_count: number
          tags?: Json | null
          category?: string | null
          completed_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          quiz_id?: string
          material_id?: string
          score?: number
          questions_count?: number
          correct_count?: number
          tags?: Json | null
          category?: string | null
          completed_at?: string
          created_at?: string
        }
      }
    }
  }
}
