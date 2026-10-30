const CACHE_NAME = "bloomodoro-cache-v20";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./core/focus-core.mjs",
  "./garden/garden-core.mjs",
  "./garden/garden-ui.mjs",
  "./ui/game-shell.mjs",
  "./garden/pixel-world.mjs",
  "./garden/world-map.mjs",
  "./garden/tile-atlas.mjs",
  "./garden/minimap.mjs",
  "./garden/companion-ai.mjs",
  "./garden/companion-art.mjs",
  "./garden/plant-art.mjs",
  "./garden/ecology.mjs",
  "./garden/wildlife-art.mjs",
  "./garden/life-core.mjs",
  "./garden/avatar-art.mjs",
  "./garden/avatar-motion.mjs",
  "./garden/hires-avatar.mjs",
  "./garden/hires-companions.mjs",
  "./garden/hires-atlas.mjs",
  "./garden/raster-art.mjs",
  "./garden/avatar-rig.mjs",
  "./garden/avatar-rig-data.mjs",
  "./garden/painted-art.mjs",
  "./garden/painted-art-data.mjs",
  "./assets/art/avatar/manifest.json",
  "./assets/art/avatar/base/idle-down.png",
  "./assets/art/avatar/base/walk-right.png",
  "./assets/art/avatar/base/surprised-down.png",
  "./assets/art/avatar/portraits/portrait.webp",
  // Phase 4G painted rig parts (needed offline for the player character). Other
  // painted art is cached on first view by the stale-while-revalidate handler.
  "./assets/art/avatar/back/bag.webp",
  "./assets/art/avatar/back/cape.webp",
  "./assets/art/avatar/back/capelet.webp",
  "./assets/art/avatar/back/forearm_left.webp",
  "./assets/art/avatar/back/forearm_right.webp",
  "./assets/art/avatar/back/head.webp",
  "./assets/art/avatar/back/leg_left.webp",
  "./assets/art/avatar/back/leg_right.webp",
  "./assets/art/avatar/back/neck.webp",
  "./assets/art/avatar/back/skirt.webp",
  "./assets/art/avatar/back/sleeve_left.webp",
  "./assets/art/avatar/back/sleeve_right.webp",
  "./assets/art/avatar/back/torso.webp",
  "./assets/art/avatar/boots/back_left.webp",
  "./assets/art/avatar/boots/back_right.webp",
  "./assets/art/avatar/boots/front_left.webp",
  "./assets/art/avatar/boots/front_right.webp",
  "./assets/art/avatar/boots/side_far.webp",
  "./assets/art/avatar/boots/side_near.webp",
  "./assets/art/avatar/expressions/head_blink.webp",
  "./assets/art/avatar/expressions/head_focused.webp",
  "./assets/art/avatar/expressions/head_halfblink.webp",
  "./assets/art/avatar/expressions/head_happy.webp",
  "./assets/art/avatar/expressions/head_neutral.webp",
  "./assets/art/avatar/expressions/head_surprised.webp",
  "./assets/art/avatar/front/bag.webp",
  "./assets/art/avatar/front/cape.webp",
  "./assets/art/avatar/front/capelet.webp",
  "./assets/art/avatar/front/forearm_left.webp",
  "./assets/art/avatar/front/forearm_right.webp",
  "./assets/art/avatar/front/hair_back.webp",
  "./assets/art/avatar/front/head.webp",
  "./assets/art/avatar/front/neck.webp",
  "./assets/art/avatar/front/skirt.webp",
  "./assets/art/avatar/front/sleeve_left.webp",
  "./assets/art/avatar/front/sleeve_right.webp",
  "./assets/art/avatar/front/thigh_left.webp",
  "./assets/art/avatar/front/thigh_right.webp",
  "./assets/art/avatar/front/torso.webp",
  "./assets/art/avatar/side/arm_far.webp",
  "./assets/art/avatar/side/arm_near.webp",
  "./assets/art/avatar/side/bag.webp",
  "./assets/art/avatar/side/cape.webp",
  "./assets/art/avatar/side/capelet.webp",
  "./assets/art/avatar/side/hair_back.webp",
  "./assets/art/avatar/side/head.webp",
  "./assets/art/avatar/side/head_blink.webp",
  "./assets/art/avatar/side/neck.webp",
  "./assets/art/avatar/side/skirt.webp",
  "./assets/art/avatar/side/thigh_far.webp",
  "./assets/art/avatar/side/thigh_near.webp",
  "./assets/art/avatar/side/torso.webp",
  "./ui/b-theme.css",
  "./assets/fonts/fonts.css",
  "./assets/art/ui/icons/garden.webp",
  "./assets/art/ui/icons/focus.webp",
  "./assets/art/ui/icons/records.webp",
  "./assets/art/ui/icons/settings.webp",
  "./assets/art/ui/icons/time_points.webp",
  "./assets/art/avatar/portraits/focus_reading.webp",
  "./ui/flower-ornament.svg",
  "./garden/garden.css",
  "./keepalive.mp3",
  "./timer-worker.js",
  "./manifest.webmanifest",
  "./icons/world-mark.svg",
  "./icons/bloomodoro-b.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkResponse = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkResponse;
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const targetUrl = event.notification?.data?.url || "./";
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client;
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
