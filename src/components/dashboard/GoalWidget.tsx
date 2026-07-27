import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  currentGoal: number | null;
  latestWpm: number | null;
}

export default function GoalWidget({ currentGoal, latestWpm }: Props) {
  const [goal, setGoal] = useState<number | null>(currentGoal);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(currentGoal ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setInputValue(String(goal ?? ""));
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setError(null);
    setEditing(false);
  }

  async function save() {
    const wpm = parseInt(inputValue, 10);
    if (isNaN(wpm) || wpm < 50 || wpm > 1000) {
      setError("Enter a value between 50 and 1000 wpm");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body = new URLSearchParams({ target_wpm: String(wpm) });
      const res = await fetch("/api/goals/set", { method: "POST", body });
      const json = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || json.error) {
        setError(json.error ?? "Failed to save goal");
      } else {
        setGoal(wpm);
        setEditing(false);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4">
      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={50}
              max={1000}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
                if (e.key === "Escape") cancelEdit();
              }}
              className="w-28 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/40 focus:ring-2 focus:ring-blue-400/50 focus:outline-none"
              placeholder="e.g. 300"
              autoFocus
            />
            <Button size="sm" onClick={() => void save()} disabled={saving} className="gap-1 px-3">
              <Check className="size-3" />
              {saving ? "Saving…" : "Save"}
            </Button>
            <button
              onClick={cancelEdit}
              className="rounded-lg p-1.5 text-white/50 hover:text-white/80"
              aria-label="Cancel"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="text-xs text-blue-100/50">
            Beginner: 200–250 wpm · Intermediate: 300–400 wpm · Advanced: 400+ wpm
          </p>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      ) : goal !== null ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-blue-100/80">
            Goal: <span className="font-semibold text-white">{goal} wpm</span>
          </span>
          {latestWpm !== null && (
            <span className="text-sm text-blue-100/60">
              Last Focus Sprint: <span className="font-semibold text-blue-200">{latestWpm} wpm</span>
            </span>
          )}
          <button
            onClick={startEdit}
            className="flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-xs text-white/70 transition-colors hover:bg-white/20"
            aria-label="Edit goal"
          >
            <Pencil className="size-3" />
            Edit
          </button>
        </div>
      ) : (
        <button onClick={startEdit} className="text-sm text-blue-300 underline underline-offset-2 hover:text-blue-200">
          Set your reading speed goal
        </button>
      )}
    </div>
  );
}
