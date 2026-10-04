import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertProjectStatusTransition,
  calculateIntakeCompleteness,
  canTransitionProjectStatus,
  isIsoDate,
  statusAfterIntakeUpdate,
  validatePermitDependencies,
} from '../dist/index.js';

test('project status transitions allow supported lifecycle moves', () => {
  assert.equal(canTransitionProjectStatus('draft', 'intake_in_progress'), true);
  assert.equal(
    canTransitionProjectStatus('intake_in_progress', 'report_ready'),
    false,
  );
  assert.equal(canTransitionProjectStatus('archived', 'draft'), false);
  assert.throws(
    () => assertProjectStatusTransition('draft', 'report_ready'),
    /cannot transition/,
  );
  assert.equal(
    statusAfterIntakeUpdate('intake_in_progress', true),
    'ready_for_review',
  );
  assert.equal(statusAfterIntakeUpdate('archived', false), 'archived');
});

test('intake completeness distinguishes missing and unknown answers', () => {
  const completeness = calculateIntakeCompleteness(
    [
      { id: 'required-a', required: true },
      { id: 'required-b', required: true },
      { id: 'optional-c', required: false },
    ],
    [
      { questionId: 'required-a', state: 'answered', value: true },
      { questionId: 'required-b', state: 'unknown' },
    ],
  );

  assert.deepEqual(completeness, {
    requiredCount: 2,
    answeredRequiredCount: 1,
    missingRequiredQuestionIds: [],
    unknownRequiredQuestionIds: ['required-b'],
    isComplete: false,
  });
});

test('permit dependency validation detects unknown, duplicate, self, and cyclic edges', () => {
  const issues = validatePermitDependencies(
    ['permit-a', 'permit-b', 'permit-c'],
    [
      {
        permitTypeId: 'permit-a',
        dependsOnPermitTypeId: 'permit-b',
        relationship: 'before',
        explanation: 'A before B',
      },
      {
        permitTypeId: 'permit-a',
        dependsOnPermitTypeId: 'permit-b',
        relationship: 'parallel',
        explanation: 'duplicate',
      },
      {
        permitTypeId: 'permit-b',
        dependsOnPermitTypeId: 'permit-a',
        relationship: 'before',
        explanation: 'cycle',
      },
      {
        permitTypeId: 'permit-c',
        dependsOnPermitTypeId: 'permit-c',
        relationship: 'before',
        explanation: 'self',
      },
      {
        permitTypeId: 'permit-c',
        dependsOnPermitTypeId: 'missing',
        relationship: 'before',
        explanation: 'unknown',
      },
    ],
  );

  assert.deepEqual(
    new Set(issues.map((issue) => issue.code)),
    new Set(['duplicate', 'cycle', 'self_reference', 'unknown_permit']),
  );
});

test('ISO date helper rejects calendar rollovers', () => {
  assert.equal(isIsoDate('2028-02-29'), true);
  assert.equal(isIsoDate('2027-02-29'), false);
  assert.equal(isIsoDate('2026-2-03'), false);
});
