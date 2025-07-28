// service-worker.js
const CACHE_NAME = 'adventurequest-cache-v1';
const urlsToCache = [
    './index.html',
    './player-styles.css',
    './player-script.js',
    './player-supabase-config.js', // Shared config
    './manifest.json',
    './icon-192x192.png', // Añadido si no estaba
    // Las URLs de los CDNs no necesitan ser ajustadas por <base>
    'https://unpkg.com/@supabase/supabase-js@2',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
    // Puedes añadir aquí otras URLs de assets como imágenes o audios si sabes que serán estáticos
    // Por ejemplo: './icons/some-image.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                // Ajustar urlsToCache para que sean relativas a la raíz del repositorio para SW
                // Nota: Service Workers resuelven las rutas relativas a su propio scope URL
                // Si el SW está en /AdventureQuestPlayer/service-worker.js, './index.html'
                // se resuelve a /AdventureQuestPlayer/index.html. ¡Esto es correcto!
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', (event) => {
    // Para las llamadas a la API de Supabase o cualquier otra API externa,
    // y para las navegaciones, siempre intenta ir a la red primero.
    // Usamos el dominio de Supabase para identificar sus llamadas.
    if (event.request.url.includes('supabase.co/rest/v1') || event.request.mode === 'navigate') {
        event.respondWith(fetch(event.request));
        return; // No intentar cachear estas peticiones
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            // Si hay una respuesta en caché, la devolvemos.
            if (response) {
                return response;
            }
            // Si no está en caché, la buscamos en la red.
            return fetch(event.request).then(
                (response) => {
                    // Si la respuesta no es válida, la devolvemos sin cachear.
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    // IMPORTANTE: Clonar la respuesta. Una respuesta es un flujo y solo puede
                    // ser consumida una vez. La clonamos para poder enviarla al navegador
                    // y a la caché.
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                }
            );
        })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});