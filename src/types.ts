// Database entity types
export interface Exercise {
  id: string; // UUID
  exercise_type: "animated_pacer" | "smart_questions" | "focus_sprint" | "speed_scan";
  dataset_id: string;
  title: string;
  description: string | null;
  content: string;
  config: {
    // Animated Pacer
    target_wpm?: number;
    pacer_speed?: "fixed" | "adaptive";
    highlight_color?: string;

    // Smart Questions
    questions_count?: number;
    time_per_question?: number;

    // Focus Sprint
    pressure_threshold?: number;
    countdown_seconds?: number;

    // Speed Scan
    scan_time_seconds?: number;
    info_recall_count?: number;
  };
  difficulty: "beginner" | "intermediate" | "advanced" | null;
  estimated_duration_seconds: number | null;
  created_at: string; // ISO timestamp
  updated_at: string;
}

export interface Completion {
  id: string; // UUID
  user_id: string;
  exercise_id: string;
  duration_seconds: number;
  errors: number;
  type_data: {
    wpm?: number;
    // Extensible for other exercise types
  };
  completed_at: string; // ISO timestamp
}

export interface UserGoal {
  id: string;
  user_id: string;
  target_wpm: number;
  created_at: string;
  updated_at: string;
}
