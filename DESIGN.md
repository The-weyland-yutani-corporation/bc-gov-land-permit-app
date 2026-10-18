# Permit Readiness design authority

## Status and thesis

This is the visual authority proven by the responsive landing page and signed-in
project shell in `apps/web/src/site/`. Permit Readiness is a sober,
content-first public service: typography, whitespace, rules, and clear task
structure carry the experience. It must help applicants make progress while
keeping uncertainty, privacy, evidence, and non-binding limits visible.

The default theme is informed by the B.C. Design System, B.C. Visual Identity
Program, and Permit Connect B.C. service structure. All copy and scenarios are
original or synthetic. Visual similarity never implies official government
status.

The original dependency-free HTML/CSS proof establishes the design anatomy. The
Next.js applicant journey preserves that reference alongside the semantic tokens
mapped in `apps/web/tailwind.config.ts`. Framework work must preserve this
anatomy instead of reverting to starter-kit defaults.

### Anti-goals

- No gradient heroes, glass effects, floating decoration, or blurred backdrops.
- No generic SaaS dashboard, KPI wall, or chat-first landing page.
- No excessive pills, fully rounded cards, or decorative status charts.
- No stock imagery used only for atmosphere.
- No AI language implying the model decides permit requirements.
- No hidden demo status, fabricated mark, or unapproved government asset.

## Official references and asset provenance

Verified October 3, 2026:

