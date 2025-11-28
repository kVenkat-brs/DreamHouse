# White-Label Review Platform Blueprint

## Objectives
Enable partner businesses to embed the DreamHouse review system under their own branding, domains, and feature configurations while ensuring DreamHouse retains data governance and compliance.

## 1. Tenant Model
- Introduce `Review_Tenant__c` representing each white-label customer with fields:
  - `DisplayName__c`, `PrimaryDomain__c`, `FallbackDomain__c`
  - Brand assets: `LogoUrl__c`, `PrimaryColor__c`, `SecondaryColor__c`, `FontStack__c`
  - Feature toggles (booleans or JSON) for modules (analytics, submission, moderation visibility).
  - Data ownership contact and legal terms acknowledgement.
- Map tenant to org data via `Property__c.Tenant__c` or `Property_Tenant__c` junction to scope reviews.
- Provide tenant-specific API keys / client IDs for embedding.

## 2. Branding & Theming
- Add theming layer for LWCs:
  - `BrandingService.getBranding(tenantId)` returns CSS variables, logos, copy overrides.
  - `reviewShell` LWC applies CSS vars (`--brand-primary`, etc.) and loads tenant logo.
- Support custom copy/localization via Custom Metadata (`Tenant_Label__mdt` mapping keys to localized strings).
- Enable custom favicons/og tags via Experience Builder site or Lightning Web Runtime host app.

## 3. Domain & Hosting
- Use **Salesforce Experience Cloud** with custom domain per tenant (via Site.com and Domain Management) or Lightning Web Runtime deployed to partner domain.
- For embedded widgets, supply LWR pack (`<c-review-embed>`) that accepts `tenant` param and loads assets from CDN.
- Implement CORS/Clickjack protections per tenant domain list.

## 4. Feature Configuration
- Custom Metadata `Tenant_Feature__mdt` controlling availability:
  - `allowReviewSubmission`, `showAnalytics`, `showAds`, `enableModerationPortal`, `enableProAnalytics`, etc.
- `FeatureToggleService.isEnabled(tenantId, feature)` used by controllers/LWCs to hide/show functionality.
- Provide admin UI (`tenantAdminApp`) for DreamHouse staff to adjust feature sets with audit logging.

## 5. Data Ownership & Segregation
- All reviews stored in shared org but scoped by `Tenant__c` lookups to enforce segmentation.
- Use Apex managed sharing or ownership-based sharing rules so tenants access only their data.
- Expose APIs/exports scoped to tenant (REST endpoints require tenant token).
- Maintain master copies of data; tenants receive usage rights via contract.

## 6. Compliance & Governance
- Each tenant must sign data processing agreement (recorded on `Review_Tenant__c`).
- Implement per-tenant encryption preferences (some may require BYOK).
- Provide audit trail (access logs, exports) per tenant; consider Field Audit Trail for cross-tenant compliance.
- Ensure sponsored content/ads obey tenant policy; toggles disable monetization modules when not licensed.

## 7. Implementation Steps
1. **Data Modeling**
   - Create `Review_Tenant__c`, `Tenant_Feature__mdt`, `Tenant_Label__mdt`.
   - Update `Property__c`, `Property_Review__c` to relate to tenant.
2. **Branding Engine**
   - Implement `BrandingService` returning theme DTO.
   - Update review LWCs to consume branding (CSS vars, logos).
   - Provide fallback theme for default DreamHouse brand.
3. **Embedding SDK**
   - Build LWR micro-frontend (or web components) for partners.
   - Provide initialization script `DreamhouseReview.init({ tenantId, targetElement, features })`.
4. **Security & Access**
   - Enforce tenant scoping in Apex using `TenantContext.getCurrentTenant()`.
   - Add domain allow lists / CORS entries.
   - Provide OAuth scopes for tenant integrations.
5. **Admin & Provisioning**
   - Create internal admin app to onboard new tenants: create record, upload branding assets, assign features, configure domains.
   - Automate certificate + domain provisioning (via Deployment scripts or manual process documented).
6. **Monitoring**
   - Per-tenant analytics dashboards (usage, errors, SLA).
   - Alerts if tenant traffic spikes or integration errors occur.

## 8. Future Enhancements
- Multi-region deployment for tenants with data residency requirements.
- Self-service provisioning portal for partners.
- Usage-based billing integration.
- White-labeled mobile SDK for iOS/Android.

## 9. Next Steps
1. Secure stakeholder approval on data model & branding approach.
2. Begin metadata modeling and theming engine updates.
3. Prototype embedded widget with sample tenant theme.
4. Develop onboarding playbook and legal documentation.
