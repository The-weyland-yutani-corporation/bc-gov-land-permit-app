# BC Sans integration

BC Sans is not bundled in this repository. The runtime stack declares `BC Sans`
first and falls back to Noto Sans, Arial, and the platform sans-serif.

To enable BC Sans:

1. Obtain the current release from the official `bcgov/bc-sans` repository or
   the `@bcgov/bc-sans` package. Version 2.1.2 was the verified current package
   during this design task.
2. Review and retain its Apache-2.0 and SIL Open Font License notices.
3. Copy `BCSans-Regular.woff2`, `BCSans-Italic.woff2`, and `BCSans-Bold.woff2`
   into this directory.
4. Uncomment the documented `@font-face` blocks in `src/styles/tokens.css`.
5. Run `pnpm validate` and manually verify Indigenous-language characters,
   headings, controls, desktop, and mobile rendering.
