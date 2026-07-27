/**
 * FILENAME: sw-staging-nocache.js
 * CREATED: 2026-07-27
 * MODIFIED: 2026-07-27
 * STATUS: active
 * PURPOSE: Staging-only service worker — network-first, clear caches, no stale shell.
 * WORKFLOW: Registered by staging HTML (dashboard/home/verify). Scope /website/staging/.
 * NOTES: Alice 2026-07-27 granted temporary cache disable for ops. Do not ship as permanent
 *   production apex policy without review. Hashed assets still network-first under staging.
 */
/* eslint-disable no-restricted-globals */
const SW_VERSION = "asx-staging-nocache-20260727T1819Z-nocache";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

/** Always network; never cache. Fail closed to network error (visible) rather than stale. */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Only handle staging channel paths
  if (!url.pathname.includes("/website/staging/")) return;
  event.respondWith(
    fetch(req, { cache: "no-store" }).catch(() =>
      new Response("ASX staging network-only SW: offline or blocked", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    )
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "ASX_SKIP_WAITING") self.skipWaiting();
  if (event.data === "ASX_CLEAR_CACHES") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});
