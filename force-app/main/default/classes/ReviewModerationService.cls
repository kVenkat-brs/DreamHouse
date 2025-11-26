public with sharing class ReviewModerationService {
    public class ModerationResult {
        @AuraEnabled public Boolean flagged;
        @AuraEnabled public Decimal confidence;
        @AuraEnabled public List<String> reasons;
        @AuraEnabled public Boolean escalate;
    }

    private static final List<String> BLOCKED_PHRASES = new List<String>{
        'hate speech', 'violent threat', 'personal attack', 'abuse'
    };
    private static final List<String> PERSONAL_DATA_PATTERNS = new List<String>{
        '\\b\d{3}-\d{2}-\d{4}\\b', // SSN pattern
        '\\b\d{10}\\b', // Phone
        '\\b\d{3}-\d{3}-\\d{4}\\b'
    };

    @AuraEnabled
    public static ModerationResult moderate(String text) {
        ModerationResult result = new ModerationResult();
        result.flagged = false;
        result.confidence = 0;
        result.reasons = new List<String>();
        result.escalate = false;

        if (String.isBlank(text)) {
            return result;
        }

        String lower = text.toLowerCase();
        Decimal severity = 0;

        for (String phrase : BLOCKED_PHRASES) {
            if (lower.contains(phrase)) {
                result.flagged = true;
                result.reasons.add('Policy violation: ' + phrase);
                severity += 0.4;
            }
        }

        for (String pattern : PERSONAL_DATA_PATTERNS) {
            if (Pattern.compile(pattern).matcher(text).find()) {
                result.flagged = true;
                result.reasons.add('Personal data exposure detected');
                severity += 0.3;
            }
        }

        if (containsProfanity(lower)) {
            result.flagged = true;
            result.reasons.add('Profanity detected');
            severity += 0.2;
        }

        if (mentionsViolence(lower)) {
            result.flagged = true;
            result.reasons.add('Violent language detected');
            severity += 0.3;
        }

        if (!result.flagged) {
            result.confidence = 0;
            return result;
        }

        result.confidence = Math.min(1, severity);
        result.escalate = result.confidence >= 0.7;
        return result;
    }

    private static Boolean containsProfanity(String lower) {
        List<String> profanity = new List<String>{
            'damn', 'hell', 'idiot', 'stupid'
        };
        for (String word : profanity) {
            if (lower.contains(word)) {
                return true;
            }
        }
        return false;
    }

    private static Boolean mentionsViolence(String lower) {
        List<String> violence = new List<String>{
            'kill', 'hurt', 'threat', 'violence'
        };
        for (String term : violence) {
            if (lower.contains(term)) {
                return true;
            }
        }
        return false;
    }
}
