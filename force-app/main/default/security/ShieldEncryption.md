# Shield Platform Encryption Configuration Blueprint

## Summary
This repository includes metadata and Apex that manipulate sensitive review data (`Property_Review__c.Comment__c`, moderation artifacts, dispute records). To support enterprise-grade encryption requirements and comply with global privacy laws (GDPR, CCPA/CPRA, PDPA, POPIA, LGPD), adopt Salesforce Shield Platform Encryption with managed key lifecycle, field-level encryption, and monitoring. This blueprint captures the org configuration steps; it does **not** activate encryption automatically in source control.

## 1. Prerequisites
- Salesforce Shield Platform Encryption licensed and provisioned.
- Designated Security Officer (SO) and Key Management Officer (KMO) with appropriate permissions.
- Inventory of integrations/reports that reference review comments to plan refactoring once fields are encrypted.

## 2. Sensitive Data Inventory
| Object / Field | Classification | Notes |
| --- | --- | --- |
| Property_Review__c.Comment__c | Restricted | Free-form text, may contain PII / PHI. |
| Shared_Review_Comment__c.Body__c | Restricted | Collaborative review drafts. |
| Review_Dispute__c.Description__c | Confidential | Dispute narratives. |
| Review_Archive__c.Archived_Body__c | Restricted | Archived comment copies. |
| ReviewModeration logs | Confidential | Moderation decisions & rationale. |

Update **Data Classification** metadata accordingly (Security → Data Classification).

## 3. Configure Shield Encryption
1. Navigate to **Setup → Security → Platform Encryption**.
2. Generate tenant secrets (HSM-backed) and enable key rotation cadence (e.g., 365 days).
3. Under **Key Management**, create deterministic keys for searchable fields (if needed) and probabilistic keys for long text.
4. In **Encrypt Fields**, enable encryption for:
   - `Property_Review__c.Comment__c`
   - `Shared_Review_Comment__c.Body__c`
   - `Review_Dispute__c.Description__c`
   - `Review_Archive__c.Archived_Body__c`
5. Choose encryption scheme:
   - Long text → Probabilistic AES-256.
   - Lookup/email/phone (if classified) → Deterministic.
6. Schedule encryption via **Encryption Health Check** after validating sandbox behavior.

## 4. Key Management & Rotation
- Assign KMO/SO roles and document approval workflow for key creation, rotation, and destruction.
- Enable **Bring Your Own Key (BYOK)** if corporate policy requires customer-controlled keys (Azure/AWS/GCP HSM).
- Configure alerting on key events with **Event Monitoring → Key Management Events**. Integrate with SIEM (Splunk/Sentinel).

## 5. Code & Integration Impact
Probabilistically encrypted fields cannot be filtered (no `LIKE`, `ORDER BY`). Review and update Apex/integration logic:
- `PropertyController.cls`
- `ReviewWordCloudService.cls`
- `ReviewHeatmapService.cls`
- `ReviewInsightService.cls`
- `ReviewImpactService.cls`
- `ReviewComparisonService.cls`
- `ReviewArchiveService.cls`
- `ReviewReportService.cls`
- Any ETL (Mulesoft, Informatica) exporting comments.

Refactoring patterns:
- Move search/filter use cases to **Einstein Search** or **Analytics** on decrypted datasets within Salesforce trust boundaries.
- For analytics (word clouds, sentiment), use Apex that operates on decrypted values server-side; avoid storing decrypted copies.
- Ensure Profile/Permission Set updates limit access to encrypted fields.

## 6. Compliance Alignment
- **GDPR**: maintain Records of Processing Activities, support Data Subject Access/Deletion (encryption assists pseudonymization but does not replace deletion).
- **CCPA/CPRA**: track opt-outs and ensure encrypted data is excluded from unauthorized sharing.
- **PDPA/POPIA/LGPD**: validate data residency; BYOK can satisfy localization requirements.
- Document encryption controls in your DPIA/PIA and security policies.

## 7. Testing & Validation
- Spin up a Full/Partial Sandbox with Shield enabled.
- Execute automated test suites (Apex & LWC) to confirm no encryption-related regressions.
- Validate reporting/analytics behavior (e.g., Lightning Reports, Tableau CRM).
- Confirm integrations gracefully handle encrypted payloads (base64/opaque) or adjust to use Platform Events/API proxies.

## 8. Monitoring & Incident Response
- Enable **Transaction Security Policies** to detect bulk export of encrypted fields.
- Subscribe to **Shield Encryption Event Monitoring** for audit logs.
- Maintain incident runbooks covering key compromise, decryption failures, regulatory notification timelines.

## 9. Documentation & Training
- Update SOPs for support teams interacting with encrypted fields (e.g., inability to filter by comment text).
- Provide training on request handling (DSAR, erasure) under encryption regimes.
- Note encryption status in customer-facing privacy notices when applicable.

## 10. Future Enhancements
- Evaluate **Field Audit Trail** for immutable history of encrypted data access.
- Implement **Heroku Shield Connect** if data needs to flow to external systems under Shield controls.
- Investigate **Client-Side Encryption** for mobile channels (Salesforce Mobile SDK).

> **Reminder**: Keys and org-level Shield settings are never stored in source control. Coordinate with your Salesforce Security team before enabling encryption to ensure compliance and operational readiness.
