-- Migration: Add peripheral_vision_grid exercise type
-- Extends the CHECK constraint and seeds 2 exercise instances.

ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_exercise_type_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_exercise_type_check
  CHECK (exercise_type IN ('animated_pacer', 'smart_questions', 'focus_sprint', 'speed_scan', 'peripheral_vision_grid'));

-- Peripheral Vision Grid dataset_1
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
  'a0000000-0000-0000-0000-000000000041'::UUID,
  'peripheral_vision_grid',
  'dataset_1',
  'Peripheral Vision Grid — Session 1',
  'Train your peripheral vision by tapping numbers 1–12 in sequence while keeping your gaze fixed on the center dot.',
  'Peripheral vision drill — 3×4 number grid',
  '{}',
  NULL,
  30
);

-- Peripheral Vision Grid dataset_2
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
  'a0000000-0000-0000-0000-000000000042'::UUID,
  'peripheral_vision_grid',
  'dataset_2',
  'Peripheral Vision Grid — Session 2',
  'Train your peripheral vision by tapping numbers 1–12 in sequence while keeping your gaze fixed on the center dot.',
  'Peripheral vision drill — 3×4 number grid',
  '{}',
  NULL,
  30
);
