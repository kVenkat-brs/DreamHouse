public with sharing class ReviewComparisonService {
    public class ComparisonRequest {
        @AuraEnabled public Id propertyId;
        @AuraEnabled public List<Id> competitorIds;
    }

    public class ComparisonResponse {
        @AuraEnabled public List<PropertyMetric> metrics;
        @AuraEnabled public List<String> sentimentLabels;
    }

    public class PropertyMetric {
        @AuraEnabled public Id propertyId;
        @AuraEnabled public String name;
        @AuraEnabled public Decimal averageRating;
        @AuraEnabled public Decimal sentimentPositive;
        @AuraEnabled public Decimal sentimentNeutral;
        @AuraEnabled public Decimal sentimentNegative;
        @AuraEnabled public Decimal reviewVolume;
        @AuraEnabled public Decimal detailScore;
    }

    @AuraEnabled(cacheable=true)
    public static ComparisonResponse compareProperties(ComparisonRequest request) {
        if (request == null || request.propertyId == null) {
            throw new AuraHandledException('Primary property is required.');
        }
        Set<Id> propertyIds = new Set<Id>();
        propertyIds.add(request.propertyId);
        if (request.competitorIds != null) {
            propertyIds.addAll(request.competitorIds);
        }
        List<Property__c> properties = [
            SELECT Id, Name
            FROM Property__c
            WHERE Id IN :propertyIds
        ];

        Map<Id, PropertyMetric> metrics = new Map<Id, PropertyMetric>();
        for (Property__c property : properties) {
            PropertyMetric metric = new PropertyMetric();
            metric.propertyId = property.Id;
            metric.name = property.Name;
            metrics.put(property.Id, metric);
        }

        List<Property_Review__c> reviews = [
            SELECT Id, Property__c, Rating__c, Comment__c
            FROM Property_Review__c
            WHERE Property__c IN :propertyIds
        ];

        Map<Id, List<Property_Review__c>> reviewsByProperty = new Map<Id, List<Property_Review__c>>();
        for (Property_Review__c review : reviews) {
            if (!reviewsByProperty.containsKey(review.Property__c)) {
                reviewsByProperty.put(review.Property__c, new List<Property_Review__c>());
            }
            reviewsByProperty.get(review.Property__c).add(review);
        }

        Map<Id, SentimentService.Analysis> sentimentMap = new Map<Id, SentimentService.Analysis>();
        Map<Id, String> commentMap = new Map<Id, String>();
        for (Property_Review__c review : reviews) {
            commentMap.put(review.Id, review.Comment__c);
        }
        if (!commentMap.isEmpty()) {
            SentimentService.BatchResult sentimentBatch = SentimentService.analyzeBatch(commentMap);
            if (sentimentBatch != null && sentimentBatch.results != null) {
                sentimentMap.putAll(sentimentBatch.results);
            }
        }

        for (Id propertyId : propertyIds) {
            PropertyMetric metric = metrics.get(propertyId);
            List<Property_Review__c> propertyReviews = reviewsByProperty.get(propertyId);
            if (propertyReviews == null || propertyReviews.isEmpty()) {
                continue;
            }
            Decimal totalRating = 0;
            Decimal positive = 0;
            Decimal neutral = 0;
            Decimal negative = 0;
            Decimal detailScore = 0;
            for (Property_Review__c review : propertyReviews) {
                if (review.Rating__c != null) {
                    totalRating += review.Rating__c;
                }
                SentimentService.Analysis analysis = sentimentMap.get(review.Id);
                if (analysis != null) {
                    if ('Positive'.equalsIgnoreCase(analysis.label)) positive++;
                    else if ('Negative'.equalsIgnoreCase(analysis.label)) negative++;
                    else neutral++;
                }
                if (!String.isBlank(review.Comment__c)) {
                    detailScore += Math.min(1, Decimal.valueOf(review.Comment__c.length()) / 400);
                }
            }
            Decimal count = propertyReviews.size();
            metric.averageRating = (count > 0) ? (totalRating / count).setScale(2) : null;
            metric.sentimentPositive = count > 0 ? (positive / count).setScale(2) : 0;
            metric.sentimentNeutral = count > 0 ? (neutral / count).setScale(2) : 0;
            metric.sentimentNegative = count > 0 ? (negative / count).setScale(2) : 0;
            metric.reviewVolume = count;
            metric.detailScore = detailScore;
        }

        ComparisonResponse response = new ComparisonResponse();
        response.metrics = metrics.values();
        response.sentimentLabels = new List<String>{'Positive', 'Neutral', 'Negative'};
        return response;
    }
}
