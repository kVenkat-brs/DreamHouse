public with sharing class ReviewImpactService {
    public class ImpactResponse {
        @AuraEnabled public Id propertyId;
        @AuraEnabled public Decimal valueAdjustment;
        @AuraEnabled public Decimal rentalAdjustment;
        @AuraEnabled public Decimal conversionLift;
        @AuraEnabled public String positioning;
        @AuraEnabled public Decimal confidence;
    }

    @AuraEnabled(cacheable=true)
    public static ImpactResponse evaluateImpact(Id propertyId) {
        if (propertyId == null) {
            throw new AuraHandledException('Property Id is required.');
        }
        Property__c property = [
            SELECT Id, Price__c, Rent__c
            FROM Property__c
            WHERE Id = :propertyId
            LIMIT 1
        ];
        List<Property_Review__c> reviews = [
            SELECT Id, Rating__c, Comment__c, CreatedDate
            FROM Property_Review__c
            WHERE Property__c = :propertyId
            WITH SECURITY_ENFORCED
        ];
        if (reviews.isEmpty()) {
            ImpactResponse emptyResponse = new ImpactResponse();
            emptyResponse.propertyId = propertyId;
            emptyResponse.valueAdjustment = 0;
            emptyResponse.rentalAdjustment = 0;
            emptyResponse.conversionLift = 0;
            emptyResponse.positioning = 'Insufficient data';
            emptyResponse.confidence = 0;
            return emptyResponse;
        }

        Decimal avgRating = 0;
        Decimal detailScore = 0;
        for (Property_Review__c review : reviews) {
            if (review.Rating__c != null) {
                avgRating += review.Rating__c;
            }
            if (!String.isBlank(review.Comment__c)) {
                detailScore += Math.min(1, Decimal.valueOf(review.Comment__c.length()) / 400);
            }
        }
        Decimal reviewCount = reviews.size();
        avgRating = avgRating / reviewCount;
        Decimal detailFactor = detailScore / reviewCount;

        Integer helpfulVotes = [
            SELECT COUNT()
            FROM Review_Vote__c
            WHERE Property_Review__c IN :reviews AND Vote_Type__c = 'Helpful'
        ];
        Decimal helpfulFactor = Decimal.valueOf(helpfulVotes) / Math.max(1, reviewCount);

        Decimal sentimentPositive = 0;
        Decimal sentimentNegative = 0;
        Map<Id, String> commentMap = new Map<Id, String>();
        for (Property_Review__c review : reviews) {
            commentMap.put(review.Id, review.Comment__c);
        }
        if (!commentMap.isEmpty()) {
            SentimentService.BatchResult batch = SentimentService.analyzeBatch(commentMap);
            if (batch != null && batch.results != null) {
                for (Id reviewId : batch.results.keySet()) {
                    SentimentService.Analysis analysis = batch.results.get(reviewId);
                    if ('Positive'.equalsIgnoreCase(analysis.label)) {
                        sentimentPositive++;
                    } else if ('Negative'.equalsIgnoreCase(analysis.label)) {
                        sentimentNegative++;
                    }
                }
            }
        }
        Decimal sentimentScore = (sentimentPositive - sentimentNegative) / Math.max(1, reviewCount);

        Decimal valueAdjustment = computeValueImpact(property.Price__c, avgRating, reviewCount, detailFactor, sentimentScore);
        Decimal rentalAdjustment = computeRentalImpact(property.Rent__c, avgRating, reviewCount, detailFactor, sentimentScore);
        Decimal conversionLift = computeConversionLift(avgRating, helpfulFactor, detailFactor);
        String positioning = calculatePositioning(avgRating, reviewCount, detailFactor, sentimentScore);
        Decimal confidence = Math.min(1, Decimal.valueOf(reviewCount) / 20);

        ImpactResponse response = new ImpactResponse();
        response.propertyId = propertyId;
        response.valueAdjustment = valueAdjustment.setScale(2);
        response.rentalAdjustment = rentalAdjustment.setScale(2);
        response.conversionLift = conversionLift.setScale(2);
        response.positioning = positioning;
        response.confidence = confidence.setScale(2);
        return response;
    }

    private static Decimal computeValueImpact(Decimal price, Decimal avgRating, Decimal reviewCount, Decimal detailFactor, Decimal sentimentScore) {
        if (price == null) {
            price = 0;
        }
        Decimal baseline = (avgRating - 4) * 0.02;
        Decimal volumeLift = Math.min(0.05, reviewCount / 1000);
        Decimal detailLift = detailFactor * 0.03;
        Decimal sentimentLift = sentimentScore * 0.04;
        return price * (baseline + volumeLift + detailLift + sentimentLift);
    }

    private static Decimal computeRentalImpact(Decimal rent, Decimal avgRating, Decimal reviewCount, Decimal detailFactor, Decimal sentimentScore) {
        if (rent == null) {
            rent = 0;
        }
        Decimal baseline = (avgRating - 4) * 0.01;
        Decimal detailLift = detailFactor * 0.015;
        Decimal sentimentLift = sentimentScore * 0.02;
        Decimal volumeLift = Math.min(0.03, reviewCount / 1200);
        return rent * (baseline + detailLift + sentimentLift + volumeLift);
    }

    private static Decimal computeConversionLift(Decimal avgRating, Decimal helpfulFactor, Decimal detailFactor) {
        Decimal ratingLift = (avgRating - 4) * 0.05;
        Decimal helpfulLift = Math.min(0.05, helpfulFactor * 0.1);
        Decimal detailLift = detailFactor * 0.04;
        return ratingLift + helpfulLift + detailLift;
    }

    private static String calculatePositioning(Decimal avgRating, Decimal reviewCount, Decimal detailFactor, Decimal sentimentScore) {
        Decimal composite = (avgRating / 5) * 0.4 + (Math.min(1, reviewCount / 100) * 0.2) + (detailFactor * 0.2) + ((sentimentScore + 1) / 2 * 0.2);
        if (composite >= 0.8) return 'Market Leader';
        if (composite >= 0.6) return 'Strong Performer';
        if (composite >= 0.4) return 'Competitive';
        return 'Needs Improvement';
    }
}
