public with sharing class ReviewAggregationService {
    public class SourceReview {
        public String source;
        public String externalId;
        public Decimal rating;
        public Datetime createdDate;
        public String comment;
        public String author;
    }

    public class AggregatedReview {
        @AuraEnabled public Id propertyId;
        @AuraEnabled public Decimal blendedRating;
        @AuraEnabled public List<PlatformReview> reviews;
    }

    public class PlatformReview {
        @AuraEnabled public String source;
        @AuraEnabled public String author;
        @AuraEnabled public Decimal rating;
        @AuraEnabled public Datetime date;
        @AuraEnabled public String comment;
        @AuraEnabled public Decimal weight;
    }

    @AuraEnabled(cacheable=true)
    public static AggregatedReview aggregate(Id propertyId) {
        if (propertyId == null) {
            throw new AuraHandledException('Property Id required.');
        }

        List<SourceReview> sourceReviews = gatherSourceReviews(propertyId);
        Map<String, PlatformReview> deduped = new Map<String, PlatformReview>();

        for (SourceReview review : sourceReviews) {
            String key = generateDedupKey(review);
            Decimal weight = weightForSource(review.source, review.rating, review.createdDate);

            PlatformReview pr = deduped.get(key);
            if (pr == null || weight > pr.weight) {
                pr = new PlatformReview();
                pr.source = review.source;
                pr.author = review.author;
                pr.rating = review.rating;
                pr.date = review.createdDate;
                pr.comment = review.comment;
                pr.weight = weight;
                deduped.put(key, pr);
            }
        }

        Decimal ratingSum = 0;
        Decimal weightSum = 0;
        List<PlatformReview> reviews = new List<PlatformReview>();
        for (PlatformReview pr : deduped.values()) {
            reviews.add(pr);
            ratingSum += (pr.rating * pr.weight);
            weightSum += pr.weight;
        }

        AggregatedReview aggregated = new AggregatedReview();
        aggregated.propertyId = propertyId;
        aggregated.reviews = reviews;
        aggregated.blendedRating = weightSum == 0 ? null : (ratingSum / weightSum).setScale(2);
        return aggregated;
    }

    private static String generateDedupKey(SourceReview review) {
        if (!String.isBlank(review.externalId)) {
            return review.source + '-' + review.externalId;
        }
        return review.source + '-' + Crypto.generateDigest('SHA1', Blob.valueOf(review.author + review.comment));
    }

    private static Decimal weightForSource(String source, Decimal rating, Datetime createdDate) {
        Decimal base = 1;
        if ('zillow'.equalsIgnoreCase(source)) base = 1.1;
        if ('airbnb'.equalsIgnoreCase(source)) base = 1.2;
        if ('google'.equalsIgnoreCase(source)) base = 1;
        if (createdDate != null) {
            Integer age = Date.today().daysBetween(createdDate.date());
            base *= Math.max(0.5, 1 - (Decimal.valueOf(age) / 3650));
        }
        if (rating != null && rating >= 4.5) {
            base *= 1.05;
        }
        return base;
    }

    private static List<SourceReview> gatherSourceReviews(Id propertyId) {
        List<SourceReview> reviews = new List<SourceReview>();
        reviews.addAll(fetchZillowReviews(propertyId));
        reviews.addAll(fetchAirbnbReviews(propertyId));
        reviews.addAll(fetchGoogleReviews(propertyId));
        return reviews;
    }

    private static List<SourceReview> fetchZillowReviews(Id propertyId) {
        List<SourceReview> results = new List<SourceReview>();
        for (Property_Review__c review : [
            SELECT Id, Rating__c, Comment__c, CreatedDate, CreatedBy.Name
            FROM Property_Review__c
            WHERE Property__c = :propertyId
        ]) {
            SourceReview sr = new SourceReview();
            sr.source = 'Zillow';
            sr.externalId = review.Id;
            sr.rating = review.Rating__c;
            sr.comment = review.Comment__c;
            sr.createdDate = review.CreatedDate;
            sr.author = review.CreatedBy?.Name;
            results.add(sr);
        }
        return results;
    }

    private static List<SourceReview> fetchAirbnbReviews(Id propertyId) {
        return new List<SourceReview>();
    }

    private static List<SourceReview> fetchGoogleReviews(Id propertyId) {
        return new List<SourceReview>();
    }
}
