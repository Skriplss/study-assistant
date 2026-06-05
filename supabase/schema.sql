-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  preferences JSONB DEFAULT '{}'::jsonb
);

-- Study Materials Table
CREATE TABLE IF NOT EXISTS study_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('pdf', 'txt', 'md')),
  file_size BIGINT NOT NULL,
  file_path TEXT NOT NULL,
  parsed_content TEXT,
  parsing_status VARCHAR(20) DEFAULT 'pending' CHECK (
    parsing_status IN ('pending', 'processing', 'completed', 'failed')
  ),
  parsing_error TEXT,
  category VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Material Tags Table
CREATE TABLE IF NOT EXISTS material_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES study_materials(id) ON DELETE CASCADE,
  tag VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(material_id, tag)
);

-- Quizzes Table
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES study_materials(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  difficulty VARCHAR(20) CHECK (difficulty IN ('easy', 'medium', 'hard', 'mixed')),
  total_questions INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (
    status IN ('draft', 'in_progress', 'completed')
  ),
  score DECIMAL(5,2),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questions Table
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) NOT NULL CHECK (
    question_type IN ('multiple_choice', 'open_ended')
  ),
  difficulty VARCHAR(20) CHECK (difficulty IN ('easy', 'medium', 'hard')),
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Answers Table
CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  feedback TEXT,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quiz_id, question_id)
);

-- Material Connections Table
CREATE TABLE IF NOT EXISTS material_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id_1 UUID NOT NULL REFERENCES study_materials(id) ON DELETE CASCADE,
  material_id_2 UUID NOT NULL REFERENCES study_materials(id) ON DELETE CASCADE,
  connection_strength DECIMAL(3,2) NOT NULL CHECK (
    connection_strength >= 0 AND connection_strength <= 1
  ),
  shared_concepts JSONB,
  analysis_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (material_id_1 < material_id_2),
  UNIQUE(material_id_1, material_id_2)
);

-- Progress Snapshots Table
CREATE TABLE IF NOT EXISTS progress_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES study_materials(id) ON DELETE CASCADE,
  score DECIMAL(5,2) NOT NULL,
  questions_count INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  tags JSONB,
  category VARCHAR(100),
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Performance Optimization

-- Study Materials Indexes
CREATE INDEX IF NOT EXISTS idx_study_materials_user ON study_materials(user_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_category ON study_materials(category);
CREATE INDEX IF NOT EXISTS idx_study_materials_created ON study_materials(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_materials_parsing_status ON study_materials(parsing_status);

-- Material Tags Indexes
CREATE INDEX IF NOT EXISTS idx_material_tags_material ON material_tags(material_id);
CREATE INDEX IF NOT EXISTS idx_material_tags_tag ON material_tags(tag);

-- Quizzes Indexes
CREATE INDEX IF NOT EXISTS idx_quizzes_user ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_material ON quizzes(material_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_completed ON quizzes(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON quizzes(status);

-- Questions Indexes
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id, order_index);

-- Answers Indexes
CREATE INDEX IF NOT EXISTS idx_answers_quiz ON answers(quiz_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);

-- Material Connections Indexes
CREATE INDEX IF NOT EXISTS idx_material_connections_user ON material_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_material_connections_mat1 ON material_connections(material_id_1);
CREATE INDEX IF NOT EXISTS idx_material_connections_mat2 ON material_connections(material_id_2);
CREATE INDEX IF NOT EXISTS idx_material_connections_strength ON material_connections(connection_strength DESC);

-- Progress Snapshots Indexes
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress_snapshots(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_material ON progress_snapshots(material_id);
CREATE INDEX IF NOT EXISTS idx_progress_quiz ON progress_snapshots(quiz_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_snapshots ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Study Materials Policies
CREATE POLICY "Users can view their own materials" ON study_materials
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own materials" ON study_materials
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own materials" ON study_materials
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own materials" ON study_materials
  FOR DELETE USING (auth.uid() = user_id);

-- Material Tags Policies
CREATE POLICY "Users can view tags for their materials" ON material_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM study_materials
      WHERE study_materials.id = material_tags.material_id
      AND study_materials.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tags for their materials" ON material_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM study_materials
      WHERE study_materials.id = material_tags.material_id
      AND study_materials.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete tags for their materials" ON material_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM study_materials
      WHERE study_materials.id = material_tags.material_id
      AND study_materials.user_id = auth.uid()
    )
  );

-- Quizzes Policies
CREATE POLICY "Users can view their own quizzes" ON quizzes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quizzes" ON quizzes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quizzes" ON quizzes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quizzes" ON quizzes
  FOR DELETE USING (auth.uid() = user_id);

-- Questions Policies
CREATE POLICY "Users can view questions for their quizzes" ON questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = questions.quiz_id
      AND quizzes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert questions for their quizzes" ON questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = questions.quiz_id
      AND quizzes.user_id = auth.uid()
    )
  );

-- Answers Policies
CREATE POLICY "Users can view their own answers" ON answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = answers.quiz_id
      AND quizzes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own answers" ON answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = answers.quiz_id
      AND quizzes.user_id = auth.uid()
    )
  );

-- Material Connections Policies
CREATE POLICY "Users can view their own connections" ON material_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connections" ON material_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections" ON material_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections" ON material_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Progress Snapshots Policies
CREATE POLICY "Users can view their own progress" ON progress_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress" ON progress_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Storage Bucket Configuration (Execute manually in Supabase Dashboard)
-- 1. Create a bucket named 'study-materials'
-- 2. Set the bucket to private (not public)
-- 3. Add the following policies:

-- Storage Policies (for reference - execute in Supabase Dashboard)
-- CREATE POLICY "Users can upload their own materials"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'study-materials' AND
--   auth.uid()::text = (storage.foldername(name))[1]
-- );

-- CREATE POLICY "Users can view their own materials"
-- ON storage.objects FOR SELECT
-- USING (
--   bucket_id = 'study-materials' AND
--   auth.uid()::text = (storage.foldername(name))[1]
-- );

-- CREATE POLICY "Users can update their own materials"
-- ON storage.objects FOR UPDATE
-- USING (
--   bucket_id = 'study-materials' AND
--   auth.uid()::text = (storage.foldername(name))[1]
-- );

-- CREATE POLICY "Users can delete their own materials"
-- ON storage.objects FOR DELETE
-- USING (
--   bucket_id = 'study-materials' AND
--   auth.uid()::text = (storage.foldername(name))[1]
-- );

-- Triggers for updated_at timestamps

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_materials_updated_at BEFORE UPDATE ON study_materials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_material_connections_updated_at BEFORE UPDATE ON material_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
