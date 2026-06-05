// Database entity types
export interface Exercise {
  id: string; // UUID
  exercise_type: "animated_pacer" | "smart_questions" | "focus_sprint" | "speed_scan";
  dataset_id: string;
  title: string;
  description: string | null;
  content: string;
  config: {
    target_wpm?: number;
    pacer_speed?: "fixed" | "adaptive";
    highlight_color?: string;
    // Extensible for other exercise types in S-02
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
