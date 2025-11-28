public with sharing class ReviewInsightService {
    public class InsightResponse {
        @AuraEnabled public List<String> highlights;
        @AuraEnabled public List<String> opportunities;
        @AuraEnabled public Decimal forecastRating;
        @AuraEnabled public Decimal trend;
        @AuraEnabled public Decimal confidence;
    }

    @AuraEnabled(cacheable=true)
    public static InsightResponse generateInsights(Id propertyId) {
        if (propertyId == null) {
            throw new AuraHandledException('Property Id is required.');
        }

        List<Property_Review__c> reviews = [
            SELECT Id, Rating__c, Comment__c, CreatedDate
            FROM Property_Review__c
            WHERE Property__c = :propertyId
            ORDER BY CreatedDate ASC
            WITH SECURITY_ENFORCED
        ];

        InsightResponse response = new InsightResponse();
        response.highlights = new List<String>();
        response.opportunities = new List<String>();
        if (reviews.isEmpty()) {
            response.forecastRating = null;
            response.trend = 0;
            response.confidence = 0;
            return response;
        }

        Integer count = reviews.size();
        Decimal totalRating = 0;
        Map<String, Integer> positiveSignals = new Map<String, Integer>();
        Map<String, Integer> negativeSignals = new Map<String, Integer>();

        for (Property_Review__c review : reviews) {
            if (review.Rating__c != null) {
                totalRating += review.Rating__c;
            }
            analyzeComment(review.Comment__c, positiveSignals, negativeSignals);
        }

        Decimal avgRating = totalRating / count;
        List<Property_Review__c> recent = reviews.size() > 6 ? reviews.subList(Math.max(0, reviews.size() - 6), reviews.size()) : reviews;
        Decimal recentAvg = 0;
        for (Property_Review__c review : recent) {
            if (review.Rating__c != null) {
                recentAvg += review.Rating__c;
            }
        }
        recentAvg = recent.isEmpty() ? avgRating : recentAvg / recent.size();
        Decimal firstHalfAvg = 0;
        Integer firstCount = 0;
        Integer halfIndex = Math.max(1, reviews.size() / 2);
        for (Integer i = 0; i < halfIndex; i++) {
            Decimal rating = reviews[i].Rating__c;
            if (rating != null) {
                firstHalfAvg += rating;
                firstCount++;
            }
        }
        firstHalfAvg = firstCount == 0 ? avgRating : (firstHalfAvg / firstCount);
        Decimal trend = recentAvg - firstHalfAvg;
        Decimal forecast = avgRating + (trend * 0.5);
        if (forecast > 5) forecast = 5;
        if (forecast < 1) forecast = 1;

        response.forecastRating = forecast.setScale(2);
        response.trend = trend.setScale(2);
        response.confidence = Math.min(1, Decimal.valueOf(count) / 30).setScale(2);

        response.highlights.addAll(renderSignals(positiveSignals, true));
        if (response.highlights.isEmpty()) {
            response.highlights.add('Guests mention overall positive experiences.');
        }
        response.opportunities.addAll(renderSignals(negativeSignals, false));
        if (response.opportunities.isEmpty()) {
            response.opportunities.add('Maintain current standards to preserve satisfaction.');
        }

        return response;
    }

    private static void analyzeComment(String comment, Map<String, Integer> positive, Map<String, Integer> negative) {
        if (String.isBlank(comment)) {
            return;
        }
        String lower = comment.toLowerCase();
        Map<String, List<String>> positiveKeywords = new Map<String, List<String>>{
            'Service' => new List<String>{'friendly', 'helpful', 'host', 'service'},
            'Cleanliness' => new List<String>{'clean', 'spotless', 'tidy'},
            'Comfort' => new List<String>{'comfortable', 'cozy', 'spacious', 'quiet'},
            'Location' => new List<String>{'location', 'walk', 'transit', 'commute'}
        };
        Map<String, List<String>> negativeKeywords = new Map<String, List<String>>{
            'Maintenance' => new List<String>{'broken', 'repair', 'maintenance', 'fix'},
            'Noise' => new List<String>{'loud', 'noise', 'noisy'},
            'Cleanliness' => new List<String>{'dirty', 'dusty', 'unclean'},
            'Check-in/Service' => new List<String>{'slow', 'late', 'unresponsive', 'rude'}
        };

        for (String category : positiveKeywords.keySet()) {
            if (containsAny(lower, positiveKeywords.get(category))) {
                Integer count = positive.get(category);
                positive.put(category, count == null ? 1 : count + 1);
            }
        }
        for (String category : negativeKeywords.keySet()) {
            if (containsAny(lower, negativeKeywords.get(category))) {
                Integer count = negative.get(category);
                negative.put(category, count == null ? 1 : count + 1);
            }
        }
    }

    private static Boolean containsAny(String source, List<String> terms) {
        for (String term : terms) {
            if (source.contains(term)) {
                return true;
            }
        }
        return false;
    }

    private static List<String> renderSignals(Map<String, Integer> map, Boolean positive) {
        List<String> statements = new List<String>();
        for (String key : map.keySet()) {
            if (positive) {
                statements.add('Strength in ' + key + ' mentioned ' + map.get(key) + ' times.');
            } else {
                statements.add('Improve ' + key + ' (mentioned ' + map.get(key) + ' times).');
            }
        }
        return statements;
    }
}
