# Premium Review Monetization Blueprint

## Goals
- Offer premium placement for select reviews with clear sponsorship disclosure.
- Provide sponsors with summarized insights while maintaining data integrity.
- Integrate advertising placements into review experiences without compromising trust.

## 1. Product Principles
1. **Transparency**: Sponsored content must be visually distinct and labeled.
2. **No Algorithm Manipulation**: Organic reviews remain sortable by relevance/date; premium slots are additive.
3. **User Control**: Give users the option to hide sponsored sections.
4. **Compliance**: Align with FTC/ASA advertising disclosure standards; store audit logs of placements.

## 2. Feature Set Overview
### Premium Review Placement
- Highlight up to N sponsored reviews pinned atop review lists.
- Distinct styling (e.g., `Sponsored Review` badge, different background).
- Data model: `Review_Sponsorship__c` linking `Property_Review__c` with sponsor details, campaign dates, budget.
- Business rules: enforce rating threshold, cap per property, auto-expire after campaign end.

### Sponsored Insights
- Curated analytics card ("Sponsored Market Insight") generated from aggregated review data—never raw comments.
- `Sponsored_Insight__c` storing summary text, CTA, sponsor metadata.
- Display on dashboards with clear sponsor label and "Why am I seeing this?" link explaining selection.

### Advertising Integration
- Slot definitions embedded in LWC layout (e.g., inline card between organic reviews, sidebar slot).
- Support Salesforce Advertising Studio or external ad networks via iFrame/Lightning Web Runtime with sandboxed restrictions.
- Consent management: respect user ad preferences stored in `UserPrivacyPreference__c`.

## 3. Architecture Components
| Layer | New/Updated Assets | Notes |
| --- | --- | --- |
| Data | `Review_Sponsorship__c`, `Sponsored_Insight__c`, `Ad_Slot_Config__mdt` | Manage placements & campaigns. |
| Apex | `SponsorshipService`, `SponsoredInsightService`, `AdSlotService` | Fetch and enforce business rules. |
| LWC | `sponsoredReviewRibbon`, `sponsoredInsightCard`, `reviewAdSlot` | Render with disclosures and toggles. |
| Compliance | `SponsorshipAudit__c` (optional) | Log impressions/clicks and disclosure acknowledgements. |

## 4. UX Considerations
- Sponsored reviews use distinct styling with `Sponsored` badge + accessible tooltip.
- Provide "Why sponsored?" modal explaining selection criteria and sponsor identity.
- Allow users to collapse sponsored sections (persist preference per user).
- Keep organic review ordering unaffected apart from pinned sponsored block.

## 5. Implementation Steps
1. **Data Layer**
   - Create custom objects with validation rules (disclosure text required, active dates).
   - Build approval process for new sponsorship records.
2. **Apex Services**
   - `SponsorshipService.getSponsoredReviews(propertyId)` returning DTOs limited by campaign cap.
   - `SponsoredInsightService.getActiveInsights(propertyId)`.
   - `AdSlotService.getSlots(context)` referencing `Ad_Slot_Config__mdt`.
3. **LWC Updates**
   - Insert `<c-sponsored-review-ribbon>` above organic reviews; component handles disclosure text and hide toggle.
   - Add `<c-sponsored-insight-card>` to `propertyComparisonDashboard`.
   - Implement `<c-review-ad-slot>` for inline/sidebar creative, using sanitised HTML or Lightning Web Runtime for ads.
4. **Tracking & Transparency**
   - Emit `SponsoredContentEvent__e` for impressions/clicks; surface in compliance dashboards.
   - Provide `aria-label` and visible text disclosing sponsorship.
   - Offer user settings to manage sponsored content visibility; default to enabled with opt-out.
5. **Governance**
   - Document policies; ensure legal review before campaign launch.
   - Auto-disable sponsored content if review flagged by moderation service.

## 6. Safeguards
- Limit sponsored placements per session to avoid overload.
- Respect user privacy/ad opt-out flags.
- Maintain audit logs for regulatory enquiries.

## 7. Next Steps
1. Define objects/metadata in source.
2. Implement Apex services + unit tests.
3. Build LWCs with disclosure-first design and analytics tracking.
4. Pilot with internal campaigns before external rollout.
