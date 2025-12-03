public with sharing class SentimentEvolutionService {
    public class TimelinePoint {
        @AuraEnabled public Date periodStart;
        @AuraEnabled public String periodType;
        @AuraEnabled public Decimal averageSentiment;
        @AuraEnabled public Decimal rollingAverageSentiment;
        @AuraEnabled public Integer positiveCount;
        @AuraEnabled public Integer neutralCount;
        @AuraEnabled public Integer negativeCount;
        @AuraEnabled public Integer reviewVolume;
    }

    public class EventMarker {
        @AuraEnabled public Id eventId;
        @AuraEnabled public String name;
        @AuraEnabled public String type;
        @AuraEnabled public Date startDate;
        @AuraEnabled public Date endDate;
        @AuraEnabled public Decimal expectedChange;
    }

    public class TimelineResponse {
        @AuraEnabled public List<TimelinePoint> points;
        @AuraEnabled public List<EventMarker> events;
    }

    public class ComparisonResponse {
        @AuraEnabled public Id eventId;
        @AuraEnabled public Decimal beforeAverage;
        @AuraEnabled public Decimal afterAverage;
        @AuraEnabled public Decimal delta;
        @AuraEnabled public Integer beforeVolume;
        @AuraEnabled public Integer afterVolume;
        @AuraEnabled public List<String> notableThemes;
    }

    @AuraEnabled(cacheable=true)
    public static TimelineResponse getTimeline(Id propertyId, Integer weeksBack) {
        if (propertyId == null) {
            throw new AuraHandledException('propertyId is required');
        }
        Integer lookback = weeksBack != null ? weeksBack : 26;
        Date cutoff = Date.today().addDays(-7 * lookback);

        List<Property_Sentiment_Snapshot__c> snapshots = [
            SELECT PeriodStart__c, PeriodType__c, AverageSentiment__c, RollingAverageSentiment__c,
                   PositiveCount__c, NeutralCount__c, NegativeCount__c, ReviewVolume__c
            FROM Property_Sentiment_Snapshot__c
            WHERE Property__c = :propertyId
              AND PeriodStart__c >= :cutoff
            ORDER BY PeriodStart__c ASC
        ];

        List<Property_Event__c> events = [
            SELECT Id, Name, Type__c, StartDate__c, EndDate__c, ExpectedSentimentChange__c
            FROM Property_Event__c
            WHERE Property__c = :propertyId
              AND StartDate__c >= :cutoff
            ORDER BY StartDate__c ASC
        ];

        TimelineResponse response = new TimelineResponse();
        response.points = new List<TimelinePoint>();
        for (Property_Sentiment_Snapshot__c snapshot : snapshots) {
            TimelinePoint point = new TimelinePoint();
            point.periodStart = snapshot.PeriodStart__c;
            point.periodType = snapshot.PeriodType__c;
            point.averageSentiment = snapshot.AverageSentiment__c;
            point.rollingAverageSentiment = snapshot.RollingAverageSentiment__c;
            point.positiveCount = (Integer)snapshot.PositiveCount__c;
            point.neutralCount = (Integer)snapshot.NeutralCount__c;
            point.negativeCount = (Integer)snapshot.NegativeCount__c;
            point.reviewVolume = (Integer)snapshot.ReviewVolume__c;
            response.points.add(point);
        }

        response.events = new List<EventMarker>();
        for (Property_Event__c eventRecord : events) {
            EventMarker marker = new EventMarker();
            marker.eventId = eventRecord.Id;
            marker.name = eventRecord.Name;
            marker.type = eventRecord.Type__c;
            marker.startDate = eventRecord.StartDate__c;
            marker.endDate = eventRecord.EndDate__c;
            marker.expectedChange = eventRecord.ExpectedSentimentChange__c;
            response.events.add(marker);
        }

        return response;
    }

    @AuraEnabled(cacheable=true)
    public static ComparisonResponse compareBeforeAfter(Id propertyId, Id eventId, Integer lookbackWeeks, Integer lookforwardWeeks) {
        if (propertyId == null || eventId == null) {
            throw new AuraHandledException('propertyId and eventId are required');
        }
        Property_Event__c propertyEvent = [
            SELECT Id, StartDate__c, EndDate__c, Type__c
            FROM Property_Event__c
            WHERE Id = :eventId AND Property__c = :propertyId
            LIMIT 1
        ];

        Date eventStart = propertyEvent.StartDate__c;
        Integer backWeeks = lookbackWeeks != null ? lookbackWeeks : 8;
        Integer forwardWeeks = lookforwardWeeks != null ? lookforwardWeeks : 8;
        Date beforeStart = eventStart.addDays(-7 * backWeeks);
        Date afterEnd = eventStart.addDays(7 * forwardWeeks);

        List<Property_Sentiment_Snapshot__c> relevantSnapshots = [
            SELECT PeriodStart__c, AverageSentiment__c, ReviewVolume__c
            FROM Property_Sentiment_Snapshot__c
            WHERE Property__c = :propertyId
              AND PeriodStart__c >= :beforeStart
              AND PeriodStart__c <= :afterEnd
            ORDER BY PeriodStart__c ASC
        ];

        Decimal beforeTotal = 0;
        Decimal afterTotal = 0;
        Integer beforeCount = 0;
        Integer afterCount = 0;
        Integer beforeVolume = 0;
        Integer afterVolume = 0;

        for (Property_Sentiment_Snapshot__c snapshot : relevantSnapshots) {
            if (snapshot.PeriodStart__c < eventStart) {
                beforeTotal += snapshot.AverageSentiment__c;
                beforeCount++;
                beforeVolume += (Integer)snapshot.ReviewVolume__c;
            } else {
                afterTotal += snapshot.AverageSentiment__c;
                afterCount++;
                afterVolume += (Integer)snapshot.ReviewVolume__c;
            }
        }

        ComparisonResponse comparison = new ComparisonResponse();
        comparison.eventId = propertyEvent.Id;
        comparison.beforeAverage = beforeCount > 0 ? (beforeTotal / beforeCount).setScale(2) : null;
        comparison.afterAverage = afterCount > 0 ? (afterTotal / afterCount).setScale(2) : null;
        comparison.delta = (comparison.beforeAverage != null && comparison.afterAverage != null)
            ? (comparison.afterAverage - comparison.beforeAverage).setScale(2)
            : null;
        comparison.beforeVolume = beforeVolume;
        comparison.afterVolume = afterVolume;
        comparison.notableThemes = new List<String>();
        return comparison;
    }
}
