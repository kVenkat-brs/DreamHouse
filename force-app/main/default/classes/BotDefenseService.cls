public with sharing class BotDefenseService {
    public class Decision {
        @AuraEnabled public Boolean allow;
        @AuraEnabled public Decimal score;
        @AuraEnabled public String action;
        @AuraEnabled public String reason;
    }

    public enum Capability {
        ReviewSubmit,
        ReviewAnalyticsView
    }

    private static final String CACHE_PREFIX = 'BOTDECISION_';

    public static Decision evaluateRequest(Capability capability, Id userId, String deviceFingerprint) {
        Decision decision = new Decision();
        decision.allow = true;
        decision.score = 0;
        decision.action = 'ALLOW';
        decision.reason = 'Default allow';

        return decision;
    }
}
