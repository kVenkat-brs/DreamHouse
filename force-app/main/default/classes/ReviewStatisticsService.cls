public with sharing class ReviewStatisticsService {
    public class RatingBucket {
        @AuraEnabled public Decimal rating;
        @AuraEnabled public Integer count;
        @AuraEnabled public Decimal share;
        @AuraEnabled public Decimal benchmarkShare;
        @AuraEnabled public Decimal zScore;
        @AuraEnabled public Decimal pValue;
    }

    public class TrendPoint {
        @AuraEnabled public Date period;
        @AuraEnabled public Decimal averageRating;
        @AuraEnabled public Decimal benchmarkAverage;
        @AuraEnabled public Decimal correlation;
    }

    public class StatisticsResponse {
        @AuraEnabled public List<RatingBucket> ratingDistribution;
        @AuraEnabled public List<TrendPoint> trendPoints;
        @AuraEnabled public Decimal correlationCoefficient;
        @AuraEnabled public Decimal correlationPValue;
        @AuraEnabled public Decimal sampleSize;
        @AuraEnabled public Decimal benchmarkSampleSize;
    }

    @AuraEnabled(cacheable=true)
    public static StatisticsResponse buildStatistics(Id propertyId, List<Id> benchmarkIds) {
        if (propertyId == null) {
            throw new AuraHandledException('Property Id is required.');
        }
        Set<Id> propertyIds = new Set<Id>{ propertyId };
        if (benchmarkIds != null) {
            propertyIds.addAll(benchmarkIds);
        }

        List<Property_Review__c> reviews = [
            SELECT Property__c, Rating__c, CreatedDate
            FROM Property_Review__c
            WHERE Property__c IN :propertyIds AND Rating__c != null
        ];

        List<Property_Review__c> primaryReviews = new List<Property_Review__c>();
        Map<Id, List<Property_Review__c>> benchmarkReviews = new Map<Id, List<Property_Review__c>>();
        for (Property_Review__c review : reviews) {
            if (review.Property__c == propertyId) {
                primaryReviews.add(review);
            } else {
                List<Property_Review__c> listRef = benchmarkReviews.get(review.Property__c);
                if (listRef == null) {
                    listRef = new List<Property_Review__c>();
                    benchmarkReviews.put(review.Property__c, listRef);
                }
                listRef.add(review);
            }
        }

        StatisticsResponse response = new StatisticsResponse();
        response.ratingDistribution = buildDistribution(primaryReviews, benchmarkReviews);
        response.trendPoints = buildTrendPoints(primaryReviews, benchmarkReviews);
        response.sampleSize = primaryReviews.size();
        response.benchmarkSampleSize = 0;
        for (List<Property_Review__c> listRef : benchmarkReviews.values()) {
            response.benchmarkSampleSize += listRef.size();
        }
        CorrelationResult corr = computeCorrelation(response.trendPoints);
        response.correlationCoefficient = corr.coefficient;
        response.correlationPValue = corr.pValue;
        return response;
    }

    private static List<RatingBucket> buildDistribution(List<Property_Review__c> primary, Map<Id, List<Property_Review__c>> benchmarks) {
        Map<Decimal, Integer> primaryCounts = initRatingMap();
        Map<Decimal, Integer> benchmarkCounts = initRatingMap();
        for (Property_Review__c review : primary) {
            Decimal rating = review.Rating__c.setScale(0);
            primaryCounts.put(rating, primaryCounts.get(rating) + 1);
        }
        for (List<Property_Review__c> listRef : benchmarks.values()) {
            for (Property_Review__c review : listRef) {
                Decimal rating = review.Rating__c.setScale(0);
                benchmarkCounts.put(rating, benchmarkCounts.get(rating) + 1);
            }
        }
        Integer primaryTotal = primary.size();
        Integer benchmarkTotal = 0;
        for (Integer qty : benchmarkCounts.values()) {
            benchmarkTotal += qty;
        }
        List<RatingBucket> buckets = new List<RatingBucket>();
        for (Decimal rating : new List<Decimal>{1, 2, 3, 4, 5}) {
            RatingBucket bucket = new RatingBucket();
            Integer primaryCount = primaryCounts.get(rating);
            Integer benchmarkCount = benchmarkCounts.get(rating);
            bucket.rating = rating;
            bucket.count = primaryCount;
            bucket.share = primaryTotal > 0 ? Decimal.valueOf(primaryCount) / primaryTotal : 0;
            bucket.benchmarkShare = benchmarkTotal > 0 ? Decimal.valueOf(benchmarkCount) / benchmarkTotal : 0;
            StatisticalTestResult test = computeProportionZTest(primaryCount, primaryTotal, benchmarkCount, benchmarkTotal);
            bucket.zScore = test.zScore;
            bucket.pValue = test.pValue;
            buckets.add(bucket);
        }
        return buckets;
    }

    private static Map<Decimal, Integer> initRatingMap() {
        Map<Decimal, Integer> mapRef = new Map<Decimal, Integer>();
        mapRef.put(1, 0);
        mapRef.put(2, 0);
        mapRef.put(3, 0);
        mapRef.put(4, 0);
        mapRef.put(5, 0);
        return mapRef;
    }

    private static List<TrendPoint> buildTrendPoints(List<Property_Review__c> primary, Map<Id, List<Property_Review__c>> benchmarks) {
        if (primary.isEmpty()) {
            return new List<TrendPoint>();
        }
        Date startDate = primary[0].CreatedDate.date();
        Date endDate = primary[primary.size() - 1].CreatedDate.date();
        if (startDate == null || endDate == null) {
            return new List<TrendPoint>();
        }
        List<Date> periods = new List<Date>();
        Date cursor = startDate.toStartOfMonth();
        Date limit = endDate.toStartOfMonth();
        while (cursor <= limit) {
            periods.add(cursor);
            cursor = cursor.addMonths(1);
        }
        Map<Date, List<Decimal>> primaryByPeriod = new Map<Date, List<Decimal>>();
        Map<Date, List<Decimal>> benchmarkByPeriod = new Map<Date, List<Decimal>>();
        for (Date period : periods) {
            primaryByPeriod.put(period, new List<Decimal>());
            benchmarkByPeriod.put(period, new List<Decimal>());
        }
        for (Property_Review__c review : primary) {
            Date period = review.CreatedDate.date().toStartOfMonth();
            primaryByPeriod.get(period).add(review.Rating__c);
        }
        for (List<Property_Review__c> listRef : benchmarks.values()) {
            for (Property_Review__c review : listRef) {
                Date period = review.CreatedDate.date().toStartOfMonth();
                if (!benchmarkByPeriod.containsKey(period)) {
                    benchmarkByPeriod.put(period, new List<Decimal>());
                }
                benchmarkByPeriod.get(period).add(review.Rating__c);
            }
        }
        List<TrendPoint> points = new List<TrendPoint>();
        for (Date period : periods) {
            TrendPoint point = new TrendPoint();
            point.period = period;
            point.averageRating = average(primaryByPeriod.get(period));
            point.benchmarkAverage = average(benchmarkByPeriod.get(period));
            points.add(point);
        }
        CorrelationResult corr = computeCorrelation(points);
        for (TrendPoint point : points) {
            point.correlation = corr.coefficient;
        }
        return points;
    }

    private static Decimal average(List<Decimal> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        Decimal total = 0;
        for (Decimal v : values) {
            total += v;
        }
        return (total / values.size()).setScale(2);
    }

    private class StatisticalTestResult {
        public Decimal zScore;
        public Decimal pValue;

        public StatisticalTestResult(Decimal z, Decimal p) {
            zScore = z;
            pValue = p;
        }
    }

    private static StatisticalTestResult computeProportionZTest(Integer countA, Integer sizeA, Integer countB, Integer sizeB) {
        if (sizeA == 0 || sizeB == 0) {
            return new StatisticalTestResult(null, null);
        }
        Decimal p1 = Decimal.valueOf(countA) / sizeA;
        Decimal p2 = Decimal.valueOf(countB) / sizeB;
        Decimal p = Decimal.valueOf(countA + countB) / (sizeA + sizeB);
        Decimal denominator = Math.sqrt((p * (1 - p)) * ((1 / Decimal.valueOf(sizeA)) + (1 / Decimal.valueOf(sizeB))));
        if (denominator == 0) {
            return new StatisticalTestResult(null, null);
        }
        Decimal z = (p1 - p2) / denominator;
        Decimal pValue = computeTwoTailedP(z);
        return new StatisticalTestResult(z.setScale(4), pValue.setScale(4));
    }

    private class CorrelationResult {
        public Decimal coefficient;
        public Decimal pValue;

        public CorrelationResult(Decimal coef, Decimal p) {
            coefficient = coef;
            pValue = p;
        }
    }

    private static CorrelationResult computeCorrelation(List<TrendPoint> points) {
        List<Decimal> x = new List<Decimal>();
        List<Decimal> y = new List<Decimal>();
        for (TrendPoint point : points) {
            if (point.averageRating != null && point.benchmarkAverage != null) {
                x.add(point.averageRating);
                y.add(point.benchmarkAverage);
            }
        }
        if (x.isEmpty() || x.size() != y.size()) {
            return new CorrelationResult(null, null);
        }
        Decimal meanX = average(x);
        Decimal meanY = average(y);
        Decimal numerator = 0;
        Decimal sumSqX = 0;
        Decimal sumSqY = 0;
        for (Integer i = 0; i < x.size(); i++) {
            Decimal devX = x[i] - meanX;
            Decimal devY = y[i] - meanY;
            numerator += devX * devY;
            sumSqX += devX * devX;
            sumSqY += devY * devY;
        }
        if (sumSqX == 0 || sumSqY == 0) {
            return new CorrelationResult(null, null);
        }
        Decimal denominator = Math.sqrt(sumSqX * sumSqY);
        Decimal r = numerator / denominator;
        Decimal pValue = computeCorrelationPValue(r, x.size());
        return new CorrelationResult(r.setScale(4), pValue.setScale(4));
    }

    private static Decimal average(List<Property_Review__c> reviews, Date period) {
        if (reviews == null || reviews.isEmpty()) {
            return null;
        }
        Decimal total = 0;
        Integer count = 0;
        for (Property_Review__c review : reviews) {
            if (review.CreatedDate.date().toStartOfMonth() == period) {
                total += review.Rating__c;
                count++;
            }
        }
        if (count == 0) {
            return null;
        }
        return (total / count).setScale(2);
    }

    private static Decimal computeTwoTailedP(Decimal zScore) {
        if (zScore == null) {
            return null;
        }
        Decimal absZ = Math.abs(zScore);
        // Approximation using error function expansion for normal distribution tail
        Double z = Double.valueOf(absZ);
        Double p = 1 - 0.5 * (1 + erf(z / Math.sqrt(2)));
        return Decimal.valueOf(2 * p);
    }

    @TestVisible private static Double erf(Double x) {
        // Numerical approximation (Abramowitz & Stegun formula 7.1.26)
        Double t = 1.0 / (1.0 + 0.5 * Math.abs(x));
        Double tau = t * Math.exp(
            -x * x
            - 1.26551223
            + 1.00002368 * t
            + 0.37409196 * Math.pow(t, 2)
            + 0.09678418 * Math.pow(t, 3)
            - 0.18628806 * Math.pow(t, 4)
            + 0.27886807 * Math.pow(t, 5)
            - 1.13520398 * Math.pow(t, 6)
            + 1.48851587 * Math.pow(t, 7)
            - 0.82215223 * Math.pow(t, 8)
            + 0.17087277 * Math.pow(t, 9)
        );
        if (x >= 0) {
            return 1 - tau;
        }
        return tau - 1;
    }

    private static Decimal computeCorrelationPValue(Decimal correlation, Integer sampleSize) {
        if (correlation == null || sampleSize == null || sampleSize < 3) {
            return null;
        }
        Double r = Double.valueOf(correlation);
        Double n = Double.valueOf(sampleSize);
        Double tStatistic = r * Math.sqrt((n - 2) / (1 - (r * r)));
        Double p = 2 * (1 - studentTCdf(Math.abs(tStatistic), n - 2));
        return Decimal.valueOf(p);
    }

    @TestVisible private static Double studentTCdf(Double t, Double v) {
        // Numerical integration (approx) for Student's t CDF using regularized incomplete beta
        Double x = v / (v + t * t);
        return regularizedIncompleteBeta(0.5 * v, 0.5, x);
    }

    @TestVisible private static Double regularizedIncompleteBeta(Double a, Double b, Double x) {
        Double bt = Math.exp(Gamma.lnGamma(a + b) - Gamma.lnGamma(a) - Gamma.lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
        if (x < (a + 1) / (a + b + 2)) {
            return bt * betaCf(a, b, x) / a;
        }
        return 1 - bt * betaCf(b, a, 1 - x) / b;
    }

    @TestVisible private static Double betaCf(Double a, Double b, Double x) {
        Integer maxIterations = 200;
        Double eps = 3.0e-7;
        Double am = 1;
        Double bm = 1;
        Double az = 1;
        Double qab = a + b;
        Double qap = a + 1;
        Double qam = a - 1;
        Double bz = 1 - qab * x / qap;
        for (Integer m = 1; m <= maxIterations; m++) {
            Integer em = m;
            Double tem = em + em;
            Double d = em * (b - m) * x / ((qam + tem) * (a + tem));
            Double ap = az + d * am;
            Double bp = bz + d * bm;
            d = - (a + em) * (qab + em) * x / ((a + tem) * (qap + tem));
            Double app = ap + d * az;
            Double bpp = bp + d * bz;
            Double aold = az;
            am = ap / bpp;
            bm = bp / bpp;
            az = app / bpp;
            bz = 1;
            if (Math.abs(az - aold) < (eps * Math.abs(az))) {
                return az;
            }
        }
        return az;
    }

    private class Gamma {
        public static Double lnGamma(Double x) {
            Double[] cof = new Double[]{
                76.18009172947146,
                -86.50532032941677,
                24.01409824083091,
                -1.231739572450155,
                0.001208650973866179,
                -0.000005395239384953
            };
            Double y = x;
            Double tmp = x + 5.5;
            tmp -= (x + 0.5) * Math.log(tmp);
            Double ser = 1.000000000190015;
            for (Integer j = 0; j < cof.size(); j++) {
                y += 1;
                ser += cof[j] / y;
            }
            return -tmp + Math.log(2.5066282746310005 * ser / x);
        }
    }
}
