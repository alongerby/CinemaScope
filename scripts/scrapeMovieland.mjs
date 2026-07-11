#!/usr/bin/env node
/**
 * Mirrors Movieland's public showtimes JSON to a GitHub Gist, run on a
 * schedule from a residential machine (e.g. Windows Task Scheduler once a
 * day). Movieland's `/api/Events` sits behind a Cloudflare Managed Challenge
 * that gates almost entirely on IP/ASN reputation — cloud hosting ranges
 * (Vercel, Netlify, etc.) get challenged/blocked no matter what headers are
 * sent, while a residential IP passes straight through. So instead of
 * fighting that from the deployed site, this script does the one real fetch
 * from a trusted network each day and republishes the result somewhere the
 * deployed site *can* read from without hitting Movieland directly.
 *
 * Setup:
 *   1. Create a GitHub Personal Access Token with the "gist" scope:
 *      https://github.com/settings/tokens (classic token is fine).
 *   2. Create a new Gist (public or secret, doesn't matter — this is public
 *      showtime data) with one file named `movieland-events.json` containing
 *      `[]` as a placeholder. Note its id from the URL
 *      (https://gist.github.com/<user>/<GIST_ID>).
 *   3. Set two environment variables before running this script:
 *        MOVIELAND_GIST_ID=<the gist id>
 *        MOVIELAND_GIST_TOKEN=<the personal access token>
 *   4. Run it once manually to confirm it works:
 *        node scripts/scrapeMovieland.mjs
 *   5. Schedule it to run once a day (Windows Task Scheduler: Action = "node",
 *      Arguments = the full path to this file, with the two env vars set on
 *      the task, e.g. via a wrapping .bat file that sets them then calls node).
 *   6. On Vercel, set MOVIELAND_MIRROR_URL to this gist file's raw URL:
 *        https://gist.githubusercontent.com/<user>/<GIST_ID>/raw/movieland-events.json
 *      (that path with no revision hash always serves the latest update.)
 */

const HOST = "https://www.movieland.co.il";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const GIST_FILENAME = "movieland-events.json";

const gistId = process.env.MOVIELAND_GIST_ID;
const gistToken = process.env.MOVIELAND_GIST_TOKEN;

if (!gistId || !gistToken) {
  console.error("Missing MOVIELAND_GIST_ID and/or MOVIELAND_GIST_TOKEN environment variables. See the header of this file for setup steps.");
  process.exit(1);
}

async function fetchMovielandEvents() {
  const res = await fetch(`${HOST}/api/Events`, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": USER_AGENT,
      "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
      Referer: `${HOST}/`,
      Origin: HOST,
    },
  });
  if (!res.ok) throw new Error(`Movieland responded HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Unexpected response shape (expected an array of movies).");
  return data;
}

async function updateGist(content) {
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
  try {
    console.log(`[${new Date().toISOString()}] Fetching Movieland events...`);
    const events = await fetchMovielandEvents();
    console.log(`Fetched ${events.length} movies. Updating gist ${gistId}...`);
    await updateGist(events);
    console.log(`Done in ${Date.now() - startedAt}ms.`);
  } catch (err) {
    console.error(`Failed after ${Date.now() - startedAt}ms:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();
