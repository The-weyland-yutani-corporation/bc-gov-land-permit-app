import Link from 'next/link';
import { Breadcrumb } from '../../../components/breadcrumb';
import { Button } from '../../../components/button';
import { ProjectNav } from '../../../components/project-nav';
import { requireSession } from '../../../lib/auth';
import { getPermitAppRepository } from '../../../lib/repository';

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await requireSession(`/projects/${projectId}`);
  const repository = await getPermitAppRepository();
  const { project, intake, report, tasks } = await repository.getWorkspace(
    session,
    projectId,
  );
  const readyForReview =
    intake.completeness.missingRequiredQuestionIds.length === 0;

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Projects', href: '/projects' },
          { label: project.name },
        ]}
      />
      <main id="main-content" className="page-width">
        <header className="shell-heading">
          <p className="eyebrow">Illustrative project</p>
          <h1>{project.name}</h1>
          <div className="shell-heading__meta">
            <span
              className="status"
              data-state={report ? 'complete' : 'active'}
            >
              {report
                ? 'Report ready'
                : readyForReview
                  ? 'Ready for review'
                  : 'Information needed'}
            </span>
            <span>
              Updated {new Date(project.updatedAt).toLocaleDateString('en-CA')}
            </span>
          </div>
        </header>
        <div className="notice" role="note">
          <strong>This is synthetic demonstration content.</strong> Do not enter
          real location, identity, or commercially sensitive information.
        </div>
        <ProjectNav projectId={projectId} />
        <div className="shell-grid">
          <section className="content-block" aria-labelledby="next-step">
            <h2 id="next-step">Your next step</h2>
            {report ? (
              <>
                <p>
                  Review the saved report and work through its traceable tasks.
                </p>
                <div className="actions">
                  <Button asChild>
                    <Link href={`/projects/${projectId}/report`}>
                      View readiness report
                    </Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href={`/projects/${projectId}/tasks`}>
                      View {tasks.length} tasks
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p>
                  {readyForReview
                    ? 'Review the normalized project summary before generating guidance.'
                    : 'Complete the required project and location information.'}
                </p>
                <div className="actions">
                  <Button asChild>
                    <Link
                      href={`/projects/${projectId}/${readyForReview ? 'summary' : 'intake'}`}
                    >
                      {readyForReview
                        ? 'Review project summary'
                        : 'Continue project details'}
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </section>
          <aside className="content-block" aria-labelledby="project-summary">
            <h2 id="project-summary">Project summary</h2>
            <dl className="summary-list">
              <div>
                <dt>Pathway</dt>
                <dd>{project.projectTypeId.replaceAll('-', ' ')}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{project.location ? 'Provided' : 'Not provided'}</dd>
              </div>
              <div>
                <dt>Required answers</dt>
                <dd>
                  {intake.completeness.answeredRequiredCount} of{' '}
                  {intake.completeness.requiredCount}
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </main>
    </>
  );
}
