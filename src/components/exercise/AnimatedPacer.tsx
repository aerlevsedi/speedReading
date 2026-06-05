import { useState, useEffect, useRef } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Exercise } from "@/types";

interface Props {
  exercise: Exercise;
  onComplete: (durationSeconds: number) => void;
}

export default function AnimatedPacer({ exercise, onComplete }: Props) {
  const words = exercise.content.split(/\s+/); // Split by whitespace
  const targetWpm = exercise.config.target_wpm ?? 250;
  const msPerWord = (60 * 1000) / targetWpm; // e.g., 250 WPM = 240ms per word
  const highlightColor = exercise.config.highlight_color ?? "#3b82f6";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRunning && currentIndex < words.length) {
      intervalRef.current = window.setInterval(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          if (next >= words.length) {
            setIsRunning(false);
            setIsComplete(true);
            const durationSeconds = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
            onComplete(durationSeconds);
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

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {!isRunning && !isComplete && (
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
                padding: index === currentIndex ? "2px 4px" : "0",
                borderRadius: index === currentIndex ? "4px" : "0",
                transition: "background-color 0.1s ease",
              }}
              className={index === currentIndex ? "font-semibold text-white" : "text-blue-100/70"}
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
