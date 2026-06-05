-- Migration: Create exercises and exercise_completions tables with RLS policies
-- This is the foundation for the speed-reading training app

-- Create exercises table
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_type TEXT NOT NULL CHECK (exercise_type IN ('animated_pacer', 'smart_questions', 'focus_sprint', 'speed_scan')),
  dataset_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  estimated_duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on exercises
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Public read policy for exercises
CREATE POLICY exercises_select_policy ON exercises
  FOR SELECT
  USING (true);

-- Admin-only write (no explicit policy = service role only)

-- Create exercise_completions table
CREATE TABLE exercise_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  duration_seconds INTEGER NOT NULL,
  errors INTEGER NOT NULL DEFAULT 0,
  type_data JSONB NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for progress chart queries (last N completions for user X)
CREATE INDEX idx_exercise_completions_user_date ON exercise_completions(user_id, completed_at DESC);

-- Enable RLS on exercise_completions
ALTER TABLE exercise_completions ENABLE ROW LEVEL SECURITY;

-- User can read own completions
CREATE POLICY completions_select_own ON exercise_completions
  FOR SELECT
  USING ((select auth.uid()) = user_id);

-- User can insert own completions
CREATE POLICY completions_insert_own ON exercise_completions
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- Seed 1 Animated Pacer exercise for north star validation (S-01)
INSERT INTO exercises (
  id,
  exercise_type,
  dataset_id,
  title,
  description,
  content,
  config,
  difficulty,
  estimated_duration_seconds
) VALUES (
  'a0000000-0000-0000-0000-000000000001'::UUID,
  'animated_pacer',
  'dataset_1',
  'Database Performance Fundamentals',
  'Learn about database indexing and query optimization techniques used by modern web applications.',
  'Database indexing is one of the most critical performance optimization techniques in software development. An index is a data structure that improves the speed of data retrieval operations on a database table. Without indexes, the database must scan every row to find matching records, which becomes increasingly slow as tables grow larger.

The most common index type is the B-tree index, which organizes data in a sorted tree structure. When you query a column that has a B-tree index, the database can quickly navigate the tree to find matching rows without reading the entire table. For example, if you have a users table with one million rows and you search by email address, a B-tree index on the email column can reduce query time from several seconds to milliseconds.

However, indexes come with tradeoffs. Each index requires storage space and must be updated whenever data changes. If you have too many indexes, INSERT and UPDATE operations become slower because the database must maintain multiple index structures. The key is to index columns that are frequently used in WHERE clauses, JOIN conditions, and ORDER BY statements, while avoiding indexes on columns that are rarely queried.

Modern databases like PostgreSQL also support specialized index types for specific use cases. GIN indexes excel at full-text search and JSONB queries, while GiST indexes are optimized for geometric and range data. Understanding which index type to use for your access patterns is essential for building high-performance applications. Query planning tools like EXPLAIN ANALYZE help developers identify slow queries and determine whether adding an index would improve performance.',
  '{"target_wpm": 250, "pacer_speed": "adaptive", "highlight_color": "#3b82f6"}',
  'beginner',
  120
);
