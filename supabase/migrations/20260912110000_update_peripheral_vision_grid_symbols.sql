-- Migration: Add symbol sets and better titles to peripheral_vision_grid exercises

UPDATE exercises
SET
  title = 'Peripheral Vision Grid — Numbers',
  config = '{"symbols": ["1","2","3","4","5","6","7","8","9","10","11","12"]}'
WHERE id = 'a0000000-0000-0000-0000-000000000041'::UUID;

UPDATE exercises
SET
  title = 'Peripheral Vision Grid — Letters',
  config = '{"symbols": ["A","B","C","D","E","F","G","H","I","J","K","L"]}'
WHERE id = 'a0000000-0000-0000-0000-000000000042'::UUID;
