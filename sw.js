const CACHE = 'edvoice-v1';
const ASSETS = [
	'./',
	'./index.html',
	'./styles.css',
	'./app.js',
	'./data/courses.js'
];

self.addEventListener('install', (e) => {
	e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});
self.addEventListener('activate', (e) => {
	e.waitUntil(
		caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
	);
});
self.addEventListener('fetch', (e) => {
	const url = new URL(e.request.url);
	if (url.origin === location.origin) {
		e.respondWith(
			caches.match(e.request).then((res) => res || fetch(e.request).then((r) => {
				const rClone = r.clone();
				caches.open(CACHE).then((c) => c.put(e.request, rClone));
				return r;
			}))
		);
	}
});

