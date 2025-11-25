public with sharing class ReviewVoteService {
    public class VoteRequest {
        @AuraEnabled public Id reviewId;
        @AuraEnabled public String voteType; // Helpful / Unhelpful
    }

    public class VoteResponse {
        @AuraEnabled public Decimal helpfulScore;
        @AuraEnabled public Integer helpfulVotes;
        @AuraEnabled public Integer unhelpfulVotes;
    }

    @AuraEnabled
    public static VoteResponse castVote(VoteRequest request) {
        if (request == null || request.reviewId == null || String.isBlank(request.voteType)) {
            throw new AuraHandledException('Review and vote type required.');
        }
        if (UserInfo.getUserId() == null) {
            throw new AuraHandledException('You must be signed in to vote.');
        }

        Review_Vote__c vote = fetchExistingVote(request.reviewId, UserInfo.getUserId());
        if (vote == null) {
            vote = new Review_Vote__c();
            vote.Property_Review__c = request.reviewId;
            vote.Voter__c = UserInfo.getUserId();
        }
        vote.Vote_Type__c = request.voteType;
        vote.Weight__c = calculateWeight(UserInfo.getUserId());
        upsert vote;

        return summarizeVotes(request.reviewId);
    }

    private static Review_Vote__c fetchExistingVote(Id reviewId, Id userId) {
        List<Review_Vote__c> votes = [
            SELECT Id, Property_Review__c, Voter__c
            FROM Review_Vote__c
            WHERE Property_Review__c = :reviewId AND Voter__c = :userId
            LIMIT 1
        ];
        return votes.isEmpty() ? null : votes[0];
    }

    private static Decimal calculateWeight(Id userId) {
        Integer pastReviews = [
            SELECT COUNT() FROM Property_Review__c WHERE CreatedById = :userId
        ];
        Integer pastVotes = [
            SELECT COUNT() FROM Review_Vote__c WHERE Voter__c = :userId
        ];
        Decimal weight = 1 + (Decimal.valueOf(pastReviews) * 0.1) + (Decimal.valueOf(pastVotes) * 0.05);
        if (weight > 3) {
            weight = 3;
        }
        return weight;
    }

    private static VoteResponse summarizeVotes(Id reviewId) {
        AggregateResult[] aggregates = [
            SELECT
                SUM(CASE WHEN Vote_Type__c = 'Helpful' THEN Weight__c ELSE 0 END) helpfulScore,
                SUM(CASE WHEN Vote_Type__c = 'Helpful' THEN 1 ELSE 0 END) helpfulVotes,
                SUM(CASE WHEN Vote_Type__c = 'Unhelpful' THEN 1 ELSE 0 END) unhelpfulVotes
            FROM Review_Vote__c
            WHERE Property_Review__c = :reviewId
        ];
        VoteResponse response = new VoteResponse();
        if (!aggregates.isEmpty()) {
            AggregateResult ar = aggregates[0];
            response.helpfulScore = (Decimal)ar.get('helpfulScore');
            response.helpfulVotes = (Integer)ar.get('helpfulVotes');
            response.unhelpfulVotes = (Integer)ar.get('unhelpfulVotes');
        }
        return response;
    }
}
