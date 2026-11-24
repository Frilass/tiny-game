// Offline cache for Slime Pit.
//
// Online loads are network-first: a fresh response replaces the cache entry,
// and a failed network read falls back to that entry so offline play still works.
// CACHE_NAME is bumped so activate() drops the previous cache and an
// installed phone reloads onto this version. slime-pit-v4 is the
// floor-and-run update.
// Add new URLs to FILES_TO_CACHE so the first install can play offline
// before each file has been requested on its own.
// Paths are relative to this script, which keeps GitHub Pages subpaths working.

const CACHE_NAME = "slime-pit-v4";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./style.css",
    "./manifest.json",
    "./favicon.ico",
    "./js/enemies.js",
    "./js/upgrades.js",
    "./js/save.js",
    "./js/render.js",
    "./js/game.js",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(FILES_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim()).then(() => {
            // The open page was painted by the previous worker. Reload it
            // after activate finishes. Waiting on navigate() here deadlocks
            // WebKit: the new load cannot finish until this worker is active,
            // and activate would be waiting on that load. activate runs once
            // per worker version, so later visits are not reloaded.
            return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
                setTimeout(() => {
                    windows.forEach((client) => {
                        if (typeof client.navigate === "function") {
                            client.navigate(client.url);
                        }
                    });
                }, 50);
            });
        })
    );
});

function offlineResponse() {
    return new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain" }
    });
}

function isWorkerScript(url) {
    return url.pathname.endsWith("/service-worker.js");
}

// Bypass the browser's HTTP cache. GitHub Pages marks assets fresh for
// several minutes, and the previous stylesheet was what made the new page
// look like a single huge Reset button.
function freshFetch(request) {
    // A navigation Request rejects a new cache mode, so reload those by URL.
    // Subresources can take the cache mode directly. Either way the HTTP
    // cache is not allowed to answer.
    if (request.mode === "navigate") {
        return fetch(request.url, { cache: "reload", credentials: "same-origin" });
    }
    return fetch(request, { cache: "reload" });
}

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") {
        return;
    }

    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin || isWorkerScript(url)) {
        return;
    }

    event.respondWith(
        freshFetch(event.request).then((response) => {
            if (response && response.ok && response.type === "basic") {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    return cache.put(event.request, copy);
                }).catch(() => {});
            }
            return response;
        }).catch(() => {
            return caches.match(event.request).then((cached) => {
                if (cached) {
                    return cached;
                }
                if (event.request.mode === "navigate") {
                    return caches.match("./index.html").then((page) => {
                        return page || caches.match("./").then((root) => root || offlineResponse());
                    });
                }
                return offlineResponse();
            });
        })
    );
});
