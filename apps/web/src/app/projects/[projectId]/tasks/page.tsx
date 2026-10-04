import Link from 'next/link';
import { updateTaskAction } from '../../../actions';
import { Breadcrumb } from '../../../../components/breadcrumb';
import { Button } from '../../../../components/button';
import { ProjectNav } from '../../../../components/project-nav';
import { requireSession } from '../../../../lib/auth';
import { getPermitAppRepository } from '../../../../lib/repository';

export default async function TasksPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await requireSession(`/projects/${projectId}/tasks`);
  const repository = await getPermitAppRepository();
  const workspace = await repository.getWorkspace(session, projectId);

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Projects', href: '/projects' },
          { label: workspace.project.name, href: `/projects/${projectId}` },
          { label: 'Tasks and status' },
        ]}
      />
      <main id="main-content" className="page-width">
        <header className="page-heading">
          <p className="eyebrow">Continue after the report</p>
          <h1>Tasks and project status</h1>
          <p>
            Track non-binding preparation tasks derived from the saved
            demonstration report.
          </p>
        </header>
        <ProjectNav projectId={projectId} />
        {workspace.tasks.length ? (
          <ol className="task-list">
            {workspace.tasks.map((task, index) => {
              const update = updateTaskAction.bind(null, projectId, task.id);
              return (
                <li key={task.id}>
                  <span className="task-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <strong>{task.title}</strong>
                    <p>{task.description}</p>
                    <div className="task-controls">
                      <span className="status" data-state="active">
                        {task.status.replaceAll('_', ' ')}
                      </span>
                      <form action={update}>
                        <input
                          type="hidden"
                          name="status"
                          value={
                            task.status === 'completed' ? 'todo' : 'completed'
                          }
                        />
                        <Button type="submit" variant="secondary">
                          {task.status === 'completed'
                            ? 'Mark not complete'
                            : 'Mark complete'}
                        </Button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <section className="empty-state">
            <h2>No report-derived tasks</h2>
            <p>Generate a report to create traceable preparation tasks.</p>
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
