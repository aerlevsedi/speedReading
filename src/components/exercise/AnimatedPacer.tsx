import { useState, useEffect, useRef } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import ComprehensionQuiz from "./ComprehensionQuiz";
import type { Exercise } from "@/types";

interface Props {
  exercise: Exercise;
  onComplete: (durationSeconds: number, errors: number) => void;
}

// Hard-coded comprehension questions for Animated Pacer
const QUESTIONS = [
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

export default function AnimatedPacer({ exercise, onComplete }: Props) {
  const words = exercise.content.split(/\s+/); // Split by whitespace
  const targetWpm = exercise.config.target_wpm ?? 250;
  const msPerWord = (60 * 1000) / targetWpm; // e.g., 250 WPM = 240ms per word
  const highlightColor = exercise.config.highlight_color ?? "#3b82f6";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [duration, setDuration] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRunning && currentIndex < words.length) {
      intervalRef.current = window.setInterval(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          if (next >= words.length) {
            setIsRunning(false);
            const durationSeconds = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
            setDuration(durationSeconds);
            setShowQuiz(true);
          }
          return next;
        });
      }, msPerWord);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, currentIndex, words.length, msPerWord, onComplete]);

  const handleStart = () => {
    startTimeRef.current ??= Date.now();
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleQuizComplete = (errors: number) => {
    onComplete(duration, errors);
  };

  // Show quiz after pacer completes
  if (showQuiz) {
    return <ComprehensionQuiz questions={QUESTIONS} onComplete={handleQuizComplete} />;
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {!isRunning && (
          <Button onClick={handleStart} size="lg">
            <Play className="size-4" />
            {currentIndex === 0 ? "Start Reading" : "Resume"}
          </Button>
        )}
        {isRunning && (
          <Button onClick={handlePause} variant="outline" size="lg">
            <Pause className="size-4" />
            Pause
          </Button>
        )}
      </div>

      {/* Text Display */}
      <div className="min-h-[400px] rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
        <div className="prose prose-invert mx-auto max-w-3xl text-lg leading-relaxed">
          {words.map((word, index) => (
            <span
              key={index}
              style={{
                backgroundColor: index === currentIndex ? highlightColor : "transparent",
                color: index === currentIndex ? "#ffffff" : "rgb(191 219 254 / 0.7)",
                padding: "2px 4px",
                borderRadius: "4px",
                transition: "background-color 0.3s ease, color 0.3s ease",
              }}
            >
              {word}{" "}
            </span>
          ))}
        </div>
      </div>

      {/* Progress */}
      <div className="text-center text-sm text-blue-100/60">
        Word {currentIndex + 1} of {words.length}
      </div>
    </div>
  );
}
