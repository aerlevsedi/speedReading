import { useState } from "react";
import AnimatedPacer from "./AnimatedPacer";
import ComprehensionQuiz from "./ComprehensionQuiz";
import type { Exercise } from "@/types";

interface Props {
  exercise: Exercise;
}

export default function ExerciseFlow({ exercise }: Props) {
  const [step, setStep] = useState<"pacer" | "quiz" | "submit">("pacer");
  const [duration, setDuration] = useState(0);
  const [errors, setErrors] = useState(0);

  // Hard-coded comprehension questions for the seeded exercise
  const questions = [
    {
      text: "What is the most common index type mentioned in the text?",
      options: ["GIN index", "B-tree index", "GiST index", "Hash index"],
      correctIndex: 1,
    },
    {
      text: "What is a key tradeoff of having too many indexes?",
      options: [
        "Queries become faster",
        "Storage space increases",
        "INSERT and UPDATE operations become slower",
        "Database crashes",
      ],
      correctIndex: 2,
    },
  ];

  const handlePacerComplete = (durationSeconds: number) => {
    setDuration(durationSeconds);
    setStep("quiz");
  };

  const handleQuizComplete = (errorCount: number) => {
    setErrors(errorCount);
    setStep("submit");
  };

  if (step === "pacer") {
    return <AnimatedPacer exercise={exercise} onComplete={handlePacerComplete} />;
  }

  if (step === "quiz") {
    return <ComprehensionQuiz questions={questions} onComplete={handleQuizComplete} />;
  }

  // Auto-submit form when step = 'submit'
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
