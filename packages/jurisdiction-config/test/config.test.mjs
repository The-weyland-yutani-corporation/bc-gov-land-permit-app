import assert from 'node:assert/strict';
import test from 'node:test';
import {
  JURISDICTION_CONFIG_SCHEMA_VERSION,
  JurisdictionConfigurationSchema,
  bcInspiredSyntheticPreset,
  genericPublicSectorPreset,
  getJurisdictionPreset,
} from '../dist/index.js';

test('both synthetic presets validate and are immutable', () => {
  assert.equal(
    JurisdictionConfigurationSchema.safeParse(genericPublicSectorPreset)
      .success,
    true,
  );
  assert.equal(
    JurisdictionConfigurationSchema.safeParse(bcInspiredSyntheticPreset)
      .success,
    true,
  );
  assert.equal(Object.isFrozen(bcInspiredSyntheticPreset), true);
  assert.equal(Object.isFrozen(bcInspiredSyntheticPreset.rules), true);
  assert.equal(
    getJurisdictionPreset('bc-inspired-synthetic'),
    bcInspiredSyntheticPreset,
  );
  assert.equal(bcInspiredSyntheticPreset.provenance.synthetic, true);
  assert.match(
    bcInspiredSyntheticPreset.content.demonstrationNotice,
    /demonstration/i,
  );
});

test('configuration schema version is explicit and unsupported versions fail', () => {
  assert.equal(JURISDICTION_CONFIG_SCHEMA_VERSION, '1.0.0');
  const incompatible = structuredClone(genericPublicSectorPreset);
  incompatible.schemaVersion = '2.0.0';
  assert.equal(
    JurisdictionConfigurationSchema.safeParse(incompatible).success,
    false,
  );
});

test('cross references and release versions are validated', () => {
  const unknownQuestion = structuredClone(genericPublicSectorPreset);
  unknownQuestion.rules[0].condition.questionId = 'missing-question';
  assert.equal(
    JurisdictionConfigurationSchema.safeParse(unknownQuestion).success,
    false,
  );

  const wrongRuleVersion = structuredClone(genericPublicSectorPreset);
  wrongRuleVersion.rules[0].version = '1.1.0';
  assert.equal(
    JurisdictionConfigurationSchema.safeParse(wrongRuleVersion).success,
    false,
  );

  const duplicatePermit = structuredClone(genericPublicSectorPreset);
  duplicatePermit.permits.push(structuredClone(duplicatePermit.permits[0]));
  assert.equal(
    JurisdictionConfigurationSchema.safeParse(duplicatePermit).success,
    false,
  );
});

test('cyclic permit dependencies and invalid geometry fail activation', () => {
  const cyclic = structuredClone(genericPublicSectorPreset);
  cyclic.permitDependencies.push({
    permitTypeId: 'access-coordination',
    dependsOnPermitTypeId: 'site-disturbance-review',
    relationship: 'before',
    explanation: 'Synthetic reverse dependency added to prove cycle rejection.',
  });
  assert.equal(
    JurisdictionConfigurationSchema.safeParse(cyclic).success,
    false,
  );

  const invalidGeometry = structuredClone(genericPublicSectorPreset);
  invalidGeometry.demoZones[0].geometry.coordinates[0].pop();
  assert.equal(
    JurisdictionConfigurationSchema.safeParse(invalidGeometry).success,
    false,
  );
});

test('approved releases require an effective date and matching guidance version', () => {
  const noEffectiveDate = structuredClone(genericPublicSectorPreset);
  delete noEffectiveDate.release.effectiveDate;
  assert.equal(
    JurisdictionConfigurationSchema.safeParse(noEffectiveDate).success,
    false,
  );

  const mismatchedGuidance = structuredClone(genericPublicSectorPreset);
  mismatchedGuidance.guidanceSources[0].version = '1.1.0';
  assert.equal(
    JurisdictionConfigurationSchema.safeParse(mismatchedGuidance).success,
    false,
  );
});

test('rule evidence and follow-up references must exist in the release', () => {
  const unknownSource = structuredClone(genericPublicSectorPreset);
  unknownSource.rules[0].sourceIds = ['missing-source'];
  assert.equal(
    JurisdictionConfigurationSchema.safeParse(unknownSource).success,
    false,
  );

  const unknownFollowUp = structuredClone(genericPublicSectorPreset);
  unknownFollowUp.rules[0].followUpQuestionIds = ['missing-question'];
  assert.equal(
    JurisdictionConfigurationSchema.safeParse(unknownFollowUp).success,
    false,
  );
});
