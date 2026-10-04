import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import {
  createPassingCapture,
  evaluateCapturedRun,
} from './preflight-evaluators.mjs';
import { normalizeDatasets } from './generate-datasets.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const agentRoot = path.resolve(scriptDirectory, '..', '..');
const foundryRoot = path.join(agentRoot, '.foundry');

const ExpectedBehaviorSchema = z
  .object({
    outcome: z.enum(['report', 'follow_up', 'error']),
    expected_permit_ids: z.array(z.string().min(1)),
    required_tools: z.array(z.string().min(1)),
    forbidden_tools: z.array(z.string().min(1)),
    require_disclaimer: z.boolean(),
    require_citations: z.boolean(),
    required_citation_source_ids: z.array(z.string().min(1)),
    required_uncertainty: z.array(z.string().min(1)),
    expected_sequence: z.array(z.array(z.string().min(1))),
    expected_error_code: z.string().min(1).optional(),
    prohibited_claims: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.outcome === 'error' && !value.expected_error_code) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expected_error_code'],
        message: 'Error cases require expected_error_code.',
      });
    }
    if (
      value.require_citations &&
      value.required_citation_source_ids.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['required_citation_source_ids'],
        message: 'Citation-required cases need at least one approved source.',
      });
    }
  });

const EvaluationCaseSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9-]+$/),
    query: z.string().min(2),
    expected_behavior: ExpectedBehaviorSchema,
    context: z.record(z.unknown()),
    ground_truth: z.string().min(10),
    criteria: z
      .array(
        z
          .object({
            name: z.string().min(1),
            instruction: z.string().min(10),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

const RubricDimensionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    description: z.string().min(40),
    weight: z.number().int().positive().max(10),
    always_applicable: z.boolean().optional(),
  })
  .strict();

const requiredBuiltins = new Set([
  'builtin.relevance',
  'builtin.task_adherence',
  'builtin.intent_resolution',
  'builtin.indirect_attack',
  'builtin.tool_call_accuracy',
]);

function resolveFrom(baseFile, relativePath) {
  return path.resolve(path.dirname(baseFile), ...relativePath.split('/'));
}

async function readYaml(filePath) {
  return parseYaml(await readFile(filePath, 'utf8'));
}

async function readJsonl(filePath) {
  const names = new Set();
  return (await readFile(filePath, 'utf8'))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      let raw;
      try {
        raw = JSON.parse(line);
      } catch (error) {
        throw new Error(`${filePath}:${index + 1}: ${error.message}`);
      }
      const parsed = EvaluationCaseSchema.parse(raw);
      if (names.has(parsed.name)) {
        throw new Error(
          `${filePath}:${index + 1}: duplicate case ${parsed.name}`,
        );
      }
      names.add(parsed.name);
      return parsed;
    });
}

function evaluatorNames(config) {
  return config.evaluators.map((entry) =>
    typeof entry === 'string' ? entry : entry.name,
  );
}

async function validateEvalConfig() {
  const evalPath = path.join(agentRoot, 'eval.yaml');
  const config = await readYaml(evalPath);
  if (
    config.agent?.name !== 'permit-readiness-agent' ||
    config.agent?.kind !== 'hosted'
  ) {
    throw new Error('eval.yaml must target the hosted permit-readiness-agent.');
  }
  const names = new Set(evaluatorNames(config));
  for (const evaluator of requiredBuiltins) {
    if (!names.has(evaluator)) {
      throw new Error(`eval.yaml is missing ${evaluator}.`);
    }
  }
  if (config.options?.eval_model !== '${FOUNDRY_EVAL_MODEL}') {
    throw new Error(
      'eval.yaml must resolve the judge model from FOUNDRY_EVAL_MODEL.',
    );
  }
  if (config.options?.generation_model !== '${FOUNDRY_GENERATION_MODEL}') {
    throw new Error(
      'eval.yaml must resolve generation from FOUNDRY_GENERATION_MODEL.',
    );
  }
  const datasetPath = resolveFrom(evalPath, config.dataset.local_uri);
  const validationPath = resolveFrom(
    evalPath,
    config.validation_dataset.local_uri,
  );
  const smoke = await readJsonl(datasetPath);
  const regression = await readJsonl(validationPath);
  if (config.max_samples !== smoke.length) {
    throw new Error(
      `eval.yaml max_samples (${config.max_samples}) must equal smoke dataset size (${smoke.length}).`,
    );
  }
  return { config, smoke, regression };
}

