import { createProjectAction } from '../../actions';
import { Breadcrumb } from '../../../components/breadcrumb';
import { Button } from '../../../components/button';
import { requireSession } from '../../../lib/auth';
import { demoProjectTypes } from '../../../lib/demo-config';

export default async function NewProjectPage() {
  await requireSession('/projects/new');

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Projects', href: '/projects' },
          { label: 'Create project' },
        ]}
      />
      <main id="main-content" className="page-width">
        <header className="page-heading">
          <p className="eyebrow">Step 1 of 2</p>
          <h1>Create a demonstration project</h1>
          <p>
            Give the project a recognizable synthetic name and choose the
            pathway that best matches the example you want to explore.
          </p>
        </header>
        <div className="notice" role="note">
          <strong>Do not use real project information.</strong> All fields are
          for demonstration content only.
        </div>
        <form action={createProjectAction}>
          <input
            type="hidden"
            name="idempotencyKey"
            value={crypto.randomUUID()}
          />
          <section className="form-section" aria-labelledby="project-details">
            <h2 id="project-details">Project details</h2>
            <div className="field">
              <label htmlFor="name">
                Project name <span aria-hidden="true">*</span>
              </label>
              <span className="field__hint" id="name-hint">
                Use a fictional name, such as “North Valley route.”
              </span>
              <input
                id="name"
                name="name"
                minLength={2}
                maxLength={160}
                required
                aria-describedby="name-hint"
              />
            </div>
            <div className="field">
              <label htmlFor="description">Short description (optional)</label>
              <textarea id="description" name="description" maxLength={2000} />
            </div>
            <fieldset className="field">
              <legend>
                Project pathway <span aria-hidden="true">*</span>
              </legend>
              <div className="choice-list">
                {demoProjectTypes.map((projectType) => (
                  <label className="choice" key={projectType.id}>
                    <input
                      type="radio"
                      name="projectTypeId"
                      value={projectType.id}
                      data-testid={`project-type-${projectType.id}`}
                      required
                    />
                    <span>
                      <strong>{projectType.name}</strong>
                      <br />
                      {projectType.description}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
          <div className="actions">
            <Button type="submit">Create and add project details</Button>
          </div>
        </form>
      </main>
    </>
  );
}
