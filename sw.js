// Service worker: deixa o app abrir rápido e funcionar offline.
const VERSAO = 'tp-v3.1';
const ARQUIVOS = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/app.js', './js/config.js', './js/store.js', './js/parser.js', './js/analise.js', './js/extrato.js',
  './js/categorias.js', './js/graficos.js', './js/tema.js', './js/util.js',
  './js/telas/inicio.js', './js/telas/lancamentos.js', './js/telas/painel.js', './js/telas/metas.js',
  './js/telas/registro.js', './js/telas/anexos.js', './js/vendor/supabase-2.118.0.js',
  './icons/icon.svg', './icons/logo.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Rede primeiro (pega atualizações), cache se estiver offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone();
        caches.open(VERSAO).then((c) => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  );
});
