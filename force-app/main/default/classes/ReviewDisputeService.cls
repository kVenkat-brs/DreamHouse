public with sharing class ReviewDisputeService {
    public class DisputeRequest {
        @AuraEnabled public Id reviewId;
        @AuraEnabled public String reason;
        @AuraEnabled public List<String> evidenceLinks;
    }

    public class DisputeResponse {
        @AuraEnabled public Id disputeId;
        @AuraEnabled public String status;
    }

    @AuraEnabled
    public static DisputeResponse submitDispute(DisputeRequest request) {
        if (request == null || request.reviewId == null || String.isBlank(request.reason)) {
            throw new AuraHandledException('Review and reason are required to file a dispute.');
        }

        Review_Dispute__c dispute = new Review_Dispute__c(
            Property_Review__c = request.reviewId,
            Disputant__c = UserInfo.getUserId(),
            Status__c = 'Submitted',
            Mediation_Notes__c = request.reason
        );
        insert dispute;

        if (request.evidenceLinks != null) {
            for (String link : request.evidenceLinks) {
                if (String.isBlank(link)) {
                    continue;
                }
                insert new Review_Evidence__c(
                    Dispute__c = dispute.Id,
                    File_Link__c = link
                );
            }
        }

        DisputeResponse response = new DisputeResponse();
        response.disputeId = dispute.Id;
        response.status = dispute.Status__c;
        return response;
    }

    @AuraEnabled
    public static void updateStatus(Id disputeId, String status, String notes) {
        if (disputeId == null || String.isBlank(status)) {
            throw new AuraHandledException('Dispute Id and status are required.');
        }
        Review_Dispute__c dispute = [
            SELECT Id
            FROM Review_Dispute__c
            WHERE Id = :disputeId
            LIMIT 1
        ];
        dispute.Status__c = status;
        if (!String.isBlank(notes)) {
            dispute.Mediation_Notes__c = String.isBlank(dispute.Mediation_Notes__c) ? notes : dispute.Mediation_Notes__c + '\n' + notes;
        }
        update dispute;
    }

    @AuraEnabled(cacheable=true)
    public static List<Review_Dispute__c> getMyDisputes(Id reviewId) {
        return [
            SELECT Id, Status__c, Mediation_Notes__c, CreatedDate
            FROM Review_Dispute__c
            WHERE Property_Review__c = :reviewId AND Disputant__c = :UserInfo.getUserId()
            ORDER BY CreatedDate DESC
        ];
    }
}