async function validateSuites(regressionCount) {
  const smoke = await readYaml(path.join(foundryRoot, 'suites', 'smoke.yaml'));
  const regression = await readYaml(
    path.join(foundryRoot, 'suites', 'regression.yaml'),
  );
  if (
    smoke.thresholdProfile !== 'smoke' ||
    regression.thresholdProfile !== 'regression'
  ) {
    throw new Error('Suite thresholdProfile values are invalid.');
  }
  if (regression.max_samples !== regressionCount) {
    throw new Error(
      `Regression max_samples (${regression.max_samples}) must equal dataset size (${regressionCount}).`,
    );
  }
  const thresholds = JSON.parse(
    await readFile(path.join(foundryRoot, 'suites', 'thresholds.json'), 'utf8'),
  );
  for (const profileName of ['smoke', 'regression']) {
    const profile = thresholds.profiles?.[profileName];
    if (!profile) throw new Error(`Missing threshold profile ${profileName}.`);
    if (
      typeof profile.minimumOverallPassRate !== 'number' ||
      profile.minimumOverallPassRate <= 0 ||
      profile.minimumOverallPassRate > 1
    ) {
      throw new Error(`${profileName} has an invalid overall pass threshold.`);
    }
    for (const evaluator of requiredBuiltins) {
      const metric = evaluator.replace('builtin.', '');
      if (typeof profile.requiredMetrics?.[metric] !== 'number') {
        throw new Error(
          `${profileName} is missing threshold metric ${metric}.`,
        );
      }
    }
    for (const custom of [
      'permit_recommendation_completeness',
      'uncertainty_citation',
    ]) {
      if (typeof profile.requiredMetrics?.[custom] !== 'number') {
        throw new Error(
          `${profileName} is missing threshold metric ${custom}.`,
        );
      }
    }
  }
}

async function validateMetadata() {
  const metadata = await readYaml(
    path.join(foundryRoot, 'agent-metadata.yaml'),
  );
  const serialized = JSON.stringify(metadata).toLowerCase();
  for (const forbidden of [
    'projectendpoint',
    'project_endpoint',
    'agentversion',
    'agent_version',
    'containerregistry',
  ]) {
    if (serialized.includes(forbidden)) {
      throw new Error(
        `.foundry/agent-metadata.yaml duplicates azd-owned ${forbidden}.`,
      );
    }
  }
  if (metadata.azd?.service !== 'permit-readiness-agent') {
    throw new Error('Metadata must bind only the azd service name.');
  }
  if (metadata.evaluationSuites?.length !== 2) {
    throw new Error('Metadata must reference smoke and regression suites.');
  }
}

async function validateRubrics() {
  const files = [
    path.join(
      foundryRoot,
      'evaluators',
      'permit-recommendation-completeness',
      'v1',
      'rubric_dimensions.json',
    ),
    path.join(
      foundryRoot,
      'evaluators',
      'uncertainty-citation',
      'v1',
      'rubric_dimensions.json',
    ),
  ];
  for (const filePath of files) {
    const raw = JSON.parse(await readFile(filePath, 'utf8'));
    const dimensions = z.array(RubricDimensionSchema).min(2).parse(raw);
    if (new Set(dimensions.map((item) => item.id)).size !== dimensions.length) {
      throw new Error(`${filePath} has duplicate rubric dimension IDs.`);
    }
  }
}

function validateCapturedRuns(cases) {
  for (const testCase of cases) {
    const capture = createPassingCapture(testCase);
    const errors = evaluateCapturedRun(testCase, capture);
    if (errors.length > 0) {
      throw new Error(
        `${testCase.name} local evaluator failed:\n${errors.join('\n')}`,
      );
    }
  }
}

export async function runPreflight() {
  await normalizeDatasets({ check: true });
  const { smoke, regression } = await validateEvalConfig();
  await Promise.all([
    validateSuites(regression.length),
    validateMetadata(),
    validateRubrics(),
  ]);
  validateCapturedRuns([...smoke, ...regression]);
  console.log(
    `Foundry evaluation preflight passed: ${smoke.length} smoke, ${regression.length} regression cases.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runPreflight();
}
