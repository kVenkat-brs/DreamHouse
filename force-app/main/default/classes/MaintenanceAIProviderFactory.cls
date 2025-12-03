public with sharing class MaintenanceAIProviderFactory {
    public static MaintenanceAIProvider getProvider() {
        return new MaintenanceMockAIProvider();
    }
}
