import { Breadcrumb } from '../../../../components/breadcrumb';
import { Navigator } from '../../../../components/navigator';
import { ProjectNav } from '../../../../components/project-nav';
import { requireSession } from '../../../../lib/auth';
import { getPermitAppRepository } from '../../../../lib/repository';

export default async function NavigatorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await requireSession(`/projects/${projectId}/navigator`);
  const repository = await getPermitAppRepository();
  const workspace = await repository.getWorkspace(session, projectId);

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Projects', href: '/projects' },
          { label: workspace.project.name, href: `/projects/${projectId}` },
          { label: 'Navigator' },
        ]}
      />
      <main id="main-content" className="page-width">
        <header className="page-heading">
          <p className="eyebrow">Bounded explanation</p>
          <h1>Permit Readiness Navigator</h1>
          <p>
            Ask for help understanding saved information. The navigator explains
            but does not decide permit requirements or change deterministic
            results.
          </p>
        </header>
        <ProjectNav projectId={projectId} />
        <div className="notice notice--info" role="note">
          <strong>Local deterministic adapter.</strong> No Foundry call is made
          from the browser. The hosted-agent integration can replace this server
          boundary later.
        </div>
        <Navigator projectId={projectId} initialMessages={workspace.messages} />
      </main>
    </>
  );
}
