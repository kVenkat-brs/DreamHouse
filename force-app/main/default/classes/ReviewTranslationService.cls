public with sharing class ReviewTranslationService {
    public class TranslationResponse {
        @AuraEnabled public String original;
        @AuraEnabled public String translated;
        @AuraEnabled public String sourceLanguage;
        @AuraEnabled public String targetLanguage;
        @AuraEnabled public Decimal confidence;
    }

    @AuraEnabled
    public static TranslationResponse translateReview(String text, String targetLanguage) {
        if (String.isBlank(text)) {
            throw new AuraHandledException('Text is required for translation.');
        }
        if (String.isBlank(targetLanguage)) {
            targetLanguage = 'en';
        }

        TranslationResponse response = new TranslationResponse();
        response.original = text;
        response.targetLanguage = targetLanguage;
        response.sourceLanguage = detectLanguage(text);
        response.translated = simulateTranslation(text, targetLanguage);
        response.confidence = 0.9;
        return response;
    }

    @AuraEnabled
    public static String detectLanguage(String text) {
        if (String.isBlank(text)) {
            return 'en';
        }
        String sample = text.substring(0, Math.min(20, text.length())).toLowerCase();
        if (sample.contains('hola') || sample.contains('gracias')) return 'es';
        if (sample.contains('bonjour') || sample.contains('merci')) return 'fr';
        if (sample.contains('hallo') || sample.contains('danke')) return 'de';
        if (sample.contains('こんにちは') || sample.contains('ありがとう')) return 'ja';
        return 'en';
    }

    private static String simulateTranslation(String text, String targetLanguage) {
        if ('en'.equalsIgnoreCase(targetLanguage)) {
            return text;
        }
        return '[[' + targetLanguage.toUpperCase() + ' TRANSLATION]] ' + text;
    }
}
