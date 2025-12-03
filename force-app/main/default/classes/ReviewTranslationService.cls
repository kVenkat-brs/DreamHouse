public with sharing class ReviewTranslationService {
    public class TranslationResponse {
        @AuraEnabled public String original;
        @AuraEnabled public String translated;
        @AuraEnabled public String sourceLanguage;
        @AuraEnabled public String targetLanguage;
        @AuraEnabled public Decimal confidence;
        @AuraEnabled public String sentimentLabel;
        @AuraEnabled public Decimal sentimentScore;
        @AuraEnabled public List<String> culturalAdjustments;
        @AuraEnabled public List<String> toneAdjustments;
        @AuraEnabled public String strategy;
    }

    private static final Map<String, Map<String, String>> BASE_DICTIONARY = buildBaseDictionary();
    private static final Map<String, Map<String, String>> CULTURAL_DICTIONARY = buildCulturalDictionary();
    private static final Map<String, Map<String, String>> SENTIMENT_AMPLIFIERS = buildSentimentAmplifiers();

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

        SentimentService.Analysis sentiment = SentimentService.analyze(text);
        response.sentimentLabel = sentiment.label;
        response.sentimentScore = sentiment.score;
        response.strategy = determineStrategy(response.sourceLanguage, targetLanguage, sentiment.label);

        TranslationEngine engine = new TranslationEngine(response.sourceLanguage, response.targetLanguage, response.strategy);
        TranslationOutcome outcome = engine.translate(text, sentiment);

        response.translated = outcome.translated;
        response.confidence = outcome.confidence;
        response.culturalAdjustments = dedupe(outcome.culturalNotes);
        response.toneAdjustments = dedupe(outcome.toneNotes);
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

    private class TranslationEngine {
        private final String sourceLang;
        private final String targetLang;
        private final String strategy;

        TranslationEngine(String sourceLang, String targetLang, String strategy) {
            this.sourceLang = String.isBlank(sourceLang) ? 'en' : sourceLang;
            this.targetLang = String.isBlank(targetLang) ? 'en' : targetLang;
            this.strategy = String.isBlank(strategy) ? 'Literal' : strategy;
        }

        TranslationOutcome translate(String text, SentimentService.Analysis sentiment) {
            List<Token> originalTokens = tokenize(text);
            List<String> translatedFragments = new List<String>();
            List<String> culturalNotes = new List<String>();
            List<String> toneNotes = new List<String>();

            for (Token token : originalTokens) {
                TokenTranslation tokenTranslation = translateToken(token, sentiment);
                translatedFragments.add(tokenTranslation.translatedFragment);
                if (!String.isBlank(tokenTranslation.culturalNote)) {
                    culturalNotes.add(tokenTranslation.culturalNote);
                }
                if (!String.isBlank(tokenTranslation.toneNote)) {
                    toneNotes.add(tokenTranslation.toneNote);
                }
            }

            String translatedText = String.join(translatedFragments, '');
            translatedText = adjustTone(translatedText, sentiment);
            translatedText = preserveEmphasis(tokenize(translatedText), originalTokens);

            TranslationOutcome outcome = new TranslationOutcome();
            outcome.translated = translatedText;
            outcome.confidence = calculateConfidence(originalTokens, translatedFragments);
            outcome.culturalNotes = culturalNotes;
            outcome.toneNotes = toneNotes;
            return outcome;
        }

        private TokenTranslation translateToken(Token token, SentimentService.Analysis sentiment) {
            TokenTranslation result = new TokenTranslation();
            result.translatedFragment = token.value;
            if (token.type == TokenType.WORD) {
                String normalized = token.value == null ? '' : token.value;
                String translatedWord = translateWord(normalized, sentiment.label);
                result.translatedFragment = applyCapitalization(normalized, translatedWord);
                result.culturalNote = culturalHint(normalized);
                result.toneNote = toneHint(normalized, sentiment.label);
            }
            return result;
        }

        private String translateWord(String word, String sentimentLabel) {
            if (String.isBlank(word)) {
                return word;
            }
            Map<String, String> dictionary = BASE_DICTIONARY.get(targetLang);
            String lower = word.toLowerCase();
            String translated = dictionary != null ? dictionary.get(lower) : null;
            if (translated == null) {
                translated = fallbackTranslation(lower);
            }

            String culturalVariant = culturalAdjustment(lower);
            if (culturalVariant != null) {
                translated = culturalVariant;
            }

            return adjustForSentiment(translated, sentimentLabel);
        }

        private String adjustForSentiment(String translated, String sentimentLabel) {
            if (translated == null) {
                return null;
            }
            if (String.isBlank(sentimentLabel)) {
                return translated;
            }
            Map<String, String> modifiers = SENTIMENT_AMPLIFIERS.get(sentimentLabel);
            if (modifiers == null) {
                return translated;
            }
            String lower = translated.toLowerCase();
            String replacement = modifiers.get(lower);
            return replacement != null ? replacement : translated;
        }

        private String culturalAdjustment(String lowerWord) {
            Map<String, String> map = CULTURAL_DICTIONARY.get(targetLang);
            if (map == null) {
                return null;
            }
            return map.get(lowerWord);
        }

        private String fallbackTranslation(String lowerWord) {
            return ExternalTranslationProvider.translate(lowerWord, sourceLang, targetLang, strategy);
        }

        private List<Token> tokenize(String text) {
            List<Token> tokens = new List<Token>();
            if (text == null) {
                return tokens;
            }

            StringBuilder current = new StringBuilder();
            TokenType currentType = null;
            for (Integer i = 0; i < text.length(); i++) {
                String ch = text.substring(i, i + 1);
                TokenType type = classifyCharacter(ch);
                if (currentType == null) {
                    currentType = type;
                }
                if (type != currentType && current.length() > 0) {
                    tokens.add(new Token(current.toString(), currentType));
                    current = new StringBuilder();
                    currentType = type;
                }
                current.append(ch);
            }
            if (currentType != null && current.length() > 0) {
                tokens.add(new Token(current.toString(), currentType));
            }
            return tokens;
        }

        private TokenType classifyCharacter(String ch) {
            if (String.isBlank(ch)) {
                return TokenType.WHITESPACE;
            }
            if (ch.matches('\\s')) {
                return TokenType.WHITESPACE;
            }
            if (ch.matches('[A-Za-zÀ-ÿ0-9]')) {
                return TokenType.WORD;
            }
            return TokenType.PUNCTUATION;
        }

        private String adjustTone(String translated, SentimentService.Analysis sentiment) {
            if (String.isBlank(translated) || sentiment == null) {
                return translated;
            }
            if ('Negative'.equalsIgnoreCase(sentiment.label)) {
                return softenNegativeTone(translated);
            }
            return translated;
        }

        private String softenNegativeTone(String text) {
            if (String.isBlank(text)) {
                return text;
            }
            String output = text.replace('terrible', 'problematic');
            output = output.replace('awful', 'difficult');
            output = output.replace('hate', 'really dislike');
            return output;
        }

        private String preserveEmphasis(List<Token> translatedTokens, List<Token> originalTokens) {
            StringBuilder builder = new StringBuilder();
            Integer length = Math.max(translatedTokens.size(), originalTokens.size());
            for (Integer i = 0; i < length; i++) {
                Token translated = i < translatedTokens.size() ? translatedTokens[i] : null;
                Token original = i < originalTokens.size() ? originalTokens[i] : null;
                String fragment = translated != null ? translated.value : '';
                if (original != null && original.type == TokenType.WORD) {
                    if (isAllCaps(original.value)) {
                        fragment = fragment != null ? fragment.toUpperCase() : fragment;
                    } else if (hasLeadingCapital(original.value)) {
                        fragment = preserveLeadingCapital(fragment);
                    }
                    if (hasTrailingExclamation(original.value) && !hasTrailingExclamation(fragment)) {
                        fragment = fragment + '!';
                    }
                }
                builder.append(fragment);
            }
            return builder.toString();
        }

        private Decimal calculateConfidence(List<Token> originalTokens, List<String> translatedFragments) {
            Integer originalWords = 0;
            for (Token token : originalTokens) {
                if (token != null && token.type == TokenType.WORD) {
                    originalWords++;
                }
            }
            Integer translatedCount = translatedFragments.size();
            if (originalWords == 0) {
                return 0.90;
            }
            Decimal ratio = Decimal.valueOf(translatedCount) / Decimal.valueOf(originalWords);
            Decimal base = Math.min(1, ratio);
            if ('Literal'.equalsIgnoreCase(strategy)) {
                base += 0.05;
            } else if ('Cultural'.equalsIgnoreCase(strategy)) {
                base += 0.03;
            }
            if (base > 0.98) {
                base = 0.98;
            }
            return base.setScale(2);
        }

        private String applyCapitalization(String original, String translated) {
            if (translated == null) {
                return original;
            }
            if (String.isBlank(original)) {
                return translated;
            }
            if (isAllCaps(original)) {
                return translated.toUpperCase();
            }
            if (hasLeadingCapital(original)) {
                return preserveLeadingCapital(translated);
            }
            return translated;
        }

        private Boolean isAllCaps(String value) {
            if (String.isBlank(value)) {
                return false;
            }
            return value == value.toUpperCase() && value != value.toLowerCase();
        }

        private Boolean hasLeadingCapital(String value) {
            if (String.isBlank(value)) {
                return false;
            }
            String first = value.substring(0, 1);
            return first == first.toUpperCase() && first != first.toLowerCase();
        }

        private String preserveLeadingCapital(String text) {
            if (String.isBlank(text)) {
                return text;
            }
            if (text.length() == 1) {
                return text.toUpperCase();
            }
            return text.substring(0, 1).toUpperCase() + text.substring(1);
        }

        private Boolean hasTrailingExclamation(String value) {
            return !String.isBlank(value) && value.endsWith('!');
        }

        private String culturalHint(String originalWord) {
            Map<String, String> hints = CULTURAL_DICTIONARY.get(targetLang);
            if (hints == null) {
                return null;
            }
            String lower = originalWord == null ? null : originalWord.toLowerCase();
            if (lower != null && hints.containsKey(lower)) {
                return 'Adjusted cultural reference for "' + originalWord + '"';
            }
            return null;
        }

        private String toneHint(String originalWord, String sentimentLabel) {
            if (String.isBlank(originalWord) || String.isBlank(sentimentLabel)) {
                return null;
            }
            if (!'Neutral'.equalsIgnoreCase(sentimentLabel)) {
                return null;
            }
            if (originalWord.toLowerCase().contains('maybe')) {
                return 'Preserved hedging language';
            }
            return null;
        }
    }

    private class TranslationOutcome {
        String translated;
        Decimal confidence;
        List<String> culturalNotes;
        List<String> toneNotes;
    }

    private class TokenTranslation {
        String translatedFragment;
        String culturalNote;
        String toneNote;
    }

    private class Token {
        String value;
        TokenType type;

        Token(String value, TokenType type) {
            this.value = value;
            this.type = type;
        }
    }

    private enum TokenType {
        WORD,
        WHITESPACE,
        PUNCTUATION
    }

    private static String determineStrategy(String sourceLang, String targetLang, String sentimentLabel) {
        if (String.isBlank(sentimentLabel) || 'Neutral'.equalsIgnoreCase(sentimentLabel)) {
            return 'Literal';
        }
        if (sourceLang == targetLang) {
            return 'Literal';
        }
        if ('Positive'.equalsIgnoreCase(sentimentLabel)) {
            return 'Expressive';
        }
        return 'Cultural';
    }

    private static Map<String, Map<String, String>> buildBaseDictionary() {
        Map<String, Map<String, String>> dictionary = new Map<String, Map<String, String>>();
        dictionary.put('es', new Map<String, String>{
            'beautiful' => 'hermoso',
            'love' => 'encanta',
            'quiet' => 'tranquilo',
            'noisy' => 'ruidoso',
            'problem' => 'problema',
            'service' => 'servicio',
            'maintenance' => 'mantenimiento'
        });
        dictionary.put('fr', new Map<String, String>{
            'beautiful' => 'magnifique',
            'love' => 'adore',
            'quiet' => 'calme',
            'noisy' => 'bruyant',
            'problem' => 'problème',
            'service' => 'service',
            'maintenance' => 'maintenance'
        });
        dictionary.put('de', new Map<String, String>{
            'beautiful' => 'wunderschön',
            'love' => 'liebe',
            'quiet' => 'ruhig',
            'noisy' => 'laut',
            'problem' => 'problem',
            'service' => 'service',
            'maintenance' => 'wartung'
        });
        dictionary.put('ja', new Map<String, String>{
            'beautiful' => '美しい',
            'love' => '大好き',
            'quiet' => '静か',
            'noisy' => '騒がしい',
            'problem' => '問題',
            'service' => 'サービス',
            'maintenance' => 'メンテナンス'
        });
        return dictionary;
    }

    private static Map<String, Map<String, String>> buildCulturalDictionary() {
        Map<String, Map<String, String>> dictionary = new Map<String, Map<String, String>>();
        dictionary.put('es', new Map<String, String>{
            'soccer' => 'fútbol',
            'football' => 'fútbol americano',
            'diner' => 'cafetería estilo americano'
        });
        dictionary.put('fr', new Map<String, String>{
            'soccer' => 'football',
            'football' => 'football américain',
            'diner' => 'brasserie'
        });
        dictionary.put('de', new Map<String, String>{
            'soccer' => 'fußball',
            'football' => 'american football',
            'diner' => 'amerikanisches diner'
        });
        dictionary.put('ja', new Map<String, String>{
            'soccer' => 'サッカー',
            'football' => 'アメリカンフットボール',
            'diner' => 'アメリカ風ダイナー'
        });
        return dictionary;
    }

    private static Map<String, Map<String, String>> buildSentimentAmplifiers() {
        Map<String, Map<String, String>> amplifiers = new Map<String, Map<String, String>>();
        amplifiers.put('Positive', new Map<String, String>{
            'encanta' => 'encanta muchísimo',
            'adore' => 'adore vraiment',
            'liebe' => 'liebe sehr',
            '大好き' => 'とても大好き'
        });
        amplifiers.put('Negative', new Map<String, String>{
            'problema' => 'problema serio',
            'problème' => 'sérieux problème',
            'problem' => 'ernstes problem',
            '問題' => '深刻な問題'
        });
        return amplifiers;
    }

    private static List<String> dedupe(List<String> source) {
        if (source == null || source.isEmpty()) {
            return new List<String>();
        }
        return new List<String>(new Set<String>(source));
    }

    private class ExternalTranslationProvider {
        static String translate(String text, String sourceLang, String targetLang, String strategy) {
            if (String.isBlank(text)) {
                return text;
            }
            return '[[' + targetLang + ':' + strategy + ']] ' + text;
        }
    }
}
