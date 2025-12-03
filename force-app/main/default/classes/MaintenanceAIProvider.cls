public virtual class MaintenanceAIProvider {
    public virtual List<MaintenancePredictionService.MaintenanceAIResponse> analyzeReviews(List<Property_Review__c> reviews) {
        throw new AuraHandledException('Provider not implemented');
    }
}
