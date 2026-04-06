import { useState } from "react";

interface Answer {
  selected: number;
  isCorrect: boolean;
}

const questions = [
  {
    question: "What makes molecular hydrogen different from Vitamin C?",
    options: [
      "It is cheaper",
      "It is much smaller and can cross cell membranes",
      "It comes from water",
      "It is a vitamin",
    ],
    correct: 1,
    explanation:
      "H\u2082 is 500\u00D7 smaller than Vitamin C molecules. This lets it pass through cell walls and reach places \u2014 like mitochondria and the brain \u2014 that larger antioxidants cannot.",
  },
  {
    question: "What is oxidative stress?",
    options: [
      "Stress from working out too hard",
      "Emotional stress that affects your health",
      "Damage caused by unstable particles called free radicals",
      "Low blood sugar",
    ],
    correct: 2,
    explanation:
      "Free radicals are unstable particles that damage nearby cells when they grab electrons. The buildup of this damage over time is oxidative stress \u2014 linked to aging and chronic disease.",
  },
  {
    question: "Where can H\u2082 travel that most antioxidants cannot reach?",
    options: ["The kidneys", "The stomach", "The liver", "The brain"],
    correct: 3,
    explanation:
      "H\u2082 crosses the blood-brain barrier \u2014 a protective filter that blocks most molecules from entering the brain. This makes it uniquely useful for studying neuroprotection.",
  },
];

export default function QuizSection() {
  const [answers, setAnswers] = useState<Record<number, Answer>>({});

  const handleAnswer = (questionIndex: number, optionIndex: number) => {
    if (answers[questionIndex] !== undefined) return;
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: {
        selected: optionIndex,
        isCorrect: optionIndex === questions[questionIndex].correct,
      },
    }));
  };

  const allAnswered = Object.keys(answers).length === questions.length;

  return (
    <section
      style={{
        background: "var(--lp-accent-lt)",
        padding: "var(--lp-section-pad)",
      }}
    >
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <span className="lp-section-label">CHECK YOUR UNDERSTANDING</span>

        <h2
          style={{
            fontFamily: "var(--lp-font-display)",
            fontWeight: 600,
            fontSize: 40,
            color: "var(--lp-primary)",
            marginTop: 12,
            marginBottom: 8,
          }}
        >
          Quick check — what did you pick up?
        </h2>

        <p
          style={{
            fontFamily: "var(--lp-font-body)",
            fontSize: 17,
            color: "var(--lp-muted)",
            marginBottom: 40,
          }}
        >
          Three questions. No score. Just a quick way to make sure it is
          clicking.
        </p>

        {/* Question cards */}
        {questions.map((q, qi) => {
          const answer = answers[qi];
          const isAnswered = answer !== undefined;

          return (
            <div
              key={qi}
              style={{
                background: "#FFFFFF",
                borderRadius: "var(--lp-radius-md)",
                boxShadow: "var(--lp-shadow-card)",
                padding: 24,
                marginBottom: 16,
              }}
            >
              <p
                style={{
                  fontFamily: "var(--lp-font-body)",
                  fontSize: 16,
                  fontWeight: 500,
                  color: "var(--lp-text)",
                  marginBottom: 16,
                }}
              >
                {qi + 1}. {q.question}
              </p>

              {/* Options */}
              {q.options.map((option, oi) => {
                let bg = "var(--lp-bg)";
                let border = "var(--lp-border)";
                let indicator = "";

                if (isAnswered) {
                  if (oi === q.correct) {
                    bg = "#D1FAE5";
                    border = "#10B981";
                    indicator = "\u2713";
                  } else if (oi === answer.selected && !answer.isCorrect) {
                    bg = "#FEE2E2";
                    border = "#EF4444";
                    indicator = "\u2717";
                  }
                }

                return (
                  <button
                    key={oi}
                    onClick={() => handleAnswer(qi, oi)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      textAlign: "left",
                      background: bg,
                      border: `1px solid ${border}`,
                      borderRadius: "var(--lp-radius-sm)",
                      padding: 12,
                      fontFamily: "var(--lp-font-body)",
                      fontSize: 15,
                      color: "var(--lp-text)",
                      cursor: isAnswered ? "default" : "pointer",
                      marginBottom: 8,
                      transition: "background 0.2s ease, border 0.2s ease",
                    }}
                  >
                    {indicator && (
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 16,
                          color:
                            indicator === "\u2713" ? "#10B981" : "#EF4444",
                          flexShrink: 0,
                        }}
                      >
                        {indicator}
                      </span>
                    )}
                    <span>{option}</span>
                  </button>
                );
              })}

              {/* Explanation */}
              {isAnswered && (
                <div
                  style={{
                    background: "#FFFFFF",
                    borderLeft: "3px solid #10B981",
                    padding: 12,
                    marginTop: 8,
                    fontFamily: "var(--lp-font-body)",
                    fontSize: 14,
                    color: "var(--lp-muted)",
                    lineHeight: 1.6,
                    borderRadius: "0 var(--lp-radius-sm) var(--lp-radius-sm) 0",
                  }}
                >
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}

        {/* Success banner */}
        {allAnswered && (
          <div
            style={{
              background: "#D1FAE5",
              border: "1px solid #10B981",
              borderRadius: "var(--lp-radius-md)",
              padding: 16,
              marginTop: 8,
            }}
          >
            <p
              style={{
                fontFamily: "var(--lp-font-body)",
                fontSize: 15,
                fontWeight: 500,
                color: "#065F46",
                margin: 0,
              }}
            >
              You are following along. The science gets more interesting from
              here. →
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
