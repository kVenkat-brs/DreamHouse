public with sharing class GamificationService {
    public class ProgressResponse {
        @AuraEnabled public Decimal points;
        @AuraEnabled public Integer level;
        @AuraEnabled public List<String> badges;
    }

    @AuraEnabled
    public static ProgressResponse updateProgress(Id userId) {
        if (userId == null) {
            userId = UserInfo.getUserId();
        }

        List<Property_Review__c> reviews = [
            SELECT Id, Rating__c, Comment__c, CreatedDate
            FROM Property_Review__c
            WHERE CreatedById = :userId
        ];
        Integer reviewCount = reviews.size();
        Integer detailedReviews = 0;
        for (Property_Review__c review : reviews) {
            if (!String.isBlank(review.Comment__c) && review.Comment__c.length() > 250) {
                detailedReviews++;
            }
        }

        AggregateResult[] helpfulAgg = [
            SELECT
                SUM(CASE WHEN Vote_Type__c = 'Helpful' THEN Weight__c ELSE 0 END) helpfulWeight,
                COUNT(Id) totalVotes
            FROM Review_Vote__c
            WHERE Property_Review__c IN :reviews
        ];
        Decimal helpfulWeight = helpfulAgg.isEmpty() ? 0 : (Decimal)helpfulAgg[0].get('helpfulWeight');
        Integer totalVotes = helpfulAgg.isEmpty() ? 0 : (Integer)helpfulAgg[0].get('totalVotes');

        Integer rewardsRedeemed = [
            SELECT COUNT()
            FROM Reward_Redemption__c
            WHERE User__c = :userId
        ];

        Decimal points = Decimal.valueOf(reviewCount * 10 + detailedReviews * 15 + helpfulWeight * 5 - rewardsRedeemed * 20);
        if (points < 0) points = 0;
        Integer level = Integer.valueOf(Math.floor(points / 100)) + 1;

        Reviewer_Progress__c progress = fetchProgress(userId);
        progress.Points__c = points;
        progress.Level__c = level;
        upsert progress;

        List<String> badges = evaluateBadges(userId, reviewCount, detailedReviews, helpfulWeight, points);

        ProgressResponse response = new ProgressResponse();
        response.points = points;
        response.level = level;
        response.badges = badges;
        return response;
    }

    private static Reviewer_Progress__c fetchProgress(Id userId) {
        Reviewer_Progress__c progress;
        try {
            progress = [
                SELECT Id, User__c, Points__c, Level__c
                FROM Reviewer_Progress__c
                WHERE User__c = :userId
                LIMIT 1
            ];
        } catch (QueryException ex) {
            progress = new Reviewer_Progress__c(User__c = userId);
        }
        return progress;
    }

    private static List<String> evaluateBadges(Id userId, Integer reviewCount, Integer detailedReviews, Decimal helpfulWeight, Decimal points) {
        List<String> newlyEarned = new List<String>();
        if (reviewCount >= 10) newlyEarned.add('Trailblazer');
        if (detailedReviews >= 5) newlyEarned.add('Detailed Critic');
        if (helpfulWeight >= 20) newlyEarned.add('Community Mentor');
        if (points >= 500) newlyEarned.add('Local Expert');

        Set<String> existingBadges = new Set<String>();
        for (Reviewer_Badge__c badge : [
            SELECT Badge_Name__c
            FROM Reviewer_Badge__c
            WHERE User__c = :userId
        ]) {
            existingBadges.add(badge.Badge_Name__c);
        }

        for (String badgeName : newlyEarned) {
            if (!existingBadges.contains(badgeName)) {
                insert new Reviewer_Badge__c(User__c = userId, Badge_Name__c = badgeName);
            }
        }
        newlyEarned.addAll(existingBadges);
        return newlyEarned;
    }
}
