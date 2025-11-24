public with sharing class ReviewFraudService {
    public class FraudSignal {
        @AuraEnabled public Boolean suspicious;
        @AuraEnabled public Decimal riskScore;
        @AuraEnabled public List<String> reasons;
    }

    public class ReviewInfo {
        public Id reviewId;
        public Id propertyId;
        public Decimal rating;
        public String comment;
        public String title;
        public String reviewerName;
        public Datetime createdDate;
    }

    public static Map<Id, FraudSignal> evaluateBatch(List<ReviewInfo> reviews) {
        Map<Id, FraudSignal> results = new Map<Id, FraudSignal>();
        if (reviews == null || reviews.isEmpty()) {
            return results;
        }

        Map<String, Integer> signatureCounts = buildSignatureCounts(reviews);
        Map<String, Integer> reviewerFrequency = buildReviewerFrequency(reviews);

        for (ReviewInfo review : reviews) {
            FraudSignal signal = evaluateReview(review, signatureCounts, reviewerFrequency);
            results.put(review.reviewId, signal);
        }
        return results;
    }

    private static FraudSignal evaluateReview(
        ReviewInfo review,
        Map<String, Integer> signatureCounts,
        Map<String, Integer> reviewerFrequency
    ) {
        FraudSignal signal = new FraudSignal();
        signal.suspicious = false;
        signal.riskScore = 0;
        signal.reasons = new List<String>();

        if (review == null) {
            return signal;
        }

        String text = (review.title == null ? '' : review.title + ' ') + (review.comment == null ? '' : review.comment);
        String signature = computeSignature(text);
        Integer duplicates = signatureCounts.get(signature);
        if (duplicates != null && duplicates > 1) {
            signal.suspicious = true;
            Decimal duplicateScore = Decimal.valueOf(Math.min(duplicates - 1, 5)) * 0.15;
            signal.riskScore += duplicateScore;
            signal.reasons.add('Duplicate phrasing detected in ' + duplicates + ' reviews');
        }

        Integer reviewerCount = reviewerFrequency.get(review.reviewerName);
        if (reviewerCount != null && reviewerCount > 3) {
            signal.suspicious = true;
            Decimal reviewerScore = Decimal.valueOf(Math.min(reviewerCount - 3, 5)) * 0.1;
            signal.riskScore += reviewerScore;
            signal.reasons.add('Reviewer submitted ' + reviewerCount + ' reviews across properties');
        }

        if (isBotLike(text)) {
            signal.suspicious = true;
            signal.riskScore += 0.25;
            signal.reasons.add('Bot-like repetitive language detected');
        }

        if (isRatingMismatch(review.rating, text)) {
            signal.suspicious = true;
            signal.riskScore += 0.1;
            signal.reasons.add('Rating sentiment inconsistent with review tone');
        }

        if (signal.riskScore > 1) {
            signal.riskScore = 1;
        }
        if (!signal.suspicious) {
            signal.riskScore = 0;
        }
        return signal;
    }

    private static Map<String, Integer> buildSignatureCounts(List<ReviewInfo> reviews) {
        Map<String, Integer> counts = new Map<String, Integer>();
        for (ReviewInfo review : reviews) {
            String signature = computeSignature((review.title == null ? '' : review.title + ' ') + (review.comment == null ? '' : review.comment));
            if (String.isNotBlank(signature)) {
                Integer current = counts.get(signature);
                counts.put(signature, current == null ? 1 : current + 1);
            }
        }
        return counts;
    }

    private static Map<String, Integer> buildReviewerFrequency(List<ReviewInfo> reviews) {
        Map<String, Integer> counts = new Map<String, Integer>();
        for (ReviewInfo review : reviews) {
            if (String.isBlank(review.reviewerName)) {
                continue;
            }
            Integer current = counts.get(review.reviewerName);
            counts.put(review.reviewerName, current == null ? 1 : current + 1);
        }
        return counts;
    }

    private static String computeSignature(String text) {
        if (String.isBlank(text)) {
            return '';
        }
        String normalized = text.toLowerCase().replaceAll('[^a-z0-9 ]', ' ');
        List<String> tokens = new List<String>();
        for (String token : normalized.split('\\s+')) {
            if (token.length() >= 4) {
                tokens.add(token);
            }
        }
        tokens.sort();
        if (tokens.isEmpty()) {
            return normalized.trim();
        }
        return String.join(tokens, ' ');
    }

    private static Boolean isBotLike(String text) {
        if (String.isBlank(text)) {
            return false;
        }
        Integer repeatedPhrases = detectRepeatedPhrases(text);
        Integer uppercaseRuns = countUppercaseRuns(text);
        Integer linkCount = countOccurrences(text.toLowerCase(), 'http');
        return repeatedPhrases > 2 || uppercaseRuns > 3 || linkCount > 1;
    }

    private static Integer detectRepeatedPhrases(String text) {
        if (String.isBlank(text)) {
            return 0;
        }
        Map<String, Integer> phrases = new Map<String, Integer>();
        String lower = text.toLowerCase();
        List<String> words = lower.split('\\s+');
        for (Integer i = 0; i < words.size() - 2; i++) {
            String phrase = words[i] + ' ' + words[i + 1] + ' ' + words[i + 2];
            Integer current = phrases.get(phrase);
            phrases.put(phrase, current == null ? 1 : current + 1);
        }
        Integer duplicates = 0;
        for (Integer value : phrases.values()) {
            if (value > 1) {
                duplicates += value - 1;
            }
        }
        return duplicates;
    }

    private static Integer countUppercaseRuns(String text) {
        if (String.isBlank(text)) {
            return 0;
        }
        Integer count = 0;
        for (String token : text.split('\\s+')) {
            if (token.length() >= 4 && token == token.toUpperCase()) {
                count++;
            }
        }
        return count;
    }

    private static Boolean isRatingMismatch(Decimal rating, String text) {
        if (rating == null || String.isBlank(text)) {
            return false;
        }
        String lower = text.toLowerCase();
        Boolean containsPositive = lower.contains('love') || lower.contains('great') || lower.contains('amazing');
        Boolean containsNegative = lower.contains('hate') || lower.contains('terrible') || lower.contains('awful');
        if (rating >= 4 && containsNegative && !containsPositive) {
            return true;
        }
        if (rating <= 2 && containsPositive && !containsNegative) {
            return true;
        }
        return false;
    }

    private static Integer countOccurrences(String text, String search) {
        if (String.isBlank(text) || String.isBlank(search)) {
            return 0;
        }
        Integer count = 0;
        Integer index = text.indexOf(search);
        while (index != -1) {
            count++;
            index = text.indexOf(search, index + search.length());
        }
        return count;
    }
}
