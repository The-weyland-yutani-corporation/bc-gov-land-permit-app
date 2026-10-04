export interface TransactionBoundary<TSession> {
  run<T>(work: (session: TSession) => Promise<T>): Promise<T>;
}

export async function createProjectTransaction<TSession, TResult>(
  boundary: TransactionBoundary<TSession>,
  operations: {
    insertOrGetProject(
      session: TSession,
    ): Promise<{ result: TResult; created: boolean }>;
    resolveQuestionSet(session: TSession, project: TResult): Promise<string>;
    insertInitialIntake(
      session: TSession,
      project: TResult,
      questionSetKey: string,
    ): Promise<void>;
    insertLocation(session: TSession, project: TResult): Promise<void>;
    writeAuditEvent(session: TSession, project: TResult): Promise<void>;
  },
  hasLocation: boolean,
): Promise<TResult> {
  return boundary.run(async (session) => {
    const { result: project, created } =
      await operations.insertOrGetProject(session);
    if (!created) {
      return project;
    }
    const questionSetKey = await operations.resolveQuestionSet(
      session,
      project,
    );
    await operations.insertInitialIntake(session, project, questionSetKey);
    if (hasLocation) {
      await operations.insertLocation(session, project);
    }
    await operations.writeAuditEvent(session, project);
    return project;
  });
}

export async function completeIntakeTransaction<TSession, TResult>(
  boundary: TransactionBoundary<TSession>,
  operations: {
    lockAndCompleteIntake(session: TSession): Promise<TResult>;
    updateProjectStatus(session: TSession, result: TResult): Promise<void>;
    writeAuditEvent(session: TSession, result: TResult): Promise<void>;
  },
): Promise<TResult> {
  return boundary.run(async (session) => {
    const result = await operations.lockAndCompleteIntake(session);
    await operations.updateProjectStatus(session, result);
    await operations.writeAuditEvent(session, result);
    return result;
  });
}

export async function saveIntakeTransaction<TSession, TResult>(
  boundary: TransactionBoundary<TSession>,
  operations: {
    saveIntake(session: TSession): Promise<TResult>;
    saveLocation(session: TSession, result: TResult): Promise<void>;
    updateProjectAndInvalidateReport(
      session: TSession,
      result: TResult,
    ): Promise<void>;
    invalidateReportTasks(session: TSession, result: TResult): Promise<void>;
    writeAuditEvent(session: TSession, result: TResult): Promise<void>;
  },
): Promise<TResult> {
  return boundary.run(async (session) => {
    const result = await operations.saveIntake(session);
    await operations.saveLocation(session, result);
    await operations.updateProjectAndInvalidateReport(session, result);
    await operations.invalidateReportTasks(session, result);
    await operations.writeAuditEvent(session, result);
    return result;
  });
}

export async function persistReportTransaction<TSession, TResult>(
  boundary: TransactionBoundary<TSession>,
  operations: {
    insertOrGetReport(
      session: TSession,
    ): Promise<{ result: TResult; created: boolean }>;
    insertRecommendations(session: TSession, report: TResult): Promise<void>;
    replaceTasks(session: TSession, report: TResult): Promise<void>;
    updateProject(session: TSession, report: TResult): Promise<void>;
    writeAuditEvent(session: TSession, report: TResult): Promise<void>;
  },
): Promise<TResult> {
  return boundary.run(async (session) => {
    const { result: report, created } =
      await operations.insertOrGetReport(session);
    if (!created) {
      return report;
    }
    await operations.insertRecommendations(session, report);
    await operations.replaceTasks(session, report);
    await operations.updateProject(session, report);
    await operations.writeAuditEvent(session, report);
    return report;
  });
}
