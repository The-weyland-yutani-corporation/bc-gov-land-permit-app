import Link from 'next/link';
import { generateReportAction } from '../../../actions';
import { Breadcrumb } from '../../../../components/breadcrumb';
import { Button } from '../../../../components/button';
import { ProjectNav } from '../../../../components/project-nav';
import { requireSession } from '../../../../lib/auth';
import { getDemoQuestionSet } from '../../../../lib/demo-config';
import { getPermitAppRepository } from '../../../../lib/repository';

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await requireSession(`/projects/${projectId}/summary`);
  const repository = await getPermitAppRepository();
  const { project, intake } = await repository.getWorkspace(session, projectId);
  const questionSet = getDemoQuestionSet(project.projectTypeId);
  const generate = generateReportAction.bind(null, projectId, project.version);
  const hasMissingAnswers =
    intake.completeness.missingRequiredQuestionIds.length > 0;
  const hasUnknownAnswers =
    intake.completeness.unknownRequiredQuestionIds.length > 0;

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Projects', href: '/projects' },
          { label: project.name, href: `/projects/${projectId}` },
          { label: 'Summary' },
        ]}
      />
      <main id="main-content" className="page-width">
        <header className="page-heading">
          <p className="eyebrow">Applicant review</p>
          <h1>Review the project summary</h1>
          <p>
            Correct structured information before generating deterministic
            demonstration guidance.
          </p>
        </header>
        <ProjectNav projectId={projectId} />
        {hasMissingAnswers ? (
          <div className="notice" role="alert">
            <strong>Required information is incomplete.</strong>{' '}
            {intake.completeness.missingRequiredQuestionIds.length} unanswered
            and {intake.completeness.unknownRequiredQuestionIds.length} unknown
            items remain. Answer each required question or explicitly choose
            “Unknown” before generating a report.
          </div>
        ) : hasUnknownAnswers ? (
          <div className="notice" role="status">
            <strong>Some required information is unknown.</strong>{' '}
            {intake.completeness.unknownRequiredQuestionIds.length} unknown item
            remains visible. You can generate a degraded report that carries
            this gap forward.
          </div>
        ) : (
          <div className="notice notice--success" role="status">
            <strong>Required information is complete.</strong> You can generate
            a synthetic readiness report.
          </div>
        )}
        <section className="report-section" aria-labelledby="facts">
          <h2 id="facts">Normalized project facts</h2>
          <dl className="data-list">
            <div>
              <dt>Project name</dt>
              <dd>{project.name}</dd>
            </div>
            <div>
              <dt>Project type</dt>
              <dd>{project.projectTypeId.replaceAll('-', ' ')}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>
                {project.location
                  ? `${project.location.geometry.type} supplied by ${project.location.source}`
                  : 'Not supplied'}
              </dd>
            </div>
            {questionSet.questions.map((question) => {
              const answer = intake.answers.find(
                (candidate) => candidate.questionId === question.id,
              );
              return (
                <div key={question.id}>
                  <dt>{question.label}</dt>
                  <dd>
                    {!answer
                      ? 'Not answered'
                      : answer.state !== 'answered'
                        ? answer.state
                        : Array.isArray(answer.value)
                          ? answer.value.join(', ')
                          : String(answer.value)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
        <div className="actions">
          <Button asChild variant="secondary">
            <Link href={`/projects/${projectId}/intake`}>
              Edit project details
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/projects/${projectId}/navigator`}>
              Ask the navigator
            </Link>
          </Button>
          <form action={generate}>
            <Button type="submit" disabled={hasMissingAnswers}>
              Generate readiness report
            </Button>
          </form>
        </div>
      </main>
    </>
  );
}
