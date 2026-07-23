/** Methodology & Sources — Skywatch-depth, generated from the bundled data so it can't drift. */
import { statusBadge } from './format.js';

export function renderMethodology(root, data) {
  const f = data.config.figures;
  const srcRow = (label, entry) => `
    <tr><td><strong>${label}</strong></td>
      <td class="num">${Array.isArray(entry.value) ? entry.value.join('–') : entry.value} <span style="color:var(--ink-dim);font-family:var(--font-ui)">${entry.unit ?? ''}</span></td>
      <td>${entry.url ? `<a href="${entry.url}" target="_blank" rel="noopener">${entry.source}</a>` : entry.source}</td>
      <td class="num">${entry.retrieved ?? ''}</td>
      <td>${statusBadge(entry.status)}</td></tr>`;

  root.innerHTML = `
    <h1>Methodology &amp; Sources</h1>
    <p class="lede">Every number on this site traces to a public source. That reproducibility is the product.
    Data as of <b class="num">${data.config.as_of}</b>.</p>

    <section>
      <h2>What Chokepoint is</h2>
      <p>A consequence engine for the Strait of Hormuz — not another live tanker map. The world can watch ships
      burn on television; what isn't published cleanly is the analysis underneath: the difference between the
      scary gross throughput number in the headlines and the barrels <strong>actually stranded</strong> once the
      overland escape routes are subtracted. Chokepoint models that difference, who owns it, what it does to
      price, and what four decades of Hormuz threats actually delivered.</p>
      <p><strong>Intended use.</strong> Decision-support for shipping, energy and policy analysis, built entirely
      from public data. Chokepoint models flows, exposure, insurance and history. It deliberately provides
      <strong>no real-time vessel positions, no navigational data, and nothing that could serve as a targeting
      aid</strong>. Incident markers are historical or reported events at approximate positions; vessel-behavior
      content is pattern-level (AIS gaps, spoofing zones, STS areas), matching
      <a href="https://watchstander.analyticadss.com" target="_blank" rel="noopener">Watchstander</a>'s framing.</p>
    </section>

    <section>
      <h2>How to read the map</h2>
      <ul>
        <li><span style="color:var(--data-cyan)">■</span> Cyan flows — oil moving toward and through the strait; <span style="color:var(--accent-gold)">■</span> gold — Qatari LNG.</li>
        <li><span style="color:var(--safe-teal)">■</span> Teal lines — the three bypass pipelines. They <em>thicken</em> as the scenario pushes diverted barrels into them.</li>
        <li><span style="color:var(--stranded-crim)">■</span> The red pool at the narrows — stranded volume that has nowhere to go.</li>
        <li>Terminal dots are sized by export volume and colored by exposure (red = total, amber = high, teal = partial). Color is never the only encoding — every feature opens a sourced card with the figures in text.</li>
        <li><strong>Click any terminal</strong> to light the flow trunk it rides (bypass outlets light their pipeline instead); the card names the trunk and its companion ports. Open water, Esc or the card's ✕ clears. Origin is shown on demand rather than as permanent route colors — that keeps the semantic palette and colorblind guarantees intact.</li>
        <li>The shadow-fleet layer (off by default) shows <em>pattern-level</em> zones only — AIS-gap corridors, spoofing and STS areas from public reporting — never vessel positions.</li>
        <li>The strait's lane geometry is a <em>schematic</em> of the IMO traffic separation scheme — two 2-mile lanes in a ~21-nautical-mile-wide narrows. Not for navigation.</li>
      </ul>
    </section>

    <section>
      <h2>How to interpret — gross vs. stranded</h2>
      <p>The headline number (~${f.hormuz_throughput_mbd.value} M b/d) is <em>gross throughput</em>. The honest
      denominator for damage is <strong>spare bypass</strong>: pipeline capacity that exists <em>and isn't already
      full</em>. Nameplate capacity double-counts barrels that already flow overland. EIA's long-standing usable
      spare figure is ~2.6 M b/d; after Aramco's claimed Petroline expansion to 7 M b/d, public commentary puts
      the upper bound near 5.5 M b/d — sustained flows at that level are untested. Chokepoint defaults to the
      conservative figure and exposes the assumption as a switch, because the difference is the whole argument.</p>
      <p>The model:</p>
      <pre>stranded(d)   = throughput·d − min(spare_bypass, throughput·d)
share         = stranded(d) / global_liquids_supply
ΔP/P          ≈ share / ε        ε ∈ [${f.eps_short_run.value.join(', ')}]  (capped at +${f.shock_cap.value * 100}%)
SPR_days      = releasable_reserves / stranded(d)
SPR_offset    = min(max_release_rate, stranded(d))       — the tap binds, not the tank
producer_i    : stranded_i = exports_i·d − min(own_pipeline_spare_i, exports_i·d)
importer_i    : loss_i = imports_i·d · stranded/gross    — bypass pro-rata; barrels are fungible
implied odds  : P(hull loss per transit) ≤ premium / severity   — upper bound; premiums include loadings
LNG multiplier: 1 + (lng_lost / global_lng_trade) / ε_gas       — no bypass exists for gas; capped
voyage        : premium share = hull·p / (cargo·freight)        — >1 means the underwriter decides
price path    : ΔP(t)/P = share / ε(t),  ε(t) = ε₀ + (ε∞−ε₀)(1−e^(−t/τ))   — spike decays to a siege premium
macro         : ΔCPI ≈ (ΔP%/10)·[0.2,0.4] pp · ΔGDP ≈ −(ΔP%/10)·[0.1,0.2] pp   — rules of thumb, one-year</pre>
      <p>The price equation is <strong>illustrative by construction</strong>: short-run oil demand is famously
      inelastic, so small volume losses move price hard — but real markets price expectations, OPEC spare
      capacity, SPR releases and demand destruction. We show a band, not a point, and cap it. The SPR runway is
      a stock-to-flow ratio, not a release plan — actual drawdown rates are capped well below a full-closure
      stranded rate.</p>
      <p>The empirical anchor comes first: the event study shows that in every prior Hormuz episode — including
      the Tanker War, when the strait never closed — <strong>threat premiums mean-reverted within weeks unless
      barrels were physically missing</strong>. The 2026 crisis is the first episode where they are.</p>
    </section>

    <section>
      <h2>Data sources</h2>
      <div class="chart-wrap"><table class="src-table">
        <thead><tr><th>Figure</th><th>Value</th><th>Source</th><th>Retrieved</th><th>Status</th></tr></thead>
        <tbody>
          ${srcRow('Hormuz throughput', f.hormuz_throughput_mbd)}
          ${srcRow('Share of global consumption', f.hormuz_share_global_consumption)}
          ${srcRow('Share of seaborne crude', f.hormuz_share_seaborne_crude)}
          ${srcRow('Share of global LNG', f.lng_share_global)}
          ${srcRow('Global liquids supply', f.global_liquids_mbd)}
          ${srcRow('Spare bypass (conservative)', { ...data.config.bypass_profiles.eia, value: data.config.bypass_profiles.eia.total_mbd, unit: 'M b/d' })}
          ${srcRow('Spare bypass (expanded)', { ...data.config.bypass_profiles.expanded, value: data.config.bypass_profiles.expanded.total_mbd, unit: 'M b/d' })}
          ${srcRow('Petroline', { ...data.config.pipelines.petroline, value: data.config.pipelines.petroline.nameplate_mbd, unit: 'M b/d nameplate' })}
          ${srcRow('Habshan–Fujairah (ADCOP)', { ...data.config.pipelines.adcop, value: data.config.pipelines.adcop.nameplate_mbd, unit: 'M b/d nameplate' })}
          ${srcRow('Goreh–Jask', { ...data.config.pipelines.jask, value: data.config.pipelines.jask.nameplate_mbd, unit: 'M b/d nameplate' })}
          ${srcRow('Releasable strategic reserves', f.spr_releasable_mbbl)}
          ${srcRow('Max coordinated release rate', f.max_release_mbd)}
          ${srcRow('OPEC+ spare capacity', f.opec_spare_mbd)}
          ${srcRow('Current reported disruption', f.current_reported_disruption)}
          ${srcRow('Short-run elasticity band ε', f.eps_short_run)}
          ${srcRow('Long-run elasticity ε∞', f.eps_longrun)}
          ${srcRow('Elasticity ramp τ', f.tau_months)}
          ${srcRow('CPI per +10% oil', f.cpi_per_10pct)}
          ${srcRow('GDP per +10% oil', f.gdp_per_10pct)}
        </tbody>
      </table></div>
      <ul style="margin-top:10px">
        <li><strong>Producer volumes</strong> — EIA WOTC 2024 through-Hormuz crude + condensate by origin (Saudi 38% ≈ 5.5 M b/d; Iraq ~22.5%; UAE ~13%; Iran 10.6%; Kuwait 10.1%; top five &gt;93%). Refined products transit the same strait but are not origin-attributed in the producer board.</li>
        <li><strong>Importer volumes</strong> — EIA WOTC Hormuz flows by destination (2024). Destination volumes must sum to total throughput — the build validator enforces it, which is what makes importer losses sum exactly to stranded barrels.</li>
        <li><strong>Strategic stocks per importer</strong> — <a href="https://www.iea.org/about/oil-security-and-emergency-response" target="_blank" rel="noopener">IEA</a> (Japan, Korea, Europe), <a href="https://www.isprlindia.com/" target="_blank" rel="noopener">ISPRL</a> (India), <a href="https://www.energy.gov/ceser/strategic-petroleum-reserve" target="_blank" rel="noopener">DOE</a> (US). China's reserves are state-opaque; the bundled figure is a public analyst estimate and is badged as such everywhere it appears.</li>
        <li><strong>Maximum release rate</strong> — the 2022 IEA coordinated actions (<a href="https://www.iea.org/news/iea-confirms-member-country-contributions-to-second-collective-action-to-release-oil-stocks-in-response-to-russia-s-invasion-of-ukraine" target="_blank" rel="noopener">240 M bbl over ~6 months</a>; US SPR drawdown peaked near 1 M b/d).</li>
        <li><strong>Reopening anchors</strong> — US Navy mine-countermeasure histories (1988, 1991), the EIA daily Brent series, and this site's own insurance ledger. Ranges are estimates and badged as such.</li>
        <li><strong>LNG</strong> — Hormuz volumes from EIA WOTC / QatarEnergy / ADNOC disclosures; global trade from <a href="https://giignl.org/" target="_blank" rel="noopener">GIIGNL</a>; the 2021–22 European gas crisis (<a href="https://www.iea.org/reports/gas-market-report-q1-2023" target="_blank" rel="noopener">IEA gas market reports</a>) is the empirical anchor for the multiplier band. Buyer split sums to the Hormuz total — validator-enforced.</li>
        <li><strong>Voyage &amp; floating-storage defaults</strong> — VLCC values and freight from public Baltic Exchange / broker commentary (estimates, adjustable in the UI); the ship queue from 2026-crisis reporting; OPEC spare capacity from <a href="https://www.eia.gov/outlooks/steo/" target="_blank" rel="noopener">EIA STEO</a>.</li>
        <li><strong>Chokepoint comparison</strong> — EIA WOTC volumes for Malacca, Suez+SUMED, Bab el-Mandeb and Panama; closure records from the historical public record. The validator enforces the thesis as data: exactly one chokepoint has no sea alternative, and it is Hormuz.</li>
        <li><strong>Macro coefficients &amp; long-run elasticity</strong> — <a href="https://www.imf.org/en/Publications/WEO" target="_blank" rel="noopener">IMF WEO analytical work</a> and Federal Reserve staff rules of thumb; ε∞ from oil-demand elasticity meta-analyses. All marked illustrative — linear rules of thumb break down at extreme shocks.</li>
        <li><strong>Brent history</strong> — <a href="${data.brentEvents.url}" target="_blank" rel="noopener">${data.brentEvents.source}</a>; event windows computed by <code>scripts/fetch.mjs</code>.</li>
        <li><strong>War-risk insurance</strong> — JWC listed-area circulars; <a href="https://www.lloydslist.com/" target="_blank" rel="noopener">Lloyd's List</a>, <a href="https://www.spglobal.com/energy/en/news-research/latest-news/shipping/062326-war-cover-available-for-hormuz-trades-but-transit-challenges-remain-insurers" target="_blank" rel="noopener">S&amp;P Global</a> and broker commentary. Points are estimates inside publicly quoted ranges; marked as such.</li>
        <li><strong>Incident record</strong> — <a href="https://www.congress.gov/crs-product/R45281" target="_blank" rel="noopener">CRS R45281</a>, US Navy histories, ACLED-adjacent press reporting; 2026 entries from current public reporting including <a href="https://en.wikipedia.org/wiki/2026_Strait_of_Hormuz_crisis" target="_blank" rel="noopener">the aggregated crisis record</a>.</li>
        <li><strong>Shadow-fleet patterns</strong> — public tracking by <a href="https://www.unitedagainstnucleariran.com/tanker-tracker" target="_blank" rel="noopener">UANI</a> and Windward commentary; pattern-level zones only. OFAC SDN screening lives in <a href="https://watchstander.analyticadss.com" target="_blank" rel="noopener">Watchstander</a>.</li>
        <li><strong>Basemap</strong> — an offline <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a> PMTiles extract of the Gulf (© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, ODbL), rendered by <a href="https://maplibre.org" target="_blank" rel="noopener">MapLibre GL JS</a> — the map makes no external requests. CARTO dark matter serves only as a fallback if the offline bundle is stripped. Pipeline routes and flow trunks are schematic.</li>
        <li><strong>Intro geography</strong> — <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth 1:50m</a> coastlines (public domain), projected to the intro figure at build time by <code>scripts/make-intro-geo.mjs</code>.</li>
      </ul>
    </section>

    <section>
      <h2>Coverage &amp; gaps — the honesty section</h2>
      <ul>
        <li>Event-study windows are computed from the public daily Brent series (EIA's API with a free key, or its FRED mirror DCOILBRENTEU when no key is present — identical numbers). The daily series starts May 1987, so the 1984 Tanker War row remains an <span class="status estimate">estimate</span>.</li>
        <li>Insurance points are reconstructed from public commentary, not a broker feed. Ranges shown; single points are illustrative midpoints.</li>
        <li>2026-crisis figures are <span class="status reported">reported</span> — a live war zone's numbers move; this build is stamped ${data.config.as_of}.</li>
        <li>Per-pipeline allocation of EIA's 2.6 M b/d spare is Analytica's derived estimate (the total is EIA's).</li>
        <li>Producer and importer volumes are pre-crisis baselines; the model asks "what if d% of normal flow is disrupted", not "what is flowing today".</li>
        <li>Producer rows cover through-Hormuz crude + condensate (~15 M b/d of the 20.9 total); refined products are in the throughput and importer totals but not attributed to origin countries.</li>
        <li>No AIS feed is bundled — vessel-level detection belongs to Watchstander; here the shadow-fleet layer is pattern-level context.</li>
      </ul>
    </section>

    <section>
      <h2>Scenario briefs</h2>
      <p>Pre-generated five-page analyst briefs at the canonical scenarios:
      <a href="briefs/chokepoint-brief-40.pdf">40% — partial closure</a> ·
      <a href="briefs/chokepoint-brief-90.pdf">90% — current reported</a> ·
      <a href="briefs/chokepoint-brief-100.pdf">100% — full closure</a>.
      Or press <strong>Download brief</strong> anywhere on the site to generate one at your exact scenario.</p>
    </section>

    <section>
      <h2>About Analytica Data Science Solutions</h2>
      <p>Chokepoint is built by <a href="https://analyticadss.com" target="_blank" rel="noopener">Analytica
      Data Science Solutions</a> — decision-support and data-analysis platforms for government and commercial
      clients. It is part of a family of public-data intelligence platforms sharing this design system and
      provenance discipline, including <a href="https://watchstander.analyticadss.com" target="_blank" rel="noopener">Watchstander</a>
      (maritime domain awareness) and Skywatch. The platform is fully self-contained — static, client-side,
      no accounts, no telemetry, vendored basemap and data — and runs complete from a copied directory in
      restricted or disconnected environments. Accessibility conformance and the data-refresh runbook ship
      in the repository (ACCESSIBILITY.md, REFRESH.md). Engagements: via
      <a href="https://analyticadss.com" target="_blank" rel="noopener">analyticadss.com</a>.</p>
    </section>

    <section>
      <h2>Build note</h2>
      <p>Static, client-side, no backend, no login, no telemetry, no paid APIs. All model logic ships as
      documented, unit-tested ES modules (<code>src/model.js</code>, <code>tests/</code>); all data ships as
      versioned JSON under <code>/data</code> with per-figure <code>{source, url, retrieved, status}</code>.
      The basemap, fonts, map libraries and dataset are vendored — the site is fully self-contained and runs
      from a copied directory with zero external requests. Rebuild the dataset from scratch with
      <code>scripts/fetch.mjs</code>. Deploys to GitHub Pages behind Cloudflare.
      Accessibility conformance (WCAG 2.1 AA) and the data-refresh runbook ship in the repository.
      Deep links encode the full view state in the URL hash. <em>Chokepoint ·
      <a href="https://analyticadss.com" target="_blank" rel="noopener">Analytica Data Science Solutions</a> ·
      built from 100% public data.</em></p>
    </section>`;
}
