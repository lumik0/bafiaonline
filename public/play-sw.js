// Кэшируется только сама страница игры (чтобы она открывалась без сети): сначала сеть, при отсутствии связи - запомненная копия.
// Остальные файлы (код, картинки, анимации) идут напрямую: перехват каждого запроса замедляет игру на телефоне,
// а Safari к тому же усыпляет воркер, и каждый запрос после простоя ждёт его пробуждения.
const CACHE = "bafia-play-v2";

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.add("./play.html")));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  // только открытие страницы; всё остальное браузер грузит сам
  if(event.request.method != "GET" || event.request.mode != "navigate" || !event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if(response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached ?? caches.match("./play.html")))
  );
});
