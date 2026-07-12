/**
 * Runs the full ingestion pipeline (all 5 chains) from a trusted residential
 * network and mirrors the merged result to a GitHub Gist, so the deployed
 * site never has to talk to any chain's API directly — it just reads one
 * JSON file. This supersedes scripts/scrapeMovieland.mjs (which only mirrored
 * one chain): every provider benefits from running on a residential IP —
 * faster, and immune to per-chain bot-protection/IP-reputation issues, not
 * just Movieland's.
 *
 * Setup (reuses the same Gist from scripts/scrapeMovieland.mjs if you already
 * set that up — no need to create a second one):
 *   1. Create a GitHub Personal Access Token with the "gist" scope:
 *      https://github.com/settings/tokens (classic token is fine).
 *   2. Create a Gist (or reuse the existing one) with a file named
 *      `dataset.json` containing `{}` as a placeholder. Note its id from the
 *      URL (https://gist.github.com/<user>/<GIST_ID>).
 *   3. Set two environment variables before running this script:
 *        DATASET_GIST_ID=<the gist id>
 *        DATASET_GIST_TOKEN=<the personal access token>
 *      (Already have MOVIELAND_GIST_ID / MOVIELAND_GIST_TOKEN set up from the
 *      Movieland-only mirror? Those work here too as a fallback — no need to
 *      duplicate them.)
 *   4. Run it once manually to confirm it works:
 *        npx tsx scripts/scrapeAll.ts
 *   5. Schedule it to run once a day (Windows Task Scheduler) instead of (or
 *      alongside — it's harmless either way) scrapeMovieland.mjs.
 *   6. On Vercel, set DATASET_MIRROR_URL to this gist file's raw URL:
 *        https://gist.githubusercontent.com/<user>/<GIST_ID>/raw/dataset.json
 *      (that path with no revision hash always serves the latest update.)
 *      This replaces MOVIELAND_MIRROR_URL — once DATASET_MIRROR_URL is set,
 *      the deployed app skips live ingestion entirely and just reads the
 *      mirror, so MOVIELAND_MIRROR_URL is no longer consulted.
 */

import { runIngestion } from "@/lib/ingestion";

const GIST_FILENAME = "dataset.json";

const gistId = process.env.DATASET_GIST_ID ?? process.env.MOVIELAND_GIST_ID;
const gistToken = process.env.DATASET_GIST_TOKEN ?? process.env.MOVIELAND_GIST_TOKEN;

if (!gistId || !gistToken) {
  console.error(
    "Missing DATASET_GIST_ID/DATASET_GIST_TOKEN (or the older MOVIELAND_GIST_ID/MOVIELAND_GIST_TOKEN). See the header of this file for setup steps.",
  );
  process.exit(1);
}

async function updateGist(content: unknown) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${gistToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      files: {
        [GIST_FILENAME]: { content: JSON.stringify(content) },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub Gist update failed: HTTP ${res.status} ${body}`);
  }
}

(async () => {
  const startedAt = Date.now();
  console.log(`[${new Date().toISOString()}] Running full ingestion (all chains, forceFresh)...`);

  const { dataset, results, validationWarnings } = await runIngestion({ forceFresh: true });

  for (const r of results) {
    const status = r.success ? "ok" : "FAILED";
    console.log(`  ${r.providerName}: ${status} — ${r.moviesImported} movies, ${r.screeningsImported} screenings${r.errors.length ? ` — ${r.errors.join("; ")}` : ""}`);
  }

  const payload = {
    dataset,
    results,
    validationWarnings,
    generatedAt: new Date().toISOString(),
  };

  console.log(`Ingestion done in ${Date.now() - startedAt}ms. Updating gist ${gistId}...`);
  await updateGist(payload);
  console.log(`Done in ${Date.now() - startedAt}ms total.`);
})().catch((err) => {
  console.error("scrapeAll failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
