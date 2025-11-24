public with sharing class AIWritingAssistantService {
    public class SuggestionResponse {
        @AuraEnabled public List<String> suggestions;
    }

    @AuraEnabled(cacheable=false)
    public static SuggestionResponse getSuggestions(Id propertyId, Decimal rating, String draft) {
        SuggestionResponse response = new SuggestionResponse();
        response.suggestions = new List<String>();

        String context = buildContext(propertyId);
        String tone = rating == null ? 'balanced' : rating >= 4 ? 'positive' : rating <= 2 ? 'candid' : 'balanced';

        response.suggestions.add('Highlight specific features that impressed you, such as natural light, storage, or layout.');
        response.suggestions.add('Share how the neighbourhood feels (noise levels, amenities, commuting).');
        response.suggestions.add('Provide tips for future guests/buyers, e.g., best parking spot or maintenance notes.');
        response.suggestions.add('Describe how the property compared to expectations ' + tone + ' and mention any stand-out details.');

        if (!String.isBlank(draft)) {
            response.suggestions.add('Expand on: "' + trimSnippet(draft) + '" with more context or examples.');
        }
        if (!String.isBlank(context)) {
            response.suggestions.add('Reference the local vibe around ' + context + ' to make the review more useful.');
        }

        return response;
    }

    private static String buildContext(Id propertyId) {
        if (propertyId == null) {
            return null;
        }
        Property__c property = [
            SELECT Name, City__c, Neighborhood__c__c
            FROM Property__c
            WHERE Id = :propertyId
            LIMIT 1
        ];
        List<String> bits = new List<String>();
        if (!String.isBlank(property.Neighborhood__c__c)) {
            bits.add(property.Neighborhood__c__c);
        }
        if (!String.isBlank(property.City__c)) {
            bits.add(property.City__c);
        }
        return String.join(bits, ', ');
    }

    private static String trimSnippet(String draft) {
        String plain = draft.replaceAll('<[^>]+>', ' ');
        if (plain.length() > 120) {
            return plain.substring(0, 117) + '…';
        }
        return plain;
    }
}
