/** Loads the bundled static JSON — no runtime API the visitor depends on. */

async function json(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

export async function loadAll() {
  const [config, producersDoc, eventsDoc, insurance, brentEvents, strait, pipelines, terminals, flows, shadow, introCoast, importersDoc, reopening, lng, voyage, chokepointsDoc] =
    await Promise.all([
      json('data/config.json'),
      json('data/producers.json'),
      json('data/events.json'),
      json('data/insurance.json'),
      json('data/brent_events.json'),
      json('data/geo/strait.geojson'),
      json('data/geo/pipelines.geojson'),
      json('data/geo/terminals.geojson'),
      json('data/geo/flows.geojson'),
      json('data/geo/shadow.geojson'),
      json('data/geo/intro-coast.json'),
      json('data/importers.json'),
      json('data/reopening.json'),
      json('data/lng.json'),
      json('data/voyage.json'),
      json('data/chokepoints.json'),
    ]);
  return {
    config,
    producers: producersDoc.producers,
    producersDoc,
    events: eventsDoc.events,
    eras: eventsDoc.eras,
    eventsDoc,
    insurance,
    brentEvents,
    importers: importersDoc.importers,
    importersDoc,
    reopening,
    lng,
    voyage,
    chokepointsDoc,
    geo: { strait, pipelines, terminals, flows, shadow, introCoast },
  };
}
