public with sharing class ReviewComplianceService {
    public class ComplianceResult {
        @AuraEnabled public Boolean compliant;
        @AuraEnabled public Decimal confidence;
        @AuraEnabled public List<String> violations;
        @AuraEnabled public Boolean escalate;
    }

    @AuraEnabled
    public static ComplianceResult assessCompliance(String text) {
        ComplianceResult result = new ComplianceResult();
        result.compliant = true;
        result.confidence = 1;
        result.violations = new List<String>();
        result.escalate = false;

        if (String.isBlank(text)) {
            return result;
        }

        String lower = text.toLowerCase();

        if (violatesFairHousing(lower)) {
            result.compliant = false;
            result.violations.add('Potential fair housing violation');
            result.confidence -= 0.2;
            result.escalate = true;
        }

        if (containsDefamation(lower)) {
            result.compliant = false;
            result.violations.add('Possible defamation or unverifiable claim');
            result.confidence -= 0.2;
        }

        if (exposesPrivacy(lower)) {
            result.compliant = false;
            result.violations.add('Personal or private data exposed');
            result.confidence -= 0.1;
        }

        if (platformPolicyViolations(lower)) {
            result.compliant = false;
            result.violations.add('Platform content policy violation');
            result.confidence -= 0.1;
        }

        if (result.confidence < 0) {
            result.confidence = 0;
        }

        return result;
    }

    private static Boolean violatesFairHousing(String lower) {
        List<String> protectedTerms = new List<String>{
            'family status', 'race', 'religion', 'handicap', 'national origin', 'sex'};
        if (containsAny(lower, protectedTerms) && (lower.contains('prefer') || lower.contains('exclude') || lower.contains('no '))) {
            return true;
        }
        return false;
    }

    private static Boolean containsDefamation(String lower) {
        List<String> defamationPatterns = new List<String>{
            'illegal', 'scam', 'fraud', 'criminal', 'lawsuit'
        };
        if (!containsAny(lower, defamationPatterns)) {
            return false;
        }
        return lower.contains('without evidence') || lower.contains('unverified') || lower.contains('rumor');
    }

    private static Boolean exposesPrivacy(String lower) {
        return lower.contains('@') || Pattern.compile('\u003c[a-zA-Z]+@').matcher(lower).find();
    }

    private static Boolean platformPolicyViolations(String lower) {
        List<String> banned = new List<String>{
            'hate speech', 'extremist', 'terror', 'weapon trade'
        };
        return containsAny(lower, banned);
    }

    private static Boolean containsAny(String source, List<String> terms) {
        for (String term : terms) {
            if (source.contains(term)) {
                return true;
            }
        }
        return false;
    }
}
