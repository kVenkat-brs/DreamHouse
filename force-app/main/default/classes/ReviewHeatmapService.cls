public with sharing class ReviewHeatmapService {
    public class HeatmapRequest {
        @AuraEnabled public String grouping; // neighborhood, city, propertyType
        @AuraEnabled public Id propertyId; // optional focus
    }

    public class HeatmapResponse {
        @AuraEnabled public List<HeatBucket> buckets;
    }

    public class HeatBucket {
        @AuraEnabled public String label;
        @AuraEnabled public Decimal positive;
        @AuraEnabled public Decimal neutral;
        @AuraEnabled public Decimal negative;
        @AuraEnabled public Decimal averageRating;
        @AuraEnabled public Integer reviewCount;
        @AuraEnabled public Decimal latitude;
        @AuraEnabled public Decimal longitude;
    }

    @AuraEnabled(cacheable=true)
    public static HeatmapResponse buildHeatmap(HeatmapRequest request) {
        String grouping = request == null || String.isBlank(request.grouping) ? 'city' : request.grouping.toLowerCase();
        Map<Id, Property__c> propertyMap = new Map<Id, Property__c>();
        for (Property__c property : [
            SELECT Id, Name, City__c, Neighborhood__c__c, Property_Type__c, Location__Latitude__s, Location__Longitude__s
            FROM Property__c
        ]) {
            propertyMap.put(property.Id, property);
        }

        Map<String, HeatBucket> buckets = new Map<String, HeatBucket>();
        Map<Id, String> reviewComments = new Map<Id, String>();
        for (Property_Review__c review : [
            SELECT Id, Property__c, Rating__c, Comment__c
            FROM Property_Review__c
        ]) {
            Property__c property = propertyMap.get(review.Property__c);
            if (property == null) {
                continue;
            }
            String key = buildKey(grouping, property);
            if (String.isBlank(key)) {
                key = 'Unknown';
            }
            HeatBucket bucket = buckets.get(key);
            if (bucket == null) {
                bucket = new HeatBucket();
                bucket.label = key;
                bucket.latitude = property.Location__Latitude__s;
                bucket.longitude = property.Location__Longitude__s;
                bucket.reviewCount = 0;
                buckets.put(key, bucket);
            }
            bucket.reviewCount++;
            if (review.Rating__c != null) {
                bucket.averageRating += review.Rating__c;
            }
            reviewComments.put(review.Id, review.Comment__c);
        }

        Map<Id, SentimentService.Analysis> sentimentMap = new Map<Id, SentimentService.Analysis>();
        if (!reviewComments.isEmpty()) {
            SentimentService.BatchResult batch = SentimentService.analyzeBatch(reviewComments);
            if (batch != null && batch.results != null) {
                sentimentMap.putAll(batch.results);
            }
        }

        for (Id reviewId : reviewComments.keySet()) {
            Property_Review__c review = [SELECT Property__c FROM Property_Review__c WHERE Id = :reviewId LIMIT 1];
            Property__c property = propertyMap.get(review.Property__c);
            String key = buildKey(grouping, property);
            if (String.isBlank(key)) {
                key = 'Unknown';
            }
            HeatBucket bucket = buckets.get(key);
            if (bucket == null) {
                continue;
            }
            SentimentService.Analysis analysis = sentimentMap.get(reviewId);
            if (analysis != null) {
                if ('Positive'.equalsIgnoreCase(analysis.label)) bucket.positive++;
                else if ('Negative'.equalsIgnoreCase(analysis.label)) bucket.negative++;
                else bucket.neutral++;
            }
        }

        for (HeatBucket bucket : buckets.values()) {
            if (bucket.reviewCount > 0) {
                bucket.averageRating = (bucket.averageRating / bucket.reviewCount).setScale(2);
                bucket.positive = (bucket.positive / bucket.reviewCount).setScale(2);
                bucket.neutral = (bucket.neutral / bucket.reviewCount).setScale(2);
                bucket.negative = (bucket.negative / bucket.reviewCount).setScale(2);
            }
        }

        HeatmapResponse response = new HeatmapResponse();
        response.buckets = buckets.values();
        return response;
    }

    private static String buildKey(String grouping, Property__c property) {
        if (property == null) {
            return null;
        }
        switch on grouping {
            when 'neighborhood' {
                return property.Neighborhood__c__c;
            }
            when 'propertytype' {
                return property.Property_Type__c;
            }
            when else {
                return property.City__c;
            }
        }
    }
}
