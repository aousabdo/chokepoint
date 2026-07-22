# Accessibility conformance — Chokepoint

**Standard:** WCAG 2.1 Level AA (the standard referenced by Section 508 / ICT Final Rule).
**Scope:** chokepoint.analyticadss.com — Map, Insights and Methodology views, scenario controls, guided tour, print brief.
**Assessment date:** 2026-07-22 (self-assessment; automated + manual).

## Testing performed

- **Automated:** axe-core 4.10.2 against all three views at multiple scenario states — **0 violations**
  (after remediation of 3 finding classes: small-text contrast on crimson accents, complementary-landmark
  nesting, missing page h1).
- **Keyboard:** all controls are native elements (buttons, range inputs, select, links) in a logical tab
  order; the scenario slider, time scrubber and elasticity slider are operable with arrow keys; `Esc`
  dismisses the detail card and tour; the tour supports arrow-key navigation; opening a detail card moves
  focus to its dismiss control.
- **Motion:** all animation (count-up tweens, flow dashes, intro transitions, tour transitions) is
  suppressed under `prefers-reduced-motion`.
- **Color:** color is never the sole encoding — exposure classes pair color with text tags, provenance
  states pair color with text badges, chart series pair color with direct labels and signed values.
  Small crimson text uses a dedicated ≥4.5:1 variant (`--stranded-crim-text`).
- **Structure:** landmarks (banner, nav, main, regions, contentinfo-equivalent), one h1 per page,
  descriptive `aria-label`s on charts (`role="img"`) summarizing what each shows, `aria-live="polite"`
  on the scenario readout.

## Known limitations

- **The map canvas** (MapLibre GL) is a WebGL surface and is not element-navigable by screen readers.
  Mitigation: every fact shown on the map is available as text — the scenario readout (live region),
  the Insights tables, and sourced detail cards; the map is enhancement, not the sole path to any data.
- **SVG charts** expose a summary via `aria-label`; underlying values are also present in adjacent
  tables or text (event study values are printed beside each bar; ledger values appear in tooltips and
  the brief's tables).
- The **print brief** is generated HTML styled for print; headings and tables are semantic, but it is
  designed for visual/paper consumption. The same content is available in the accessible web views.

## Contact

Accessibility issues: via [analyticadss.com](https://analyticadss.com). We treat accessibility
regressions as defects.
