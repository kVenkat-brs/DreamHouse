# Review Performance & Scalability Roadmap

## Current Pain Points
- Analytics services (word cloud, sentiment insights, impact) perform synchronous SOQL across entire review history per request.
- No server-side caching; repeated dashboard visits trigger duplicate computations.
- Large comment fields complicate filtering once encrypted, limiting deterministic indexes.

## Strategy Overview
1. **Layered Caching**
   - **Platform Cache (Session/Org)**: cache aggregated review DTOs per property + timeframe.
   - **Custom Metadata TTLs**: define freshness windows (e.g., 15 min for analytics).
   - **Async precomputation**: schedule `Queueable` jobs to refresh heavy analytics outside user flow.

2. **Query Optimization**
   - Replace full history scans with incremental aggregates stored in `Review_Aggregate__c` (property, period, metrics JSON, Last_Refreshed__c).
   - Use selective filters (date range, property) and indexed fields; avoid `LIKE` on encrypted text.
   - Leverage `COUNT()` and `GROUP BY` to reduce round trips, then join aggregated results with precomputed metadata.

3. **Lazy Loading in UI**
   - Split dashboards into tabbed/accordion sections; load expensive cards (word cloud, statistics, segmentation) only when expanded.
   - Implement `lightning-spinner` states tied to child component load events; use `@wire` with `refreshApex` for manual reload.

4. **High-Volume Architecture**
   - Introduce `ReviewAnalyticsCacheService` Apex facade:
     - `getWordCloud(propertyId, days)` first checks Platform Cache, then falls back to analytics service.
     - `getStatistics(...)` and other analytics follow same pattern.
     - Cache invalidation triggered by Platform Events or after review insert/update via trigger.
   - Keep raw review ingest minimal: asynchronous processing (Platform Event → Queueable) updates aggregates and caches.
   - For millions of rows, consider `Big Objects` (`Property_Review_History__b`) storing immutable reviews with asynchronous querying (SOQL on big objects).

5. **Compliance & Encryption Compatibility**
   - Ensure caching layer stores only aggregate metrics, never raw comments.
   - Use `Crypto` utilities for hashed keys if property IDs are sensitive; avoid caching encrypted payloads outside Shield-managed storage.

## Implementation Steps
1. **Create Aggregates**
   - Custom object `Review_Aggregate__c` (Property, Period, Metrics JSON, Last_Refreshed__c).
   - Apex batch/queueable `ReviewAggregateJob` to populate metrics nightly.

2. **Add Caching Service**
   ```apex
   public with sharing class ReviewAnalyticsCacheService {
       private static final Integer TTL_SECONDS = 900;

       public static List<ReviewWordCloudService.WordCloudEntry> getWordCloud(Id propertyId, Integer days) {
           String cacheKey = 'WC_' + propertyId + '_' + days;
           List<ReviewWordCloudService.WordCloudEntry> cached = (List<ReviewWordCloudService.WordCloudEntry>)PlatformCacheUtil.get(cacheKey);
           if (cached != null) {
               return cached;
           }
           List<ReviewWordCloudService.WordCloudEntry> fresh = ReviewWordCloudService.buildWordCloud(propertyId, days);
           PlatformCacheUtil.put(cacheKey, fresh, TTL_SECONDS);
           return fresh;
       }
   }
   ```
   - Implement `PlatformCacheUtil` wrapper handling session/org cache fallback + serialisation guarding.

3. **Trigger Invalidation**
   - Update `Property_Review__c` trigger to publish `ReviewAnalyticsRefresh__e` Platform Event after commit.
   - Subscribe Queueable job to invalidate affected cache keys and refresh aggregates asynchronously.

4. **UI Lazy Loading**
   - Wrap heavy LWC cards in `<template if:true={isWordCloudVisible}>`; toggle on `onactive` from `lightning-tab` or custom section expansion.
   - Ensure child components expose `@api loadData()` to defer fetching until invoked.

5. **Performance Testing**
   - Seed Performance Test Org with > 5M reviews (scripted data generator).
   - Use **Apex Test Execution** and **Lightning Test Service (LTS)** for load testing; capture metrics in Performance Test Plan.
   - Monitor via **Salesforce Performance Profiler**, **Event Monitoring (QueryUsage)**, and custom debug logs.

6. **Monitoring**
   - Add custom metrics (Platform Events) recording cache hit ratio and average computation time.
   - Build dashboard in **Salesforce Performance Manager** or external observability (New Relic) for latency tracking.

## Risks & Mitigations
- **Cache Staleness**: mitigate via short TTL + invalidation events.
- **Governor Limits**: ensure asynchronous jobs batch heavy processing; use continuations if needed for external services.
- **Encryption**: never store decrypted comments outside Shield-managed context; aggregate before caching.
- **Deployment Complexity**: feature-toggle caching via Custom Metadata to allow progressive rollout.

## Deliverables
- New Apex services (`ReviewAnalyticsCacheService`, `PlatformCacheUtil`).
- Custom object & metadata for aggregates.
- Updated LWCs with lazy loading.
- Performance regression scripts + documentation.

## Next Steps
1. Implement `PlatformCacheUtil` and caching facade.
2. Create aggregate custom object + batch job skeleton.
3. Update `propertyComparisonDashboard` to lazy-load analytic cards, invoking caches.
4. Draft automated performance test plan.
