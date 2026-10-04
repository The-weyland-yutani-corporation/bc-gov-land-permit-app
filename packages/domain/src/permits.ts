import type { Identifier, VersionReference } from './types.js';

export type PermitKind = 'permit' | 'authorization' | 'notification' | 'review';

export interface PermitTypeDefinition {
  readonly id: Identifier;
  readonly name: string;
  readonly kind: PermitKind;
  readonly authorityName: string;
  readonly summary: string;
  readonly guidanceSourceIds: readonly Identifier[];
}

export type RuleComparisonOperator =
  | 'equals'
  | 'not_equals'
  | 'includes'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal';

export type PermitCondition =
  | {
      readonly type: 'project_type';
      readonly projectTypeIds: readonly Identifier[];
    }
  | {
      readonly type: 'answer';
      readonly questionId: Identifier;
      readonly operator: RuleComparisonOperator;
      readonly value: string | number | boolean;
    }
  | {
      readonly type: 'location_provided';
      readonly expected: boolean;
    }
  | {
      readonly type: 'location_intersects_zone';
      readonly zoneIds: readonly Identifier[];
    }
  | {
      readonly type: 'all' | 'any';
      readonly conditions: readonly PermitCondition[];
    }
  | {
      readonly type: 'not';
      readonly condition: PermitCondition;
    };

export interface PermitRule {
  readonly id: Identifier;
  readonly version: string;
  readonly permitTypeId: Identifier;
  readonly outcome: 'likely' | 'may_apply' | 'not_indicated';
  readonly explanation: string;
  readonly priority?: number;
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
  readonly sourceIds?: readonly Identifier[];
  readonly followUpQuestionIds?: readonly Identifier[];
  readonly requiresEscalation?: boolean;
  readonly condition: PermitCondition;
}

export interface PermitDependency {
  readonly permitTypeId: Identifier;
  readonly dependsOnPermitTypeId: Identifier;
  readonly relationship: 'before' | 'confirm_first' | 'parallel';
  readonly explanation: string;
}

export interface MissingInformation {
  readonly id: Identifier;
  readonly questionId?: Identifier;
  readonly field?: 'project_type' | 'location' | 'intake_answer';
  readonly label: string;
  readonly reason: string;
  readonly severity: 'required' | 'recommended';
}

export interface TriggerEvaluation {
  readonly permitTypeId: Identifier;
  readonly outcome: 'triggered' | 'not_triggered' | 'indeterminate';
  readonly recommendation: 'likely' | 'may_apply' | 'not_indicated';
  readonly matchedRuleIds: readonly Identifier[];
  readonly missingInformation: readonly MissingInformation[];
  readonly assumptions: readonly string[];
  readonly ruleRelease: VersionReference;
}

export interface PermitDependencyIssue {
  readonly code: 'duplicate' | 'self_reference' | 'unknown_permit' | 'cycle';
  readonly permitTypeId: Identifier;
  readonly dependsOnPermitTypeId?: Identifier;
}

export function validatePermitDependencies(
  permitTypeIds: readonly Identifier[],
  dependencies: readonly PermitDependency[],
): readonly PermitDependencyIssue[] {
  const permitIds = new Set(permitTypeIds);
  const issues: PermitDependencyIssue[] = [];
  const edges = new Map<Identifier, Identifier[]>();
  const seen = new Set<string>();

  for (const dependency of dependencies) {
    const key = `${dependency.permitTypeId}:${dependency.dependsOnPermitTypeId}`;
    if (seen.has(key)) {
      issues.push({
        code: 'duplicate',
        permitTypeId: dependency.permitTypeId,
        dependsOnPermitTypeId: dependency.dependsOnPermitTypeId,
      });
      continue;
    }
    seen.add(key);

    if (dependency.permitTypeId === dependency.dependsOnPermitTypeId) {
      issues.push({
        code: 'self_reference',
        permitTypeId: dependency.permitTypeId,
        dependsOnPermitTypeId: dependency.dependsOnPermitTypeId,
      });
      continue;
    }
    if (
      !permitIds.has(dependency.permitTypeId) ||
      !permitIds.has(dependency.dependsOnPermitTypeId)
    ) {
      issues.push({
        code: 'unknown_permit',
        permitTypeId: dependency.permitTypeId,
        dependsOnPermitTypeId: dependency.dependsOnPermitTypeId,
      });
      continue;
    }

    const current = edges.get(dependency.permitTypeId) ?? [];
    current.push(dependency.dependsOnPermitTypeId);
    edges.set(dependency.permitTypeId, current);
  }

  const visiting = new Set<Identifier>();
  const visited = new Set<Identifier>();
  const reportedCycles = new Set<string>();

  const visit = (permitTypeId: Identifier): void => {
    if (visited.has(permitTypeId)) {
      return;
    }
    visiting.add(permitTypeId);

    for (const dependencyId of edges.get(permitTypeId) ?? []) {
      if (visiting.has(dependencyId)) {
        const cycleKey = [permitTypeId, dependencyId].sort().join(':');
        if (!reportedCycles.has(cycleKey)) {
          reportedCycles.add(cycleKey);
          issues.push({
            code: 'cycle',
            permitTypeId,
            dependsOnPermitTypeId: dependencyId,
          });
        }
      } else {
        visit(dependencyId);
      }
    }

    visiting.delete(permitTypeId);
    visited.add(permitTypeId);
  };

  for (const permitTypeId of permitIds) {
    visit(permitTypeId);
  }

  return issues;
}
