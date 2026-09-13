import { useState } from "react";
import AnimatedPacer from "./AnimatedPacer";
import SmartQuestions from "./SmartQuestions";
import FocusSprint from "./FocusSprint";
import SpeedScan from "./SpeedScan";
import PeripheralVisionGrid from "./PeripheralVisionGrid";
import ExerciseIntroModal from "./ExerciseIntroModal";
import type { Exercise } from "@/types";

interface Props {
  exercise: Exercise;
  seenIntros: string[];
}

const ExerciseComponentMap = {
  animated_pacer: AnimatedPacer,
  smart_questions: SmartQuestions,
  focus_sprint: FocusSprint,
  speed_scan: SpeedScan,
  peripheral_vision_grid: PeripheralVisionGrid,
} as const;

const INTRO_SUPPORTED_TYPES = ["animated_pacer", "focus_sprint", "speed_scan", "peripheral_vision_grid"] as const;
type IntroSupportedType = (typeof INTRO_SUPPORTED_TYPES)[number];

export default function ExerciseFlow({ exercise, seenIntros }: Props) {
  const [isComplete, setIsComplete] = useState(false);
  const [duration, setDuration] = useState(0);
  const [errors, setErrors] = useState(0);
  const [gridsCompleted, setGridsCompleted] = useState(0);

  const supportsIntro = (INTRO_SUPPORTED_TYPES as readonly string[]).includes(exercise.exercise_type);
  const alreadySeen = seenIntros.includes(exercise.exercise_type);
  const [isFirstTimeGate, setIsFirstTimeGate] = useState(supportsIntro && !alreadySeen);
  const [introOpen, setIntroOpen] = useState(supportsIntro && !alreadySeen);
  const [markedAsSeen, setMarkedAsSeen] = useState(alreadySeen);
  const [introOpenCount, setIntroOpenCount] = useState(0);

  const handleComplete = (durationSeconds: number, errorCount: number, gridsCount = 0) => {
    setDuration(durationSeconds);
    setErrors(errorCount);
    setGridsCompleted(gridsCount);
    setIsComplete(true);
  };

  const handleIntroDismiss = (doNotShowAgain: boolean) => {
    setIntroOpen(false);
    setIsFirstTimeGate(false);
    if (doNotShowAgain && !markedAsSeen) {
      setMarkedAsSeen(true);
      const fd = new FormData();
      fd.append("exercise_type", exercise.exercise_type);
      void fetch("/api/intros/mark-seen", { method: "POST", body: fd }).catch((err: unknown) => {
        console.error("[mark-seen]", err);
        setMarkedAsSeen(false);
      });
    }
  };

  const ExerciseComponent = ExerciseComponentMap[exercise.exercise_type];

  if (isComplete) {
    return (
      <form method="POST" action="/api/exercises/complete" className="hidden">
        <input type="hidden" name="exercise_id" value={exercise.id} />
        <input type="hidden" name="duration_seconds" value={duration} />
        <input type="hidden" name="errors" value={errors} />
        {gridsCompleted > 0 && <input type="hidden" name="grids_completed" value={gridsCompleted} />}
        <button type="submit" ref={(el) => el?.click()}>
          Submit
        </button>
      </form>
    );
  }

  return (
    <div className="relative">
      {supportsIntro && (
        <ExerciseIntroModal
          key={introOpenCount}
          exerciseType={exercise.exercise_type as IntroSupportedType}
          open={introOpen}
          initialChecked={markedAsSeen}
          onDismiss={handleIntroDismiss}
        />
      )}
      {supportsIntro && (
        <button
          onClick={() => {
            setIntroOpenCount((c) => c + 1);
            setIntroOpen(true);
          }}
          className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm text-white/60 transition-colors hover:bg-white/20 hover:text-white"
          aria-label="Show exercise instructions"
        >
          ?
        </button>
      )}
      <div className="mb-6 text-center">
        <div className="mb-2">
          <h1 className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-3xl font-bold text-transparent">
            {exercise.title}
          </h1>
        </div>
        <p className="text-sm text-blue-100/60">Read at your own pace. Focus on comprehension.</p>
      </div>
      {!isFirstTimeGate && <ExerciseComponent exercise={exercise} onComplete={handleComplete} />}
    </div>
  );
}
