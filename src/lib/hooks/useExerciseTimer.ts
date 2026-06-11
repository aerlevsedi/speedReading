import { useRef, useState } from "react";

/**
 * Reusable timer hook for exercise components.
 * Tracks cumulative duration from start() call to getDuration() call.
 *
 * NOTE: pause() only sets isRunning flag - it does NOT stop time accumulation.
 * getDuration() always calculates from original start time to current time,
 * regardless of pause/resume state. Use pause() only for UI display purposes.
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
