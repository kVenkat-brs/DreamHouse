# Review Security Hardening Blueprint

## Objectives
- Enforce least-privilege access for all review operations.
- Apply micro-segmentation to isolate reviewer, moderator, analytics, and integration contexts.
- Introduce continuous authentication signals before sensitive actions.

## 1. Access Inventory
| Capability | Current Components | Recommended Access | Notes |
| --- | --- | --- | --- |
| Submit Review | `PropertyController.savePropertyReview` (LWC) | Authenticated community users with `Review_Submitter` perm set | Ensure rate limiting + CAPTCHA (see BotDefenseStrategy). |
| Moderate Review | `ReviewModerationService`, custom LWCs | Internal staff only (`Review_Moderator` perm set) | Require MFA + transaction PIN for destructive actions. |
| View Analytics | `propertyComparisonDashboard`, analytics services | Internal analysts (`Review_Analyst` perm set) | Provide read-only rights; deny raw comment export. |
| API/Integration | `ReviewCRMIntegrationService`, `ReviewAggregationService` | Integration user with scoped permission set | Use Named Credentials with JWT/OAuth and IP restrictions. |

## 2. Micro-Segmentation Approach
- Create dedicated **Permission Sets**: `Review_Submitter`, `Review_Moderator`, `Review_Analyst`, `Review_Integration`.
- Use **Permission Set Groups** for composite roles (e.g., `Review_Operations` = Moderator + Analyst minus submit).
- Restrict each set to only required custom objects/fields:
  - Submitter: create on `Property_Review__c`, no access to moderation/dispute objects.
  - Moderator: read/write `Property_Review__c`, `Review_Dispute__c`, `Shared_Review_Session__c`, plus audit fields.
  - Analyst: read on aggregates (`Review_Aggregate__c`), no delete rights.
  - Integration: API-enabled user, read/write as required, locked to integration profile.
- Apply **Org-Wide Defaults** of Private for review objects; share via apex-managed sharing or implicit community sharing for submitters.

## 3. Continuous Authentication Controls
1. **Session Context Evaluation**
   - Store login risk score in `User.SessionRiskScore__c` (updated via Login Flow or external identity provider).
   - Before invoking sensitive operations (moderation, bulk export), call `ContinuousAuthService.evaluate(userId, requiredLevel)`.
2. **Lightning Component Guard**
   - LWC mixin `withContinuousAuth` verifying session freshness and prompting for MFA when `evaluate()` returns `CHALLENGE`.
3. **Transaction Security Policies**
   - Create TSP rules (requires Event Monitoring) to enforce IP/Device restrictions and trigger step-up auth for anomalous requests.

## 4. Least-Privilege Implementation Steps
1. **Metadata**
   - Define new Permission Sets (see Appendix A for template) granting minimal CRUD/FLS.
   - Update `dreamhouse.permissionset-meta.xml` to remove broad review access; assign via Permission Set Groups.
2. **Apex Guards**
   - Add helper `ReviewSecurityService.requireCapability(Capability cap)` verifying current user’s permission set (Custom Metadata mapping).
   - Use `WITH SECURITY_ENFORCED` on SOQL (already introduced in recent updates).
   - Deny fallback paths in controllers when user lacks capability, logging via `ReviewSecurityEvent__e` Platform Event.
3. **Shared Data Isolation**
   - For community sites, disable `View All Users` and restrict data row-level access using Sharing Rules vs. apex-managed sharing tokens.
   - Use **Customer Community Plus** license features if per-record sharing is needed.
4. **Continuous Auth Service Stub**
   ```apex
   public with sharing class ContinuousAuthService {
       public enum Decision { Allow, Challenge, Block }
       public static Decision evaluate(Id userId, String capability) {
           // TODO: integrate with Identity Provider / Session Risk API
           return Decision.Allow;
       }
   }
   ```
   - Controllers check decision and surface challenge UI when required.

## 5. Monitoring & Audit
- Log all review mutations via **Platform Events** or **Field Audit Trail** (enable for `Property_Review__c` critical fields).
- Use **Einstein Data Detect** or 3rd-party CASB to ensure access policies remain effective.
- Schedule monthly access review: export Permission Set assignments, validate least-privilege.

## 6. Compliance Alignment
- Document micro-segmentation and step-up auth in privacy/security runbooks.
- Ensure DSAR/erasure processes respect new permission boundaries.
- Combine with Shield encryption (see ShieldEncryption.md) for defense-in-depth.

## Appendix A – Permission Set Template (example)
```xml
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Property_Review__c.Comment__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Property_Review__c</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>APIEnabled</name>
    </userPermissions>
</PermissionSet>
```

> Implement changes iteratively: start with permission set refactor, add ContinuousAuthService integration, then enforce TSP/device posture for high-risk operations.
