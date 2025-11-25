public with sharing class ReviewerCredibilityService {
    public class CredibilityResult {
        @AuraEnabled public Decimal score;
        @AuraEnabled public Integer reviewCount;
        @AuraEnabled public Decimal trustRatio;
        @AuraEnabled public List<String> expertise;
        @AuraEnabled public Boolean verified;
    }

    public static Map<Id, CredibilityResult> computeCredibility(Set<Id> userIds) {
        Map<Id, CredibilityResult> results = new Map<Id, CredibilityResult>();
        if (userIds == null || userIds.isEmpty()) {
            return results;
        }

        Map<Id, List<Property_Review__c>> reviewsByUser = new Map<Id, List<Property_Review__c>>();
        Set<Id> reviewIds = new Set<Id>();
        for (Property_Review__c review : [
            SELECT Id, CreatedById, Rating__c, Comment__c, CreatedDate
            FROM Property_Review__c
            WHERE CreatedById IN :userIds
        ]) {
            reviewIds.add(review.Id);
            if (!reviewsByUser.containsKey(review.CreatedById)) {
                reviewsByUser.put(review.CreatedById, new List<Property_Review__c>());
            }
            reviewsByUser.get(review.CreatedById).add(review);
        }

        Map<Id, Decimal> helpfulWeightsByReview = new Map<Id, Decimal>();
        Map<Id, Decimal> unhelpfulWeightsByReview = new Map<Id, Decimal>();
        if (!reviewIds.isEmpty()) {
            AggregateResult[] voteAggregates = [
                SELECT Property_Review__c pid,
                    Vote_Type__c type,
                    SUM(Weight__c) totalWeight
                FROM Review_Vote__c
                WHERE Property_Review__c IN :reviewIds
                GROUP BY Property_Review__c, Vote_Type__c
            ];
            for (AggregateResult ar : voteAggregates) {
                Id pid = (Id)ar.get('pid');
                Decimal weight = (Decimal)ar.get('totalWeight');
                String type = (String)ar.get('type');
                if (weight == null || pid == null) {
                    continue;
                }
                if ('Helpful'.equalsIgnoreCase(type)) {
                    helpfulWeightsByReview.put(pid, weight);
                } else {
                    unhelpfulWeightsByReview.put(pid, weight);
                }
            }
        }

        for (Id userId : userIds) {
            CredibilityResult result = new CredibilityResult();
            result.score = 1;
            result.reviewCount = 0;
            result.trustRatio = 0;
            result.expertise = new List<String>();
            result.verified = false;

            List<Property_Review__c> userReviews = reviewsByUser.get(userId);
            if (userReviews == null || userReviews.isEmpty()) {
                results.put(userId, result);
                continue;
            }

            Integer helpfulVotes = 0;
            Integer unhelpfulVotes = 0;
            Map<String, Integer> expertiseCounts = new Map<String, Integer>();

            for (Property_Review__c review : userReviews) {
                result.reviewCount++;
                Decimal helpfulWeight = helpfulWeightsByReview.get(review.Id);
                Decimal unhelpfulWeight = unhelpfulWeightsByReview.get(review.Id);
                if (helpfulWeight != null) {
                    helpfulVotes += Integer.valueOf(Math.round(helpfulWeight.doubleValue()));
                }
                if (unhelpfulWeight != null) {
                    unhelpfulVotes += Integer.valueOf(Math.round(unhelpfulWeight.doubleValue()));
                }

                String comment = review.Comment__c;
                if (!String.isBlank(comment)) {
                    for (String keyword : extractKeywords(comment)) {
                        Integer count = expertiseCounts.get(keyword);
                        expertiseCounts.put(keyword, count == null ? 1 : count + 1);
                    }
                }
            }

            Integer totalVotes = helpfulVotes + unhelpfulVotes;
            if (totalVotes > 0) {
                result.trustRatio = Decimal.valueOf(helpfulVotes) / totalVotes;
            }

            List<String> topExpertise = new List<String>(expertiseCounts.keySet());
            topExpertise.sort(new ExpertiseComparator(expertiseCounts));
            if (topExpertise.size() > 5) {
                topExpertise.removeRange(5, topExpertise.size());
            }
            result.expertise = topExpertise;

            Decimal reviewFactor = Decimal.valueOf(Math.log(result.reviewCount + 1));
            Decimal trustFactor = result.trustRatio;
            Decimal expertiseFactor = topExpertise.isEmpty() ? 0 : Decimal.valueOf(topExpertise.size()) / 5;

            result.verified = (result.reviewCount >= 5 && result.trustRatio >= 0.6);

            Decimal score = 1
                + (reviewFactor * 0.3)
                + (trustFactor * 0.4)
                + (expertiseFactor * 0.2)
                + (result.verified ? 0.3 : 0);

            if (score > 3) score = 3;
            if (score < 0.5) score = 0.5;

            result.score = score.setScale(2);
            results.put(userId, result);
        }

        return results;
    }

    private static List<String> extractKeywords(String comment) {
        List<String> categories = new List<String>();
        String lower = comment.toLowerCase();
        if (lower.contains('kitchen')) categories.add('Kitchen');
        if (lower.contains('bath') || lower.contains('shower')) categories.add('Bathroom');
        if (lower.contains('commute') || lower.contains('transit')) categories.add('Transit');
        if (lower.contains('school')) categories.add('Schools');
        if (lower.contains('noise') || lower.contains('quiet')) categories.add('Noise');
        if (lower.contains('storage') || lower.contains('closet')) categories.add('Storage');
        if (categories.isEmpty()) {
            categories.add('General Insight');
        }
        return categories;
    }

    private class ExpertiseComparator implements System.Comparator<String> {
        Map<String, Integer> counts;
        ExpertiseComparator(Map<String, Integer> counts) {
            this.counts = counts;
        }
        public Integer compare(String a, String b) {
            Integer countA = counts.get(a);
            Integer countB = counts.get(b);
            if (countA == null) countA = 0;
            if (countB == null) countB = 0;
            return countB.compareTo(countA);
        }
    }
}
