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
producer_i    : stranded_i = exports_i·d − min(own_pipeline_spare_i, exports_i·d)</pre>
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
          ${srcRow('Current reported disruption', f.current_reported_disruption)}
          ${srcRow('Short-run elasticity band', f.eps_short_run)}
        </tbody>
      </table></div>
      <ul style="margin-top:10px">
        <li><strong>Producer exports</strong> — <a href="https://www.eia.gov/international/analysis/" target="_blank" rel="noopener">EIA country analysis briefs</a> (approximate pre-crisis Gulf seaborne exports).</li>
        <li><strong>Brent history</strong> — <a href="${data.brentEvents.url}" target="_blank" rel="noopener">EIA Europe Brent spot, daily</a>; event windows recomputed exactly by <code>scripts/fetch.mjs</code> (free EIA API key).</li>
        <li><strong>War-risk insurance</strong> — JWC listed-area circulars; <a href="https://www.lloydslist.com/" target="_blank" rel="noopener">Lloyd's List</a>, <a href="https://www.spglobal.com/energy/en/news-research/latest-news/shipping/062326-war-cover-available-for-hormuz-trades-but-transit-challenges-remain-insurers" target="_blank" rel="noopener">S&amp;P Global</a> and broker commentary. Points are estimates inside publicly quoted ranges; marked as such.</li>
        <li><strong>Incident record</strong> — <a href="https://www.congress.gov/crs-product/R45281" target="_blank" rel="noopener">CRS R45281</a>, US Navy histories, ACLED-adjacent press reporting; 2026 entries from current public reporting including <a href="https://en.wikipedia.org/wiki/2026_Strait_of_Hormuz_crisis" target="_blank" rel="noopener">the aggregated crisis record</a>.</li>
        <li><strong>Shadow-fleet patterns</strong> — public tracking by <a href="https://www.unitedagainstnucleariran.com/tanker-tracker" target="_blank" rel="noopener">UANI</a> and Windward commentary; pattern-level zones only. OFAC SDN screening lives in <a href="https://watchstander.analyticadss.com" target="_blank" rel="noopener">Watchstander</a>.</li>
        <li><strong>Basemap</strong> — <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO dark matter</a> © OpenStreetMap contributors, rendered by <a href="https://maplibre.org" target="_blank" rel="noopener">MapLibre GL JS</a>. Pipeline routes and flow trunks are schematic.</li>
      </ul>
    </section>

    <section>
      <h2>Coverage &amp; gaps — the honesty section</h2>
      <ul>
        <li>Event-study windows before 2019 are approximations pending exact recomputation from the EIA daily series (the fetch pipeline computes them; run it with a free API key). Marked <span class="status estimate">estimate</span> everywhere they appear.</li>
        <li>Insurance points are reconstructed from public commentary, not a broker feed. Ranges shown; single points are illustrative midpoints.</li>
        <li>2026-crisis figures are <span class="status reported">reported</span> — a live war zone's numbers move; this build is stamped ${data.config.as_of}.</li>
        <li>Per-pipeline allocation of EIA's 2.6 M b/d spare is Analytica's derived estimate (the total is EIA's).</li>
        <li>Producer exports are pre-crisis baselines; the model asks "what if d% of normal flow is disrupted", not "what is flowing today".</li>
        <li>No AIS feed is bundled — vessel-level detection belongs to Watchstander; here the shadow-fleet layer is pattern-level context.</li>
      </ul>
    </section>

    <section>
      <h2>Build note</h2>
      <p>Static, client-side, no backend, no login, no paid APIs. All model logic ships as documented,
      unit-tested ES modules (<code>src/model.js</code>, <code>tests/</code>); all data ships as versioned JSON
      under <code>/data</code> with per-figure <code>{source, url, retrieved, status}</code>. Rebuild the dataset
      from scratch with <code>scripts/fetch.mjs</code>. Deploys to GitHub Pages behind Cloudflare.
      Deep links encode the full view state in the URL hash. <em>Chokepoint · Analytica Data Science Solutions ·
      built from 100% public data.</em></p>
    </section>`;
}
