import { Breadcrumb } from '../../components/breadcrumb';

export default function HelpPage() {
  return (
    <>
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Help' }]} />
      <main id="main-content" className="page-width">
        <header className="page-heading">
          <h1>Help, privacy, and accessibility</h1>
          <p>
            This demonstration is designed for keyboard operation and provides
            non-map and non-conversation alternatives.
          </p>
        </header>
        <section className="content-block">
          <h2>Protect your information</h2>
          <p className="measure">
            Enter fictional or non-sensitive information only. Do not include
            personal records, secrets, precise private-site details, or
            commercially sensitive material.
          </p>
        </section>
        <section className="content-block">
          <h2>Alternative ways to complete tasks</h2>
          <p className="measure">
            Location can be supplied with coordinates or GeoJSON. Every
            navigator explanation is supplementary to structured project fields,
            summaries, reports, and tasks.
          </p>
        </section>
      </main>
    </>
  );
}
