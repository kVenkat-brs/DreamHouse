# Professional Analytics Subscription Blueprint

## Vision
Deliver a paid analytics tier for power users (brokers, investors, asset managers) featuring competitor benchmarking, predictive insights, and custom reporting while protecting proprietary data.

## 1. Offering Structure
| Tier | Audience | Key Features | Pricing Model |
| --- | --- | --- | --- |
| Core (existing) | Public/homebuyers | Standard reviews, basic analytics | Free |
| Pro Analytics | Professionals | Competitor benchmarks, predictive insights, custom reports, API access | Subscription (monthly/annual) |

## 2. Entitlement Model
- Introduce `Analytics_Subscription__c` (Account-level) capturing plan type, seats, expiration.
- Map users to subscriptions via junction `User_Analytics_Subscription__c` or Permission Set Group assignment.
- Permission Sets:
  - `Analytics_Pro_User`: grants access to pro dashboards, API endpoints, export capabilities.
  - `Analytics_Admin`: manage subscriptions, generate invoices.
- Gate analytics Apex methods using `SubscriptionGuard.hasAccess(userId, feature)` with Custom Metadata enumerating feature flags per tier.

## 3. Advanced Features
### Competitor Benchmarking
- Expand `ReviewComparisonService` to include multi-property benchmarking, percentile ranks, market averages.
- Add `Competitor_Profile__c` storing competitor clusters with anonymized metrics.
- LWC: `proBenchmarkDashboard` showing heat maps, radar charts, exportable tables.

### Predictive Insights
- Use existing `ReviewInsightService` + extend with predictive models (e.g., regression on occupancy, price appreciation).
- Add `PredictiveInsightService` returning forecasts (5/10 year scenarios) and risk scores.
- Display via `proPredictiveInsights` LWC with ability to adjust assumptions (sliders).

### Custom Reporting
- Provide report builder UI using saved configurations:
  - `Analytics_Report_Template__c` (JSON config of metrics, filters, visualization type).
  - `Analytics_Report_Run__c` storing generated results, accessible for download (CSV/PDF).
- Enable scheduled email delivery for Pro subscribers.

## 4. Platform Components
| Layer | Assets |
| --- | --- |
| Data | `Analytics_Subscription__c`, `User_Analytics_Subscription__c`, `Competitor_Profile__c`, `Analytics_Report_*__c` |
| Apex | `SubscriptionGuard`, `CompetitorBenchmarkService`, `PredictiveInsightService`, `CustomReportService` |
| LWC | `proAnalyticsHub`, `proBenchmarkDashboard`, `proPredictiveInsights`, `proReportBuilder` |
| Integration | Optional billing integration via Named Credentials (Stripe, Salesforce Billing) |
| Compliance | `SubscriptionAudit__c` for license events, data export logs |

## 5. UX Flow
1. Pro users land on `proAnalyticsHub` with tier badge, usage summary, quick links.
2. Benchmark card shows key metrics (rank vs competitors, sentiment delta, volume trends).
3. Predictive card provides scenario sliders and forecast graphs (confidence intervals).
4. Custom report builder allows selecting metrics, groupings, export format; saves templates per user/team.
5. Non-subscribers see upsell dialog with feature comparison and CTA to upgrade.

## 6. Access Control & Monetization
- Use Permission Set Groups assigned via subscription record trigger or provisioning job.
- Build upgrade flow integrated with Checkout: LWC collects billing -> call out to payment service -> create subscription record.
- Add usage tracking (Platform Events) for benchmarking queries and report generation to enforce fair use limits.

## 7. Implementation Steps
1. Data Modeling & Entitlements
   - Create custom objects and permission sets.
   - Implement `SubscriptionGuard` with unit tests.
2. Feature Development
   - Extend existing services for benchmarking and predictions.
   - Develop Pro LWCs with lazy loading and virtualization for large datasets.
   - Implement report builder (Apex + LWC) with export functionality.
3. Billing Integration (Phase 2)
   - Hook into payment provider, handle invoices, renewals, cancellations.
4. Launch Readiness
   - Add telemetry dashboards for subscription metrics (MRR, churn).
   - Provide documentation/training, update pricing pages.

## 8. Safeguards & Trust
- Clearly label Pro-only analytics; ensure data anonymization for competitor metrics.
- Enforce row-level visibility (only aggregated competitor data unless explicit permission).
- Provide pro users with data usage logs and ability to export their own analytics history.
- Include opt-out controls for sharing anonymized data in benchmarking.

## 9. Next Steps
1. Secure stakeholder approval on pricing & feature scope.
2. Begin metadata modeling (custom objects, permission sets).
3. Implement `SubscriptionGuard` stub and integrate into existing analytics controllers.
4. Prototype `proBenchmarkDashboard` using sample data.
