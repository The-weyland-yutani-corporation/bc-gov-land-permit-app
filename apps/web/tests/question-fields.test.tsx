import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { IntakeAnswer, IntakeQuestion } from '@permit-readiness/contracts';
import { QuestionFields } from '../src/components/question-fields';

const question: IntakeQuestion = {
  id: 'near-water',
  kind: 'boolean',
  label: 'Could work occur near water?',
  required: true,
};

function Harness() {
  const [answers, setAnswers] = useState<IntakeAnswer[]>([]);
  return (
    <QuestionFields
      questions={[question]}
      answers={answers}
      onChange={(answer) => setAnswers([answer])}
    />
  );
}

describe('QuestionFields', () => {
  it('records an explicit unknown answer', () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText('Unknown'));
    expect(screen.getByLabelText('Unknown')).toBeChecked();
  });
});
