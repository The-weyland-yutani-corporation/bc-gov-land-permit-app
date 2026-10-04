import {
  AgentProjectContextSchema,
  BuildPermitSequenceToolInputSchema,
  ComposeReadinessReportToolInputSchema,
  EvaluatePermitTriggersToolInputSchema,
  GuidanceSearchResultSchema,
  ScopedProjectToolInputSchema,
  SearchPermitGuidanceToolInputSchema,
  type AgentProjectContext,
  type Citation,
  type GuidanceSearchResult,
  type PlatformAgentVersion,
} from '@permit-readiness/contracts';
import { sequencePermits } from '@permit-readiness/domain';
import { ZodError, type z } from 'zod';
import {
  evaluateContext,
  identifyMissing,
  ruleReleaseId,
  toTriggerEvaluation,
} from './deterministic-tools.js';
import { AgentError, throwIfAborted } from './errors.js';
import { composeReadinessReport } from './report.js';
import { inSpan } from './telemetry.js';

export const TOOL_NAMES = [
  'get_project_context',
  'identify_missing_information',
  'evaluate_permit_triggers',
  'search_permit_guidance',
  'build_permit_sequence',
  'compose_readiness_report',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export interface GuidanceSearch {
  search(
    request: z.infer<typeof SearchPermitGuidanceToolInputSchema>,
    context: AgentProjectContext,
    signal: AbortSignal,
  ): Promise<GuidanceSearchResult>;
}

export class UnavailableGuidanceSearch implements GuidanceSearch {
  async search(): Promise<GuidanceSearchResult> {
    return GuidanceSearchResultSchema.parse({
      available: false,
      citations: [],
      warning:
        'Approved guidance search is not configured. Confirm current requirements with the responsible authority.',
    });
  }
}

function assertScope(
  input: z.infer<typeof ScopedProjectToolInputSchema>,
  context: AgentProjectContext,
): void {
  if (
    input.organizationId !== context.scope.organizationId ||
    input.projectId !== context.scope.projectId ||
    input.runId !== context.scope.runId
  ) {
    throw new AgentError(
      'scope_violation',
      'The tool request does not match the authorized run scope.',
      403,
      false,
    );
  }
}

export class PermitReadinessToolRegistry {
  readonly context: AgentProjectContext;
  private readonly groundedCitations = new Map<string, Citation>();

  constructor(
    context: AgentProjectContext,
    private readonly guidanceSearch: GuidanceSearch = new UnavailableGuidanceSearch(),
    private readonly agentVersion: PlatformAgentVersion = 'local',
  ) {
    this.context = AgentProjectContextSchema.parse(context);
  }

  getGroundedCitations(citationIds: readonly string[]): Citation[] | undefined {
    const citations: Citation[] = [];
    const seen = new Set<string>();
    for (const citationId of citationIds) {
      const citation = this.groundedCitations.get(citationId);
      if (!citation || seen.has(citationId)) return undefined;
      seen.add(citationId);
      citations.push(structuredClone(citation));
    }
    return citations;
  }

  async execute(
    name: string,
    rawArguments: string | Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<unknown> {
    throwIfAborted(signal);
    if (!TOOL_NAMES.includes(name as ToolName)) {
      throw new AgentError(
        'tool_error',
        `Tool ${name} is not allowed.`,
        400,
        false,
      );
    }
    let raw: unknown;
    try {
      raw =
        typeof rawArguments === 'string'
          ? JSON.parse(rawArguments)
          : rawArguments;
    } catch (error) {
      throw new AgentError(
        'tool_error',
        `Tool ${name} received malformed JSON arguments.`,
        400,
        false,
        { cause: error },
      );
    }
    const scope = ScopedProjectToolInputSchema.passthrough().safeParse(raw);
    if (!scope.success) {
      throw new AgentError(
        'tool_error',
        `Tool ${name} arguments failed validation.`,
        422,
        false,
        { cause: scope.error },
      );
    }
    assertScope(scope.data, this.context);
    return inSpan(
      `tool.${name}`,
      {
        'agent.tool.name': name,
        'agent.project.id': this.context.scope.projectId,
        'agent.run.id': this.context.scope.runId,
      },
      async () => {
        try {
          return await this.executeValidated(name as ToolName, raw, signal);
        } catch (error) {
          if (error instanceof AgentError) throw error;
          if (error instanceof ZodError) {
            throw new AgentError(
              'tool_error',
              `Tool ${name} output or arguments failed validation.`,
              422,
              false,
              { cause: error },
            );
          }
          throw error;
        }
      },
    );
  }

  private async executeValidated(
    name: ToolName,
    raw: unknown,
    signal: AbortSignal,
  ): Promise<unknown> {
    if (name === 'get_project_context') {
      return {
        scope: this.context.scope,
        project: this.context.project,
        intake: this.context.intake,
        questionSet: this.context.questionSet,
        permitTypes: this.context.permitTypes,
        jurisdictionRelease: this.context.project.jurisdictionRelease,
      };
    }
    if (name === 'identify_missing_information') {
      return { missingInformation: identifyMissing(this.context) };
    }
    if (name === 'evaluate_permit_triggers') {
      const input = EvaluatePermitTriggersToolInputSchema.parse(raw);
      if (
        input.ruleReleaseId !== ruleReleaseId(this.context) ||
        input.ruleReleaseVersion !==
          this.context.project.jurisdictionRelease.ruleVersion
      ) {
        throw new AgentError(
          'scope_violation',
          'The requested rule release is not authorized for this run.',
          403,
          false,
        );
      }
      const result = evaluateContext(this.context);
      if (result.status !== 'evaluated') {
        throw new AgentError(
          'tool_error',
          'The deterministic rule configuration is invalid.',
          422,
          false,
        );
      }
      return {
        ruleRelease: result.ruleRelease,
        evaluations: result.evaluations.map((item) =>
          toTriggerEvaluation(item, result.ruleRelease.version, this.context),
        ),
        sequence: result.sequence,
        escalationFlags: result.escalationFlags,
      };
    }
    if (name === 'search_permit_guidance') {
      const input = SearchPermitGuidanceToolInputSchema.parse(raw);
      const allowed = new Set(
        this.context.guidanceSources.map((source) => source.id),
      );
      if (input.sourceIds.some((sourceId) => !allowed.has(sourceId))) {
        throw new AgentError(
          'scope_violation',
          'Guidance search requested an unapproved source.',
          403,
          false,
        );
      }
      if (
        input.projectTypeIds.some(
          (projectTypeId) =>
            projectTypeId !== this.context.project.projectTypeId,
        )
      ) {
        throw new AgentError(
          'scope_violation',
          'Guidance search requested a project type outside the authorized project.',
          403,
          false,
        );
      }
      const result = GuidanceSearchResultSchema.parse(
        await this.guidanceSearch.search(input, this.context, signal),
      );
      for (const citation of result.citations) {
        this.groundedCitations.set(citation.id, structuredClone(citation));
      }
      return result;
    }
    if (name === 'build_permit_sequence') {
      const input = BuildPermitSequenceToolInputSchema.parse(raw);
      const allowed = new Set(
        this.context.permitTypes.map((permit) => permit.id),
      );
      if (input.permitTypeIds.some((permitId) => !allowed.has(permitId))) {
        throw new AgentError(
          'scope_violation',
          'Permit sequencing requested an unknown permit.',
          403,
          false,
        );
      }
      return sequencePermits(
        input.permitTypeIds,
        this.context.permitDependencies,
      );
    }
    throwIfAborted(signal);
    const input = ComposeReadinessReportToolInputSchema.parse(raw);
    const citations = this.getGroundedCitations(input.citationIds);
    if (!citations) {
      throw new AgentError(
        'tool_error',
        'Report citation identifiers must reference evidence returned by guidance search for this run.',
        422,
        false,
      );
    }
    const result = evaluateContext(this.context);
    if (result.status !== 'evaluated') {
      throw new AgentError(
        'tool_error',
        'The deterministic rule configuration is invalid.',
        422,
        false,
      );
    }
    const expectedEvaluations = result.evaluations
      .map((item) =>
        toTriggerEvaluation(item, result.ruleRelease.version, this.context),
      )
      .sort((left, right) =>
        left.permitTypeId.localeCompare(right.permitTypeId),
      );
    const suppliedEvaluations = [...input.evaluations].sort((left, right) =>
      left.permitTypeId.localeCompare(right.permitTypeId),
    );
    if (
      JSON.stringify(suppliedEvaluations) !==
      JSON.stringify(expectedEvaluations)
    ) {
      throw new AgentError(
        'tool_error',
        'Report evaluations must exactly match deterministic tool results.',
        422,
        false,
      );
    }
    const expectedMissing = identifyMissing(this.context).sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    const suppliedMissing = [...input.missingInformation].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    if (JSON.stringify(suppliedMissing) !== JSON.stringify(expectedMissing)) {
      throw new AgentError(
        'tool_error',
        'Report information gaps must exactly match deterministic tool results.',
        422,
        false,
      );
    }
    const allowedAssumptions = new Set(
      expectedEvaluations.flatMap((item) => item.assumptions),
    );
    if (
      input.assumptions.some(
        (assumption) => !allowedAssumptions.has(assumption),
      )
    ) {
      throw new AgentError(
        'tool_error',
        'Report assumptions must come from deterministic tool results.',
        422,
        false,
      );
    }
    const { citationIds: _citationIds, ...reportInput } = input;
    return composeReadinessReport(
      { ...reportInput, citations },
      this.context,
      this.agentVersion,
    );
  }
}
