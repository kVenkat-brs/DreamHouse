/* eslint-disable no-restricted-globals */
const CACHE_NAME = 'review-cache-v1';
const API_CACHE = 'review-api-v1';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll([
            '/lightning/lightning.out.js'
        ]))
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method === 'GET') {
        if (request.url.includes('PropertyController.getPropertyReviews')) {
            event.respondWith(networkFirst(request));
            return;
        }
        event.respondWith(cacheFirst(request));
    }

    if (request.method === 'POST' && request.url.includes('PropertyController.savePropertyReview')) {
        event.respondWith(queuePost(request));
    }
});

async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
        return cached;
    }
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
}

async function networkFirst(request) {
    const cache = await caches.open(API_CACHE);
    try {
        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        throw error;
    }
}

async function queuePost(request) {
    try {
        const response = await fetch(request.clone());
        return response;
    } catch (error) {
        const body = await request.clone().json();
        const db = await openQueue();
        const tx = db.transaction('queue', 'readwrite');
        tx.objectStore('queue').add({
            createdAt: Date.now(),
            request: {
                url: request.url,
                body,
                headers: Array.from(request.headers.entries())
            }
        });
        await tx.complete;
        return new Response(JSON.stringify({ status: 'queued' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 202
        });
    }
}

function openQueue() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('reviewOfflineDB', 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('queue')) {
                db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

self.addEventListener('sync', (event) => {
    if (event.tag === 'review-sync') {
        event.waitUntil(processQueue());
    }
});

async function processQueue() {
    const db = await openQueue();
    const tx = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    const items = await store.getAll();
    for (const item of items) {
        try {
            await fetch(item.request.url, {
                method: 'POST',
                headers: new Headers(item.request.headers),
                body: JSON.stringify(item.request.body)
            });
            store.delete(item.id);
        } catch (error) {
            console.error('Sync failed', error);
        }
    }
    await tx.complete;
}
