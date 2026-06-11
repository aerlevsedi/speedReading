import { useState } from "react";
import AnimatedPacer from "./AnimatedPacer";
import SmartQuestions from "./SmartQuestions";
import FocusSprint from "./FocusSprint";
import SpeedScan from "./SpeedScan";
import type { Exercise } from "@/types";

interface Props {
  exercise: Exercise;
}

// Component map for routing based on exercise type
const ExerciseComponentMap = {
  animated_pacer: AnimatedPacer,
  smart_questions: SmartQuestions,
  focus_sprint: FocusSprint,
  speed_scan: SpeedScan,
} as const;

export default function ExerciseFlow({ exercise }: Props) {
  const [isComplete, setIsComplete] = useState(false);
  const [duration, setDuration] = useState(0);
  const [errors, setErrors] = useState(0);

  const handleComplete = (durationSeconds: number, errorCount: number) => {
    setDuration(durationSeconds);
    setErrors(errorCount);
    setIsComplete(true);
  };

  // Route to the appropriate exercise component
  const ExerciseComponent = ExerciseComponentMap[exercise.exercise_type];

  if (!isComplete) {
    return <ExerciseComponent exercise={exercise} onComplete={handleComplete} />;
  }

  // Auto-submit form when complete
  return (
    <form method="POST" action="/api/exercises/complete" className="hidden">
      <input type="hidden" name="exercise_id" value={exercise.id} />
      <input type="hidden" name="duration_seconds" value={duration} />
      <input type="hidden" name="errors" value={errors} />
      <button type="submit" ref={(el) => el?.click()}>
        Submit
      </button>
    </form>
  );
}
