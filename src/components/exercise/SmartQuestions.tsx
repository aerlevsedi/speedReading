import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useExerciseTimer } from "@/lib/hooks/useExerciseTimer";
import type { Exercise } from "@/types";
import { Progress } from "@/components/ui/progress";

interface Question {
  text: string;
  options: string[];
  correctIndex: number;
  difficulty: "easy" | "medium" | "hard";
}

interface Props {
  exercise: Exercise;
  onComplete: (durationSeconds: number, errors: number) => void;
}

// Hard-coded questions with progressive difficulty
const QUESTIONS: Question[] = [
  {
    text: "What is the primary purpose of API versioning?",
    options: [
      "To track the number of API releases",
      "To maintain backward compatibility while introducing changes",
      "To improve API performance",
      "To reduce server costs",
    ],
    correctIndex: 1,
    difficulty: "easy",
  },
  {
    text: "Which HTTP status code indicates a successful POST request that created a new resource?",
    options: ["200 OK", "201 Created", "204 No Content", "202 Accepted"],
    correctIndex: 1,
    difficulty: "easy",
  },
  {
    text: "What is the main advantage of using idempotent HTTP methods?",
    options: [
      "They are faster than non-idempotent methods",
      "They can be safely retried without causing unintended side effects",
      "They use less bandwidth",
      "They require less server resources",
    ],
    correctIndex: 1,
    difficulty: "medium",
  },
  {
    text: "In RESTful API design, which approach best represents a relationship between resources?",
    options: [
      "Using query parameters for all nested resources",
      "Embedding related resource IDs in the response body",
      "Using nested URL paths like /users/{id}/posts",
      "Always returning full resource details in every response",
    ],
    correctIndex: 2,
    difficulty: "medium",
  },
  {
    text: "What is the recommended practice for handling authentication tokens in API requests?",
    options: [
      "Include tokens in URL query parameters for easy debugging",
      "Store tokens in localStorage and send them in Authorization headers",
      "Send tokens only in request body to hide them from logs",
      "Use cookies exclusively for all token storage",
    ],
    correctIndex: 1,
    difficulty: "hard",
  },
];

export default function SmartQuestions({ exercise: _exercise, onComplete }: Props) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [errors, setErrors] = useState(0);
  const timer = useExerciseTimer();

  useEffect(() => {
    timer.start();
  }, [timer]);

  const handleAnswer = (optionIndex: number) => {
    const question = QUESTIONS[currentQuestion];

    // Track error if wrong answer
    if (optionIndex !== question.correctIndex) {
      setErrors((prev) => prev + 1);
    }

    // Move to next question or complete
    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    } else {
      // All questions answered - complete the exercise
      const finalErrors = optionIndex !== question.correctIndex ? errors + 1 : errors;
      timer.pause();
      onComplete(timer.getDuration(), finalErrors);
    }
  };

  const question = QUESTIONS[currentQuestion];
  const progress = ((currentQuestion + 1) / QUESTIONS.length) * 100;

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-blue-100/60">
            Question {currentQuestion + 1} of {QUESTIONS.length}
          </span>
          <span className="text-blue-100/60 capitalize">{question.difficulty}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question card */}
      <div className="rounded-2xl border border-white/10 bg-white/10 p-8 backdrop-blur-xl">
        <h3 className="mb-6 text-center text-xl font-semibold text-white">{question.text}</h3>

        {/* Answer options */}
        <div className="space-y-3">
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => {
                handleAnswer(index);
              }}
              className={cn(
                "w-full rounded-lg border border-white/20 bg-white/5 p-4 text-left text-white transition-all hover:border-white/40 hover:bg-white/10",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <p className="text-center text-sm text-blue-100/60">Select the best answer to continue to the next question</p>
    </div>
  );
}
