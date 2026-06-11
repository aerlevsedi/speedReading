import { useEffect, useState } from "react";
import { useExerciseTimer } from "@/lib/hooks/useExerciseTimer";
import ComprehensionQuiz from "./ComprehensionQuiz";
import type { Exercise } from "@/types";
import { Button } from "@/components/ui/button";

interface Props {
  exercise: Exercise;
  onComplete: (durationSeconds: number, errors: number) => void;
}

// Hard-coded comprehension questions per dataset
const QUESTIONS_BY_DATASET: Record<string, { text: string; options: string[]; correctIndex: number }[]> = {
  dataset_1: [
    // CSS Layout questions
    {
      text: "What is the primary benefit of flexbox over floats?",
      options: [
        "Better browser support",
        "Simpler and more predictable layout control",
        "Faster rendering performance",
        "Works with older IE versions",
      ],
      correctIndex: 1,
    },
    {
      text: "What does 'flex: 1' do to a flex item?",
      options: [
        "Sets it to 1px width",
        "Makes it the first item",
        "Allows it to grow and take available space",
        "Fixes its position",
      ],
      correctIndex: 2,
    },
    {
      text: "Which property controls the main axis direction in flexbox?",
      options: ["flex-direction", "flex-wrap", "justify-content", "align-items"],
      correctIndex: 0,
    },
  ],
  dataset_2: [
    // JavaScript Async questions
    {
      text: "What problem do Promises solve compared to callbacks?",
      options: [
        "They execute faster",
        "They eliminate callback hell and provide chainable operations",
        "They work in older browsers",
        "They use less memory",
      ],
      correctIndex: 1,
    },
    {
      text: "What is the main advantage of async/await syntax?",
      options: [
        "It runs operations in parallel automatically",
        "It makes async code look and behave like synchronous code",
        "It improves performance",
        "It works without Promises",
      ],
      correctIndex: 1,
    },
    {
      text: "When should you use Promise.all()?",
      options: [
        "When you want the fastest operation to win",
        "When operations must run sequentially",
        "When you want to run independent operations in parallel",
        "When you need to cancel requests",
      ],
      correctIndex: 2,
    },
  ],
};

export default function FocusSprint({ exercise, onComplete }: Props) {
  const timer = useExerciseTimer();
  const [showQuiz, setShowQuiz] = useState(false);
  const [duration, setDuration] = useState(0);

  // Get questions for current dataset - fail fast if dataset not found
  const questions = QUESTIONS_BY_DATASET[exercise.dataset_id];
  if (!questions) {
    throw new Error(
      `No questions defined for dataset: ${exercise.dataset_id}. Available datasets: ${Object.keys(QUESTIONS_BY_DATASET).join(", ")}`,
    );
  }

  // Start timer on mount
  useEffect(() => {
    timer.start();
  }, [timer]);

  const handleDoneReading = () => {
    const durationSeconds = timer.getDuration();
    setDuration(durationSeconds);
    timer.pause();
    setShowQuiz(true);
  };

  const handleQuizComplete = (errors: number) => {
    onComplete(duration, errors);
  };

  // Show quiz after reading completes
  if (showQuiz) {
    return <ComprehensionQuiz questions={questions} onComplete={handleQuizComplete} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      {/* Content */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
        <h2 className="mb-6 text-center text-3xl font-bold text-white">{exercise.title}</h2>
        <div className="prose prose-invert max-w-none">
          <p className="text-lg leading-relaxed whitespace-pre-wrap text-gray-200">{exercise.content}</p>
        </div>
      </div>

      {/* Done Button */}
      <div className="flex justify-center">
        <Button onClick={handleDoneReading} size="lg">
          Done Reading
        </Button>
      </div>

      {/* Instructions */}
      <p className="text-center text-sm text-blue-100/60">
        Read at your own pace. Click &quot;Done Reading&quot; when you&apos;re ready for the comprehension quiz.
      </p>
    </div>
  );
}
