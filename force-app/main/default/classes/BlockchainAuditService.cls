public with sharing class BlockchainAuditService {
    public class AuditRecord {
        @AuraEnabled public Id reviewId;
        @AuraEnabled public String transactionHash;
        @AuraEnabled public String proof;
        @AuraEnabled public Datetime anchoredAt;
        @AuraEnabled public String network;
    }

    @AuraEnabled(cacheable=true)
    public static AuditRecord getAuditRecord(Id reviewId) {
        return null;
    }

    public static void enqueueReviewForAnchoring(Property_Review__c review, String normalizedComment) {
    }
}
