import Link from 'next/link';
import { Breadcrumb } from '../../components/breadcrumb';
import { Button } from '../../components/button';
import { requireSession } from '../../lib/auth';
import { getPermitAppRepository } from '../../lib/repository';

const statusLabels = {
  draft: 'Not started',
  intake_in_progress: 'Information needed',
  ready_for_review: 'Ready for review',
  assessment_in_progress: 'Report in progress',
  report_ready: 'Report ready',
  archived: 'Archived',
} as const;

export default async function ProjectsPage() {
  const session = await requireSession('/projects');
  const repository = await getPermitAppRepository();
  const projects = await repository.listProjects(session);

  return (
    <>
      <Breadcrumb
        items={[{ label: 'Home', href: '/' }, { label: 'Projects' }]}
      />
      <main id="main-content" className="page-width">
        <header className="page-heading">
          <p className="eyebrow">Local demonstration workspace</p>
          <h1>Your projects</h1>
          <p>
            Continue a saved synthetic project or create a new one. Data uses
            the <strong>{repository.adapterName}</strong> repository adapter.
          </p>
          <div className="actions">
            <Button asChild>
              <Link href="/projects/new">Create a demonstration project</Link>
            </Button>
          </div>
        </header>
        {projects.length ? (
          <section className="dashboard-grid" aria-label="Saved projects">
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <p className="eyebrow">Illustrative project</p>
                <h2>
                  <Link href={`/projects/${project.id}`}>{project.name}</Link>
                </h2>
                <p>{project.projectTypeId.replaceAll('-', ' ')}</p>
                <div className="project-card__footer">
                  <span
                    className="status"
                    data-state={
                      project.status === 'report_ready' ? 'complete' : 'active'
                    }
                  >
                    {statusLabels[project.status]}
                  </span>
                  <Link className="text-link" href={`/projects/${project.id}`}>
                    Open project
                  </Link>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="empty-state">
            <h2>No projects yet</h2>
            <p>Create one synthetic project to begin the readiness journey.</p>
            <div className="actions">
              <Button asChild>
                <Link href="/projects/new">Create your first project</Link>
              </Button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
