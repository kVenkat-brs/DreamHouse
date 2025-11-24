public with sharing class ReviewQualityService {
    public class ReviewInput {
        public String comment;
        public String title;
        public Decimal rating;
    }

    public class QualityResult {
        @AuraEnabled public Decimal score;
        @AuraEnabled public String label;
        @AuraEnabled public List<String> factors;
        @AuraEnabled public String rationale;
    }

    public static QualityResult evaluate(ReviewInput input) {
        if (input == null) {
            return emptyResult();
        }
        String text = scrubText(input.comment, input.title);
        if (String.isBlank(text)) {
            return baselineResult();
        }

        Integer wordCount = countWords(text);
        Integer uniqueWords = countUniqueWords(text);
        Integer sentenceCount = countSentences(text);
        Integer helpfulHits = helpfulKeywordHits(text);
        Integer contextHits = contextKeywordHits(text);
        Integer emotiveHits = emotiveKeywordHits(text);

        Decimal lengthScore = scoreLength(wordCount);
        Decimal detailScore = scoreDetail(uniqueWords, wordCount, sentenceCount);
        Decimal helpfulScore = scoreHelpfulness(helpfulHits, contextHits, emotiveHits);
        Decimal writingScore = scoreWritingQuality(text, sentenceCount, wordCount);
        Decimal ratingBonus = scoreRatingConsistency(input.rating, helpfulHits);

        Decimal composite =
            (lengthScore * 0.35) +
            (detailScore * 0.25) +
            (helpfulScore * 0.25) +
            (writingScore * 0.1) +
            (ratingBonus * 0.05);

        QualityResult result = new QualityResult();
        result.score = clamp(composite.setScale(2));
        result.label = labelFor(result.score);
        result.factors = buildFactors(lengthScore, detailScore, helpfulScore, writingScore, ratingBonus, wordCount, sentenceCount, helpfulHits + contextHits + emotiveHits);
        result.rationale = buildRationale(result);
        return result;
    }

    public static Map<Id, QualityResult> evaluateBatch(Map<Id, ReviewInput> inputs) {
        Map<Id, QualityResult> results = new Map<Id, QualityResult>();
        if (inputs == null || inputs.isEmpty()) {
            return results;
        }
        for (Id key : inputs.keySet()) {
            results.put(key, evaluate(inputs.get(key)));
        }
        return results;
    }

    private static QualityResult emptyResult() {
        QualityResult result = new QualityResult();
        result.score = 0;
        result.label = 'Basic';
        result.factors = new List<String>();
        result.rationale = 'No review content provided.';
        return result;
    }

    private static QualityResult baselineResult() {
        QualityResult result = new QualityResult();
        result.score = 0.25;
        result.label = 'Basic';
        result.factors = new List<String>{'Very short review'};
        result.rationale = 'Review provides minimal detail.';
        return result;
    }

    private static Decimal scoreLength(Integer words) {
        if (words == null || words <= 0) {
            return 0;
        }
        if (words >= 180) {
            return 1;
        }
        Decimal ratio = Decimal.valueOf(words) / 180;
        return clamp(ratio.setScale(2));
    }

    private static Decimal scoreDetail(Integer uniqueWords, Integer words, Integer sentences) {
        if (words == null || words == 0 || uniqueWords == null) {
            return 0;
        }
        Decimal diversity = Decimal.valueOf(uniqueWords) / Math.max(words, 1);
        Decimal sentenceBlend = Decimal.valueOf(Math.max(sentences, 1)) / 6;
        Decimal score = (diversity * 0.6) + (sentenceBlend * 0.4);
        return clamp(score.setScale(2));
    }

    private static Decimal scoreHelpfulness(Integer helpfulHits, Integer contextHits, Integer emotiveHits) {
        Integer total = helpfulHits + contextHits + emotiveHits;
        if (total <= 0) {
            return 0;
        }
        Decimal base = Decimal.valueOf(Math.min(total, 6)) / 6;
        Decimal balance = helpfulHits > 0 ? 0.15 : 0;
        Decimal score = base + balance;
        return clamp(score.setScale(2));
    }

    private static Decimal scoreWritingQuality(String text, Integer sentences, Integer words) {
        if (String.isBlank(text) || words == null || words == 0) {
            return 0;
        }
        Integer exclamations = countOccurrences(text, '!');
        Integer capitals = countUppercaseWords(text);
        Integer allCaps = countAllCapsWords(text);
        Decimal averageSentence = Decimal.valueOf(words) / Math.max(sentences, 1);

        Decimal score = 1;
        if (averageSentence < 6) {
            score -= 0.1;
        } else if (averageSentence > 28) {
            score -= 0.1;
        }
        if (exclamations > 3) {
            score -= 0.1;
        }
        if (allCaps > 2) {
            score -= 0.15;
        }
        if (capitals > (words / 2)) {
            score -= 0.1;
        }
        return clamp(score.setScale(2));
    }

    private static Decimal scoreRatingConsistency(Decimal rating, Integer helpfulHits) {
        if (rating == null) {
            return 0;
        }
        Decimal base = Decimal.valueOf(helpfulHits > 0 ? 0.2 : 0);
        Decimal adjusted = (Decimal.valueOf(rating) / 5) * 0.3;
        return clamp((base + adjusted).setScale(2));
    }

    private static List<String> buildFactors(
        Decimal lengthScore,
        Decimal detailScore,
        Decimal helpfulScore,
        Decimal writingScore,
        Decimal ratingBonus,
        Integer words,
        Integer sentences,
        Integer totalHits
    ) {
        List<String> factors = new List<String>();
        if (lengthScore >= 0.6) {
            factors.add('Substantial length (' + words + ' words)');
        }
        if (detailScore >= 0.6) {
            factors.add('Detailed explanation (' + sentences + ' sentences)');
        }
        if (helpfulScore >= 0.6) {
            factors.add('Actionable insights (' + totalHits + ' helpful cues)');
        }
        if (writingScore <= 0.4) {
            factors.add('Consider improving sentence structure');
        }
        if (ratingBonus >= 0.3) {
            factors.add('Rating backed with helpful context');
        }
        return factors;
    }

    private static String buildRationale(QualityResult result) {
        if (result == null) {
            return null;
        }
        if (result.factors == null || result.factors.isEmpty()) {
            return 'Review quality scored at ' + result.score + '.';
        }
        return 'Score ' + result.score + ' due to ' + String.join(result.factors, '; ') + '.';
    }

    private static String labelFor(Decimal score) {
        if (score == null) {
            return 'Basic';
        }
        if (score >= 0.8) {
            return 'Insightful';
        }
        if (score >= 0.55) {
            return 'Helpful';
        }
        return 'Basic';
    }

    private static String scrubText(String comment, String title) {
        String base = comment;
        if (String.isBlank(base) && !String.isBlank(title)) {
            base = title;
        } else if (!String.isBlank(title)) {
            base = title + '. ' + base;
        }
        return base == null ? '' : base;
    }

    private static Integer countWords(String text) {
        if (String.isBlank(text)) {
            return 0;
        }
        return text.trim().split('\\s+').size();
    }

    private static Integer countUniqueWords(String text) {
        if (String.isBlank(text)) {
            return 0;
        }
        Set<String> uniqueWords = new Set<String>();
        for (String word : text.toLowerCase().split('\\s+')) {
            String cleaned = sanitizeWord(word);
            if (!String.isBlank(cleaned)) {
                uniqueWords.add(cleaned);
            }
        }
        return uniqueWords.size();
    }

    private static Integer countSentences(String text) {
        if (String.isBlank(text)) {
            return 0;
        }
        Integer matches = text.split('[\\.\\!\\?]+').size();
        return Math.max(matches, 1);
    }

    private static Integer helpfulKeywordHits(String text) {
        Set<String> keywords = new Set<String>{
            'because','recommend','tip','suggest','avoid','consider','note','keep','mind','advise','recommendation','warning','insight','helpful','experience'
        };
        return countKeywords(text, keywords);
    }

    private static Integer contextKeywordHits(String text) {
        Set<String> keywords = new Set<String>{
            'family','kids','school','commute','transit','parking','neighborhood','noise','maintenance','upgrades','renovation','storage','layout','space','bedroom','kitchen','bathroom','yard','garage','safety','value','price','hoa','manager'
        };
        return countKeywords(text, keywords);
    }

    private static Integer emotiveKeywordHits(String text) {
        Set<String> keywords = new Set<String>{
            'love','hate','amazing','terrible','fantastic','awful','beautiful','dirty','perfect','worst','best','incredible','disappointing','thrilled','frustrated'
        };
        return countKeywords(text, keywords);
    }

    private static Integer countKeywords(String text, Set<String> keywords) {
        if (String.isBlank(text) || keywords == null || keywords.isEmpty()) {
            return 0;
        }
        Integer hits = 0;
        String lower = text.toLowerCase();
        for (String keyword : keywords) {
            if (lower.contains(keyword)) {
                hits++;
            }
        }
        return hits;
    }

    private static Integer countOccurrences(String text, String search) {
        if (String.isBlank(text) || String.isBlank(search)) {
            return 0;
        }
        Integer count = 0;
        Integer index = text.indexOf(search);
        while (index != -1) {
            count++;
            index = text.indexOf(search, index + search.length());
        }
        return count;
    }

    private static Integer countUppercaseWords(String text) {
        if (String.isBlank(text)) {
            return 0;
        }
        Integer count = 0;
        for (String word : text.split('\\s+')) {
            if (word.length() > 0 && Character.isUpperCase(word.charAt(0))) {
                count++;
            }
        }
        return count;
    }

    private static Integer countAllCapsWords(String text) {
        if (String.isBlank(text)) {
            return 0;
        }
        Integer count = 0;
        for (String word : text.split('\\s+')) {
            String sanitized = sanitizeWord(word);
            if (sanitized.length() > 2 && sanitized == sanitized.toUpperCase()) {
                count++;
            }
        }
        return count;
    }

    private static String sanitizeWord(String word) {
        if (word == null) {
            return '';
        }
        String cleaned = word.replaceAll('[^A-Za-z]', '');
        return cleaned;
    }

    private static Decimal clamp(Decimal value) {
        if (value == null) {
            return 0;
        }
        if (value < 0) {
            return 0;
        }
        if (value > 1) {
            return 1;
        }
        return value;
    }
}
