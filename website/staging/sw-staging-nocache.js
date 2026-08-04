/**
 * FILENAME: sw-staging-nocache.js
 * CREATED: 2026-07-27
 * MODIFIED: 2026-07-27
 * STATUS: active
 * PURPOSE: Staging network-only SW — no Cache API storage; reload clients on activate.
 * WORKFLOW: Registered by staging HTML. Scope /website/staging/.
 * NOTES: Active ops — Alice wants seconds not hours. SW_VERSION stamped per deploy.
 */
/* eslint-disable no-restricted-globals */
const SW_VERSION = "asx-staging-nocache-20260804T022808Z-finish";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of list) {
        try {
          client.postMessage({ type: "ASX_STAGING_RELOAD", version: SW_VERSION });
        } catch (_) { /* ignore */ }
      }
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!url.pathname.includes("/website/staging/")) return;
  // Bypass HTTP cache entirely
  const bust = new Request(req, { cache: "reload" });
  event.respondWith(
    fetch(bust).catch(() =>
      fetch(req, { cache: "no-store" }).catch(
        () =>
          new Response("ASX staging network-only SW: offline", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
      )
    )
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "ASX_SKIP_WAITING" || (event.data && event.data.type === "ASX_SKIP_WAITING")) {
    self.skipWaiting();
  }
  if (event.data === "ASX_CLEAR_CACHES" || (event.data && event.data.type === "ASX_CLEAR_CACHES")) {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});
