// Offline cache for Slime Pit.
//
// Bump CACHE_NAME whenever a shipped file changes, and add any new file
// to FILES_TO_CACHE. activate() deletes caches that are not this name,
// so an updated worker drops the previous version.
// Paths are relative to this script, which keeps GitHub Pages subpaths working.

const CACHE_NAME = "slime-pit-v1";

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
        }).then(() => self.clients.claim())
    );
});

function offlineResponse() {
    return new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain" }
    });
}

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) {
                return cached;
            }
            return fetch(event.request).catch(() => {
                if (event.request.mode === "navigate") {
                    return caches.match("./index.html").then((page) => {
                        return page || offlineResponse();
                    });
                }
                return offlineResponse();
            });
        })
    );
});
