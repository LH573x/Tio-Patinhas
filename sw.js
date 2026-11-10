// Service worker: deixa o app abrir rápido e funcionar offline.
const VERSAO = 'tp-v4.9';
const ARQUIVOS = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/app.js', './js/config.js', './js/store.js', './js/parser.js', './js/analise.js', './js/extrato.js',
  './js/categorias.js', './js/graficos.js', './js/tema.js', './js/util.js',
  './js/telas/inicio.js', './js/telas/lancamentos.js', './js/telas/painel.js', './js/telas/metas.js',
  './js/telas/registro.js', './js/telas/anexos.js', './js/telas/contas.js', './js/telas/cartoes.js', './js/telas/alertas.js', './js/telas/revisar.js', './js/telas/assessor.js', './js/telas/lembrancas.js', './js/assessor.js', './js/mascote.js', './js/vendor/supabase-2.118.0.js',
  './icons/icon.svg', './icons/logo.svg', './icons/mascote.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];

// Instala a versão inteira de uma vez. O "?v=" fura o cache de 10 min do GitHub Pages,
// para a versão nova não guardar arquivos velhos.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => Promise.all(ARQUIVOS.map(async (u) => {
    const resp = await fetch(new Request(`${u}${u.includes('?') ? '&' : '?'}v=${VERSAO}`, { cache: 'reload' }));
    if (!resp.ok) throw new Error(`${u}: ${resp.status}`);
    await c.put(u, resp);
  }))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Abre direto da cópia guardada (sem esperar a internet a cada arquivo). Versão nova chega
// quando este sw.js muda (VERSAO): o app procura ao abrir e recarrega sozinho.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    const guardado = req.mode === 'navigate'
      ? await cache.match('./index.html')
      : await cache.match(req, { ignoreSearch: true });
    if (guardado) return guardado;
    try {
      const resp = await fetch(req);
      if (resp.ok && new URL(req.url).search === '') cache.put(req, resp.clone());
      return resp;
    } catch (err) {
      return Response.error();
    }
  })());
});
