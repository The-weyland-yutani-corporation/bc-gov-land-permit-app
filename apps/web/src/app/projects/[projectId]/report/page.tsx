import Link from 'next/link';
import { Breadcrumb } from '../../../../components/breadcrumb';
import { Button } from '../../../../components/button';
import { ProjectNav } from '../../../../components/project-nav';
import { ReportView } from '../../../../components/report-view';
import { requireSession } from '../../../../lib/auth';
import { getPermitAppRepository } from '../../../../lib/repository';

export default async function ReportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await requireSession(`/projects/${projectId}/report`);
  const repository = await getPermitAppRepository();
  const workspace = await repository.getWorkspace(session, projectId);

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Projects', href: '/projects' },
          { label: workspace.project.name, href: `/projects/${projectId}` },
          { label: 'Readiness report' },
        ]}
      />
      <main id="main-content" className="page-width">
        <header className="page-heading">
          <p className="eyebrow">Saved assessment snapshot</p>
          <h1>Readiness report</h1>
          <p>
            Review deterministic sample results, gaps, assumptions, sources, and
            non-binding next actions.
          </p>
        </header>
        <ProjectNav projectId={projectId} />
        {workspace.report ? (
          <ReportView report={workspace.report} />
        ) : (
          <section className="empty-state">
            <h2>No report has been generated</h2>
            <p>Review the project summary before generating a report.</p>
            <div className="actions">
              <Button asChild>
                <Link href={`/projects/${projectId}/summary`}>
                  Review project summary
                </Link>
              </Button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
