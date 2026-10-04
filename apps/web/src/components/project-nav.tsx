import Link from 'next/link';

export function ProjectNav({ projectId }: { projectId: string }) {
  const base = `/projects/${projectId}`;
  return (
    <nav aria-label="Project sections" className="content-block">
      <ul className="actions">
        <li>
          <Link href={base}>Overview</Link>
        </li>
        <li>
          <Link href={`${base}/intake`}>Project details</Link>
        </li>
        <li>
          <Link href={`${base}/summary`}>Summary</Link>
        </li>
        <li>
          <Link href={`${base}/navigator`}>Navigator</Link>
        </li>
        <li>
          <Link href={`${base}/report`}>Report</Link>
        </li>
        <li>
          <Link href={`${base}/tasks`}>Tasks</Link>
        </li>
      </ul>
    </nav>
  );
}
