import type { ReadinessReport } from '@permit-readiness/contracts';

function MissingInformation({ report }: { report: ReadinessReport }) {
  return (
    <section className="report-section" aria-labelledby="missing-information">
      <h2 id="missing-information">Missing information</h2>
      {report.missingInformation.length ? (
        <ul className="report-list">
          {report.missingInformation.map((missing) => (
            <li key={missing.id}>
              <strong>{missing.label}:</strong> {missing.reason}
            </li>
          ))}
        </ul>
      ) : (
        <p>No required information gaps were recorded for this snapshot.</p>
      )}
    </section>
  );
}

function Recommendations({ report }: { report: ReadinessReport }) {
  return (
    <section className="report-section" aria-labelledby="possible-requirements">
      <h2 id="possible-requirements">Possible requirements and reasons</h2>
      {report.recommendations.length ? (
        report.recommendations.map((recommendation) => (
          <article className="recommendation" key={recommendation.permitTypeId}>
            <h3>{recommendation.title}</h3>
            <p>
              <strong>Disposition:</strong>{' '}
              {recommendation.disposition.replaceAll('_', ' ')}
            </p>
            <p>{recommendation.rationale}</p>
            <p>Rule references: {recommendation.ruleIds.join(', ')}</p>
            <ul>
              {recommendation.nextActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </article>
        ))
      ) : (
        <p>No positive synthetic rule results were recorded.</p>
      )}
    </section>
  );
}

function AssumptionsAndSequence({ report }: { report: ReadinessReport }) {
  return (
    <>
      <section className="report-section" aria-labelledby="assumptions">
        <h2 id="assumptions">Assumptions</h2>
        <ul className="report-list">
          {report.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </section>
      <section className="report-section" aria-labelledby="sequence">
        <h2 id="sequence">Possible sequence</h2>
        {report.dependencies.length ? (
          <ol className="report-list">
            {report.dependencies.map((dependency) => (
              <li
                key={`${dependency.permitTypeId}-${dependency.dependsOnPermitTypeId}`}
              >
                {dependency.explanation}
              </li>
            ))}
          </ol>
        ) : (
          <p>No sequencing relationships were recorded.</p>
        )}
      </section>
    </>
  );
}

function Sources({ report }: { report: ReadinessReport }) {
  return (
    <section className="report-section" aria-labelledby="sources">
      <h2 id="sources">Illustrative guidance sources</h2>
      <ol className="report-list">
        {report.citations.map((citation) => (
          <li key={citation.id}>
            <a href={citation.url}>{citation.title}</a>, {citation.publisher},
            version {citation.sourceVersion}
          </li>
        ))}
      </ol>
    </section>
  );
}

function ReportMetadata({ report }: { report: ReadinessReport }) {
  return (
    <section className="report-section" aria-labelledby="provenance">
      <h2 id="provenance">Version and provenance</h2>
      <dl className="data-list">
        <div>
          <dt>Configuration release</dt>
          <dd>{report.jurisdictionRelease.releaseVersion}</dd>
        </div>
        <div>
          <dt>Rule release</dt>
          <dd>{report.jurisdictionRelease.ruleVersion}</dd>
        </div>
        <div>
          <dt>Guidance release</dt>
          <dd>{report.jurisdictionRelease.guidanceVersion}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{new Date(report.createdAt).toLocaleString('en-CA')}</dd>
        </div>
      </dl>
    </section>
  );
}

export function ReportView({ report }: { report: ReadinessReport }) {
  return (
    <article>
      <div
        className={
          report.status === 'completed' ? 'notice notice--success' : 'notice'
        }
        role="status"
      >
        <strong>
          {report.status === 'completed'
            ? 'Demonstration report completed.'
            : 'Report completed with information gaps.'}
        </strong>{' '}
        This report is non-binding and uses synthetic rules and guidance.
      </div>
      <section className="report-section" aria-labelledby="report-summary">
        <h2 id="report-summary">Summary and limitations</h2>
        <p>{report.summary}</p>
        <ul className="report-list">
          {report.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </section>
      <MissingInformation report={report} />
      <Recommendations report={report} />
      <AssumptionsAndSequence report={report} />
      <Sources report={report} />
      <ReportMetadata report={report} />
    </article>
  );
}
