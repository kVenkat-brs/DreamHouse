public with sharing class ARReviewService {
    public class AROverlay {
        @AuraEnabled public String id;
        @AuraEnabled public String label;
        @AuraEnabled public String value;
        @AuraEnabled public Decimal x;
        @AuraEnabled public Decimal y;
        @AuraEnabled public Decimal z;
    }

    public class ARSceneDTO {
        @AuraEnabled public List<AROverlay> overlays;
        @AuraEnabled public String sceneJson;
    }

    @AuraEnabled(cacheable=true)
    public static ARSceneDTO getScene(Id propertyId) {
        if (propertyId == null) {
            return new ARSceneDTO();
        }
        ARSceneDTO dto = new ARSceneDTO();
        dto.overlays = new List<AROverlay>();

        // Query active AR scene config if available
        AR_Scene_Config__c config = [
            SELECT Id, SceneJSON__c
            FROM AR_Scene_Config__c
            WHERE Property__c = :propertyId AND Status__c = 'Active'
            LIMIT 1
        ];
        if (config != null) {
            dto.sceneJson = config.SceneJSON__c;
        }

        // Placeholder overlays derived from review aggregates (stubbed)
        // In full implementation, compute from review data or config anchors.
        for (Integer i = 0; i < 3; i++) {
            AROverlay overlay = new AROverlay();
            overlay.id = 'overlay-' + i;
            overlay.label = i == 0 ? 'Average Rating' : i == 1 ? 'Recent Sentiment' : 'Review Volume';
            overlay.value = i == 0 ? '4.7 / 5' : i == 1 ? 'Positive' : '128 reviews';
            overlay.x = Decimal.valueOf(0.5 * i);
            overlay.y = Decimal.valueOf(0.25 * i);
            overlay.z = Decimal.valueOf(-1 - i);
            dto.overlays.add(overlay);
        }
        return dto;
    }
}
