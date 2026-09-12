import { useEffect, useState } from "react";
import type { Exercise } from "@/types";

interface Props {
  exercise: Exercise;
  onComplete: (durationSeconds: number, errorCount: number, gridsCompleted: number) => void;
}

const DEFAULT_SYMBOLS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

function shuffle(arr: string[]): string[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function freshShuffle(symbols: string[], current: string[]): string[] {
  let next = shuffle(symbols);
  while (next.every((v, i) => v === current[i])) {
    next = shuffle(symbols);
  }
  return next;
}

export default function PeripheralVisionGrid({ exercise, onComplete }: Props) {
  const symbols = exercise.config.symbols ?? DEFAULT_SYMBOLS;

  const [isSmallViewport] = useState(() => typeof window !== "undefined" && window.innerWidth < 1024);
  const [phase, setPhase] = useState<"countdown" | "running" | "done">("countdown");
  const [countdownValue, setCountdownValue] = useState<3 | 2 | 1>(3);
  const [timeLeft, setTimeLeft] = useState(30);
  const [grid, setGrid] = useState<string[]>(() => shuffle(symbols));
  const [nextIndex, setNextIndex] = useState(0);
  const [gridsCompleted, setGridsCompleted] = useState(0);

  // Countdown ticks 3→2→1 then transitions to running. Hardcoded start=3, no stale dep.
  useEffect(() => {
    if (phase !== "countdown") return;
    let ticks = 3;
    const id = setInterval(() => {
      ticks--;
      if (ticks === 0) {
        clearInterval(id);
        setPhase("running");
      } else {
        setCountdownValue(ticks as 3 | 2 | 1);
      }
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          setPhase("done");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [phase]);

  // Fires once when phase flips to "done"; gridsCompleted is frozen by then.
  useEffect(() => {
    if (phase === "done") {
      onComplete(30, 0, gridsCompleted);
    }
  }, [phase, onComplete, gridsCompleted]);

  function handleTap(symbol: string) {
    if (phase !== "running" || symbol !== symbols[nextIndex]) return;
    if (nextIndex === symbols.length - 1) {
      setGrid((g) => freshShuffle(symbols, g));
      setNextIndex(0);
      setGridsCompleted((c) => c + 1);
    } else {
      setNextIndex(nextIndex + 1);
    }
  }

  if (isSmallViewport) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-lg font-semibold text-gray-200">Desktop required</p>
        <p className="mt-2 text-sm text-gray-400">
          Peripheral Vision Grid requires a screen at least 1024px wide. Open on a desktop browser.
        </p>
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-8">
        <p className="text-sm text-gray-400">Get ready — keep your gaze on the center dot</p>
        <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gray-800 text-6xl font-bold text-white">
          {countdownValue}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <div className="flex w-full max-w-sm items-center justify-between text-sm text-gray-400">
        <span>
          Grids completed: <span className="font-bold text-white">{gridsCompleted}</span>
        </span>
        <span>
          Time: <span className="font-bold text-white">{timeLeft}s</span>
        </span>
      </div>

      <div className="relative">
        <div className="grid grid-cols-3 gap-3">
          {grid.map((symbol, idx) => {
            const tapped = symbols.indexOf(symbol) < nextIndex;
            return (
              <button
                key={idx}
                onClick={() => {
                  handleTap(symbol);
                }}
                className={`flex h-16 w-16 items-center justify-center rounded-lg text-xl font-semibold transition-colors ${tapped ? "border border-teal-500/40 bg-teal-900/40 text-teal-300" : "bg-gray-800 text-gray-200 hover:bg-gray-700 active:bg-gray-600"}`}
              >
                {symbol}
              </button>
            );
          })}
        </div>
        {/* Center dot overlay — pointer-events-none so taps pass through */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div className="h-4 w-4 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
        </div>
      </div>

      <p className="text-xs text-gray-500">Keep your gaze fixed on the green dot</p>
    </div>
  );
}
