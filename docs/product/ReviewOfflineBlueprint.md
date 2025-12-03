# Review Offline Experience Blueprint

## Objectives
- Allow users to browse existing property reviews when offline.
- Enable drafting, editing, and managing reviews without connectivity.
- Synchronize offline work seamlessly once network access returns, handling conflicts gracefully.

## Key Capabilities
1. **Offline Reading**
   - Cache recently viewed property reviews via IndexedDB (per propertyId) with metadata (timestamp, version hash).
   - Provide offline availability indicators and last-sync timestamp.
   - Gracefully degrade UI with cached data and badge when operating offline.

2. **Offline Drafting**
   - Persist draft reviews locally (IndexedDB) keyed by propertyId + temporary draftId.
   - Auto-save drafts every 30s and on form blur.
   - Support attachments (images/video thumbnails) stored via Cache API or base64 payloads with file metadata.

3. **Offline Management**
   - Queue review submissions in local store when connection is down.
   - Track submission status (pending, syncing, failed) with retry/backoff once online.
   - Provide manual retry and cancellation controls.

4. **Intelligent Sync**
   - Detect connectivity via `navigator.onLine` / `connection` events and custom health pings.
   - On reconnect, batch pending operations: upload media, submit review payloads, refresh aggregated data.
   - Handle conflict resolution using server timestamps (if review already exists, prompt user).

## Architecture Overview
- **Client Cache**: IndexedDB via a thin wrapper (`reviewOfflineStore`) storing `reviews`, `drafts`, `queue` object stores.
- **Service Worker**: `reviewServiceWorker.js` caching API responses (`/PropertyController.getPropertyReviews`) and static assets. Intercepts POST to save queue when offline.
- **Sync Manager LWC Module**: Utility `reviewOfflineManager` exposing `saveDraft`, `loadDrafts`, `queueSubmission`, `syncPending`, `observeStatus` methods.
- **UI Components**: `propertyReview`, `visualReviewUploader`, `sharedReviewComposer` integrate with the manager for offline status, local reads, and queue operations.

## Data Model (IndexedDB Stores)
- `reviews`: { propertyId, data, fetchedAt }
- `drafts`: { draftId, propertyId, title, comment, rating, attachments, updatedAt }
- `queue`: { queueId, propertyId, payload, attachments, state, lastTriedAt, error }
- `meta`: global configuration, sync flags

## Sync Workflow
1. User loads property reviews online -> cache data.
2. User goes offline -> UI shows cached reviews + offline badge.
3. Draft form auto-saves to `drafts`. On submit offline, push to `queue` and show "Pending sync" status.
4. Connectivity restored -> Sync Manager processes queue sequentially, calling Apex endpoints. On success, remove from queue and refresh.

## Conflict Handling
- Use server-generated `lastModified` on reviews.
- If queued submission conflicts (duplicate, property changed), notify user and allow edit/resubmit.

## UI Enhancements
- Add offline status banner in `propertyReview`.
- Show queued submissions list with action buttons.
- Provide local draft selector for picking up where user left off.

## Next Steps
1. Build `reviewOfflineManager` utility (IndexedDB wrapper) + unit tests (Jest using fake-indexeddb).
2. Implement service worker script with cache strategies, integrate registration in `propertyReview` (replace placeholder).
3. Update `propertyReview` LWC to:
   - Load cached reviews in `connectedCallback` when offline.
   - Auto-save drafts via manager.
   - Queue submissions when offline.
4. Extend `visualReviewUploader` to store attachments offline and sync later.
5. Add sync status UI, offline badge, and manual retry button.
6. Provide documentation and deployment instructions for service worker resource.
