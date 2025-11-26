public with sharing class ReviewCRMIntegrationService {
    public class SyncResponse {
        @AuraEnabled public Integer linkedReviews;
        @AuraEnabled public Integer followupsCreated;
        @AuraEnabled public Decimal reputationScore;
    }

    @AuraEnabled
    public static SyncResponse syncReviews(Id accountId) {
        if (accountId == null) {
            throw new AuraHandledException('Account context required for sync.');
        }

        List<Property_Review__c> reviews = [
            SELECT Id, Comment__c, Rating__c, CreatedDate
            FROM Property_Review__c
            WHERE Account__c = :accountId
        ];

        Integer linked = 0;
        Integer followups = 0;
        Decimal score = 0;

        for (Property_Review__c review : reviews) {
            ensureClientLink(review);
            linked++;
            if (needsFollowUp(review)) {
                createFollowup(review);
                followups++;
            }
            score += computeReputationContribution(review);
        }

        SyncResponse response = new SyncResponse();
        response.linkedReviews = linked;
        response.followupsCreated = followups;
        response.reputationScore = reviews.isEmpty() ? null : (score / reviews.size()).setScale(2);
        return response;
    }

    private static void ensureClientLink(Property_Review__c review) {
        List<Review_Client_Link__c> links = [
            SELECT Id
            FROM Review_Client_Link__c
            WHERE Property_Review__c = :review.Id
            LIMIT 1
        ];
        if (links.isEmpty()) {
            insert new Review_Client_Link__c(
                Property_Review__c = review.Id,
                Client__c = review.Account__r?.Primary_Contact__c
            );
        }
    }

    private static Boolean needsFollowUp(Property_Review__c review) {
        if (review.Rating__c != null && review.Rating__c <= 3) {
            return true;
        }
        return String.isBlank(review.Comment__c) ? false : review.Comment__c.toLowerCase().contains('issue');
    }

    private static void createFollowup(Property_Review__c review) {
        insert new Review_Followup__c(
            Review__c = review.Id,
            Assigned_To__c = UserInfo.getUserId()
        );
    }

    private static Decimal computeReputationContribution(Property_Review__c review) {
        Decimal rating = review.Rating__c == null ? 0 : review.Rating__c;
        Decimal freshness = 1;
        if (review.CreatedDate != null) {
            Integer age = Date.today().daysBetween(review.CreatedDate.date());
            freshness = Math.max(0.2, 1 - (Decimal.valueOf(age) / 365));
        }
        return rating * freshness;
    }
}
