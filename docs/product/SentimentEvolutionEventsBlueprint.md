# Sentiment Evolution Tracking Blueprint

## Objective
Correlate shifts in review sentiment with key property events—improvements, management changes, or market conditions—to quantify impact and guide strategy.

## Core Concepts
1. **Event Catalog**
   - Track `Property_Event__c` records with fields: Type (Improvement, Management Change, Market Event), Start/End Dates, Description, Impacted Features, Expected Sentiment Outcome.
   - Feed data from project management, asset management, or external feeds (market news API) via integrations.

2. **Sentiment Time Series**
   - Generate rolling sentiment metrics (avg sentiment score, positive/neutral/negative counts, review volume) per property by week/month.
   - Leverage existing `SentimentService` batching; store aggregates in `Property_Sentiment_Snapshot__c` (fields: Property, PeriodStart, AvgScore, Pos/Neutral/Neg counts, Volume).

3. **Event Impact Analysis**
   - Apex `SentimentEvolutionService.compareBeforeAfter(propertyId, eventId, lookbackWindow, lookforwardWindow)` returning stats: delta sentiment, rating changes, volume shifts, key themes.
   - Calculate expected vs actual impact using event metadata; flag successes or areas needing attention.

4. **Visualization**
   - LWC `sentimentEvolutionTimeline` to plot sentiment over time with event markers (color/shape by type). Tooltip displays metrics + event details.
   - Filters for event types, sentiment metrics, comparison windows.

5. **Alerts & Insights**
   - Trigger alerts when sentiment fails to improve after high-investment events or drops sharply post market shocks.
   - Surface insights in dashboards (positive trend post renovation, negative dip after management switch, etc.).

## Data Model Additions
- `Property_Event__c`: Type, StartDate, EndDate, Cost, Notes, ExternalSource, ExpectedSentimentChange__c.
- `Property_Sentiment_Snapshot__c`: PeriodStart, PeriodType, AvgScore, PositiveCount, NeutralCount, NegativeCount, ReviewVolume, RollingAvgScore.

## Implementation Steps
1. Create custom objects metadata (property events, sentiment snapshots).
2. Extend `SentimentService` batch job to compute weekly/monthly snapshots, writing to snapshot object.
3. Implement `SentimentEvolutionService` with methods:
   - `getTimeline(propertyId, range)` returns snapshots and linked events.
   - `compareBeforeAfter(propertyId, eventId, lookbackWeeks, lookforwardWeeks)` returning metrics deltas and significance.
4. Build `sentimentEvolutionTimeline` LWC: charts, filters, event callouts, link to event details.
5. Integrate with `propertyReviewImpact` or analytics dashboard to show sentiment evolution panels.
6. Optionally add Einstein Discovery or ML to predict sentiment response to planned improvements.

## Future Enhancements
- Auto-ingest market events via external data providers (interest rates, economic indicators).
- Use geospatial layering to compare neighboring properties during market swings.
- Provide narrative explanations (LLM) summarizing sentiment changes per event.
