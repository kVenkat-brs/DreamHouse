# Coordinated Review Manipulation Detection Blueprint

## Objective
Detect and visualize coordinated review manipulation campaigns spanning multiple accounts, properties, and platforms. Identify suspicious clusters, relationships, and temporal patterns indicative of organized fraud.

## Key Capabilities
1. **Reviewer Graph Construction**
   - Build bipartite graph of reviewers and properties, augmented with edges for shared IPs, devices, language patterns.
   - Track reviewer-to-reviewer similarity (shared wording, synchronized posting times) and property overlap.

2. **Community Detection & Scoring**
   - Apply graph algorithms: connected components, modularity-based clustering, PageRank/centrality to highlight hubs.
   - Compute coordinated risk score per cluster, factoring volume, sentiment exaggeration, timing bursts, device/IP reuse.

3. **Event Timeline & Alerts**
   - Detect rapid bursts of positive/negative reviews across multiple properties within short windows.
   - Trigger alerts when clusters exceed thresholds (size, score ± sentiment skew) or target competitive properties.

4. **Visualization & Investigation Tools**
   - Dashboard `fraudNetworkExplorer` LWC: graph view, cluster list, property/reviewer detail, timeline heatmaps.
   - Allow analysts to flag clusters, export evidence, and initiate remediation (mark reviews suspicious, notify compliance).

## Architecture Overview
- **Apex Services**
  - `FraudNetworkService.buildNetwork(propertyIds, lookbackDays)` returns graph DTO (nodes, edges, cluster metadata).
  - `FraudNetworkService.detectCampaigns(propertyIds)` identifies active campaigns, generates alerts.
  - `FraudCampaign__c` custom object for persistent campaigns (score, properties impacted, reviewers involved, status).
- **Data Sources**
  - `Property_Review__c`, reviewer metadata (email hash, IP/device logs if available), sentiment/time-series aggregates.
  - External feeds (if integrated) for IP reputation or known fraud rings.

## Implementation Steps
1. Create metadata for `FraudCampaign__c` (properties, reviewers, score, detectionDate, status, notes).
2. Implement `FraudNetworkService` with helper classes:
   - `ReviewerNode`, `PropertyNode`, `Edge`, `ClusterSummary`.
   - Similarity scoring (text fingerprint overlap, time deltas, rating deltas).
   - Graph algorithms (Union-Find for components, score aggregation).
3. Add `FraudCampaignAlert__c` or reuse existing alert object to notify compliance when campaign detected.
4. Build LWC `fraudNetworkExplorer` for visual analysis; integrate Chart.js/D3 for graphs.
5. Extend `ReviewFraudService` to store suspicious cluster ID on review records (for cross-referencing).
6. Integrate with dashboards and add automation (Flows) to escalate high-risk clusters.

## Future Enhancements
- Machine learning for anomaly detection (graph embeddings, unsupervised clustering).
- Integration with external fraud intelligence and identity verification services.
- Automated remediation (auto-flag reviews, request revalidation) once cluster confirmed.
