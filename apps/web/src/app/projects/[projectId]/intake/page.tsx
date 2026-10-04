import { Breadcrumb } from '../../../../components/breadcrumb';
import { IntakeWizard } from '../../../../components/intake-wizard';
import { ProjectNav } from '../../../../components/project-nav';
import { requireSession } from '../../../../lib/auth';
import { getDemoQuestionSet } from '../../../../lib/demo-config';
import { getMapAdapter } from '../../../../lib/maps';
import { getPermitAppRepository } from '../../../../lib/repository';

export default async function IntakePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await requireSession(`/projects/${projectId}/intake`);
  const repository = await getPermitAppRepository();
  const { project, intake } = await repository.getWorkspace(session, projectId);
  const questionSet = getDemoQuestionSet(project.projectTypeId);

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Projects', href: '/projects' },
          { label: project.name, href: `/projects/${projectId}` },
          { label: 'Project details' },
        ]}
      />
      <main id="main-content" className="page-width">
        <header className="page-heading">
          <p className="eyebrow">Structured intake</p>
          <h1>Add project details</h1>
          <p>
            Answer what you know. Required unknowns remain visible and map use
            is optional.
          </p>
        </header>
        <ProjectNav projectId={projectId} />
        <IntakeWizard
          projectId={projectId}
          expectedVersion={intake.version}
          expectedProjectVersion={project.version}
          questions={[...questionSet.questions]}
          initialAnswers={[...intake.answers]}
          initialLocation={project.location}
          mapConfiguration={getMapAdapter().getBrowserConfiguration()}
        />
      </main>
    </>
  );
}
