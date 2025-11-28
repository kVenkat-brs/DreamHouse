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

        // Integrate with blockchain audit trail (anchoring) asynchronously.
        try {
            BlockchainAuditService.enqueueReviewForAnchoring(review, hasCommentField ? comment : null);
        } catch (Exception auditEx) {
            System.debug(LoggingLevel.WARN, 'Blockchain anchoring enqueue failed: ' + auditEx.getMessage());
        }

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
        @AuraEnabled public Decimal qualityScore;
        @AuraEnabled public String qualityLabel;
        @AuraEnabled public List<String> qualityFactors;
        @AuraEnabled public Boolean suspicious;
        @AuraEnabled public Decimal fraudRisk;
        @AuraEnabled public List<String> fraudReasons;
        @AuraEnabled public Decimal helpfulScore;
        @AuraEnabled public Integer helpfulVotes;
        @AuraEnabled public Integer unhelpfulVotes;
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
        dtoInstance.qualityScore = 0;
        dtoInstance.qualityLabel = 'Basic';
        dtoInstance.qualityFactors = new List<String>();
        dtoInstance.suspicious = false;
        dtoInstance.fraudRisk = 0;
        dtoInstance.fraudReasons = new List<String>();
        dtoInstance.helpfulScore = 0;
        dtoInstance.helpfulVotes = 0;
        dtoInstance.unhelpfulVotes = 0;
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
        Map<Id, ReviewQualityService.ReviewInput> qualityInputs = new Map<Id, ReviewQualityService.ReviewInput>();
        List<ReviewFraudService.ReviewInfo> fraudInputs = new List<ReviewFraudService.ReviewInfo>();
        for (Property_Review__c review : reviews) {
            PropertyReviewDTO dtoInstance = mapReview(review, includeComment, includeTitle);
            dtos.add(dtoInstance);
            if (!String.isBlank(dtoInstance.comment)) {
                commentMap.put(dtoInstance.id, dtoInstance.comment);
                ReviewQualityService.ReviewInput input = new ReviewQualityService.ReviewInput();
                input.comment = dtoInstance.comment;
                input.title = dtoInstance.title;
                input.rating = dtoInstance.rating;
                qualityInputs.put(dtoInstance.id, input);

                ReviewFraudService.ReviewInfo fraudInfo = new ReviewFraudService.ReviewInfo();
                fraudInfo.reviewId = dtoInstance.id;
                fraudInfo.propertyId = dtoInstance.propertyId;
                fraudInfo.rating = dtoInstance.rating;
                fraudInfo.comment = dtoInstance.comment;
                fraudInfo.title = dtoInstance.title;
                fraudInfo.reviewerName = dtoInstance.reviewerName;
                fraudInfo.createdDate = dtoInstance.createdDate;
                fraudInputs.add(fraudInfo);
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

        if (!qualityInputs.isEmpty()) {
            Map<Id, ReviewQualityService.QualityResult> quality = ReviewQualityService.evaluateBatch(qualityInputs);
            for (PropertyReviewDTO dtoInstance : dtos) {
                if (quality.containsKey(dtoInstance.id)) {
                    ReviewQualityService.QualityResult q = quality.get(dtoInstance.id);
                    dtoInstance.qualityScore = q.score;
                    dtoInstance.qualityLabel = q.label;
                    dtoInstance.qualityFactors = q.factors;
                }
            }
            dtos.sort(new ReviewQualityComparator());
        }

        if (!fraudInputs.isEmpty()) {
            Map<Id, ReviewFraudService.FraudSignal> fraudSignals = ReviewFraudService.evaluateBatch(fraudInputs);
            for (PropertyReviewDTO dtoInstance : dtos) {
                if (fraudSignals.containsKey(dtoInstance.id)) {
                    ReviewFraudService.FraudSignal signal = fraudSignals.get(dtoInstance.id);
                    dtoInstance.suspicious = signal.suspicious;
                    dtoInstance.fraudRisk = signal.riskScore;
                    dtoInstance.fraudReasons = signal.reasons;
                }
            }
        }

        Map<Id, VoteAggregate> votes = aggregateVotes(reviews);
        for (PropertyReviewDTO dtoInstance : dtos) {
            VoteAggregate aggregate = votes.get(dtoInstance.id);
            if (aggregate != null) {
                dtoInstance.helpfulScore = aggregate.score;
                dtoInstance.helpfulVotes = aggregate.helpful;
                dtoInstance.unhelpfulVotes = aggregate.unhelpful;
            }
        }

        attachSummaries(dtos, batch);

        return dtos;
    }

    private class VoteAggregate {
        Decimal score;
        Integer helpful;
        Integer unhelpful;
    }

    private Map<Id, VoteAggregate> aggregateVotes(List<Property_Review__c> reviews) {
        Map<Id, VoteAggregate> aggregates = new Map<Id, VoteAggregate>();
        if (reviews.isEmpty()) {
            return aggregates;
        }
        Set<Id> reviewIds = new Set<Id>();
        for (Property_Review__c review : reviews) {
            reviewIds.add(review.Id);
        }

        List<Review_Vote__c> rawVotes = [
            SELECT Id, Property_Review__c, Vote_Type__c, Weight__c, CreatedById
            FROM Review_Vote__c
            WHERE Property_Review__c IN :reviewIds
        ];

        Map<Id, Decimal> credibilityMap = buildCredibility(rawVotes);

        for (Review_Vote__c vote : rawVotes) {
            VoteAggregate aggregate = aggregates.get(vote.Property_Review__c);
            if (aggregate == null) {
                aggregate = new VoteAggregate();
                aggregate.score = 0;
                aggregate.helpful = 0;
                aggregate.unhelpful = 0;
                aggregates.put(vote.Property_Review__c, aggregate);
            }
            Decimal weight = vote.Weight__c == null ? 1 : vote.Weight__c;
            Decimal credibility = credibilityMap.get(vote.CreatedById) == null ? 1 : credibilityMap.get(vote.CreatedById);
            Decimal influence = weight * credibility;
            if ('Helpful'.equalsIgnoreCase(vote.Vote_Type__c)) {
                aggregate.helpful++;
                aggregate.score += influence;
            } else {
                aggregate.unhelpful++;
                aggregate.score -= influence;
            }
        }
        return aggregates;
    }

    private Map<Id, Decimal> buildCredibility(List<Review_Vote__c> votes) {
        Map<Id, Decimal> credibility = new Map<Id, Decimal>();
        for (Review_Vote__c vote : votes) {
            if (vote.CreatedById == null) {
                continue;
            }
            Decimal current = credibility.get(vote.CreatedById);
            if (current == null) {
                credibility.put(vote.CreatedById, 1);
            }
            credibility.put(vote.CreatedById, credibility.get(vote.CreatedById) + 0.05);
        }
        return credibility;
    }

    private class ReviewQualityComparator implements System.Comparator<PropertyReviewDTO> {
        public Integer compare(PropertyReviewDTO a, PropertyReviewDTO b) {
            Decimal scoreA = a == null ? 0 : a.qualityScore;
            Decimal scoreB = b == null ? 0 : b.qualityScore;
            Integer comparison = scoreB.compareTo(scoreA);
            if (comparison != 0) {
                return comparison;
            }
            Datetime dateA = a == null ? null : a.createdDate;
            Datetime dateB = b == null ? null : b.createdDate;
            if (dateA == null && dateB == null) {
                return 0;
            }
            if (dateA == null) {
                return 1;
            }
            if (dateB == null) {
                return -1;
            }
            return dateB.compareTo(dateA);
        }
    }

    @AuraEnabled(cacheable=true)
    public static ReviewTimelineResponse getReviewTimeline(Id propertyId) {
        if (propertyId == null) {
            return new ReviewTimelineResponse();
        }

        ReviewTimelineResponse response = new ReviewTimelineResponse();
        response.events = buildPropertyEvents(propertyId);

        List<Property_Review__c> reviews = [
            SELECT Id, Property__c, Rating__c, CreatedDate, Comment__c
            FROM Property_Review__c
            WHERE Property__c = :propertyId
            ORDER BY CreatedDate ASC
            LIMIT 1000
        ];

        Map<String, ReviewBucket> bucketMap = new Map<String, ReviewBucket>();
        for (Property_Review__c review : reviews) {
            String keyMonth = review.CreatedDate == null ? 'unknown' : review.CreatedDate.format('YYYY-MM');
            ReviewBucket bucket = bucketMap.get(keyMonth);
            if (bucket == null) {
                bucket = new ReviewBucket();
                bucket.bucketKey = keyMonth;
                bucket.year = review.CreatedDate == null ? null : review.CreatedDate.year();
                bucket.month = review.CreatedDate == null ? null : review.CreatedDate.month();
                bucket.season = deriveSeason(review.CreatedDate);
                bucketMap.put(keyMonth, bucket);
                response.buckets.add(bucket);
            }
            bucket.totalCount++;
            Integer ratingIndex = adjustRatingIndex(review.Rating__c);
            if (ratingIndex >= 0 && ratingIndex < bucket.ratingCounts.size()) {
                bucket.ratingCounts[ratingIndex] = bucket.ratingCounts[ratingIndex] + 1;
            }
        }

        response.buckets.sort(new ReviewBucketComparator());
        return response;
    }

    private static String deriveSeason(Datetime value) {
        if (value == null) {
            return 'Unknown';
        }
        Integer month = value.month();
        if (month == 12 || month == 1 || month == 2) {
            return 'Winter';
        }
        if (month >= 3 && month <= 5) {
            return 'Spring';
        }
        if (month >= 6 && month <= 8) {
            return 'Summer';
        }
        return 'Autumn';
    }

    private static Integer adjustRatingIndex(Decimal rating) {
        if (rating == null) {
            return -1;
        }
        Integer rounded = Integer.valueOf(Math.round(rating.doubleValue()));
        Integer index = rounded - 1;
        if (index < 0 || index >= 5) {
            return -1;
        }
        return index;
    }

    private static List<PropertyEvent> buildPropertyEvents(Id propertyId) {
        List<PropertyEvent> events = new List<PropertyEvent>();
        Property__c property = [
            SELECT Id, Date_Listed__c, Date_Agreement__c, Date_Closed__c
            FROM Property__c
            WHERE Id = :propertyId
            LIMIT 1
        ];

        if (property.Date_Listed__c != null) {
            events.add(propertyEvent('Listed', DateTime.newInstance(property.Date_Listed__c, Time.newInstance(9, 0, 0, 0)), 'Property went live on market.'));
        }
        if (property.Date_Agreement__c != null) {
            events.add(propertyEvent('Agreement', DateTime.newInstance(property.Date_Agreement__c, Time.newInstance(9, 0, 0, 0)), 'Offer accepted / under contract.'));
        }
        if (property.Date_Closed__c != null) {
            events.add(propertyEvent('Closed', DateTime.newInstance(property.Date_Closed__c, Time.newInstance(9, 0, 0, 0)), 'Transaction closed.'));
        }

        return events;
    }

    private static PropertyEvent propertyEvent(String label, Datetime date, String detail) {
        PropertyEvent evt = new PropertyEvent();
        evt.label = label;
        evt.date = date;
        evt.detail = detail;
        return evt;
    }

    public class ReviewTimelineResponse {
        @AuraEnabled public List<ReviewBucket> buckets = new List<ReviewBucket>();
        @AuraEnabled public List<PropertyEvent> events = new List<PropertyEvent>();
    }

    public class ReviewBucket {
        @AuraEnabled public String bucketKey;
        @AuraEnabled public Integer year;
        @AuraEnabled public Integer month;
        @AuraEnabled public String season;
        @AuraEnabled public Integer totalCount = 0;
        @AuraEnabled public List<Integer> ratingCounts = new List<Integer>{0, 0, 0, 0, 0};
    }

    public class PropertyEvent {
        @AuraEnabled public String label;
        @AuraEnabled public Datetime date;
        @AuraEnabled public String detail;
    }

    private class ReviewBucketComparator implements System.Comparator<ReviewBucket> {
        public Integer compare(ReviewBucket a, ReviewBucket b) {
            if (a == null && b == null) return 0;
            if (a == null) return -1;
            if (b == null) return 1;
            String keyA = a.bucketKey;
            String keyB = b.bucketKey;
            if (keyA == null && keyB == null) return 0;
            if (keyA == null) return -1;
            if (keyB == null) return 1;
            return keyA.compareTo(keyB);
        }
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
