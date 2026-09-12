import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Props {
  exerciseType: "animated_pacer" | "focus_sprint" | "speed_scan";
  open: boolean;
  initialChecked?: boolean;
  onDismiss: (doNotShowAgain: boolean) => void;
}

const INTRO_CONTENT = {
  animated_pacer: {
    title: "Animated Pacer",
    purpose:
      "Train your brain to read at a controlled pace by following a word-by-word highlight. Reduces subvocalization and builds reading rhythm.",
    howItWorks: [
      "Words in the passage highlight one by one at the target WPM.",
      "Use Play/Pause to control the flow.",
      "After the passage ends, answer 2 comprehension questions.",
    ],
    whatsMeasured:
      "Your reading speed is set upfront; your score reflects comprehension accuracy (correct answers out of 2).",
  },
  focus_sprint: {
    title: "Focus Sprint",
    purpose:
      "Measure your natural reading speed under no external pressure. Forces you to commit to a “done reading” moment — builds awareness of when you're actually finished vs. still scanning.",
    howItWorks: [
      "The full passage is displayed at once.",
      "Read it at your own pace, then click “Done Reading.”",
      "Answer 3 comprehension questions.",
    ],
    whatsMeasured:
      "WPM calculated from your actual reading time; score reflects comprehension accuracy (correct answers out of 3).",
  },
  speed_scan: {
    title: "Speed Scan",
    purpose:
      "Train information location — the ability to find specific facts fast without reading every word. Essential for navigating codebases and documentation.",
    howItWorks: [
      "Preview phase: read 3 questions about facts in the passage.",
      "Scan phase: find the answers in the text within the time limit.",
      "Recall phase: answer the questions from memory.",
    ],
    whatsMeasured: "Total time across all three phases; score reflects recall accuracy (correct answers out of 3).",
  },
};

export default function ExerciseIntroModal({ exerciseType, open, initialChecked = false, onDismiss }: Props) {
  const [doNotShowAgain, setDoNotShowAgain] = useState(initialChecked);
  const content = INTRO_CONTENT[exerciseType];

  return (
    <Dialog open={open}>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        showCloseButton={false}
        className="max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{content.title}</DialogTitle>
          <DialogDescription>{content.purpose}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-2 font-medium">How it works</p>
            <ol className="text-muted-foreground list-decimal space-y-1 pl-5">
              {content.howItWorks.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          <div>
            <p className="mb-1 font-medium">What&apos;s measured</p>
            <p className="text-muted-foreground">{content.whatsMeasured}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={doNotShowAgain}
              onChange={(e) => {
                setDoNotShowAgain(e.target.checked);
              }}
              className="h-4 w-4"
            />
            Don&apos;t show this again
          </label>

          <button
            onClick={() => {
              onDismiss(doNotShowAgain);
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
          >
            Start Exercise
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
