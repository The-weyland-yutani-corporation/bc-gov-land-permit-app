'use client';

import type { IntakeAnswer, IntakeQuestion } from '@permit-readiness/contracts';

function answerFor(answers: IntakeAnswer[], questionId: string) {
  return answers.find((answer) => answer.questionId === questionId);
}

export function QuestionFields({
  questions,
  answers,
  onChange,
}: {
  questions: IntakeQuestion[];
  answers: IntakeAnswer[];
  onChange(answer: IntakeAnswer): void;
}) {
  return questions.map((question) => {
    const answer = answerFor(answers, question.id);
    if (question.visibleWhen) {
      const controlling = answerFor(answers, question.visibleWhen.questionId);
      if (
        controlling?.state !== 'answered' ||
        controlling.value !== question.visibleWhen.value
      ) {
        return null;
      }
    }

    if (question.kind === 'boolean') {
      const value =
        answer?.state === 'answered' ? String(answer.value) : answer?.state;
      return (
        <fieldset className="field" key={question.id}>
          <legend>{question.label}</legend>
          {question.helpText ? (
            <p className="field__hint">{question.helpText}</p>
          ) : null}
          <div className="choice-list">
            {[
              ['true', 'Yes'],
              ['false', 'No'],
              ['unknown', 'Unknown'],
            ].map(([option, label]) => (
              <label className="choice" key={option}>
                <input
                  type="radio"
                  name={question.id}
                  checked={value === option}
                  onChange={() =>
                    onChange(
                      option === 'unknown'
                        ? { questionId: question.id, state: 'unknown' }
                        : {
                            questionId: question.id,
                            state: 'answered',
                            kind: 'boolean',
                            value: option === 'true',
                          },
                    )
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      );
    }

    if (question.kind === 'number') {
      const value =
        answer?.state === 'answered' && answer.kind === 'number'
          ? answer.value
          : '';
      return (
        <div className="field" key={question.id}>
          <label htmlFor={question.id}>{question.label}</label>
          {question.helpText ? (
            <span className="field__hint">{question.helpText}</span>
          ) : null}
          <input
            id={question.id}
            type="number"
            min={question.minimum}
            max={question.maximum}
            value={value}
            onChange={(event) => {
              if (event.target.value === '') return;
              onChange({
                questionId: question.id,
                state: 'answered',
                kind: 'number',
                value: Number(event.target.value),
              });
            }}
          />
          {question.unit ? (
            <span className="field__hint">Unit: {question.unit}</span>
          ) : null}
        </div>
      );
    }

    return null;
  });
}
