import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useExerciseTimer } from "@/lib/hooks/useExerciseTimer";
import type { Exercise } from "@/types";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Question {
  text: string;
  options: string[];
  correctIndex: number;
}

interface Props {
  exercise: Exercise;
  onComplete: (durationSeconds: number, errors: number) => void;
}

// Hard-coded questions per dataset for information recall
const QUESTIONS_BY_DATASET: Record<string, Question[]> = {
  dataset_1: [
    // Web Performance questions
    {
      text: "What percentage of web performance issues are related to frontend optimization?",
      options: ["50%", "70%", "80%", "90%"],
      correctIndex: 2,
    },
    {
      text: "Which browser API is mentioned for implementing service workers?",
      options: ["Cache API", "Storage API", "Worker API", "Fetch API"],
      correctIndex: 0,
    },
    {
      text: "What is the recommended strategy for cache invalidation?",
      options: ["Time-based expiration", "Manual clearing", "Version-based cache busting", "Random invalidation"],
      correctIndex: 2,
    },
  ],
  dataset_2: [
    // Git Workflows questions
    {
      text: "What is the main purpose of feature branches?",
      options: [
        "To backup code",
        "To allow parallel development while keeping main stable",
        "To organize files",
        "To improve performance",
      ],
      correctIndex: 1,
    },
    {
      text: "Which workflow maintains a single main branch with frequent commits?",
      options: ["Gitflow", "Feature branch workflow", "Trunk-based development", "Fork workflow"],
      correctIndex: 2,
    },
    {
      text: "What do feature flags enable in trunk-based development?",
      options: [
        "Faster Git operations",
        "Hiding incomplete work while shipping code continuously",
        "Automatic code review",
        "Branch protection",
      ],
      correctIndex: 1,
    },
  ],
};

export default function SpeedScan({ exercise, onComplete }: Props) {
  const timer = useExerciseTimer();
  const scanTimeSeconds = exercise.config.scan_time_seconds ?? 30;

  // Get questions for current dataset - fail fast if dataset not found
  const QUESTIONS = QUESTIONS_BY_DATASET[exercise.dataset_id];
  if (!QUESTIONS) {
    throw new Error(
      `No questions defined for dataset: ${exercise.dataset_id}. Available datasets: ${Object.keys(QUESTIONS_BY_DATASET).join(", ")}`,
    );
  }

  const [phase, setPhase] = useState<"preview" | "scan" | "recall">("preview");
  const [countdown, setCountdown] = useState(scanTimeSeconds);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentRecallQuestion, setCurrentRecallQuestion] = useState(0);

  // Start timer on mount (tracks cumulative duration across all phases)
  useEffect(() => {
    timer.start();
  }, [timer]);

  const handleStartScan = () => {
    setPhase("scan");
  };

  const handleScanComplete = useCallback(() => {
    setPhase("recall");
  }, []);

  // Countdown logic for scan phase
  useEffect(() => {
    if (phase !== "scan") return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleScanComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [phase, handleScanComplete]);

  const handleRecallAnswer = (optionIndex: number) => {
    const newAnswers = { ...answers, [currentRecallQuestion]: optionIndex };
    setAnswers(newAnswers);

    if (currentRecallQuestion < QUESTIONS.length - 1) {
      setCurrentRecallQuestion(currentRecallQuestion + 1);
    } else {
      // All questions answered - calculate errors and complete
      const errors = QUESTIONS.reduce((acc, q, i) => {
        return newAnswers[i] !== q.correctIndex ? acc + 1 : acc;
      }, 0);
      timer.pause();
      onComplete(timer.getDuration(), errors);
    }
  };

  // Format countdown as seconds
  const formattedTime = `${countdown}s`;

  // Phase 1: Preview
  if (phase === "preview") {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-8">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-8 backdrop-blur-xl">
          <h2 className="mb-6 text-center text-3xl font-bold text-white">Speed Scan Challenge</h2>

          <Alert className="mb-6 border-blue-500/20 bg-blue-500/10">
            <AlertDescription className="text-blue-100">
              Your task is to quickly scan the text and find specific information. First, review the questions below to
              know what to look for. Then, scan the text within the time limit to locate the answers.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white">Find answers to these questions:</h3>
            <ol className="list-inside list-decimal space-y-2 text-gray-200">
              {QUESTIONS.map((q, i) => (
                <li key={i} className="text-lg">
                  {q.text}
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-8 flex justify-center">
            <Button onClick={handleStartScan} size="lg">
              Start Scanning
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Phase 2: Scan
  if (phase === "scan") {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-8">
        {/* Countdown Timer */}
        <div className="flex items-center justify-center">
          <div className="rounded-full border-4 border-blue-500 bg-blue-500/20 px-8 py-4">
            <span className="text-4xl font-bold text-blue-100">{formattedTime}</span>
          </div>
        </div>

        {/* Content to scan */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <h2 className="mb-6 text-center text-3xl font-bold text-white">{exercise.title}</h2>
          <div className="prose prose-invert max-w-none">
            <p className="text-lg leading-relaxed whitespace-pre-wrap text-gray-200">{exercise.content}</p>
          </div>
        </div>

        {/* Instructions */}
        <p className="text-center text-sm text-blue-100/60">
          Scan the text to find answers to the questions. The timer will advance automatically.
        </p>
      </div>
    );
  }

  // Phase 3: Recall
  const question = QUESTIONS[currentRecallQuestion];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      {/* Progress */}
      <div className="text-center text-sm text-blue-100/60">
        Question {currentRecallQuestion + 1} of {QUESTIONS.length}
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
                handleRecallAnswer(index);
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
      <p className="text-center text-sm text-blue-100/60">Select the answer you found in the text</p>
    </div>
  );
}
