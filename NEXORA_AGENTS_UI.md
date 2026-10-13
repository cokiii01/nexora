# NEXORA UI editing instructions

Read `NEXORA_DESIGN.md` before visual edits.

- Make minimal, scoped, reversible changes.
- Do not change routing, state, props, data fetching, sensor logic, graph physics or backend unless explicitly requested.
- Preserve all existing navigation and live WT-04 functionality.
- Prefer editing existing class-specific selectors over global selectors.
- Check the last matching CSS rules in `App.css` before assuming an earlier rule controls the UI.
- Maintain desktop and mobile responsiveness, contrast and reduced-motion support.
- Summarize changed files and regression risks after edits.
