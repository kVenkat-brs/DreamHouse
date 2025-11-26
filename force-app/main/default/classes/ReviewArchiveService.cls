public with sharing class ReviewArchiveService {
    @AuraEnabled
    public static void archiveReview(Id reviewId) {
        Property_Review__c review = [
            SELECT Id, Comment__c, CreatedDate, Rating__c
            FROM Property_Review__c
            WHERE Id = :reviewId
            LIMIT 1
        ];

        Review_Archive__c archive = new Review_Archive__c();
        archive.Original_Review__c = review.Id;
        archive.Archive_Date__c = Date.today();
        archive.Retention_End_Date__c = calculateRetention(review.CreatedDate);
        archive.Archived_Body__c = review.Comment__c;
        archive.Search_Tokens__c = buildTokens(review);
        insert archive;
    }

    @AuraEnabled(cacheable=true)
    public static List<Review_Archive__c> searchArchives(String queryText) {
        if (String.isBlank(queryText)) {
            return [
                SELECT Id, Original_Review__c, Archived_Body__c, Archive_Date__c
                FROM Review_Archive__c
                ORDER BY Archive_Date__c DESC
                LIMIT 50
            ];
        }
        String likeQuery = '%' + queryText.toLowerCase() + '%';
        return [
            SELECT Id, Original_Review__c, Archived_Body__c, Archive_Date__c
            FROM Review_Archive__c
            WHERE Search_Tokens__c LIKE :likeQuery
            ORDER BY Archive_Date__c DESC
            LIMIT 50
        ];
    }

    private static Date calculateRetention(Datetime createdDate) {
        Date base = createdDate == null ? Date.today() : createdDate.date();
        return base.addYears(7);
    }

    private static String buildTokens(Property_Review__c review) {
        List<String> tokens = new List<String>();
        if (review.Comment__c != null) {
            tokens.add(review.Comment__c.toLowerCase());
        }
        tokens.add('rating:' + review.Rating__c);
        return String.join(tokens, ' ');
    }
}
