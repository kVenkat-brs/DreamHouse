public with sharing class PropertyController {
    private static final Decimal DEFAULT_MAX_PRICE = 9999999;
    private static final Integer DEFAULT_PAGE_SIZE = 9;

    /**
     * Endpoint that retrieves a paged and filtered list of properties
     * @param searchKey String used for searching on property title, city and tags
     * @param maxPrice Maximum price
     * @param minBedrooms Minimum number of bedrooms
     * @param minBathrooms Minimum number of bathrooms
     * @param pageSize Number of properties per page
     * @param pageNumber Page number
     * @return PagedResult object holding the paged and filtered list of properties
     */
    @AuraEnabled(cacheable=true)
    public static PagedResult getPagedPropertyList(
        String searchKey,
        Decimal maxPrice,
        Integer minBedrooms,
        Integer minBathrooms,
        Integer pageSize,
        Integer pageNumber
    ) {
        // Normalize inputs
        Decimal safeMaxPrice = maxPrice ?? DEFAULT_MAX_PRICE;
        Integer safeMinBedrooms = minBedrooms ?? 0;
        Integer safeMinBathrooms = minBathrooms ?? 0;
        Integer safePageSize = pageSize ?? DEFAULT_PAGE_SIZE;
        Integer safePageNumber = pageNumber ?? 1;

        String searchPattern = '%' + searchKey + '%';
        Integer offset = (safePageNumber - 1) * safePageSize;

        PagedResult result = new PagedResult();
        result.pageSize = safePageSize;
        result.pageNumber = safePageNumber;
        result.totalItemCount = [
            SELECT COUNT()
            FROM Property__c
            WHERE
                (Name LIKE :searchPattern
                OR City__c LIKE :searchPattern
                OR Tags__c LIKE :searchPattern)
                AND Price__c <= :safeMaxPrice
                AND Beds__c >= :safeMinBedrooms
                AND Baths__c >= :safeMinBathrooms
        ];
        result.records = [
            SELECT
                Id,
                Name,
                Address__c,
                City__c,
                State__c,
                Description__c,
                Price__c,
                Baths__c,
                Beds__c,
                Thumbnail__c,
                Location__Latitude__s,
                Location__Longitude__s
            FROM Property__c
            WHERE
                (Name LIKE :searchPattern
                OR City__c LIKE :searchPattern
                OR Tags__c LIKE :searchPattern)
                AND Price__c <= :safeMaxPrice
                AND Beds__c >= :safeMinBedrooms
                AND Baths__c >= :safeMinBathrooms
            WITH USER_MODE
            ORDER BY Price__c
            LIMIT :safePageSize
            OFFSET :offset
        ];
        return result;
    }

    /**
     * Endpoint that retrieves pictures associated with a property
     * @param propertyId Property Id
     * @return List of ContentVersion holding the pictures
     */
    @AuraEnabled(cacheable=true)
    public static List<ContentVersion> getPictures(Id propertyId) {
        List<ContentDocumentLink> links = [
            SELECT Id, LinkedEntityId, ContentDocument.Title
            FROM ContentDocumentLink
            WHERE
                LinkedEntityId = :propertyId
                AND ContentDocument.FileType IN ('PNG', 'JPG', 'GIF')
            WITH USER_MODE
        ];

        if (links.isEmpty()) {
            return null;
        }

        Set<Id> contentIds = new Set<Id>();

        for (ContentDocumentLink link : links) {
            contentIds.add(link.ContentDocumentId);
        }

        return [
            SELECT Id, Title
            FROM ContentVersion
            WHERE ContentDocumentId IN :contentIds AND IsLatest = TRUE
            WITH USER_MODE
            ORDER BY CreatedDate
        ];
    }

    /**
     * Retrieves reviews for a property ordered by most recent first.
     */
    @AuraEnabled(cacheable=true)
    public static List<PropertyReviewDTO> getPropertyReviews(Id propertyId) {
        if (propertyId == null) {
            return new List<PropertyReviewDTO>();
        }

        List<PropertyReviewDTO> dtos = new List<PropertyReviewDTO>();

        try {
            Boolean hasCommentField = hasReviewField('Comment__c');
            Boolean hasTitleField = hasReviewField('Title__c');

            String fieldList = 'Id, Property__c, Rating__c, CreatedDate, CreatedBy.Name';
            if (hasCommentField) {
                fieldList += ', Comment__c';
            }
            if (hasTitleField) {
                fieldList += ', Title__c';
            }

            List<Property_Review__c> rawReviews = Database.query(
                'SELECT ' + fieldList + ' ' +
                'FROM Property_Review__c ' +
                'WHERE Property__c = :propertyId ' +
                'WITH USER_MODE ' +
                'ORDER BY CreatedDate DESC ' +
                'LIMIT 200'
            );

            dtos.addAll(mapReviewsWithSentiment(rawReviews, hasCommentField, hasTitleField));
        } catch (Exception ex) {
            System.debug(LoggingLevel.WARN, 'Failed to load comments/title fields: ' + ex.getMessage());

            List<Property_Review__c> fallbackReviews = [
                SELECT Id,
                    Property__c,
                    Rating__c,
                    CreatedDate,
                    CreatedBy.Name
                FROM Property_Review__c
                WHERE Property__c = :propertyId
                WITH USER_MODE
                ORDER BY CreatedDate DESC
                LIMIT 200
            ];

            dtos.addAll(mapBasicReviews(fallbackReviews));
        }

        return dtos;
    }

    /**
     * Creates a new review for the provided property.
     * @param propertyId Id of the Property__c record being reviewed.
     * @param rating Number of stars (1-5) the reviewer selected.
     * @param comment Body of the review text.
     */
    @AuraEnabled
    public static Id savePropertyReview(Id propertyId, Decimal rating, String comment, String title) {
        if (propertyId == null) {
            throw new AuraHandledException('Property Id is required.');
        }

        Decimal normalizedRating = rating == null ? 0 : rating;
        if (normalizedRating < 1 || normalizedRating > 5) {
            throw new AuraHandledException('Rating must be between 1 and 5.');
        }

        if (String.isBlank(comment)) {
            throw new AuraHandledException('A comment is required.');
        }

        Boolean hasCommentField = hasReviewField('Comment__c');
        Boolean hasTitleField = hasReviewField('Title__c');

        Property_Review__c review = new Property_Review__c();
        review.Property__c = propertyId;
        review.Rating__c = normalizedRating;
        if (hasCommentField) {
            review.put('Comment__c', comment);
        }
        if (hasTitleField && !String.isBlank(title)) {
            review.put('Title__c', title.length() > 255 ? title.substring(0, 255) : title);
        }

        insert review;

        return review.Id;
    }
    public class PropertyReviewDTO {
        @AuraEnabled public Id id;
        @AuraEnabled public Id propertyId;
        @AuraEnabled public Decimal rating;
        @AuraEnabled public String comment;
        @AuraEnabled public String title;
        @AuraEnabled public Datetime createdDate;
        @AuraEnabled public String reviewerName;
        @AuraEnabled public Decimal sentimentScore;
        @AuraEnabled public String sentimentLabel;
        @AuraEnabled public List<String> keywords;
        @AuraEnabled public String summary;
    }

    private static Boolean hasReviewField(String apiName) {
        return Property_Review__c.SObjectType.getDescribe().fields.getMap().containsKey(apiName);
    }

    private static PropertyReviewDTO mapReview(Property_Review__c review, Boolean includeComment, Boolean includeTitle) {
        PropertyReviewDTO dtoInstance = new PropertyReviewDTO();
        dtoInstance.id = review.Id;
        dtoInstance.propertyId = review.Property__c;
        dtoInstance.rating = review.Rating__c;
        dtoInstance.comment = includeComment ? (String)review.get('Comment__c') : null;
        dtoInstance.title = includeTitle ? (String)review.get('Title__c') : null;
        dtoInstance.createdDate = review.CreatedDate;
        dtoInstance.reviewerName = review.CreatedBy?.Name;
        dtoInstance.sentimentScore = 0;
        dtoInstance.sentimentLabel = 'Neutral';
        dtoInstance.keywords = new List<String>();
        dtoInstance.summary = null;
        return dtoInstance;
    }

    private static List<PropertyReviewDTO> mapBasicReviews(List<Property_Review__c> reviews) {
        List<PropertyReviewDTO> dtos = new List<PropertyReviewDTO>();
        for (Property_Review__c review : reviews) {
            PropertyReviewDTO dtoInstance = mapReview(review, false, false);
            dtos.add(dtoInstance);
        }
        return dtos;
    }

    private static List<PropertyReviewDTO> mapReviewsWithSentiment(
        List<Property_Review__c> reviews,
        Boolean includeComment,
        Boolean includeTitle
    ) {
        List<PropertyReviewDTO> dtos = new List<PropertyReviewDTO>();
        if (reviews.isEmpty()) {
            return dtos;
        }

        Map<Id, String> commentMap = new Map<Id, String>();
        for (Property_Review__c review : reviews) {
            PropertyReviewDTO dtoInstance = mapReview(review, includeComment, includeTitle);
            dtos.add(dtoInstance);
            if (!String.isBlank(dtoInstance.comment)) {
                commentMap.put(dtoInstance.id, dtoInstance.comment);
            }
        }

        SentimentService.BatchResult batch = commentMap.isEmpty()
            ? null
            : SentimentService.analyzeBatch(commentMap);

        if (batch != null && batch.results != null) {
            for (PropertyReviewDTO dtoInstance : dtos) {
                if (batch.results.containsKey(dtoInstance.id)) {
                    SentimentService.Analysis analysis = batch.results.get(dtoInstance.id);
                    dtoInstance.sentimentScore = analysis.score;
                    dtoInstance.sentimentLabel = analysis.label;
                    dtoInstance.keywords = analysis.keywords;
                }
            }
        }

        attachSummaries(dtos, batch);

        return dtos;
    }

    private static void attachSummaries(List<PropertyReviewDTO> reviews, SentimentService.BatchResult batch) {
        if (reviews == null || reviews.isEmpty() || batch == null) {
            return;
        }

        String summary = buildSummary(batch);
        if (String.isBlank(summary)) {
            return;
        }

        for (PropertyReviewDTO dto : reviews) {
            dto.summary = summary;
        }
    }

    private static String buildSummary(SentimentService.BatchResult batch) {
        if (batch == null) {
            return null;
        }

        List<String> highlightPhrases = summarizeThemes(batch.praises);
        List<String> cautionPhrases = summarizeThemes(batch.complaints);
        List<String> generalThemes = summarizeThemes(batch.themes);

        List<String> segments = new List<String>();
        if (!highlightPhrases.isEmpty()) {
            segments.add('Loved: ' + String.join(highlightPhrases, ', '));
        }
        if (!cautionPhrases.isEmpty()) {
            segments.add('Concerns: ' + String.join(cautionPhrases, ', '));
        }
        if (!generalThemes.isEmpty()) {
            segments.add('Themes: ' + String.join(generalThemes, ', '));
        }

        return segments.isEmpty() ? null : String.join(segments, ' | ');
    }

    private static List<String> summarizeThemes(List<SentimentService.AggregateTheme> themes) {
        List<String> phrases = new List<String>();
        if (themes == null || themes.isEmpty()) {
            return phrases;
        }

        Integer limit = Math.min(3, themes.size());
        for (Integer i = 0; i < limit; i++) {
            SentimentService.AggregateTheme theme = themes[i];
            if (theme == null || String.isBlank(theme.label)) {
                continue;
            }
            String phrase = theme.label;
            if (theme.mentions > 1) {
                phrase += ' (' + theme.mentions + ')';
            }
            phrases.add(phrase);
        }
        return phrases;
    }
}
