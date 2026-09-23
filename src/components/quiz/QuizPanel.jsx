import React, { useState } from "react";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";

// In-browser quiz only — no scores or identity sent to the server.
export default function QuizPanel({ questions }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  if (!questions || !questions.length) return null;

  const correctCount = questions.filter((q) => answers[q.id] === q.correct_option_id).length;
  const allAnswered = questions.every((q) => answers[q.id]);

  const handleSelect = (qid, oid) => {
    if (submitted) return;
    setAnswers((a) => ({ ...a, [qid]: oid }));
  };

  const reset = () => { setAnswers({}); setSubmitted(false); };

  return (
    <div className="quiz-panel space-y-5">
      {questions.map((q, qi) => (
        <div key={q.id} className="quiz-question">
          <div className="flex gap-2 mb-3">
            <span className="text-xs font-semibold text-primary mt-0.5">Q{qi + 1}</span>
            <p className="text-sm md:text-base font-medium text-foreground">{q.question}</p>
          </div>
          <div className="grid gap-2">
            {q.options.map((opt) => {
              const selected = answers[q.id] === opt.id;
              const isCorrect = q.correct_option_id === opt.id;
              const showResult = submitted && selected;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelect(q.id, opt.id)}
                  disabled={submitted}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                    showResult
                      ? isCorrect
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-red-400 bg-red-50 text-red-700"
                      : selected
                        ? "border-primary bg-accent text-primary"
                        : "border-border hover:border-primary/40 hover:bg-accent/40"
                  } ${submitted && isCorrect && !selected ? "border-green-400 bg-green-50/50" : ""}`}
                >
                  <span className="flex-1">{opt.text}</span>
                  {showResult && (isCorrect ? <CheckCircle2 size={16} className="text-green-600" /> : <XCircle size={16} className="text-red-500" />)}
                </button>
              );
            })}
          </div>
          {submitted && q.explanation && (
            <div className="mt-3 px-3 py-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">解析：</span>{q.explanation}
            </div>
          )}
        </div>
      ))}
      <div className="flex items-center gap-3">
        {!submitted ? (
          <button
            onClick={() => setSubmitted(true)}
            disabled={!allAnswered}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            揭晓答案
          </button>
        ) : (
          <>
            <div className="text-sm font-medium text-foreground">本次答对 <span className="text-primary text-base">{correctCount}</span> / {questions.length} 题</div>
            <button onClick={reset} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent">
              <RefreshCw size={14} /> 重新尝试
            </button>
          </>
        )}
      </div>
    </div>
  );
}
