# Predictive Maintenance Intelligence Blueprint

## Objective
Use AI analysis of review text, sentiment trends, and historical repairs to predict upcoming maintenance issues, recommend proactive improvements, and alert property managers before service disruptions occur.

## Capabilities
1. **Issue Prediction**
   - NLP model classifies review comments into maintenance categories (HVAC, plumbing, appliances, structural, cleanliness).
   - Time-series analysis estimates probability of future issue recurrence based on frequency, severity, and sentiment drift.

2. **Recommendation Engine**
   - Suggest targeted improvements (replace aging appliances, increase housekeeping frequency) with potential ROI.
   - Prioritize actions based on risk score, cost, and guest impact.

3. **Proactive Alerts**
   - Trigger notifications (email, in-app) when predicted risk crosses thresholds (e.g., 70% probability of HVAC failure in next month).
   - Surface alerts in maintenance dashboard with recommended actions and supporting review evidence.

## Architecture
- **Apex Layer**: `MaintenancePredictionService` aggregates review data, calls AI provider (LLM/Einstein) via Named Credential, and generates `MaintenancePrediction__c` records.
- **Data Model**:
  - `MaintenancePrediction__c` (Property, Category, RiskScore, Confidence, RecommendedAction, Evidence, PredictedWindowStart/End).
  - `MaintenanceAlert__c` (links to Prediction, Status, NotificationSent, Owner).
- **Batch/Scheduled Job**: Nightly scan to update predictions per property, optionally incremental on new reviews.
- **UI**: LWC `maintenancePredictionPanel` showing top risks, actions, and ability to acknowledge or create work orders.
- **Integration Hooks**: Optionally push high-risk issues into existing CMMS/Service Cloud workflows.

## Implementation Steps
1. Create metadata for new custom objects (`MaintenancePrediction__c`, `MaintenanceAlert__c`).
2. Build `MaintenancePredictionService.analyzeProperty(propertyId)` returning predictions using ReviewInsightService + AI provider stub.
3. Develop batch job `MaintenancePredictionJob` to iterate properties.
4. Create LWC `maintenancePredictionPanel` (table/cards) with filter by category and status.
5. Add alert notifications via Platform Events or email when risk > threshold.
6. Instrument property dashboards to display predictions next to sentiment evolution.

## Next Steps (Implementation)
1. **AI Provider Integration**
   - Replace keyword heuristics with call to `MaintenanceAIAssistant` class that invokes Named Credential (stubbed if provider unavailable).
   - Handle provider errors gracefully and log raw responses for auditing.

2. **Scheduled Execution**
   - Create `MaintenancePredictionBatch` (Database.Batchable) to process properties in batches.
   - Add `MaintenancePredictionScheduler` implementing `Schedulable` to run batch nightly.
   - Include Platform Event or email notifications when new high-risk predictions created.

3. **UI Integration**
   - Embed `maintenancePredictionPanel` into `propertyReview` or dashboard LWC, passing `activePropertyId`.
   - Add acknowledgement flow (button sets status to Actioned/Dismissed).

4. **Alerts & Permissions**
   - Update permission set to include new objects/classes; add email template or Platform Event definition for alerts.
   - Provide automation (Flow/Process) to notify owners when `MaintenanceAlert__c.NotificationSent__c` is false and risk high.

5. **Testing & Monitoring**
   - Apex unit tests covering service, batch, alert creation, and status changes.
   - Jest tests for panel UI interactions.
