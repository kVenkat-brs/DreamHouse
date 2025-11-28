public with sharing class ReviewWordCloudService {
    public class WordCloudEntry {
        @AuraEnabled public String term;
        @AuraEnabled public Integer totalCount;
        @AuraEnabled public Integer positiveCount;
        @AuraEnabled public Integer neutralCount;
        @AuraEnabled public Integer negativeCount;
        @AuraEnabled public Decimal sentimentScore;
        @AuraEnabled public Decimal trendDelta;
        @AuraEnabled public Decimal recentShare;
        @AuraEnabled public Date lastMentioned;
    }

    private static final Set<String> STOP_WORDS = new Set<String>{
        'a','an','and','the','for','with','this','that','from','have','has','had','was','were','are','will','would','could','should','about','into','onto','over','under','out','in','on','of','to','it','its','is','be','as','by','or','at','we','you','they','but','if','our','your','their','them','he','she','him','her','his','hers','than','then','so','too','very','can','just','not','no','yes','all','any','each','own','same','such','most','more','less','up','down','off','after','before','again','once','also','ever','much','many','been','being','do','did','doing','through'
    };

    @AuraEnabled(cacheable=true)
    public static List<WordCloudEntry> buildWordCloud(Id propertyId, Integer daysWindow) {
        if (propertyId == null) {
            throw new AuraHandledException('Property Id is required.');
        }
        Integer lookback = daysWindow == null || daysWindow <= 0 ? 90 : Math.min(daysWindow, 365);
        Date today = Date.today();
        Date startCurrent = today.addDays(-lookback + 1);
        Date startPrevious = startCurrent.addDays(-lookback);

        List<Property_Review__c> reviews = [
            SELECT Id, Rating__c, Comment__c, CreatedDate
            FROM Property_Review__c
            WHERE Property__c = :propertyId
            AND CreatedDate >= :DateTime.newInstance(startPrevious, Time.newInstance(0,0,0,0))
            WITH SECURITY_ENFORCED
        ];
        Map<String, WordAccumulator> index = new Map<String, WordAccumulator>();
        for (Property_Review__c review : reviews) {
            if (String.isBlank(review.Comment__c)) {
                continue;
            }
            Boolean isPositive = review.Rating__c != null && review.Rating__c >= 4;
            Boolean isNegative = review.Rating__c != null && review.Rating__c <= 2;
            Date reviewDate = review.CreatedDate.date();
            Boolean inCurrentWindow = reviewDate >= startCurrent && reviewDate <= today;
            Boolean inPreviousWindow = reviewDate >= startPrevious && reviewDate < startCurrent;

            List<String> tokens = tokenize(review.Comment__c);
            for (String token : tokens) {
                if (token.length() < 3 || STOP_WORDS.contains(token)) {
                    continue;
                }
                WordAccumulator acc = index.get(token);
                if (acc == null) {
                    acc = new WordAccumulator(token);
                    index.put(token, acc);
                }
                acc.totalCount++;
                if (isPositive) {
                    acc.positiveCount++;
                } else if (isNegative) {
                    acc.negativeCount++;
                } else {
                    acc.neutralCount++;
                }
                if (inCurrentWindow) {
                    acc.currentWindowCount++;
                }
                if (inPreviousWindow) {
                    acc.previousWindowCount++;
                }
                if (acc.lastMentioned == null || reviewDate > acc.lastMentioned) {
                    acc.lastMentioned = reviewDate;
                }
            }
        }

        List<WordCloudEntry> results = new List<WordCloudEntry>();
        for (WordAccumulator acc : index.values()) {
            if (acc.totalCount < 2) {
                continue;
            }
            WordCloudEntry entry = new WordCloudEntry();
            entry.term = acc.term;
            entry.totalCount = acc.totalCount;
            entry.positiveCount = acc.positiveCount;
            entry.neutralCount = acc.neutralCount;
            entry.negativeCount = acc.negativeCount;
            Integer sentimentDenominator = Math.max(1, acc.positiveCount + acc.neutralCount + acc.negativeCount);
            entry.sentimentScore = Decimal.valueOf(acc.positiveCount - acc.negativeCount) / sentimentDenominator;
            Integer prev = acc.previousWindowCount;
            Integer curr = acc.currentWindowCount;
            Integer base = Math.max(1, prev == 0 ? 1 : prev);
            entry.trendDelta = Decimal.valueOf(curr - prev) / base;
            entry.recentShare = Decimal.valueOf(curr) / Math.max(1, acc.totalCount);
            entry.lastMentioned = acc.lastMentioned;
            results.add(entry);
        }
        results.sort(new WordEntrySorter());
        if (results.size() > 150) {
            return results.subList(0, 150);
        }
        return results;
    }

    private class WordAccumulator {
        public String term;
        public Integer totalCount = 0;
        public Integer positiveCount = 0;
        public Integer neutralCount = 0;
        public Integer negativeCount = 0;
        public Integer currentWindowCount = 0;
        public Integer previousWindowCount = 0;
        public Date lastMentioned;

        public WordAccumulator(String word) {
            term = word;
        }
    }

    private class WordEntrySorter implements Comparator<WordCloudEntry> {
        public Integer compare(WordCloudEntry a, WordCloudEntry b) {
            Integer comp = Integer.valueOf(b.totalCount).compareTo(Integer.valueOf(a.totalCount));
            if (comp != 0) return comp;
            return a.term.compareToIgnoreCase(b.term);
        }
    }

    private static List<String> tokenize(String input) {
        String cleaned = input.toLowerCase().replaceAll('[^a-z0-9\'\- ]', ' ');
        List<String> parts = cleaned.split('[\s]+');
        List<String> tokens = new List<String>();
        for (String part : parts) {
            if (String.isBlank(part)) {
                continue;
            }
            String normalized = part;
            // Trim possessives and trailing punctuation remnants
            if (normalized.endsWith("'s")) {
                normalized = normalized.substring(0, normalized.length() - 2);
            }
            normalized = normalized.trim();
            if (!String.isBlank(normalized)) {
                tokens.add(normalized);
            }
        }
        return tokens;
    }
}
