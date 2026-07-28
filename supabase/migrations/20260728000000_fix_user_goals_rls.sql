-- Add WITH CHECK to UPDATE policy so user_id cannot be changed on update
DROP POLICY "users can update own goal" ON user_goals;

CREATE POLICY "users can update own goal"
  ON user_goals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add DELETE policy so users can remove their own goal
CREATE POLICY "users can delete own goal"
  ON user_goals FOR DELETE
  USING (auth.uid() = user_id);
