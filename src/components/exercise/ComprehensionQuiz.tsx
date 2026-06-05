import { useState } from "react";
import { cn } from "@/lib/utils";

interface Question {
  text: string;
  options: string[];
  correctIndex: number;
}

interface Props {
  questions: Question[];
  onComplete: (errors: number) => void;
}

export default function ComprehensionQuiz({ questions, onComplete }: Props) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...selectedAnswers, optionIndex];
    setSelectedAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Calculate errors
      const errors = questions.reduce((acc, q, i) => {
        return newAnswers[i] !== q.correctIndex ? acc + 1 : acc;
      }, 0);
      onComplete(errors);
    }
  };

  const question = questions[currentQuestion];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/10 p-8 backdrop-blur-xl">
        <div className="mb-4 text-center text-sm text-blue-100/60">
          Question {currentQuestion + 1} of {questions.length}
        </div>
        <h3 className="mb-6 text-center text-xl font-semibold text-white">{question.text}</h3>
        <div className="space-y-3">
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => {
                handleAnswer(index);
              }}
              className={cn(
                "w-full rounded-lg border border-white/20 bg-white/5 p-4 text-left text-white transition-all hover:border-white/40 hover:bg-white/10",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
