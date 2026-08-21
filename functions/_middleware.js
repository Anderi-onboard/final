/* Keep the internal files off the public site.
 *
 * ⚠️ `_redirects` cannot do this, and for weeks it looked like it was.
 *
 * Cloudflare Pages serves a matching static asset FIRST and only falls through
 * to `_redirects` when nothing matches. Every path in that blocklist is a file
 * that exists in the deployed tree, so the rule never fired. Measured against
 * production on 2026-08-21, all of these answered 200 with their real content:
 *
 *   /PROGRESS.md  /CLAUDE.md  /ARCHITECTURE.md  /OVERVIEW.md  /AUDIT-*.md
 *   /RELEASES.md  /palette-guide.html  /palette-overview.html
 *   /tests/*  /scripts/*  /tools/*  /schema.sql
 *
 * The two entries that did return 404 — /eval/* and /copywriting/*.md — are
 * the two whose files are not deployed at all. The list only ever "worked" on
 * things that were not there. That is the tell: a guard that passes exactly
 * where it is not needed is not running.
 *
 * Functions run BEFORE static asset resolution, so this is the layer that can
 * actually intercept. `next()` hands anything not on the list to the normal
 * asset pipeline, so the site is unaffected.
 *
 * Not exposed, and worth stating because it is the thing that would matter:
 * `functions/**` is compiled by Pages rather than served as files, so the
 * prompt engine, the D1 helpers and the model proxy were never reachable —
 * verified 404 on all three.
 *
 * The test for this list is unchanged: is the file a map of where this site is
 * weak, or an internal working document? If yes, it 404s. Keep `_redirects` in
 * step so the two do not disagree, but treat THIS file as the one that runs. */

const BLOCKED = [
  /^\/PROGRESS\.md$/i,
  /^\/CLAUDE\.md$/i,
  /^\/ARCHITECTURE\.md$/i,
  /^\/OVERVIEW\.md$/i,
  /^\/RELEASES\.md$/i,
  /^\/BRAND_VOICE\.md$/i,
  /^\/README\.md$/i,
  /^\/AUDIT-[^/]*\.md$/i,
  /^\/schema\.sql$/i,
  /^\/package(-lock)?\.json$/i,
  /^\/wrangler\.toml$/i,
  /^\/palette-guide\.html$/i,
  /^\/palette-overview\.html$/i,
  /^\/baoxianghua-compositions\.html$/i,
  /^\/(tests|scripts|tools|eval|artifacts|copywriting|qa)(\/|$)/i,
  /^\/\.(git|env|dev\.vars)/i
];

export async function onRequest(context) {
  const path = new URL(context.request.url).pathname;

  if (BLOCKED.some((re) => re.test(path))) {
    /* Serve the site's own 404 so a probe cannot tell "blocked" from "absent".
       If that fetch fails for any reason, fall back to a bare 404 — this guard
       must never depend on another asset resolving in order to deny. */
    try {
      const res = await context.env.ASSETS.fetch(
        new Request(new URL('/404.html', context.request.url), context.request)
      );
      return new Response(res.body, {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' }
      });
    } catch (e) {
      return new Response('Not found', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' }
      });
    }
  }

  return context.next();
}
