public with sharing class InspectionService {

    public class InspectionDTO {
        @AuraEnabled public Id id;
        @AuraEnabled public Date requestedDate;
        @AuraEnabled public String status;
        @AuraEnabled public String preferredWindow;
        @AuraEnabled public Decimal estimatedCost;
        @AuraEnabled public String inspectorName;
        @AuraEnabled public String notes;
    }

    @AuraEnabled(cacheable=true)
    public static List<InspectionDTO> getInspectionRequests(Id propertyId) {
        List<Inspection_Request__c> rows = [
            SELECT Id, Requested_Date__c, Status__c, Preferred_Time_Window__c, Estimated_Cost__c, Inspector_Contact__r.Name, Description__c
            FROM Inspection_Request__c
            WHERE Property__c = :propertyId
            ORDER BY Requested_Date__c DESC NULLS LAST
        ];
        List<InspectionDTO> out = new List<InspectionDTO>();
        for (Inspection_Request__c row : rows) {
            InspectionDTO dto = new InspectionDTO();
            dto.id = row.Id;
            dto.requestedDate = row.Requested_Date__c;
            dto.status = row.Status__c;
            dto.preferredWindow = row.Preferred_Time_Window__c;
            dto.estimatedCost = row.Estimated_Cost__c;
            dto.inspectorName = row.Inspector_Contact__r != null ? row.Inspector_Contact__r.Name : null;
            dto.notes = row.Description__c;
            out.add(dto);
        }
        return out;
    }

    @AuraEnabled
    public static Id createInspectionRequest(Id propertyId, Date requestedDate, String preferredWindow, String notes, Decimal estimatedCost) {
        Inspection_Request__c req = new Inspection_Request__c();
        req.Property__c = propertyId;
        req.Requested_Date__c = requestedDate;
        req.Preferred_Time_Window__c = preferredWindow;
        req.Description__c = notes;
        req.Estimated_Cost__c = estimatedCost;
        req.Status__c = 'Requested';
        insert req;
        return req.Id;
    }

    @AuraEnabled
    public static void updateInspectionStatus(Id requestId, String status) {
        if (requestId == null || String.isBlank(status)) return;
        Inspection_Request__c req = [SELECT Id FROM Inspection_Request__c WHERE Id = :requestId LIMIT 1];
        req.Status__c = status;
        update req;
    }
}
