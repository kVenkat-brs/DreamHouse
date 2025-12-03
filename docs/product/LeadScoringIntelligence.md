# Intelligent Lead Scoring Blueprint

## Objective
Build a lead scoring engine that leverages review engagement signals, referral tracking, and marketing automation integrations to prioritize high-value prospects for sales and marketing teams.

## 1. Data Inputs
- **Review Engagement**
  - Views, likes, helpful votes, comment submissions per user.
  - Time on property review pages, return visits.
  - Sentiment alignment (positive engagement vs negative comments).
- **Referral Tracking**
  - Referral sources captured via UTM parameters, affiliate IDs, partner campaigns.
  - "Share" actions from review components (copy link, social share, email share).
  - Conversion attribution (lead created/opportunity from referral).
- **Marketing Automation Signals**
  - Email interactions (opens, clicks) via Marketing Cloud/Pardot.
  - Journey status, nurture stage, propensity scores.
  - Event attendance, webinar participation.

## 2. Data Model Extensions
- `Lead_Engagement__c`: captures per-lead metrics (views, likes, shares, last interaction).
- `Referral_Event__c`: logs referral actions with metadata (source, medium, campaign, property).
- `Lead_Score__c`: stores calculated score components + total.
- External integrations via Named Credentials to marketing automation for additional activity data.

## 3. Scoring Framework
- Weighted scoring model combining:
  - Engagement score (0-50): review views, likes, comments, time on page.
  - Referral score (0-30): referrals generated, conversions, viral coefficient.
  - Marketing score (0-20): email engagement, campaign interactions, segmentation fit.
- Decay function reducing score over time without activity.
- Thresholds mapping to lead status (Hot, Warm, Cold) with recommended sales actions.
- Custom Metadata `LeadScoreWeight__mdt` to adjust weights per business unit/tenant.

## 4. Processing Pipeline
- Trigger review engagement logging via Platform Events (`ReviewEngagementEvent__e`).
- Batch/Queueable job aggregates events into `Lead_Engagement__c` daily (EWM smoothing).
- Scoring job `LeadScoringBatch` calculates totals, writes to `Lead_Score__c`, updates Lead/Contact fields (e.g., `Intelligent_Score__c`).
- Process builder/Flow triggers alerting when score crosses threshold (notify AE, add to campaign).

## 5. CRM & Marketing Automation Integration
- Sync scores to Salesforce Leads/Contacts for reporting and assignment rules.
- Push high-score leads to Marketing Cloud/Pardot segments via REST API (Named Credential).
- Pull nurture data from Marketing Cloud journeys to adjust scores (bidirectional sync).
- Optionally integrate with external MAP (HubSpot, Marketo) using middleware or direct API calls.

## 6. Analytics & Reporting
- Dashboards showing lead score distribution, top engaged leads, referral performance.
- Attribution reports linking review engagement to closed opportunities.
- A/B testing on scoring weights via Custom Metadata snapshots.

## 7. Implementation Steps
1. **Data Capture**
   - Instrument review components to emit `ReviewEngagementEvent__e` with user/lead IDs.
   - Add referral tracking to share buttons, capturing UTM/campaign data.
2. **Data Model & Metadata**
   - Create custom objects (`Lead_Engagement__c`, `Referral_Event__c`, `Lead_Score__c`).
   - Define Custom Metadata for weights and decay parameters.
3. **Apex Services**
   - `LeadEngagementAggregator` (queueable) to roll up events.
   - `LeadScoringService` executing weighted calculations, applying decay, updating Lead records.
   - `MarketingAutomationSyncService` for push/pull with MAP.
4. **Automation & Alerting**
   - Flow/Process builder to assign tasks/notify reps for Hot leads.
   - Einstein Next Best Action (optional) to recommend follow-ups.
5. **Testing & Iteration**
   - Unit tests covering scoring logic and integration stubs.
   - Measure predictive accuracy; iterate weights using historical conversion data.

## 8. Governance
- Ensure data privacy compliance (handle PII in events, honor opt-out preferences).
- Provide admin UI to adjust scoring weights and view audit logs.
- Document lead scoring methodology for sales/marketing teams.

## 9. Next Steps
1. Validate data availability (link between review engagement and CRM leads).
2. Model custom objects/metadata in sandbox.
3. Implement scoring service with sample weights.
4. Pilot with select sales team, gather feedback, adjust thresholds.
