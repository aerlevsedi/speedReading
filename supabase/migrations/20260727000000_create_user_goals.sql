CREATE TABLE user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_wpm INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX user_goals_user_id_unique ON user_goals (user_id);

ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own goal"
  ON user_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users can upsert own goal"
  ON user_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own goal"
  ON user_goals FOR UPDATE
  USING (auth.uid() = user_id);
