public with sharing class PropertyManagementSyncService {
    public class SyncRequest {
        @AuraEnabled public Id propertyId;
        @AuraEnabled public String externalPropertyId;
    }

    public class SyncStatus {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String message;
        @AuraEnabled public Datetime lastSynced;
    }

    @AuraEnabled
    public static SyncStatus pushReviewStatus(Id reviewId, String status) {
        if (reviewId == null || String.isBlank(status)) {
            throw new AuraHandledException('Review Id and status required.');
        }
        Property_Review__c review = [
            SELECT Id, External_Review_Id__c
            FROM Property_Review__c
            WHERE Id = :reviewId
            LIMIT 1
        ];
        if (String.isBlank(review.External_Review_Id__c)) {
            throw new AuraHandledException('Review does not have an external mapping.');
        }
        // Simulated external call
        // HttpRequest req = new HttpRequest(); ...
        return buildStatus(true, 'Review status updated');
    }

    @AuraEnabled
    public static SyncStatus pullPropertySnapshot(SyncRequest request) {
        if (request == null || request.propertyId == null) {
            throw new AuraHandledException('Property context required.');
        }
        Property__c property = [
            SELECT Id, Name
            FROM Property__c
            WHERE Id = :request.propertyId
            LIMIT 1
        ];
        // Simulated external data fetch; update property context or logs.
        return buildStatus(true, 'Property data refreshed');
    }

    private static SyncStatus buildStatus(Boolean success, String message) {
        SyncStatus status = new SyncStatus();
        status.success = success;
        status.message = message;
        status.lastSynced = Datetime.now();
        return status;
    }
}
