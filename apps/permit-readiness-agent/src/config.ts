import { z } from 'zod';
import { PlatformAgentVersionSchema } from '@permit-readiness/contracts';

const EnvironmentSchema = z
  .object({
    FOUNDRY_PROJECT_ENDPOINT: z.string().url(),
    FOUNDRY_MODEL_NAME: z.string().trim().min(1).max(200),
    FOUNDRY_AGENT_NAME: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .default('permit-readiness-agent'),
    FOUNDRY_AGENT_VERSION: PlatformAgentVersionSchema.default('local'),
    PORT: z.coerce.number().int().min(1).max(65535).default(8088),
    AGENT_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(45_000),
    AGENT_MAX_TOOL_ROUNDS: z.coerce.number().int().min(1).max(12).default(6),
    AGENT_MAX_OUTPUT_RETRIES: z.coerce.number().int().min(0).max(3).default(2),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    GUIDANCE_SEARCH_MODE: z
      .enum(['disabled', 'azure', 'local'])
      .default('disabled'),
    AZURE_SEARCH_ENDPOINT: z.string().url().startsWith('https://').optional(),
    AZURE_SEARCH_INDEX_NAME: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]{1,127}$/)
      .default('permit-guidance-v1'),
    GUIDANCE_SEARCH_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.2),
    GUIDANCE_MANIFEST_PATH: z.string().min(1).max(1000).optional(),
    FOUNDRY_EMBEDDING_MODEL: z.string().trim().min(1).max(200).optional(),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
  })
  .superRefine((configuration, context) => {
    if (
      configuration.GUIDANCE_SEARCH_MODE === 'azure' &&
      !configuration.AZURE_SEARCH_ENDPOINT
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AZURE_SEARCH_ENDPOINT'],
        message: 'Azure guidance search requires AZURE_SEARCH_ENDPOINT.',
      });
    }
    if (
      configuration.GUIDANCE_SEARCH_MODE === 'local' &&
      !configuration.GUIDANCE_MANIFEST_PATH
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GUIDANCE_MANIFEST_PATH'],
        message: 'Local guidance search requires GUIDANCE_MANIFEST_PATH.',
      });
    }
    if (
      configuration.NODE_ENV === 'production' &&
      configuration.GUIDANCE_SEARCH_MODE === 'local'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GUIDANCE_SEARCH_MODE'],
        message: 'Local guidance search is not permitted in production.',
      });
    }
  });

export type AgentConfiguration = z.infer<typeof EnvironmentSchema>;

export function loadConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): AgentConfiguration {
  return EnvironmentSchema.parse(environment);
}

export function configurationIsPresent(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(
    environment.FOUNDRY_PROJECT_ENDPOINT && environment.FOUNDRY_MODEL_NAME,
  );
}