- [B.C. Design System](https://www2.gov.bc.ca/gov/content/digital/design-system)
- [Header](https://www2.gov.bc.ca/gov/content/digital/design-system/components/header),
  [footer](https://www2.gov.bc.ca/gov/content/digital/design-system/components/footer),
  and
  [button](https://www2.gov.bc.ca/gov/content/digital/design-system/components/buttons)
  guidance
- [B.C. Visual Identity Program](https://www2.gov.bc.ca/gov/content/governments/services-for-government/policies-procedures/bc-visual-identity)
- [B.C. Design Guidelines](https://www2.gov.bc.ca/gov/content/governments/services-for-government/policies-procedures/bc-visual-identity/design-guidelines)
- [BC Sans](https://www2.gov.bc.ca/gov/content/governments/services-for-government/policies-procedures/bc-visual-identity/bc-sans)
- [Permit Connect B.C.](https://www2.gov.bc.ca/gov/content/industry/natural-resource-use/natural-resource-permits/permit-connect-bc)

The design guidelines provide corporate blue `#234075`, corporate gold
`#e3a82b`, mark integrity/clear-space rules, and minimum web sizes. The
component guidance establishes one non-sticky header, one footer, skip links,
visible focus, responsive navigation, and sparse action hierarchy.

No approved BC Mark artwork is present. The masthead uses a dashed, text-only
`data-brand-placeholder` labelled “approved asset required.” It is not a redraw
or substitute logo. BC Sans is open source but was not technically downloadable
in this environment; the stack declares it first and falls back to Noto Sans,
Arial, and platform sans-serif. Integration steps are in
`apps/web/public/brand/README.md` and `apps/web/public/fonts/README.md`.

## Theme model

The default `bc-inspired` theme uses semantic roles. A jurisdiction theme may
replace an approved identity asset, accessible identity name, brand/accent
colours, font family, service title, footer ownership, and jurisdiction links.

It may not replace semantic reading order, the demo label, focus and contrast,
minimum targets, reduced motion, alert meanings, reflow safeguards,
deterministic/agent responsibility labels, or logo approval rules. Every
override requires automated contrast tests and desktop/mobile review.

## Tokens

Runtime variables live in `apps/web/src/styles/tokens.css`; Tailwind mappings
live in `apps/web/tailwind.config.ts`. Components consume semantic variables,
not one-off colours.

| Role                     | Token                     | Default                        |
| ------------------------ | ------------------------- | ------------------------------ |
| Brand primary            | `--color-brand-blue`      | `#234075`                      |
| Brand strong             | `--color-brand-blue-dark` | `#1a3058`                      |
| Brand accent             | `--color-brand-gold`      | `#e3a82b`                      |
| Page / muted / subtle    | `--color-surface-*`       | white / pale blue / light grey |
| Primary / secondary text | `--color-text-*`          | `#313132` / `#555555`          |
| Link                     | `--color-text-link`       | `#1a5a96`                      |
| Focus                    | `--color-focus`           | `#2e5dd7`                      |

Support roles provide paired foreground/background colours for information,
success, warning, and danger. Never communicate status by colour alone. Gold is
a narrow structural accent—not body text, a large background, or a primary
button fill.

Spacing uses a 4 px base (`--space-1` through `--space-20`). Prefer 16–32 px
inside components and 48–80 px between sections. Controls use a 4 px radius.
Normal surfaces have no shadow; the only standard shadow is the focus ring.

## Typography

Use BC Sans when approved local files are present. The development fallback is
Noto Sans, Arial, then platform sans-serif. Noto Sans is not the final B.C.
production typeface.

- Body: 16 px / 1.55 line-height.
- Metadata: 14 px; never for essential instructions.
- Lead and H3: 20 px.
- H2: fluid 24–30 px.
- H1: fluid 32–44 px.
- Reading measure: maximum 46 rem.
- Headings: bold, sentence case, left aligned, compact line-height.

Avoid thin weights, centered paragraphs, decorative serif pairings, and
oversized display headings. Reserve tracked uppercase for short eyebrows.

## Layout and canonical anatomy

- Maximum page width: 76 rem; gutters: 16 px mobile to 32 px desktop.
- Start with one readable flow, then enhance to columns.
- Desktop hero: introduction plus a bounded “Before you start” callout.
- Three-column process/pathways collapse at 56 rem.
- Signed-in shell uses a primary task column and narrower summary column.
- At 40 rem, actions become full width and two-column content becomes one.
- Reflow must remain usable at 320 CSS px and 400% zoom.

Every applicant surface uses:

1. first-focus skip link;
2. prominent “Demonstration — not an official government service” banner;
3. masthead with approved mark or explicit placeholder, service title, utility
   navigation, and gold rule;
4. signed-in navigation when applicable;
5. breadcrumb;
6. one page-level H1 and task/content sections;
7. footer with gold rule, status/authorship, secondary links, and copyright.

## Components and state rules

### Links, buttons, and navigation

- Links navigate and remain underlined in content; buttons perform actions.
- Use one primary action per decision point. Secondary actions are white with a
  blue border.
- Interactive targets are at least 44 px high.
- Labels start with a clear verb and name the outcome.
- Breadcrumb is a labelled ordered list with `aria-current="page"`.
- Mobile menus use native `<details>/<summary>` before custom script.

### Content primitives

- Callouts use a pale surface and thick left border.
- Alerts pair a semantic colour with explicit text and a heading/strong lead.
- Pathway panels are reserved for peer navigation choices.
- General grouping uses headings, rules, and whitespace—not nested cards.
- Status combines text with a shape/icon and uses plain states such as
  “Information needed” or “Report incomplete.”
- Ordered task lists provide one direct next action per task.
- Tables are only for genuinely tabular data and require captions and scoped
  headers.

### Forms

Use persistent labels, connected hint/error text, textual required status, and
`fieldset`/`legend` for grouped controls. Preserve entered data after errors.
Never make map interaction the only way to provide a location.

### Loading, empty, error, permission, success, degraded

- **Loading:** retain title/context and name the work; motion is optional.
- **Empty:** explain why and offer one appropriate action.
- **Error:** state what failed, what remains saved, and how to retry/get help.
- **Permission:** reveal no cross-tenant object details; provide a safe return.
- **Success:** confirm outcome without celebratory animation.
- **Degraded:** distinguish agent/search/map unavailability from deterministic
  project work; never show incomplete prose as a completed report.

## Map, navigator, and report treatment

### Map

The map is a supporting input, never a hero/background. Place it in a labelled
field group with instructions, keyboard controls, geometry status, and a non-map
coordinate/location-description alternative. Keep the base map muted; label
synthetic zones and non-survey accuracy beside it.

### Permit Readiness Navigator

Show navigator help after structured project context, not as the landing hero.
Use labels and modest surfaces rather than speech-bubble decoration. Put
rule/tool results outside the transcript as structured content. Streaming needs
accessible announcements plus stop/retry controls. The navigator explains; it
does not decide.

### Readiness report

Order report content as: status/limitations, missing information, deterministic
possible requirements, reasons, assumptions, sequence, cited guidance, next
actions, then version/provenance metadata. Use headings, definition lists, and
restrained tables. Never convert uncertainty into a decorative score or imply
regulatory approval.

## Accessibility

- Target WCAG 2.2 AA with semantic landmarks, unique titles/H1s, and a skip
  link.
- All functionality works by keyboard; focus is a white separation ring plus a
  blue outer ring and is never removed.
- Text contrast is at least 4.5:1 and meaningful non-text UI meets AA.
- Primary targets are at least 44 px high.
- Never depend on colour, pointer precision, animation, map, audio, or
  conversation alone.
- Respect `prefers-reduced-motion`; status never requires animation.
- Test desktop/mobile, 200%/400% zoom, forced colours, keyboard order, and
  screen-reader landmarks/headings.
- Verify Indigenous-language characters after BC Sans is installed.

## Content voice

Address the applicant as “you.” Lead with the task, use plain language, define
specialist terms, expose missing/conflicting information, and prefer “may,”
“could,” and “confirm with” over definitive regulatory claims. Use specific
actions such as “Start a demonstration project,” not “Get started.”

Required limitation pattern:

> This guidance is for preparation only. It is not an application, approval,
> legal opinion, or complete statement of requirements. Confirm current
> obligations with the responsible authorities.

## Do and do not

| Do                                                                  | Do not                                           |
| ------------------------------------------------------------------- | ------------------------------------------------ |
| Use one clear page title, lead, primary action, and factual callout | Use a gradient hero with competing CTAs          |
| Group content with headings, rules, and whitespace                  | Wrap every section in a rounded shadow card      |
| Show “Information needed” beside the next task                      | Show decorative completion metrics               |
| Put navigator help after structured intake                          | Make chat the first and only interaction         |
| Use descriptive underlined links                                    | Repeat ambiguous “Learn more” links              |
| Show unknowns and assumptions                                       | Convert uncertainty into confidence              |
| Keep the demo banner on every surface                               | Hide unofficial status in footer fine print      |
| Use the approved mark unchanged                                     | Draw, recolour, crop, distort, or approximate it |

## Approved-asset replacement

### BC Mark

1. Obtain current web artwork from GCPE or another brand-owner-approved handoff
   for the specific deployment.
2. Record source/handoff, approver, date, orientation, filename, permitted
   environments, and conditions here.
3. Store the unchanged file in `apps/web/public/brand/`.
4. Replace only the shared `data-brand-placeholder` contents.
5. Preserve clear space and proportional scaling. Minimum web height is greater
   than 50 px vertical or greater than 25 px horizontal.
6. Verify contrast, accessible name, home link, zoom, desktop, and mobile.
7. Keep the demo banner until the deployment—not merely the asset—is formally
   approved as an official service.

### BC Sans

1. Obtain the official `bcgov/bc-sans` release or `@bcgov/bc-sans` package.
2. Retain Apache-2.0 and SIL Open Font License notices.
3. Add regular, italic, and bold WOFF2 files under `apps/web/public/fonts/`.
4. Enable the prepared `@font-face` rules in `src/styles/tokens.css`.
5. Re-run validation and inspect character coverage, layout shift, controls,
   headings, and mobile wrapping.

## Validation contract

`apps/web/scripts/validate-design.mjs` and
`apps/web/tests/design-system.test.mjs` enforce canonical sections and demo
disclosure, semantic landmarks/skip links, active app navigation, corporate
blue/gold tokens, core contrast, focus, reduced motion, minimum targets, the
explicit brand placeholder, absence of a fabricated mark, and bans on gradients
and backdrop filters. Future visual regression checks should extend this
contract.
