# Bot Defense & Adaptive Rate Limiting Strategy

## 1. Threat Model
- Automated review submissions flooding the platform with spam or skewed ratings.
- Credential stuffing or scripted browsing attempting to harvest review analytics.
- API scraping of property dashboards, resulting in governor limit exhaustion.
- Coordinated attacks distributing traffic across accounts/devices to bypass static limits.

## 2. Detection Layers
1. **Telemetry Collection**
   - Emit Platform Events (e.g., `Review_Request__e`) containing user Id, session Id, hashed IP/UA, capability type (submit review, load analytics card), timestamp.
   - Persist aggregate counters in `Review_Request_Log__c` (custom object) keyed by user/device/time window for behavioural analytics.

2. **Heuristic + ML Scoring**
   - Extend `ReviewFraudService` with velocity-based scoring (submissions per minute/hour, property switching) and text anomaly signals.
   - Optionally integrate external bot detection APIs (reCAPTCHA Enterprise, Cloudflare Turnstile) via Named Credentials + `BotDefenseGateway` Apex.

3. **Policy Metadata**
   - Maintain thresholds in `BotDefensePolicy__mdt` with fields `Capability__c`, `MaxPerMinute__c`, `MaxPerHour__c`, `ChallengeScore__c`, `BlockScore__c`, `BurstMultiplier__c`.
   - Support environment-specific configurations through separate custom metadata records.

## 3. Enforcement Architecture
- Introduce `BotDefenseService.evaluateRequest(capability, userId, deviceFingerprint)` that:
  1. Loads policy settings.
  2. Retrieves recent metrics via `RequestMetricsAggregator` (Platform Cache + fallback to request log).
  3. Calls `ReviewFraudService.computeBotScore(metrics)`.
  4. Returns decision `{ allow, score, action (ALLOW/CHALLENGE/BLOCK/THROTTLE), reason }`.
- Controllers/LWCs call `BotDefenseService` before executing critical actions (review submit, analytics load). Depending on action:
  - **ALLOW**: continue.
  - **CHALLENGE**: surface CAPTCHA/2FA challenge; require success to proceed.
  - **BLOCK**: deny request and inform user.
  - **THROTTLE**: enqueue request or ask user to retry after backoff.
- Publish `BotDefenseDecision__e` Platform Event for monitoring.

## 4. Adaptive Rate Limiting
- Compute dynamic limit `limit = baseline + burstMultiplier * currentLoadIndex` where `currentLoadIndex` derives from:
  - Active sessions (`Review_Request_Log__c` rollups).
  - Event Monitoring metrics (Logins, URI requests) if licensed.
- Adjust Platform Cache TTLs and thresholds automatically during spikes.
- Track challenge success/failure to adjust scoring weights.

## 5. Behavioural Analytics Dashboard
- Build `ReviewSecurityDashboard` LWC to visualize:
  - Request volume by capability (stacked chart).
  - Block/challenge ratios.
  - Top offending accounts/IP hashes.
  - Response effectiveness over time.
- Feed data from `BotDefenseDecision__e` and `Review_Request_Log__c` via Apex aggregate queries and Platform Cache.

## 6. Implementation Steps (Phase 1)
1. **Metadata & Schema**
   - Create `BotDefensePolicy__mdt` and `Review_Request_Log__c` (API access, indexed fields `User__c`, `Device_Fingerprint__c`, `Window_Start__c`).
2. **Apex Services**
   - `BotDefenseService` (decision engine).
   - `RequestMetricsAggregator` (records request, computes rolling averages; stores small JSON in Platform Cache).
   - Update `ReviewFraudService` with `computeBotScore(RequestMetrics)` that weighs velocity, sentiment mismatch, duplicate signatures.
3. **UI/Controller Integration**
   - Wrap review submission (`PropertyController.createReview`) with bot evaluation and challenge flow.
   - Add reCAPTCHA v3 token validation endpoint (`CaptchaVerificationService`).
   - For analytics LWCs, add lazy loading + throttle messaging when decision != ALLOW.
4. **Monitoring & Alerting**
   - Use Salesforce Flow or Apex trigger on `BotDefenseDecision__e` to notify Security Ops (Slack/email) when block rate exceeds threshold.
   - Store aggregate stats daily for trend analysis.
5. **Testing**
   - Apex unit tests for decision logic (policy variations, metrics extremes).
   - Load test in sandbox using automated scripts to simulate attack scenarios.

## 7. Future Enhancements
- Integrate Shield Event Monitoring for precise IP/session tracking.
- Feed request metrics into Einstein Discovery or external ML model for improved scoring.
- Introduce progressive customer verification (email/SMS step-up) for repeated challenges.
- Consider CDN/WAF fronting Experience Cloud sites for edge-level filtering.

> This plan stays within Salesforce governor limits while combining metadata-driven policies, behaviour analytics, and adaptive rate limiting to guard review workloads against bot-driven abuse.
