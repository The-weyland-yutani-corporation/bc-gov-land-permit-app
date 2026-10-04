import Link from 'next/link';
import { Breadcrumb } from '../components/breadcrumb';
import { Button } from '../components/button';

export default function LandingPage() {
  return (
    <>
      <Breadcrumb items={[{ label: 'Home' }, { label: 'Permit Readiness' }]} />
      <main id="main-content">
        <section className="hero">
          <div className="page-width hero__layout">
            <div>
              <p className="eyebrow">Plan before you apply</p>
              <h1>Understand what your land-based project may need</h1>
              <p className="lead">
                Describe a proposed project, identify information gaps, and
                prepare questions for the authorities responsible for permits
                and authorizations.
              </p>
              <div className="actions">
                <Button asChild>
                  <Link href="/sign-in?returnTo=/projects/new">
                    Start a demonstration project
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/sign-in">Continue a saved project</Link>
                </Button>
              </div>
            </div>
            <aside className="callout" aria-labelledby="before-you-start">
              <h2 id="before-you-start">Before you start</h2>
              <p>
                Use fictional or non-sensitive information only. This
                demonstration does not connect to government application
                systems.
              </p>
              <p>
                The guidance is preparatory and is{' '}
                <strong>not a permit decision</strong> or legal advice.
              </p>
            </aside>
          </div>
        </section>

        <section className="section section--tinted" aria-labelledby="how">
          <div className="page-width">
            <div className="section-heading">
              <h2 id="how">How the service works</h2>
              <p>
                Complete a short, reviewable journey. You can correct your
                information before viewing guidance.
              </p>
            </div>
            <ol className="steps">
              <li>
                <h3>Describe the project</h3>
                <p>
                  Choose a pathway and provide a general location, activities,
                  timing, and known constraints.
                </p>
              </li>
              <li>
                <h3>Review information gaps</h3>
                <p>
                  See which answers are missing or uncertain before synthetic
                  rules are evaluated.
                </p>
              </li>
              <li>
                <h3>Prepare next steps</h3>
                <p>
                  Receive a non-binding report with assumptions, illustrative
                  sources, and questions to confirm.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="section" aria-labelledby="pathways">
          <div className="page-width">
            <div className="section-heading">
              <h2 id="pathways">Explore a project pathway</h2>
              <p>
                Synthetic scenarios demonstrate how a configurable public
                service can adapt its intake.
              </p>
            </div>
            <div className="pathways">
              {[
                {
                  title: 'Housing',
                  description:
                    'Plan housing-site preparation and identify early land and water questions.',
                },
                {
                  title: 'Electrification',
                  description:
                    'Explore a clean-power connection using illustrative activities.',
                },
                {
                  title: 'Connectivity',
                  description:
                    'Consider a terrestrial route and questions about crossings and access.',
                },
              ].map(({ title, description }) => (
                <article className="pathway" key={title}>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <Link href="/sign-in?returnTo=/projects/new">
                    Start a {title.toLowerCase()} example
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--tinted" id="about">
          <div className="page-width">
            <div className="section-heading">
              <h2>Important information</h2>
              <p>
                Understand the demonstration boundary before entering project
                information.
              </p>
            </div>
            <div className="information-grid">
              <article>
                <h3>Privacy and identity</h3>
                <p>
                  Local demo mode uses a synthetic identity. Do not enter
                  personal, confidential, or commercially sensitive information.
                </p>
              </article>
              <article>
                <h3>Guidance is non-binding</h3>
                <p>
                  Results are not an application, approval, legal opinion, or
                  complete statement of requirements. Confirm obligations with
                  the responsible authorities.
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
