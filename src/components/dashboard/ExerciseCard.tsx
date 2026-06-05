import { useState } from "react";
import { Play, Clock, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Exercise } from "@/types";

interface Props {
  exercise: Exercise;
}

export default function ExerciseCard({ exercise }: Props) {
  const [isNavigating, setIsNavigating] = useState(false);
  const typeBadgeColor = {
    animated_pacer: "bg-blue-500/20 text-blue-300",
    smart_questions: "bg-purple-500/20 text-purple-300",
    focus_sprint: "bg-green-500/20 text-green-300",
    speed_scan: "bg-orange-500/20 text-orange-300",
  }[exercise.exercise_type];

  const typeLabel = {
    animated_pacer: "Animated Pacer",
    smart_questions: "Smart Questions",
    focus_sprint: "Focus Sprint",
    speed_scan: "Speed Scan",
  }[exercise.exercise_type];

  const estimatedMinutes = exercise.estimated_duration_seconds
    ? Math.ceil(exercise.estimated_duration_seconds / 60)
    : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur-xl transition-all hover:border-white/20 hover:bg-white/[0.15]">
      <div className="mb-3 flex items-start justify-between">
        <span className={`rounded-lg px-3 py-1 text-xs font-medium ${typeBadgeColor}`}>{typeLabel}</span>
        {exercise.difficulty && (
          <span className="flex items-center gap-1 text-xs text-blue-100/60">
            <BarChart3 className="size-3" />
            {exercise.difficulty}
          </span>
        )}
      </div>

      <h3 className="mb-2 text-xl font-bold text-white">{exercise.title}</h3>
      {exercise.description && <p className="mb-4 text-sm text-blue-100/70">{exercise.description}</p>}

      <div className="mb-4 flex items-center gap-2 text-xs text-blue-100/50">
        <Clock className="size-3" />
        {estimatedMinutes ? `~${estimatedMinutes} min` : "Time varies"}
      </div>

      <a
        href={`/exercise/${exercise.id}`}
        onClick={() => {
          setIsNavigating(true);
        }}
      >
        <Button className="w-full" size="lg" disabled={isNavigating}>
          {isNavigating ? (
            <>
              <span className="animate-spin">⏳</span>
              Loading...
            </>
          ) : (
            <>
              <Play className="size-4" />
              Start Exercise
            </>
          )}
        </Button>
      </a>
    </div>
  );
}
