// Lightweight IndexedDB wrapper for offline review storage.
// Note: window.indexedDB is unavailable in SSR contexts; guard at call sites.

const DB_NAME = 'reviewOfflineDB';
const DB_VERSION = 1;
const STORES = {
    REVIEWS: 'reviews',
    DRAFTS: 'drafts',
    QUEUE: 'queue'
};

let dbPromise;

function openDb() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORES.REVIEWS)) {
                    db.createObjectStore(STORES.REVIEWS, { keyPath: 'propertyId' });
                }
                if (!db.objectStoreNames.contains(STORES.DRAFTS)) {
                    db.createObjectStore(STORES.DRAFTS, { keyPath: 'draftId' });
                }
                if (!db.objectStoreNames.contains(STORES.QUEUE)) {
                    db.createObjectStore(STORES.QUEUE, { keyPath: 'queueId', autoIncrement: true });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    return dbPromise;
}

async function withStore(storeName, mode, callback) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const result = callback(store);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
    });
}

export async function cacheReviews(propertyId, payload) {
    if (!propertyId || !payload) return;
    await withStore(STORES.REVIEWS, 'readwrite', (store) => {
        store.put({ propertyId, data: payload, fetchedAt: Date.now() });
    });
}

export async function getCachedReviews(propertyId) {
    if (!propertyId) return null;
    return withStore(STORES.REVIEWS, 'readonly', (store) => store.get(propertyId));
}

export async function saveDraft(draft) {
    if (!draft || !draft.draftId) return;
    await withStore(STORES.DRAFTS, 'readwrite', (store) => {
        store.put({ ...draft, updatedAt: Date.now() });
    });
}

export async function getDrafts(propertyId) {
    return withStore(STORES.DRAFTS, 'readonly', (store) => {
        return new Promise((resolve) => {
            const drafts = [];
            const request = store.openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    if (!propertyId || cursor.value.propertyId === propertyId) {
                        drafts.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(drafts);
                }
            };
        });
    });
}

export async function removeDraft(draftId) {
    if (!draftId) return;
    await withStore(STORES.DRAFTS, 'readwrite', (store) => store.delete(draftId));
}

export async function queueSubmission(entry) {
    await withStore(STORES.QUEUE, 'readwrite', (store) => {
        store.add({ ...entry, createdAt: Date.now(), state: 'pending' });
    });
}

export async function getQueue() {
    return withStore(STORES.QUEUE, 'readonly', (store) => {
        return new Promise((resolve) => {
            const items = [];
            const request = store.openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    items.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(items);
                }
            };
        });
    });
}

export async function clearQueueItem(queueId) {
    if (!queueId) return;
    await withStore(STORES.QUEUE, 'readwrite', (store) => store.delete(queueId));
}

export async function updateQueueState(queueId, updates) {
    if (!queueId) return;
    await withStore(STORES.QUEUE, 'readwrite', (store) => {
        const request = store.get(queueId);
        request.onsuccess = () => {
            const record = request.result;
            store.put({ ...record, ...updates, updatedAt: Date.now() });
        };
    });
}
