# Chokepoint — capability statement

**The Strait of Hormuz consequence engine.** A decision-support platform that models what happens to
the world's oil and LNG when the strait is disrupted: stranded volumes after overland bypass, producer
and importer exposure with days-of-cover, market response (price paths, war-risk insurance, voyage
economics), macro pass-through, and the reopening timeline — all recomputed live from a single
scenario control, all traceable to public primary sources.

**Live:** https://chokepoint.analyticadss.com · **Built by:** [Analytica Data Science Solutions](https://analyticadss.com)

## What differentiates it

- **Net, not gross.** Headlines quote ~20.9 M b/d of gross throughput; the platform models the honest
  damage number — what remains after the Petroline/ADCOP/Goreh–Jask escape valves — with the bypass
  assumption exposed as a switch, not buried as a footnote.
- **Radical provenance.** Every figure carries `{source, url, retrieved, status}`; provenance badges
  (verified / reported / estimate / illustrative) render throughout the UI; the build *fails* on any
  unsourced figure. Analytical invariants are enforced as data tests (importer losses must sum to
  stranded barrels; only Hormuz may lack a sea alternative).
- **History as discipline.** A 45-year escalation ladder and a Brent event study computed from the
  public daily series anchor every model output. The 2026 crisis is the study's own counterexample:
  the first Hormuz spike in four decades that did not mean-revert.
- **Deployment posture.** 100% static and client-side: no backend, no accounts, no telemetry, no paid
  APIs, no cookies. The basemap, fonts, libraries and data are vendored — the platform runs complete
  from a copied directory in restricted or disconnected environments. Unit-tested model; reproducible
  data pipeline; WCAG 2.1 AA assessed (see ACCESSIBILITY.md).
- **Intended use, in writing.** Decision-support for shipping, energy and policy analysis. No real-time
  vessel positions, no navigational data, nothing usable as a targeting aid; vessel-behavior content is
  pattern-level only.

## The platform family

Chokepoint is one of a family of public-data intelligence platforms by Analytica DSS — including
Skywatch, Watchstander (maritime domain awareness), Drift, Crucible and Constellation — sharing a
common design system, provenance discipline and static-deployment posture.

## Engagement

Analytica Data Science Solutions builds decision-support and data-analysis platforms of this class for
government and commercial clients — from public-data products like Chokepoint to bespoke analytical
tooling against client data. Contact via **https://analyticadss.com**.
