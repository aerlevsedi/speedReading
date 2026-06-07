import { useRef, useState } from "react";

/**
 * Reusable timer hook for exercise components.
 * Tracks cumulative duration with pause/resume support.
 */
export function useExerciseTimer(): {
  start: () => void;
  pause: () => void;
  getDuration: () => number;
  isRunning: boolean;
} {
  const startTimeRef = useRef<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const start = () => {
    // Use ??= to preserve original start time across pause/resume
    startTimeRef.current ??= Date.now();
    setIsRunning(true);
  };

  const pause = () => {
    setIsRunning(false);
  };

  const getDuration = (): number => {
    if (!startTimeRef.current) return 0;
    return Math.floor((Date.now() - startTimeRef.current) / 1000);
  };

  return { start, pause, getDuration, isRunning };
}
