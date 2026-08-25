const CACHE_NAME = 'dea-simulador-v3';
const RECURSOS_A_CACHEAR = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './img/logo.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(RECURSOS_A_CACHEAR))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nombresDeCache) => {
      return Promise.all(
        nombresDeCache.map((nombre) => {
          if (nombre !== CACHE_NAME) return caches.delete(nombre);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evento) => {
  evento.respondWith(
    caches.match(evento.request).then((respuesta) => respuesta || fetch(evento.request))
  );
});