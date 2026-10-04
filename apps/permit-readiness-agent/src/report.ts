import {
  ReadinessReportSchema,
  type AgentProjectContext,
  type Citation,
  type ComposeReadinessReportToolInputSchema,
  type PlatformAgentVersion,
} from '@permit-readiness/contracts';
import type { z } from 'zod';
import { AgentError } from './errors.js';

type ReportInput = Omit<
  z.infer<typeof ComposeReadinessReportToolInputSchema>,
  'citationIds'
> & {
  readonly citations: readonly Citation[];
};

function citationIdsForPermit(
  permitTypeId: string,
  citations: readonly Citation[],
  context: AgentProjectContext,
): string[] {
  const sourceIds =
    context.permitTypes.find((permit) => permit.id === permitTypeId)
      ?.guidanceSourceIds ?? [];
  return citations
    .filter((citation) => sourceIds.includes(citation.sourceId))
    .map((citation) => citation.id);
}

export function composeReadinessReport(
  input: ReportInput,
  context: AgentProjectContext,
  agentVersion: PlatformAgentVersion,
) {
  for (const citation of input.citations) {
    const source = context.guidanceSources.find(
      (candidate) => candidate.id === citation.sourceId,
    );
    if (
      !source ||
      source.version !== citation.sourceVersion ||
      source.title !== citation.title ||
      source.publisher !== citation.publisher ||
      source.url !== citation.url
    ) {
      throw new AgentError(
        'tool_error',
        `Citation ${citation.id} does not match approved source metadata.`,
        422,
        false,
      );
    }
  }
  const recommendations = input.evaluations.map((evaluation) => {
    const permit = context.permitTypes.find(
      (candidate) => candidate.id === evaluation.permitTypeId,
    );
    if (!permit) {
      throw new AgentError(
        'tool_error',
        `Unknown permit type ${evaluation.permitTypeId}.`,
        422,
        false,
      );
    }
    const citationIds = citationIdsForPermit(
      permit.id,
      input.citations,
      context,
    );
    if (
      evaluation.recommendation !== 'not_indicated' &&
      citationIds.length === 0
    ) {
      throw new AgentError(
        'tool_error',
        `Approved guidance is required for ${permit.id}.`,
        422,
        false,
      );
    }
    return {
      permitTypeId: permit.id,
      disposition:
        evaluation.outcome === 'indeterminate'
          ? ('needs_information' as const)
          : evaluation.recommendation,
      title: permit.name,
      rationale:
        evaluation.outcome === 'indeterminate'
          ? 'The deterministic evaluation requires more information.'
          : `The deterministic rule evaluation returned ${evaluation.recommendation.replace('_', ' ')}.`,
      ruleIds: evaluation.matchedRuleIds,
      citationIds,
      nextActions: [
        `Confirm current requirements with ${permit.authorityName}.`,
      ],
    };
  });
  const degraded =
    input.missingInformation.length > 0 ||
    recommendations.some(
      (recommendation) => recommendation.disposition === 'needs_information',
    );
  return ReadinessReportSchema.parse({
    id: crypto.randomUUID(),
    projectId: context.scope.projectId,
    projectVersion: context.project.version,
    runId: context.scope.runId,
    status: degraded ? 'degraded' : 'completed',
    jurisdictionRelease: context.project.jurisdictionRelease,
    agentVersion,
    summary: input.summary,
    recommendations,
    missingInformation: input.missingInformation,
    dependencies: context.permitDependencies,
    assumptions: input.assumptions,
    citations: input.citations,
    limitations: [
      'This guidance is for preparation only. It is not an application, approval, legal opinion, or complete statement of requirements.',
      'Confirm current obligations with the responsible authorities.',
    ],
    createdAt: new Date().toISOString(),
  });
}
