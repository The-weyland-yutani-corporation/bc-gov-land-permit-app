import type { PermitDependency } from './permits.js';
import type { Identifier } from './types.js';

export interface PermitSequenceEntry {
  readonly permitTypeId: Identifier;
  readonly blockingPrerequisiteIds: readonly Identifier[];
  readonly externalBlockingPrerequisiteIds: readonly Identifier[];
  readonly parallelPermitTypeIds: readonly Identifier[];
}

export interface PermitSequenceGroup {
  readonly order: number;
  readonly permitTypeIds: readonly Identifier[];
}

export interface PermitDependencyCycle {
  readonly permitTypeIds: readonly Identifier[];
}

export interface PermitSequencePlan {
  readonly status: 'ready' | 'blocked';
  readonly groups: readonly PermitSequenceGroup[];
  readonly entries: readonly PermitSequenceEntry[];
  readonly cycles: readonly PermitDependencyCycle[];
  readonly issues: readonly string[];
}

function canonicalCycle(cycle: readonly Identifier[]): Identifier[] {
  const values = cycle[0] === cycle.at(-1) ? cycle.slice(0, -1) : [...cycle];
  const rotations = values.map((_, index) => [
    ...values.slice(index),
    ...values.slice(0, index),
  ]);
  rotations.sort((left, right) =>
    left.join('\0').localeCompare(right.join('\0')),
  );
  return rotations[0] ?? [];
}

function findCycles(
  permitIds: readonly Identifier[],
  edges: ReadonlyMap<Identifier, readonly Identifier[]>,
): PermitDependencyCycle[] {
  const visited = new Set<Identifier>();
  const stack: Identifier[] = [];
  const inStack = new Set<Identifier>();
  const cycles = new Map<string, PermitDependencyCycle>();

  const visit = (permitId: Identifier): void => {
    visited.add(permitId);
    stack.push(permitId);
    inStack.add(permitId);
    for (const next of [...(edges.get(permitId) ?? [])].sort()) {
      if (!visited.has(next)) {
        visit(next);
      } else if (inStack.has(next)) {
        const canonical = canonicalCycle(stack.slice(stack.indexOf(next)));
        cycles.set(canonical.join('\0'), { permitTypeIds: canonical });
      }
    }
    stack.pop();
    inStack.delete(permitId);
  };

  for (const permitId of [...permitIds].sort()) {
    if (!visited.has(permitId)) {
      visit(permitId);
    }
  }
  return [...cycles.values()].sort((left, right) =>
    left.permitTypeIds.join('\0').localeCompare(right.permitTypeIds.join('\0')),
  );
}

export function sequencePermits(
  permitTypeIds: readonly Identifier[],
  dependencies: readonly PermitDependency[],
): PermitSequencePlan {
  const permitIds = [...new Set(permitTypeIds)].sort();
  const selected = new Set(permitIds);
  const blockers = new Map<Identifier, Set<Identifier>>();
  const externalBlockers = new Map<Identifier, Set<Identifier>>();
  const dependents = new Map<Identifier, Set<Identifier>>();
  const parallels = new Map<Identifier, Set<Identifier>>();
  const issues = new Set<string>();
  const seen = new Set<string>();

  for (const dependency of [...dependencies].sort((left, right) =>
    `${left.permitTypeId}\0${left.dependsOnPermitTypeId}\0${left.relationship}`.localeCompare(
      `${right.permitTypeId}\0${right.dependsOnPermitTypeId}\0${right.relationship}`,
    ),
  )) {
    const key = `${dependency.permitTypeId}\0${dependency.dependsOnPermitTypeId}`;
    if (seen.has(key)) {
      issues.add(
        `Duplicate dependency ${dependency.permitTypeId} -> ${dependency.dependsOnPermitTypeId}.`,
      );
      continue;
    }
    seen.add(key);
    if (dependency.permitTypeId === dependency.dependsOnPermitTypeId) {
      issues.add(`Permit ${dependency.permitTypeId} cannot depend on itself.`);
      continue;
    }
    if (!selected.has(dependency.permitTypeId)) {
      continue;
    }
    if (dependency.relationship === 'parallel') {
      if (selected.has(dependency.dependsOnPermitTypeId)) {
        const left = parallels.get(dependency.permitTypeId) ?? new Set();
        const right =
          parallels.get(dependency.dependsOnPermitTypeId) ?? new Set();
        left.add(dependency.dependsOnPermitTypeId);
        right.add(dependency.permitTypeId);
        parallels.set(dependency.permitTypeId, left);
        parallels.set(dependency.dependsOnPermitTypeId, right);
      }
      continue;
    }
    if (!selected.has(dependency.dependsOnPermitTypeId)) {
      const external =
        externalBlockers.get(dependency.permitTypeId) ?? new Set();
      external.add(dependency.dependsOnPermitTypeId);
      externalBlockers.set(dependency.permitTypeId, external);
      continue;
    }
    const permitBlockers = blockers.get(dependency.permitTypeId) ?? new Set();
    permitBlockers.add(dependency.dependsOnPermitTypeId);
    blockers.set(dependency.permitTypeId, permitBlockers);
    const prerequisiteDependents =
      dependents.get(dependency.dependsOnPermitTypeId) ?? new Set();
    prerequisiteDependents.add(dependency.permitTypeId);
    dependents.set(dependency.dependsOnPermitTypeId, prerequisiteDependents);
  }

  const edgeMap = new Map<Identifier, readonly Identifier[]>(
    permitIds.map((permitId) => [
      permitId,
      [...(dependents.get(permitId) ?? [])],
    ]),
  );
  const cycles = findCycles(permitIds, edgeMap);
  const indegree = new Map(
    permitIds.map((permitId) => [
      permitId,
      (blockers.get(permitId) ?? new Set()).size,
    ]),
  );
  const remaining = new Set(permitIds);
  const groups: PermitSequenceGroup[] = [];

  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((permitId) => indegree.get(permitId) === 0)
      .sort();
    if (ready.length === 0) {
      break;
    }
    groups.push({ order: groups.length + 1, permitTypeIds: ready });
    for (const permitId of ready) {
      remaining.delete(permitId);
      for (const dependent of dependents.get(permitId) ?? []) {
        indegree.set(dependent, (indegree.get(dependent) ?? 1) - 1);
      }
    }
  }

  if (cycles.length > 0) {
    issues.add(
      `Blocking dependency cycle detected: ${cycles
        .map((cycle) => cycle.permitTypeIds.join(' -> '))
        .join('; ')}.`,
    );
  }
  for (const [permitId, external] of externalBlockers) {
    issues.add(
      `${permitId} has unselected blocking prerequisites: ${[...external]
        .sort()
        .join(', ')}.`,
    );
  }

  return {
    status:
      cycles.length > 0 || externalBlockers.size > 0 ? 'blocked' : 'ready',
    groups,
    entries: permitIds.map((permitTypeId) => ({
      permitTypeId,
      blockingPrerequisiteIds: [...(blockers.get(permitTypeId) ?? [])].sort(),
      externalBlockingPrerequisiteIds: [
        ...(externalBlockers.get(permitTypeId) ?? []),
      ].sort(),
      parallelPermitTypeIds: [...(parallels.get(permitTypeId) ?? [])].sort(),
    })),
    cycles,
    issues: [...issues].sort(),
  };
}
