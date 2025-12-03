public with sharing class ReviewResponseService {
    public class ResponseOption {
        @AuraEnabled public String draftText;
        @AuraEnabled public String tone;
        @AuraEnabled public Decimal confidence;
        @AuraEnabled public List<String> keyPoints;
        @AuraEnabled public String provider;
    }

    public class ResponseRequest {
        @AuraEnabled public Id reviewId;
        @AuraEnabled public String tone;
        @AuraEnabled public Boolean includeFollowUp;
    }

    @AuraEnabled(cacheable=true)
    public static ResponseOption generateResponse(ResponseRequest request) {
        if (request == null || request.reviewId == null) {
            throw new AuraHandledException('Review id is required.');
        }
        Property_Review__c review = [
            SELECT Id, Title__c, Comment__c, Rating__c, CreatedDate, Property__c
            FROM Property_Review__c
            WHERE Id = :request.reviewId
            LIMIT 1
        ];

        String sentiment = ReviewSentimentService.getSentiment(review.Comment__c);
        ResponseOption option = new ResponseOption();
        option.tone = request.tone != null ? request.tone : 'Professional';
        option.provider = 'MockProvider';
        option.confidence = 0.82;
        option.keyPoints = new List<String>();
        option.keyPoints.add('Sentiment: ' + sentiment);
        option.keyPoints.add('Rating: ' + review.Rating__c);
        option.draftText = buildDraft(review, option.tone, sentiment, request.includeFollowUp);
        return option;
    }

    @AuraEnabled
    public static Id saveResponse(Id reviewId, String finalText, String tone, Decimal confidence, String provider, Boolean markAsPosted) {
        if (reviewId == null || String.isBlank(finalText)) {
            throw new AuraHandledException('Review and final text are required.');
        }
        Review_Response__c response = new Review_Response__c();
        response.Review__c = reviewId;
        response.FinalText__c = finalText;
        response.Tone__c = tone;
        response.Confidence__c = confidence;
        response.Provider__c = provider;
        response.Status__c = markAsPosted ? 'Posted' : 'Draft';
        if (markAsPosted) {
            response.PostedAt__c = System.now();
            response.PostedBy__c = UserInfo.getUserId();
        }
        insert response;
        return response.Id;
    }

    private static String buildDraft(Property_Review__c review, String tone, String sentiment, Boolean includeFollowUp) {
        tone = tone != null ? tone : 'Professional';
        String greeting = tone == 'Friendly' ? 'Hi there' : 'Hello';
        String appreciation = sentiment == 'Positive' ? 'Thanks for the wonderful feedback!' : 'Thank you for taking the time to share your thoughts.';
        String followUp = includeFollowUp == true ? ' Please reach out to our team so we can continue helping you.' : '';
        return String.format('{0}, we appreciate your {1} review. {2}{3}', new List<String>{
            greeting,
            sentiment.toLowerCase(),
            appreciation,
            followUp
        });
    }
}
