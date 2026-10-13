# NEXORA — Design Direction v1

## Product intent
A township intelligence platform with a cinematic public entrance and a high-clarity operational workspace. It must feel engineered, credible and specific to township infrastructure—not like a generic AI dashboard.

## Non-negotiable safeguards
- Preserve existing React page keys: `overview`, `digitalTwin`, `intelligenceGraph`, `operations`, `sustainability`.
- Preserve landing / command / resident screen transitions.
- Preserve the shared WT-04 snapshot, sensor deep-links, Operations and Sustainability callbacks.
- Do not edit `Township3D.jsx`, Intelligence Graph geometry, FastAPI, or IoT pipeline as part of a visual-only change.
- Prefer scoped CSS over global selectors, and review responsive states.

## Visual language
- **Public landing:** cinematic video backdrop, restrained overlay, oversized editorial typography, clear primary and secondary actions.
- **Command shell:** near-black/navy header, one deliberate violet accent, clear active-page indicator, quiet operational status.
- **Data pages:** calm readable surfaces with strong type hierarchy, deliberate grid, low-contrast separators, and high-density information where useful. Avoid decorative cards for every metric.
- **3D scenes:** remain immersive and dark. Do not force the light dashboard surface into WebGL viewports.
- **Color semantics:** violet = product/interaction; green = healthy; amber = warning; red = critical. Never use severity colors purely as decoration.
- **Typography:** Inter for UI, JetBrains Mono for telemetry, IDs and timestamps. Large headings should have purposeful line breaks and responsive sizing.
- **Shape:** 4–10px radii for UI; avoid oversized pill cards unless conveying status.
- **Motion:** short hover/focus transitions, optional subtle entrance sequences; respect `prefers-reduced-motion`; do not animate critical data or distract from graph interactions.

## Design quality rules
1. Every section must answer a concrete user question.
2. Use real page terminology (WT-04, zones, incidents) instead of generic AI buzzwords.
3. Prefer whitespace and alignment over unnecessary borders and gradients.
4. Maintain readable contrast on dark backgrounds.
5. Keep keyboard focus, semantic buttons, and mobile navigation usable.
6. Avoid changing global `button`, `main`, `header` rules when a component class will suffice.
7. No dependency additions solely for visual polish without approval.

## Recommended implementation sequence
1. **Audit and consolidate CSS cascade:** current `App.css` contains legacy light corporate rules and later cinematic/dark overrides. Map and preserve effective rules before modifying.
2. **Landing page:** refine typography, CTA hierarchy, responsive spacing and video legibility. Keep video/poster paths intact.
3. **Command navigation:** responsive active states, brand treatment and compact layout. Keep existing `setActivePage` behavior.
4. **Executive Overview:** strengthen information hierarchy while preserving live WT-04 and navigation callbacks.
5. **Operations / Sustainability / Resident Portal:** adapt the shared visual language one page at a time, with regression checks.
6. **Digital Twin and Intelligence Graph:** only visual shell polish if needed; do not alter camera, graph physics or sensor logic.

## Regression checklist
- Landing `Explore NEXORA` opens command centre.
- Landing `Resident Connect` opens resident portal and back navigation works.
- All five command tabs render.
- Overview WT-04 reflects Digital Twin live snapshot.
- `VIEW SENSOR` opens Digital Twin with WT-04 targeted.
- Incident and sustainability links still navigate correctly.
- Graph rotation/click/inspector and Digital Twin remain untouched.
- Desktop, laptop and narrow mobile widths remain usable.
