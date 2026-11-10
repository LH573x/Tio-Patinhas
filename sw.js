// Service worker: deixa o app abrir rápido e funcionar offline.
const VERSAO = 'tp-v4.2';
const ARQUIVOS = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/app.js', './js/config.js', './js/store.js', './js/parser.js', './js/analise.js', './js/extrato.js',
  './js/categorias.js', './js/graficos.js', './js/tema.js', './js/util.js',
  './js/telas/inicio.js', './js/telas/lancamentos.js', './js/telas/painel.js', './js/telas/metas.js',
  './js/telas/registro.js', './js/telas/anexos.js', './js/telas/contas.js', './js/telas/cartoes.js', './js/telas/alertas.js', './js/telas/revisar.js', './js/vendor/supabase-2.118.0.js',
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

// Arquivos que nunca mudam no mesmo endereço (biblioteca com versão no nome, ícones): direto do cache.
const FIXOS = /\/js\/vendor\/|\/icons\//;

function guardar(req, resp) {
  if (resp && resp.ok) {
    const copia = resp.clone();
    caches.open(VERSAO).then((c) => c.put(req, copia));
  }
  return resp;
}

// O resto: rede primeiro (pega atualizações), mas se a rede demorar mais de
// 2,5 s (sinal fraco) abre com a cópia guardada e atualiza em segundo plano.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (FIXOS.test(new URL(req.url).pathname)) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((resp) => guardar(req, resp))));
    return;
  }
  const rede = fetch(req).then((resp) => guardar(req, resp));
  e.waitUntil(rede.catch(() => {}));
  e.respondWith(new Promise((resolve) => {
    let respondeu = false;
    const responder = (r) => { if (!respondeu && r) { respondeu = true; resolve(r); } };
    const doCache = () => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html') : null));
    const timer = setTimeout(() => doCache().then(responder), 2500);
    rede.then((r) => { clearTimeout(timer); responder(r); })
      .catch(() => { clearTimeout(timer); doCache().then((r) => responder(r || Response.error())); });
  }));
});
