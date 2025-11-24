public with sharing class SentimentService {
    public class Analysis {
        @AuraEnabled public Decimal score;
        @AuraEnabled public String label;
        @AuraEnabled public List<String> keywords;
    }

    public class BatchResult {
        @AuraEnabled public Map<Id, Analysis> results;
        @AuraEnabled public List<AggregateTheme> themes;
        @AuraEnabled public List<AggregateTheme> praises;
        @AuraEnabled public List<AggregateTheme> complaints;
    }

    public class AggregateTheme {
        @AuraEnabled public String label;
        @AuraEnabled public Integer mentions;
        @AuraEnabled public String sentiment;
        @AuraEnabled public List<Id> reviewIds;
    }

    public static Analysis analyze(String text) {
        Analysis result = new Analysis();
        if (String.isBlank(text)) {
            result.score = 0;
            result.label = 'Neutral';
            result.keywords = new List<String>();
            return result;
        }

        Analyzer analyzer = new Analyzer(text);
        return analyzer.evaluate();
    }

    public static BatchResult analyzeBatch(Map<Id, String> texts) {
        BatchResult result = new BatchResult();
        result.results = new Map<Id, Analysis>();
        result.themes = new List<AggregateTheme>();
        result.praises = new List<AggregateTheme>();
        result.complaints = new List<AggregateTheme>();
        if (texts == null || texts.isEmpty()) {
            return result;
        }

        Map<String, AggregateTheme> themeTotals = new Map<String, AggregateTheme>();
        Map<String, AggregateTheme> praiseTotals = new Map<String, AggregateTheme>();
        Map<String, AggregateTheme> complaintTotals = new Map<String, AggregateTheme>();

        for (Id key : texts.keySet()) {
            String text = texts.get(key);
            Analysis analysis = analyze(text);
            result.results.put(key, analysis);

            for (String keyword : analysis.keywords) {
                upsertTheme(themeTotals, keyword, key, analysis.label);
                if (analysis.label == 'Positive') {
                    upsertTheme(praiseTotals, keyword, key, analysis.label);
                } else if (analysis.label == 'Negative') {
                    upsertTheme(complaintTotals, keyword, key, analysis.label);
                }
            }
        }

        result.themes = sortThemes(themeTotals.values());
        result.praises = sortThemes(praiseTotals.values());
        result.complaints = sortThemes(complaintTotals.values());
        return result;
    }

    private static void upsertTheme(Map<String, AggregateTheme> map, String keyword, Id reviewId, String sentiment) {
        if (String.isBlank(keyword) || reviewId == null) {
            return;
        }
        AggregateTheme theme = map.get(keyword);
        if (theme == null) {
            theme = new AggregateTheme();
            theme.label = keyword;
            theme.mentions = 0;
            theme.sentiment = sentiment;
            theme.reviewIds = new List<Id>();
            map.put(keyword, theme);
        }
        theme.mentions++;
        if (theme.reviewIds == null) {
            theme.reviewIds = new List<Id>();
        }
        theme.reviewIds.add(reviewId);
    }

    private static List<AggregateTheme> sortThemes(Iterable<AggregateTheme> themes) {
        List<AggregateTheme> list = new List<AggregateTheme>();
        if (themes == null) {
            return list;
        }
        list.addAll(themes);
        list.sort(new AggregateThemeComparator());
        return list;
    }

    private class AggregateThemeComparator implements System.Comparator<AggregateTheme> {
        public Integer compare(AggregateTheme a, AggregateTheme b) {
            Integer aMentions = a == null ? 0 : a.mentions;
            Integer bMentions = b == null ? 0 : b.mentions;
            return bMentions.compareTo(aMentions);
        }
    }

    private class Analyzer {
        private final String source;
        private final String lower;

        Analyzer(String text) {
            source = text;
            lower = text.toLowerCase();
        }

        Analysis evaluate() {
            Analysis outcome = new Analysis();
            outcome.keywords = new List<String>();

            Integer positiveHits = scoreForWords(positiveWords());
            Integer negativeHits = scoreForWords(negativeWords());
            Integer totalHits = positiveHits + negativeHits;

            Integer lengthBonus = lengthSignal();
            Integer emphasis = emphasisSignal();

            Integer rawScore = (positiveHits * 2) - (negativeHits * 2) + lengthBonus + emphasis;
            Decimal normalized = normalize(rawScore, totalHits);

            outcome.score = normalized;
            outcome.label = labelFor(normalized);
            outcome.keywords.addAll(extractKeywords());
            return outcome;
        }

        private Integer scoreForWords(Set<String> dictionary) {
            Integer hits = 0;
            for (String word : dictionary) {
                if (lower.contains(word)) {
                    hits++;
                }
            }
            return hits;
        }

        private Integer lengthSignal() {
            Integer words = source.split('\s+').size();
            if (words >= 80) {
                return 1;
            }
            if (words <= 5) {
                return -1;
            }
            return 0;
        }

        private Integer emphasisSignal() {
            Integer exclamations = source.countMatches('!');
            if (exclamations >= 3) {
                return 1;
            }
            if (exclamations == 0) {
                return 0;
            }
            return lower.contains('not') || lower.contains("isn't") ? 0 : 1;
        }

        private Decimal normalize(Integer rawScore, Integer totalHits) {
            Integer maxPossible = Math.max(1, totalHits * 4);
            Decimal ratio = Decimal.valueOf(rawScore) / Decimal.valueOf(maxPossible);
            Decimal clamped = Math.max(-1, Math.min(1, ratio));
            return clamped.setScale(2);
        }

        private String labelFor(Decimal score) {
            if (score >= 0.25) {
                return 'Positive';
            }
            if (score <= -0.25) {
                return 'Negative';
            }
            return 'Neutral';
        }

        private List<String> extractKeywords() {
            List<String> keywords = new List<String>();
            Map<String, String> dictionary = keywordDictionary();
            for (String phrase : dictionary.keySet()) {
                if (lower.contains(phrase)) {
                    keywords.add(dictionary.get(phrase));
                }
            }
            return keywords;
        }

        private Set<String> positiveWords() {
            return new Set<String>{
                'beautiful', 'amazing', 'spacious', 'quiet', 'love', 'perfect', 'impressed',
                'friendly', 'welcoming', 'clean', 'bright', 'cozy', 'modern', 'convenient',
                'recommend', 'great', 'excellent', 'fantastic', 'wonderful', 'peaceful'
            };
        }

        private Set<String> negativeWords() {
            return new Set<String>{
                'noisy', 'dirty', 'disappointing', 'poor', 'bad', 'terrible', 'awful',
                'broken', 'outdated', 'unsafe', 'smelly', 'cramped', 'rude', 'crowded',
                'avoid', 'worst', 'hate', 'refund', 'complaint', 'issue'
            };
        }

        private Map<String, String> keywordDictionary() {
            return new Map<String, String>{
                'natural light' => 'Natural light',
                'public transit' => 'Transit access',
                'walk to' => 'Walkable amenities',
                'school' => 'School district',
                'parking' => 'Parking availability',
                'noise' => 'Noise level',
                'maintenance' => 'Maintenance quality',
                'renovated' => 'Recent renovations'
            };
        }
    }
}
