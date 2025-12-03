public with sharing class MaintenancePredictionService {
    public class MaintenanceAIResponse {
        public String category;
        public Decimal riskScore;
        public Decimal confidence;
        public String recommendation;
        public List<String> evidence;
        public Date windowStart;
        public Date windowEnd;
    }
    public class PredictionRequest {
        @AuraEnabled public Id propertyId;
        @AuraEnabled public Boolean generateAlerts;
    }

    public class PredictionDTO {
        @AuraEnabled public Id predictionId;
        @AuraEnabled public String category;
        @AuraEnabled public Decimal riskScore;
        @AuraEnabled public Decimal confidence;
        @AuraEnabled public String recommendedAction;
        @AuraEnabled public String evidence;
        @AuraEnabled public Date windowStart;
        @AuraEnabled public Date windowEnd;
    }

    @AuraEnabled
    public static List<PredictionDTO> analyzeProperty(PredictionRequest request) {
        if (request == null || request.propertyId == null) {
            throw new AuraHandledException('Property Id is required.');
        }
        List<Property_Review__c> reviews = [
            SELECT Id, Comment__c, CreatedDate
            FROM Property_Review__c
            WHERE Property__c = :request.propertyId
            ORDER BY CreatedDate DESC
            LIMIT 200
        ];
        if (reviews.isEmpty()) {
            return new List<PredictionDTO>();
        }

        MaintenanceAIProvider provider = MaintenanceAIProviderFactory.getProvider();
        List<MaintenanceAIResponse> aiResponses = provider.analyzeReviews(reviews);

        List<PredictionDTO> predictions = new List<PredictionDTO>();
        for (MaintenanceAIResponse aiResponse : aiResponses) {
            MaintenancePrediction__c record = new MaintenancePrediction__c(
                Property__c = request.propertyId,
                Category__c = aiResponse.category,
                RiskScore__c = aiResponse.riskScore.setScale(2),
                Confidence__c = aiResponse.confidence.setScale(2),
                RecommendedAction__c = aiResponse.recommendation,
                Evidence__c = String.join(aiResponse.evidence, '\n'),
                PredictedWindowStart__c = aiResponse.windowStart,
                PredictedWindowEnd__c = aiResponse.windowEnd,
                Status__c = 'Open'
            );
            insert record;

            if (request.generateAlerts && aiResponse.riskScore >= 0.6) {
                createAlert(record);
            }

            PredictionDTO dto = new PredictionDTO();
            dto.predictionId = record.Id;
            dto.category = record.Category__c;
            dto.riskScore = record.RiskScore__c;
            dto.confidence = record.Confidence__c;
            dto.recommendedAction = record.RecommendedAction__c;
            dto.evidence = record.Evidence__c;
            dto.windowStart = record.PredictedWindowStart__c;
            dto.windowEnd = record.PredictedWindowEnd__c;
            predictions.add(dto);
        }
        return predictions;
    }

    private static void createAlert(MaintenancePrediction__c record) {
        MaintenanceAlert__c alert = new MaintenanceAlert__c(
            Prediction__c = record.Id,
            Status__c = 'New',
            Message__c = 'High risk of ' + record.Category__c + ' issue. Recommended: ' + record.RecommendedAction__c
        );
        insert alert;
    }
}
