# Web application guidance

- Follow root `AGENTS.md`, `PRODUCT.md`, and the proven rules in `DESIGN.md`.
- Use Next.js App Router and React Server Components by default when the web
  implementation is added.
- Limit client components to browser-only interaction such as maps, streaming,
  and stateful forms.
- Keep authentication, ownership checks, persistence, and Foundry calls on the
  server. The browser must not call Foundry or the database directly.
- Define route inputs and outputs in `packages/contracts` before handlers.
- Use semantic HTML, keyboard operation, visible focus, accessible names,
  helpful errors, and reduced-motion behavior.
- Preserve a prominent demonstration/non-official service indicator.
- Place web-specific tests beside behavior or under the future `tests` area and
  run the root canonical commands.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may
all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` (resolved from this file's directory; in
monorepos the `next` package may not be visible from the repo root) before
writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at
`node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a
diff only re-creates the uncommitted change; committing it with your work keeps
the tree clean.

<!-- END:nextjs-agent-rules -->
