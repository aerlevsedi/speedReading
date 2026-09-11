CREATE TABLE public.user_intro_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_type text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_type)
);

ALTER TABLE public.user_intro_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own intro views"
  ON public.user_intro_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own intro views"
  ON public.user_intro_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own intro views"
  ON public.user_intro_views FOR UPDATE
  USING (auth.uid() = user_id);
