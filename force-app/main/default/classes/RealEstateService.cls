public with sharing class RealEstateService {

    public class MarketSnapshot {
        @AuraEnabled public Id propertyId;
        @AuraEnabled public String status;
        @AuraEnabled public Decimal listPrice;
        @AuraEnabled public Decimal estimatedValue;
        @AuraEnabled public Decimal valueChange30d;
        @AuraEnabled public Decimal valueChange12m;
        @AuraEnabled public Decimal rentEstimate;
        @AuraEnabled public Decimal capRateEstimate;
        @AuraEnabled public Date lastUpdated;
    }

    public class ComparableSale {
        @AuraEnabled public String address;
        @AuraEnabled public Date closeDate;
        @AuraEnabled public Decimal salePrice;
        @AuraEnabled public Integer beds;
        @AuraEnabled public Integer baths;
        @AuraEnabled public Decimal sqft;
        @AuraEnabled public Decimal distanceMiles;
        @AuraEnabled public Decimal pricePerSqft;
    }

    public class NeighborhoodTrend {
        @AuraEnabled public Date periodStart;
        @AuraEnabled public Date periodEnd;
        @AuraEnabled public Decimal medianPrice;
        @AuraEnabled public Decimal priceChangePct;
        @AuraEnabled public Decimal inventoryChangePct;
        @AuraEnabled public Decimal daysOnMarket;
    }

    public class RealEstateData {
        @AuraEnabled public MarketSnapshot snapshot;
        @AuraEnabled public List<ComparableSale> comparables;
        @AuraEnabled public List<NeighborhoodTrend> trends;
        @AuraEnabled public List<String> messages;
        @AuraEnabled public Boolean fromCache;
        @AuraEnabled public PriceAnalysis priceAnalysis;
        @AuraEnabled public RoiAnalysis roiAnalysis;
        @AuraEnabled public DepreciationAnalysis depreciationAnalysis;
        @AuraEnabled public TaxAnalysis taxAnalysis;
        @AuraEnabled public Map<String, MediaSection> media;
        @AuraEnabled public List<MapLayer> mapLayers;
        @AuraEnabled public Map<String, TourInfo> tours;
        @AuraEnabled public List<NeighborhoodProfile> neighborhoodProfiles;
        @AuraEnabled public MobilitySummary mobility;
        @AuraEnabled public List<CommuteOption> commuteOptions;
        @AuraEnabled public SchoolComparison schools;
        @AuraEnabled public CrimeComparison crime;
        @AuraEnabled public EnvironmentalRisk environmental;
        @AuraEnabled public DevelopmentOutlook development;
        @AuraEnabled public List<MortgageScenario> mortgageComparisons;
        @AuraEnabled public TotalCostOwnership totalCost;
        @AuraEnabled public RentalAnalysis rental;
        @AuraEnabled public AppreciationOutlook appreciation;
        @AuraEnabled public RenovationComparison renovation;
        @AuraEnabled public CustomScoreTemplate scoreTemplate;
    }

    public class PriceAnalysis {
        @AuraEnabled public Decimal subjectPricePerSqft;
        @AuraEnabled public Decimal comparableAveragePpsf;
        @AuraEnabled public Decimal comparableMedianPpsf;
        @AuraEnabled public Decimal comparableStdDevPpsf;
        @AuraEnabled public Decimal deltaToAveragePct;
        @AuraEnabled public Decimal valueScore;
        @AuraEnabled public String pricingFlag;
        @AuraEnabled public String narrative;
        @AuraEnabled public Decimal zScore;
    }

    public class RoiAnalysis {
        @AuraEnabled public Decimal subjectRentEstimate;
        @AuraEnabled public Decimal subjectRentalYieldPct;
        @AuraEnabled public Decimal subjectAppreciationPct;
        @AuraEnabled public Decimal subjectTotalReturn5yPct;
        @AuraEnabled public Decimal comparablesAverageRentEstimate;
        @AuraEnabled public Decimal comparablesAverageRentalYieldPct;
        @AuraEnabled public Decimal comparablesAverageAppreciationPct;
        @AuraEnabled public Decimal comparablesTotalReturn5yPct;
        @AuraEnabled public String narrative;
    }

    public class DepreciationAnalysis {
        @AuraEnabled public Integer effectiveYear;
        @AuraEnabled public Integer observedAge;
        @AuraEnabled public Integer adjustedAge;
        @AuraEnabled public Integer yearsSinceRenovation;
        @AuraEnabled public Integer assumedUsefulLife;
        @AuraEnabled public Integer remainingUsefulLife;
        @AuraEnabled public Integer marketRemainingUsefulLife;
        @AuraEnabled public Decimal depreciationPercent;
        @AuraEnabled public Decimal depreciatedValue;
        @AuraEnabled public String narrative;
    }

    public class TaxAnalysis {
        @AuraEnabled public Decimal assessedValue;
        @AuraEnabled public Decimal municipalRate;
        @AuraEnabled public Decimal educationRate;
        @AuraEnabled public Decimal propertyTaxAnnual;
        @AuraEnabled public Decimal insuranceEstimate;
        @AuraEnabled public Decimal hoaAnnual;
        @AuraEnabled public Decimal totalCarryingCostAnnual;
        @AuraEnabled public Decimal totalCarryingCostMonthly;
        @AuraEnabled public String municipality;
        @AuraEnabled public String propertyType;
        @AuraEnabled public String narrative;
    }

    public class MediaSection {
        @AuraEnabled public String before;
        @AuraEnabled public String after;
    }

    public class MapLayer {
        @AuraEnabled public String type;
        @AuraEnabled public String label;
        @AuraEnabled public String description;
        @AuraEnabled public List<MapPoint> points;
        @AuraEnabled public List<HeatPoint> heat;
    }

    public class MapPoint {
        @AuraEnabled public Decimal lat;
        @AuraEnabled public Decimal lng;
        @AuraEnabled public String label;
        @AuraEnabled public String detail;
        @AuraEnabled public Decimal score;
    }

    public class HeatPoint {
        @AuraEnabled public Decimal lat;
        @AuraEnabled public Decimal lng;
        @AuraEnabled public Decimal intensity;
    }

    public class NeighborhoodProfile {
        @AuraEnabled public String label;
        @AuraEnabled public String summary;
        @AuraEnabled public String sentiment;
        @AuraEnabled public List<NeighborhoodMetric> metrics;
    }

    public class NeighborhoodMetric {
        @AuraEnabled public String label;
        @AuraEnabled public String value;
        @AuraEnabled public String trend;
        @AuraEnabled public String icon;
    }

    public class MobilitySummary {
        @AuraEnabled public ScoreDetail walk;
        @AuraEnabled public ScoreDetail transit;
        @AuraEnabled public ScoreDetail bike;
        @AuraEnabled public String narrative;
    }

    public class ScoreDetail {
        @AuraEnabled public Integer score;
        @AuraEnabled public String label;
        @AuraEnabled public String description;
        @AuraEnabled public List<String> highlights;
    }

    public class CommuteOption {
        @AuraEnabled public String mode;
        @AuraEnabled public String summary;
        @AuraEnabled public Integer durationMinutes;
        @AuraEnabled public Integer distanceMiles;
        @AuraEnabled public List<CommuteStep> steps;
    }

    public class CommuteStep {
        @AuraEnabled public String instruction;
        @AuraEnabled public Integer durationMinutes;
        @AuraEnabled public Integer distanceMiles;
    }

    public class SchoolComparison {
        @AuraEnabled public List<SchoolDetail> schools;
        @AuraEnabled public String narrative;
    }

    public class SchoolDetail {
        @AuraEnabled public String name;
        @AuraEnabled public String level;
        @AuraEnabled public String rating;
        @AuraEnabled public String testScorePercentile;
        @AuraEnabled public Decimal distanceMiles;
        @AuraEnabled public List<String> programs;
        @AuraEnabled public String opportunityIndex;
        @AuraEnabled public String notes;
    }

    public class CrimeComparison {
        @AuraEnabled public List<CrimeTrend> trends;
        @AuraEnabled public List<CrimeCategorySummary> categories;
        @AuraEnabled public Decimal safetyScore;
        @AuraEnabled public String narrative;
    }

    public class CrimeTrend {
        @AuraEnabled public Integer year;
        @AuraEnabled public Decimal violentRate;
        @AuraEnabled public Decimal propertyRate;
        @AuraEnabled public Decimal cityAverage;
    }

    public class CrimeCategorySummary {
        @AuraEnabled public String category;
        @AuraEnabled public Decimal subjectRate;
        @AuraEnabled public Decimal metroRate;
        @AuraEnabled public String direction;
        @AuraEnabled public String notes;
    }

    public class EnvironmentalRisk {
        @AuraEnabled public Decimal floodScore;
        @AuraEnabled public Decimal earthquakeScore;
        @AuraEnabled public Decimal airQualityScore;
        @AuraEnabled public Decimal climateProjectionScore;
        @AuraEnabled public String narrative;
        @AuraEnabled public List<EnvironmentalFactor> factors;
    }

    public class EnvironmentalFactor {
        @AuraEnabled public String label;
        @AuraEnabled public String impact;
        @AuraEnabled public String mitigation;
        @AuraEnabled public String outlook;
    }

    public class DevelopmentOutlook {
        @AuraEnabled public List<ProjectHighlight> projects;
        @AuraEnabled public List<ZoningChange> zoningChanges;
        @AuraEnabled public String narrative;
    }

    public class ProjectHighlight {
        @AuraEnabled public String name;
        @AuraEnabled public String type;
        @AuraEnabled public Integer completionYear;
        @AuraEnabled public String description;
        @AuraEnabled public String potentialImpact;
    }

    public class ZoningChange {
        @AuraEnabled public String ordinance;
        @AuraEnabled public String status;
        @AuraEnabled public String summary;
        @AuraEnabled public String expectedEffect;
    }

    public class MortgageScenario {
        @AuraEnabled public String loanType;
        @AuraEnabled public Decimal interestRate;
        @AuraEnabled public Integer termMonths;
        @AuraEnabled public Decimal downPaymentPercent;
        @AuraEnabled public Decimal monthlyPrincipalInterest;
        @AuraEnabled public Decimal totalPaid5y;
        @AuraEnabled public Decimal totalPaid10y;
        @AuraEnabled public Decimal apr;
        @AuraEnabled public String notes;
    }

    public class TotalCostOwnership {
        @AuraEnabled public Decimal maintenanceAnnual;
        @AuraEnabled public Decimal utilitiesAnnual;
        @AuraEnabled public Decimal insuranceAnnual;
        @AuraEnabled public Decimal propertyTaxAnnual;
        @AuraEnabled public Decimal renovationReserveAnnual;
        @AuraEnabled public Decimal opportunityCostAnnual;
        @AuraEnabled public Decimal totalYearOne;
        @AuraEnabled public Decimal totalFiveYear;
        @AuraEnabled public Decimal totalTenYear;
        @AuraEnabled public List<TcoLineItem> lineItems;
    }

    public class TcoLineItem {
        @AuraEnabled public String label;
        @AuraEnabled public Decimal annualCost;
        @AuraEnabled public String assumption;
    }

    public class RentalAnalysis {
        @AuraEnabled public Decimal estimatedMonthlyRent;
        @AuraEnabled public Decimal annualGrossRent;
        @AuraEnabled public Decimal vacancyRate;
        @AuraEnabled public Decimal netOperatingIncome;
        @AuraEnabled public Decimal capRate;
        @AuraEnabled public Decimal landlordCostAnnual;
        @AuraEnabled public List<RentalResponsibility> responsibilities;
        @AuraEnabled public List<RentalScenario> scenarios;
        @AuraEnabled public String narrative;
    }

    public class RentalResponsibility {
        @AuraEnabled public String item;
        @AuraEnabled public String landlord;
        @AuraEnabled public String tenant;
        @AuraEnabled public String notes;
    }

    public class RentalScenario {
        @AuraEnabled public String label;
        @AuraEnabled public Decimal rent;
        @AuraEnabled public Decimal vacancy;
        @AuraEnabled public Decimal noi;
        @AuraEnabled public String notes;
    }

    public class AppreciationOutlook {
        @AuraEnabled public List<AppreciationHistory> history;
        @AuraEnabled public List<AppreciationProjection> projections;
        @AuraEnabled public String narrative;
    }

    public class AppreciationHistory {
        @AuraEnabled public Integer year;
        @AuraEnabled public Decimal subjectAppreciation;
        @AuraEnabled public Decimal cityAppreciation;
        @AuraEnabled public Decimal nationalAppreciation;
    }

    public class AppreciationProjection {
        @AuraEnabled public Integer year;
        @AuraEnabled public Decimal conservative;
        @AuraEnabled public Decimal baseline;
        @AuraEnabled public Decimal optimistic;
    }

    public class RenovationComparison {
        @AuraEnabled public RenovationScenario asIsScenario;
        @AuraEnabled public RenovationScenario renovatedScenario;
        @AuraEnabled public List<RenovationLineItem> improvements;
        @AuraEnabled public String narrative;
    }

    public class RenovationScenario {
        @AuraEnabled public Decimal budget;
        @AuraEnabled public Decimal postRenovationValue;
        @AuraEnabled public Decimal equityGain;
        @AuraEnabled public Decimal roi;
        @AuraEnabled public Integer timelineMonths;
    }

    public class RenovationLineItem {
        @AuraEnabled public String label;
        @AuraEnabled public Decimal cost;
        @AuraEnabled public Decimal valueImpact;
        @AuraEnabled public String notes;
    }

    public class CustomScoreTemplate {
        @AuraEnabled public List<ScoreCriterion> criteria;
        @AuraEnabled public String instructions;
    }

    public class ScoreCriterion {
        @AuraEnabled public String key;
        @AuraEnabled public String label;
        @AuraEnabled public Decimal suggestedWeight;
        @AuraEnabled public String description;
        @AuraEnabled public String inputType;
    }

    public class TourInfo {
        @AuraEnabled public String label;
        @AuraEnabled public String url;
        @AuraEnabled public String thumbnail;
        @AuraEnabled public String provider;
        @AuraEnabled public List<TourMeasurement> measurements;
    }

    public class TourMeasurement {
        @AuraEnabled public String name;
        @AuraEnabled public Decimal value;
        @AuraEnabled public String unit;
        @AuraEnabled public String notes;
    }

    @AuraEnabled(cacheable=true)
    public static RealEstateData getPropertyInsights(Id propertyId) {
        if (propertyId == null) {
            throw new AuraHandledException('Property Id is required.');
        }

        Property__c subject = [
            SELECT Id, Name, Price__c, Beds__c, Baths__c, Square_Footage__c, Latitude__c, Longitude__c, City__c, State__c, PostalCode__c,
                   Effective_Year_Built__c, Renovation_Date__c, Municipality__c, Property_Type__c, Assessed_Value__c
            FROM Property__c
            WHERE Id = :propertyId
            WITH USER_MODE
            LIMIT 1
        ];

        RealEstateData data = new RealEstateData();
        data.messages = new List<String>();

        try {
            data.snapshot = fetchMarketSnapshot(subject);
        } catch (Exception ex) {
            data.messages.add('Market snapshot unavailable: ' + ex.getMessage());
        }

        try {
            data.comparables = fetchComparableSales(subject);
        } catch (Exception ex) {
            data.messages.add('Comparable sales unavailable: ' + ex.getMessage());
        }

        try {
            data.trends = fetchNeighborhoodTrends(subject);
        } catch (Exception ex) {
            data.messages.add('Neighborhood trends unavailable: ' + ex.getMessage());
        }

        if (data.messages.isEmpty()) {
            data.messages.add('Real estate data generated using sample responses. Configure Named Credentials for live data.');
        }

        data.priceAnalysis = buildPriceAnalysis(subject, data.snapshot, data.comparables);
        data.roiAnalysis = buildRoiAnalysis(subject, data.snapshot, data.trends, data.comparables);
        data.depreciationAnalysis = buildDepreciationAnalysis(subject, data.snapshot, data.comparables);
        data.taxAnalysis = buildTaxAnalysis(subject);
        data.media = buildMediaMap(subject);
        data.mapLayers = buildMapLayers(subject, data.comparables);
        data.tours = buildTourMap(subject);
        data.neighborhoodProfiles = buildNeighborhoodProfiles(subject, data.trends);
        data.mobility = buildMobilitySummary(subject);
        data.commuteOptions = buildCommuteOptions(subject);
        data.schools = buildSchoolComparison(subject);
        data.crime = buildCrimeComparison(subject);
        data.environmental = buildEnvironmentalRisk(subject);
        data.development = buildDevelopmentOutlook(subject);
        data.mortgageComparisons = buildMortgageScenarios(subject);
        data.totalCost = buildTotalCostOwnership(subject);
        data.rental = buildRentalAnalysis(subject);
        data.appreciation = buildAppreciationOutlook(subject, data.trends);
        data.renovation = buildRenovationComparison(subject);
        data.scoreTemplate = buildCustomScoreTemplate();
        data.fromCache = false;
        return data;
    }

    @AuraEnabled(cacheable=true)
    public static MarketSnapshot getMarketSnapshot(Id propertyId) {
        return getPropertyInsights(propertyId).snapshot;
    }

    @AuraEnabled(cacheable=true)
    public static List<ComparableSale> getComparableSales(Id propertyId) {
        return getPropertyInsights(propertyId).comparables;
    }

    @AuraEnabled(cacheable=true)
    public static List<NeighborhoodTrend> getNeighborhoodTrends(Id propertyId) {
        return getPropertyInsights(propertyId).trends;
    }

    private static MarketSnapshot fetchMarketSnapshot(Property__c propertyRecord) {
        MarketSnapshot snap = new MarketSnapshot();
        snap.propertyId = propertyRecord.Id;
        snap.status = 'Active';
        snap.listPrice = propertyRecord.Price__c;
        snap.estimatedValue = (propertyRecord.Price__c == null) ? null : propertyRecord.Price__c * 1.02;
        snap.valueChange30d = 0.8;
        snap.valueChange12m = 4.5;
        snap.rentEstimate = (propertyRecord.Price__c == null) ? null : (propertyRecord.Price__c * 0.0055);
        snap.capRateEstimate = snap.estimatedValue == null || snap.estimatedValue == 0 ? null : (snap.rentEstimate == null ? null : (snap.rentEstimate * 12) / snap.estimatedValue);
        snap.lastUpdated = Date.today();
        return snap;
    }

    private static List<ComparableSale> fetchComparableSales(Property__c propertyRecord) {
        List<ComparableSale> comps = new List<ComparableSale>();
        for (Integer i = 0; i < 5; i++) {
            ComparableSale c = new ComparableSale();
            c.address = (propertyRecord.City__c != null ? propertyRecord.City__c : 'Sample City') + ' Comp #' + String.valueOf(i + 1);
            c.closeDate = Date.today().addDays(-(30 * (i + 1)));
            c.salePrice = propertyRecord.Price__c == null ? 500000 + (i * 15000) : propertyRecord.Price__c + (i * 15000) - 20000;
            c.beds = propertyRecord.Beds__c == null ? 3 : Integer.valueOf(propertyRecord.Beds__c);
            c.baths = propertyRecord.Baths__c == null ? 2 : Integer.valueOf(propertyRecord.Baths__c);
            c.sqft = propertyRecord.Square_Footage__c == null ? 2000 : propertyRecord.Square_Footage__c;
            c.distanceMiles = Decimal.valueOf(0.25 * (i + 1));
            c.pricePerSqft = c.sqft == null || c.sqft == 0 ? null : (c.salePrice / c.sqft).setScale(2);
            comps.add(c);
        }
        return comps;
    }

    private static List<NeighborhoodTrend> fetchNeighborhoodTrends(Property__c propertyRecord) {
        List<NeighborhoodTrend> trends = new List<NeighborhoodTrend>();
        Date start = Date.today().addMonths(-12);
        for (Integer i = 0; i < 6; i++) {
            NeighborhoodTrend t = new NeighborhoodTrend();
            t.periodStart = start.addMonths(i * 2);
            t.periodEnd = t.periodStart.addMonths(2).addDays(-1);
            t.medianPrice = propertyRecord.Price__c == null ? 550000 + (i * 5000) : propertyRecord.Price__c + (i * 4000);
            t.priceChangePct = Decimal.valueOf(Math.sin(Math.PI * i / 6) * 3);
            t.inventoryChangePct = Decimal.valueOf(Math.cos(Math.PI * i / 6) * 5);
            t.daysOnMarket = 22 + (i * 1.5);
            trends.add(t);
        }
        return trends;
    }

    private static PriceAnalysis buildPriceAnalysis(Property__c subject, MarketSnapshot snapshot, List<ComparableSale> comparables) {
        Decimal subjectPrice = snapshot != null && snapshot.estimatedValue != null ? snapshot.estimatedValue : snapshot != null && snapshot.listPrice != null ? snapshot.listPrice : subject.Price__c;
        Decimal subjectSqft = subject.Square_Footage__c;

        PriceAnalysis analysis = new PriceAnalysis();

        if (subjectPrice != null && subjectSqft != null && subjectSqft > 0) {
            analysis.subjectPricePerSqft = (subjectPrice / subjectSqft).setScale(2);
        }

        if (comparables == null || comparables.isEmpty()) {
            analysis.narrative = 'Insufficient comparable sales to generate pricing intelligence.';
            return analysis;
        }

        List<Decimal> ppsfValues = new List<Decimal>();
        for (ComparableSale comp : comparables) {
            Decimal compSqft = comp.sqft;
            Decimal compPrice = comp.salePrice;
            Decimal ppsf = comp.pricePerSqft;
            if ((ppsf == null || ppsf == 0) && compPrice != null && compSqft != null && compSqft > 0) {
                ppsf = (compPrice / compSqft).setScale(2);
                comp.pricePerSqft = ppsf;
            }
            if (ppsf != null) {
                ppsfValues.add(ppsf);
            }
        }

        if (ppsfValues.isEmpty()) {
            analysis.narrative = 'Comparable sales do not include square footage, so price-per-foot intelligence is unavailable.';
            return analysis;
        }

        ppsfValues.sort();
        Decimal average = calculateAverage(ppsfValues);
        Decimal median = calculateMedian(ppsfValues);
        Decimal stddev = calculateStdDev(ppsfValues, average);

        analysis.comparableAveragePpsf = average == null ? null : average.setScale(2);
        analysis.comparableMedianPpsf = median == null ? null : median.setScale(2);
        analysis.comparableStdDevPpsf = stddev == null ? null : stddev.setScale(2);

        if (analysis.subjectPricePerSqft != null && average != null && average != 0) {
            Decimal diffPct = ((analysis.subjectPricePerSqft - average) / average) * 100;
            analysis.deltaToAveragePct = diffPct.setScale(2);
            analysis.valueScore = computeValueScore(diffPct);
            Double zScore = computeZScore(analysis.subjectPricePerSqft, average, stddev);
            if (zScore != null) {
                analysis.zScore = Decimal.valueOf(zScore).setScale(2);
            }
            setPricingFlag(analysis, diffPct, zScore);
        } else {
            analysis.narrative = 'Unable to evaluate pricing because subject price or square footage is missing.';
        }

        return analysis;
    }

    private static Decimal calculateAverage(List<Decimal> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        Double total = 0.0;
        for (Decimal v : values) {
            total += (Double)v;
        }
        return Decimal.valueOf(total / values.size());
    }

    private static Decimal calculateMedian(List<Decimal> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        Integer size = values.size();
        Integer mid = size / 2;
        if (Math.mod(size, 2) == 1) {
            return values[mid];
        }
        return Decimal.valueOf(((Double)values[mid - 1] + (Double)values[mid]) / 2);
    }

    private static Decimal calculateStdDev(List<Decimal> values, Decimal average) {
        if (values == null || values.size() < 2 || average == null) {
            return null;
        }
        Double mean = (Double)average;
        Double varianceTotal = 0.0;
        for (Decimal v : values) {
            Double diff = (Double)v - mean;
            varianceTotal += diff * diff;
        }
        Double variance = varianceTotal / (values.size() - 1);
        return Decimal.valueOf(Math.sqrt(variance));
    }

    private static Decimal computeValueScore(Decimal diffPct) {
        if (diffPct == null) {
            return null;
        }
        Double diff = (Double)diffPct;
        Double score = 100 - Math.abs(diff);
        if (diff < 0) {
            score += 10; // reward under-market pricing
        } else if (diff > 0) {
            score -= 10;
        }
        score = Math.max(0, Math.min(100, score));
        return Decimal.valueOf(score).setScale(0);
    }

    private static Double computeZScore(Decimal subjectPpsf, Decimal average, Decimal stddev) {
        if (subjectPpsf == null || average == null || stddev == null || stddev == 0) {
            return null;
        }
        Double mean = (Double)average;
        Double sigma = (Double)stddev;
        return (((Double)subjectPpsf) - mean) / sigma;
    }

    private static void setPricingFlag(PriceAnalysis analysis, Decimal diffPct, Double zScore) {
        if (diffPct == null) {
            analysis.pricingFlag = 'Indeterminate';
            return;
        }
        Double diff = (Double)diffPct;
        Double z = zScore;
        Double threshold = 1.5;
        if (z != null && Math.abs(z) >= threshold) {
            if (z > 0) {
                analysis.pricingFlag = 'Overpriced';
                analysis.narrative = 'Pricing appears higher than the market by ' + diffPct.setScale(1) + '% (z-score ' + Decimal.valueOf(z).setScale(2) + ').';
            } else {
                analysis.pricingFlag = 'Underpriced';
                analysis.narrative = 'Pricing appears aggressive in the buyer\'s favor by ' + diffPct.abs().setScale(1) + '% (z-score ' + Decimal.valueOf(z).setScale(2) + ').';
            }
            return;
        }

        if (diff > 5) {
            analysis.pricingFlag = 'Slightly Overpriced';
            analysis.narrative = 'Listing is modestly above local averages by ' + diffPct.setScale(1) + '%. Consider negotiating concessions.';
        } else if (diff < -5) {
            analysis.pricingFlag = 'Value Opportunity';
            analysis.narrative = 'Pricing trends below peers by ' + diffPct.abs().setScale(1) + '%. Investigate condition to confirm opportunity.';
        } else {
            analysis.pricingFlag = 'Market Aligned';
            analysis.narrative = 'Pricing aligns with comparable sales within ±5% of the average.';
        }
    }

    private static RoiAnalysis buildRoiAnalysis(Property__c subject,
                                               MarketSnapshot snapshot,
                                               List<NeighborhoodTrend> trends,
                                               List<ComparableSale> comparables) {
        RoiAnalysis roi = new RoiAnalysis();

        Decimal subjectPrice = snapshot != null && snapshot.estimatedValue != null ? snapshot.estimatedValue : snapshot != null && snapshot.listPrice != null ? snapshot.listPrice : subject.Price__c;
        Decimal subjectRent = snapshot != null && snapshot.rentEstimate != null ? snapshot.rentEstimate : (subjectPrice != null ? subjectPrice * 0.0055 : null);
        roi.subjectRentEstimate = subjectRent == null ? null : subjectRent.setScale(2);

        if (subjectPrice != null && subjectPrice > 0 && subjectRent != null) {
            Decimal annualRent = subjectRent * 12;
            roi.subjectRentalYieldPct = ((annualRent / subjectPrice) * 100).setScale(2);
        }

        Decimal appreciationRecent = null;
        if (snapshot != null && snapshot.valueChange12m != null) {
            appreciationRecent = snapshot.valueChange12m;
        } else if (trends != null && !trends.isEmpty()) {
            NeighborhoodTrend latest = trends[trends.size() - 1];
            appreciationRecent = latest != null ? latest.priceChangePct : null;
        }
        if (appreciationRecent != null) {
            roi.subjectAppreciationPct = appreciationRecent.setScale(2);
        }

        if (roi.subjectRentalYieldPct != null || roi.subjectAppreciationPct != null) {
            Double rentYield = roi.subjectRentalYieldPct == null ? 0 : (Double)roi.subjectRentalYieldPct;
            Double appreciation = roi.subjectAppreciationPct == null ? 0 : (Double)roi.subjectAppreciationPct;
            Double totalReturn5y = (rentYield * 5) + (appreciation * 5 / 12); // assume appreciation rate annual, project 5 years
            roi.subjectTotalReturn5yPct = Decimal.valueOf(totalReturn5y).setScale(2);
        }

        if (comparables == null || comparables.isEmpty()) {
            roi.narrative = 'Comparable data unavailable; ROI projections based solely on the subject property.';
            return roi;
        }

        List<Decimal> yields = new List<Decimal>();
        List<Decimal> rents = new List<Decimal>();
        List<Decimal> appreciations = new List<Decimal>();

        for (ComparableSale comp : comparables) {
            if (comp.salePrice == null || comp.salePrice <= 0) {
                continue;
            }
            Decimal compRent = comp.salePrice * 0.0050;
            rents.add(compRent);
            Decimal compYield = ((compRent * 12) / comp.salePrice) * 100;
            yields.add(compYield);

            Decimal compAppreciation = (comp.pricePerSqft != null && roi.subjectRentEstimate != null)
                ? roi.subjectAppreciationPct
                : appreciationRecent;
            if (compAppreciation != null) {
                appreciations.add(compAppreciation);
            }
        }

        if (!rents.isEmpty()) {
            roi.comparablesAverageRentEstimate = calculateAverage(rents).setScale(2);
        }
        if (!yields.isEmpty()) {
            roi.comparablesAverageRentalYieldPct = calculateAverage(yields).setScale(2);
        }
        if (!appreciations.isEmpty()) {
            roi.comparablesAverageAppreciationPct = calculateAverage(appreciations).setScale(2);
        }

        Double avgYield = roi.comparablesAverageRentalYieldPct == null ? null : (Double)roi.comparablesAverageRentalYieldPct;
        Double avgAppreciation = roi.comparablesAverageAppreciationPct == null ? null : (Double)roi.comparablesAverageAppreciationPct;
        if (avgYield != null || avgAppreciation != null) {
            Double totalReturn5y = (avgYield == null ? 0 : avgYield * 5) + (avgAppreciation == null ? 0 : (avgAppreciation * 5 / 12));
            roi.comparablesTotalReturn5yPct = Decimal.valueOf(totalReturn5y).setScale(2);
        }

        if (roi.subjectRentalYieldPct != null && roi.comparablesAverageRentalYieldPct != null) {
            Double subjectYield = (Double)roi.subjectRentalYieldPct;
            Double marketYield = (Double)roi.comparablesAverageRentalYieldPct;
            if (subjectYield > marketYield + 1) {
                roi.narrative = 'Subject rental yield outperforms comparable average; potential cash-flow advantage.';
            } else if (subjectYield < marketYield - 1) {
                roi.narrative = 'Subject rental yield trails peers; evaluate rent potential or pricing.';
            }
        }

        if (String.isBlank(roi.narrative)) {
            roi.narrative = 'ROI projections align closely with neighborhood averages.';
        }

        return roi;
    }

    private static DepreciationAnalysis buildDepreciationAnalysis(Property__c subject,
                                                                   MarketSnapshot snapshot,
                                                                   List<ComparableSale> comparables) {
        DepreciationAnalysis dep = new DepreciationAnalysis();

        Integer currentYear = Date.today().year();
        Integer effectiveYear = subject.Effective_Year_Built__c == null ? null : Integer.valueOf(subject.Effective_Year_Built__c);
        Integer observedAge = (effectiveYear == null) ? null : Math.max(0, currentYear - effectiveYear);
        Integer yearsSinceRenovation = null;
        if (subject.Renovation_Date__c != null) {
            yearsSinceRenovation = Math.max(0, Date.today().year() - subject.Renovation_Date__c.year());
        }

        dep.effectiveYear = effectiveYear;
        dep.observedAge = observedAge;
        dep.yearsSinceRenovation = yearsSinceRenovation;

        Integer adjustedAge = observedAge;
        if (yearsSinceRenovation != null && observedAge != null) {
            Integer renovationAdjustment = Math.min(observedAge, Math.max(0, observedAge - yearsSinceRenovation));
            adjustedAge = Math.max(0, observedAge - Math.floor(renovationAdjustment * 0.5));
        }
        dep.adjustedAge = adjustedAge;

        Integer assumedUsefulLife = 60; // default residential useful life in years
        dep.assumedUsefulLife = assumedUsefulLife;

        Integer remainingUsefulLife = (adjustedAge == null) ? null : Math.max(0, assumedUsefulLife - adjustedAge);
        dep.remainingUsefulLife = remainingUsefulLife;

        Integer marketRemaining = null;
        if (comparables != null && !comparables.isEmpty()) {
            Integer total = 0;
            Integer count = 0;
            for (ComparableSale comp : comparables) {
                if (comp.sqft == null) continue;
                // Simulate comparable age based on sale price adjustment
                Integer compAge = adjustedAge;
                if (comp.pricePerSqft != null && snapshot != null && snapshot.estimatedValue != null && snapshot.estimatedValue > 0) {
                    Decimal ratio = comp.pricePerSqft / (snapshot.estimatedValue / (subject.Square_Footage__c == null ? 1 : subject.Square_Footage__c));
                    if (ratio > 1.05) {
                        compAge = Math.max(0, (compAge == null ? 0 : compAge) - 5);
                    } else if (ratio < 0.95) {
                        compAge = (compAge == null ? 10 : compAge + 5);
                    }
                }
                if (compAge != null) {
                    total += Math.max(0, assumedUsefulLife - compAge);
                    count++;
                }
            }
            if (count > 0) {
                marketRemaining = Math.max(0, Math.round((Decimal)total / count));
            }
        }
        dep.marketRemainingUsefulLife = marketRemaining;

        Decimal subjectPrice = snapshot != null && snapshot.estimatedValue != null ? snapshot.estimatedValue : subject.Price__c;
        if (subjectPrice != null && adjustedAge != null) {
            Decimal depreciation = (adjustedAge / (Decimal)assumedUsefulLife) * 100;
            depreciation = depreciation.setScale(2);
            dep.depreciationPercent = depreciation;
            dep.depreciatedValue = (subjectPrice * (1 - (depreciation / 100))).setScale(0);
        }

        if (dep.depreciationPercent != null) {
            if (dep.remainingUsefulLife != null && dep.marketRemainingUsefulLife != null) {
                if (dep.remainingUsefulLife > dep.marketRemainingUsefulLife + 5) {
                    dep.narrative = 'Subject improvements extend useful life beyond peers, indicating lower effective depreciation.';
                } else if (dep.remainingUsefulLife + 5 < dep.marketRemainingUsefulLife) {
                    dep.narrative = 'Subject effective age exceeds market norms; plan for capital expenditures sooner.';
                }
            }
        }

        if (String.isBlank(dep.narrative)) {
            dep.narrative = 'Depreciation aligns with expected residential aging curves.';
        }

        return dep;
    }

    private static TaxAnalysis buildTaxAnalysis(Property__c subject) {
        TaxAnalysis tax = new TaxAnalysis();
        tax.assessedValue = subject.Assessed_Value__c;
        tax.municipality = subject.Municipality__c;
        tax.propertyType = subject.Property_Type__c;

        Decimal assessed = subject.Assessed_Value__c;
        if (assessed == null && subject.Price__c != null) {
            assessed = subject.Price__c * 0.95;
            tax.assessedValue = assessed;
        }

        Decimal municipalRate = lookupMunicipalRate(subject.Municipality__c, subject.State__c);
        Decimal educationRate = lookupEducationRate(subject.State__c);
        Decimal propertyTax = null;
        if (assessed != null) {
            propertyTax = ((municipalRate + educationRate) / 100) * assessed;
        }

        Decimal insuranceEstimate = estimateInsurance(subject.Property_Type__c, subject.State__c, assessed);
        Decimal hoa = estimateHoaFees(subject.Property_Type__c, subject.City__c);

        tax.municipalRate = municipalRate;
        tax.educationRate = educationRate;
        tax.propertyTaxAnnual = propertyTax == null ? null : propertyTax.setScale(0);
        tax.insuranceEstimate = insuranceEstimate == null ? null : insuranceEstimate.setScale(0);
        tax.hoaAnnual = hoa == null ? null : hoa.setScale(0);

        Decimal totalAnnual = 0;
        if (propertyTax != null) totalAnnual += propertyTax;
        if (insuranceEstimate != null) totalAnnual += insuranceEstimate;
        if (hoa != null) totalAnnual += hoa;
        tax.totalCarryingCostAnnual = totalAnnual == 0 ? null : totalAnnual.setScale(0);
        tax.totalCarryingCostMonthly = totalAnnual == 0 ? null : (totalAnnual / 12).setScale(0);

        tax.narrative = buildTaxNarrative(tax);
        return tax;
    }

    private static Decimal lookupMunicipalRate(String municipality, String state) {
        Map<String, Decimal> baseRates = new Map<String, Decimal>{
            'San Francisco' => 1.17,
            'New York' => 1.65,
            'Chicago' => 2.05,
            'Austin' => 1.98,
            'Denver' => 0.74
        };
        if (municipality != null && baseRates.containsKey(municipality)) {
            return baseRates.get(municipality);
        }
        Map<String, Decimal> stateFallback = new Map<String, Decimal>{
            'CA' => 1.00,
            'NY' => 1.45,
            'TX' => 2.00,
            'CO' => 0.80,
            'IL' => 1.90,
            'FL' => 0.98
        };
        if (state != null && stateFallback.containsKey(state)) {
            return stateFallback.get(state);
        }
        return 1.20; // national average
    }

    private static Decimal lookupEducationRate(String state) {
        Map<String, Decimal> educationRates = new Map<String, Decimal>{
            'CA' => 0.35,
            'NY' => 0.55,
            'TX' => 0.40,
            'CO' => 0.20,
            'IL' => 0.60,
            'FL' => 0.25
        };
        if (state != null && educationRates.containsKey(state)) {
            return educationRates.get(state);
        }
        return 0.30;
    }

    private static Decimal estimateInsurance(String propertyType, String state, Decimal assessed) {
        Decimal base = assessed == null ? 500000 : Math.min(assessed, 1000000);
        Decimal ratePerThousand = 3.5; // $3.5 per $1000 of coverage as baseline
        if (state != null) {
            if (state == 'FL' || state == 'TX') {
                ratePerThousand = 5.5;
            } else if (state == 'CA') {
                ratePerThousand = 4.2;
            }
        }
        if (propertyType != null) {
            if (propertyType == 'Condo') {
                ratePerThousand *= 0.6;
            } else if (propertyType == 'Multi Family' || propertyType == 'Investment') {
                ratePerThousand *= 1.2;
            }
        }
        return ((base / 1000) * ratePerThousand);
    }

    private static Decimal estimateHoaFees(String propertyType, String city) {
        if (propertyType == null) {
            return 0;
        }
        Map<String, Decimal> typeBase = new Map<String, Decimal>{
            'Condo' => 3000,
            'Townhouse' => 1800,
            'Single Family' => 600,
            'Multi Family' => 2400,
            'Investment' => 2000
        };
        Decimal base = typeBase.containsKey(propertyType) ? typeBase.get(propertyType) : 1000;
        if (city != null && (city == 'New York' || city == 'San Francisco')) {
            base *= 1.5;
        }
        return base;
    }

    private static String buildTaxNarrative(TaxAnalysis tax) {
        if (tax == null) {
            return null;
        }
        List<String> parts = new List<String>();
        if (tax.propertyTaxAnnual != null) {
            parts.add('Estimated property taxes: ' + tax.propertyTaxAnnual.setScale(0));
        }
        if (tax.insuranceEstimate != null) {
            parts.add('Insurance projection: ' + tax.insuranceEstimate.setScale(0));
        }
        if (tax.hoaAnnual != null && tax.hoaAnnual > 0) {
            parts.add('HOA: ' + tax.hoaAnnual.setScale(0) + ' per year');
        }
        if (tax.totalCarryingCostMonthly != null) {
            parts.add('Total monthly carrying cost approx ' + tax.totalCarryingCostMonthly.setScale(0));
        }
        if (parts.isEmpty()) {
            return 'Insufficient financial data to estimate carrying costs.';
        }
        return String.join(parts, ' | ');
    }

    private static Map<String, MediaSection> buildMediaMap(Property__c subject) {
        Map<String, MediaSection> media = new Map<String, MediaSection>();
        if (subject.Record_Link__c != null) {
            MediaSection photos = new MediaSection();
            photos.before = subject.Record_Link__c + '/photos-before.jpg';
            photos.after = subject.Record_Link__c + '/photos-after.jpg';
            media.put('photos', photos);

            MediaSection floor = new MediaSection();
            floor.before = subject.Record_Link__c + '/floor-before.jpg';
            floor.after = subject.Record_Link__c + '/floor-after.jpg';
            media.put('floorPlans', floor);

            MediaSection exterior = new MediaSection();
            exterior.before = subject.Record_Link__c + '/exterior-before.jpg';
            exterior.after = subject.Record_Link__c + '/exterior-after.jpg';
            media.put('exterior', exterior);
        }
        return media;
    }

    private static Map<String, TourInfo> buildTourMap(Property__c subject) {
        Map<String, TourInfo> tours = new Map<String, TourInfo>();
        if (subject.Record_Link__c != null) {
            TourInfo tourA = new TourInfo();
            tourA.label = 'Matterport Tour';
            tourA.provider = 'Matterport';
            tourA.url = subject.Record_Link__c + '/tour-matterport';
            tourA.thumbnail = subject.Record_Link__c + '/tour-matterport-thumb.jpg';
            tourA.measurements = new List<TourMeasurement>{
                measurement('Living Room Width', 18, 'ft', 'Measured along main wall'),
                measurement('Ceiling Height', 9, 'ft', null)
            };
            tours.put('primary', tourA);

            TourInfo tourB = new TourInfo();
            tourB.label = 'Exterior Walkthrough';
            tourB.provider = '360Cam';
            tourB.url = subject.Record_Link__c + '/tour-exterior';
            tourB.thumbnail = subject.Record_Link__c + '/tour-exterior-thumb.jpg';
            tourB.measurements = new List<TourMeasurement>{
                measurement('Lot Depth', 120, 'ft', 'Front fence to back alley'),
                measurement('Driveway Width', 12, 'ft', null)
            };
            tours.put('secondary', tourB);
        }
        return tours;
    }

    private static TourMeasurement measurement(String name, Decimal value, String unit, String notes) {
        TourMeasurement tm = new TourMeasurement();
        tm.name = name;
        tm.value = value;
        tm.unit = unit;
        tm.notes = notes;
        return tm;
    }

    private static List<MapLayer> buildMapLayers(Property__c subject, List<ComparableSale> comparables) {
        List<MapLayer> layers = new List<MapLayer>();
        Decimal baseLat = subject.Latitude__c;
        Decimal baseLng = subject.Longitude__c;
        if (baseLat == null || baseLng == null) {
            baseLat = 37.7749;
            baseLng = -122.4194;
        }

        MapLayer propertiesLayer = new MapLayer();
        propertiesLayer.type = 'properties';
        propertiesLayer.label = 'Compared Properties';
        propertiesLayer.description = 'Locations of subject and comparable properties.';
        propertiesLayer.points = new List<MapPoint>();

        MapPoint subjectPoint = new MapPoint();
        subjectPoint.lat = baseLat;
        subjectPoint.lng = baseLng;
        subjectPoint.label = subject.Name;
        subjectPoint.detail = 'Subject property';
        propertiesLayer.points.add(subjectPoint);

        for (Integer i = 0; i < Math.min(5, comparables.size()); i++) {
            ComparableSale comp = comparables[i];
            MapPoint point = new MapPoint();
            Decimal latOffset = Decimal.valueOf(Math.sin(i) * 0.01);
            Decimal lngOffset = Decimal.valueOf(Math.cos(i) * 0.01);
            point.lat = baseLat + latOffset;
            point.lng = baseLng + lngOffset;
            point.label = comp.address;
            point.detail = 'Sale Price ' + comp.salePrice;
            point.score = comp.pricePerSqft;
            propertiesLayer.points.add(point);
        }
        layers.add(propertiesLayer);

        layers.add(buildHeatLayer('crime', 'Crime Hotspots', 'Relative crime intensity using neighborhood data.', baseLat, baseLng));
        layers.add(buildHeatLayer('schools', 'Schools', 'School quality density (higher intensity = better ratings).', baseLat, baseLng));
        layers.add(buildHeatLayer('amenities', 'Amenities', 'Restaurants, parks, and daily needs access.', baseLat, baseLng));
        layers.add(buildHeatLayer('commute', 'Commute Time', 'Lower commute times produce higher intensity values.', baseLat, baseLng));

        return layers;
    }

    private static MapLayer buildHeatLayer(String type, String label, String description, Decimal baseLat, Decimal baseLng) {
        MapLayer layer = new MapLayer();
        layer.type = type;
        layer.label = label;
        layer.description = description;
        layer.heat = new List<HeatPoint>();
        for (Integer i = 0; i < 10; i++) {
            HeatPoint point = new HeatPoint();
            Decimal angle = Decimal.valueOf(i * 36);
            point.lat = baseLat + Decimal.valueOf(Math.sin((Double)angle) * 0.02);
            point.lng = baseLng + Decimal.valueOf(Math.cos((Double)angle) * 0.02);
            point.intensity = Decimal.valueOf(0.4 + Math.random() * 0.6);
            layer.heat.add(point);
        }
        return layer;
    }

    private static List<NeighborhoodProfile> buildNeighborhoodProfiles(Property__c subject, List<NeighborhoodTrend> trends) {
        List<NeighborhoodProfile> profiles = new List<NeighborhoodProfile>();
        NeighborhoodProfile current = new NeighborhoodProfile();
        current.label = 'Current Demographics';
        current.summary = 'Family-friendly community with growing tech workforce and strong public amenities.';
        current.sentiment = 'positive';
        current.metrics = new List<NeighborhoodMetric>{
            metric('Median Age', '35', 'Stable', 'utility:user'),
            metric('Median Household Income', '$125k', 'Rising', 'utility:trending'),
            metric('Population Growth', '+2.5% YoY', 'Rising', 'utility:arrowup')
        };
        profiles.add(current);

        NeighborhoodProfile education = new NeighborhoodProfile();
        education.label = 'School Districts';
        education.summary = 'Zoned to Redwood Unified (Rating 9/10) with access to STEM magnet programs.';
        education.sentiment = 'positive';
        education.metrics = new List<NeighborhoodMetric>{
            metric('Elementary', 'Maple Grove ES (9/10)', 'Improving', 'utility:education'),
            metric('Middle', 'Sequoia MS (8/10)', 'Stable', 'utility:education'),
            metric('High', 'Redwood HS (9/10)', 'Rising', 'utility:education')
        };
        profiles.add(education);

        NeighborhoodProfile safety = new NeighborhoodProfile();
        safety.label = 'Crime & Safety';
        safety.summary = 'Violent crime 30% below metro average; property crime slightly higher near transit corridors.';
        safety.sentiment = 'caution';
        safety.metrics = new List<NeighborhoodMetric>{
            metric('Violent Crime Index', '2.1 / 10k', 'Falling', 'utility:warning'),
            metric('Property Crime Index', '12.4 / 10k', 'Stable', 'utility:warning'),
            metric('Police Presence', '3 stations within 2 mi', 'Stable', 'utility:favorite')
        };
        profiles.add(safety);

        NeighborhoodProfile development = new NeighborhoodProfile();
        development.label = 'Future Development';
        development.summary = 'Upcoming mixed-use project and new light-rail station slated for 2026 delivery.';
        development.sentiment = 'opportunity';
        development.metrics = new List<NeighborhoodMetric>{
            metric('Transit Expansion', 'Light-rail Phase II (2026)', 'Rising', 'utility:travel_and_places'),
            metric('Retail Pipeline', '75k sq ft open-air plaza', 'Rising', 'utility:shop'),
            metric('Zoning Changes', 'In review for increased density', 'Stable', 'utility:approval')
        };
        profiles.add(development);

        if (trends != null && !trends.isEmpty()) {
            NeighborhoodTrend latest = trends[trends.size() - 1];
            NeighborhoodProfile housing = new NeighborhoodProfile();
            housing.label = 'Housing Market';
            housing.summary = 'Steady appreciation with manageable days-on-market, signalling balanced demand.';
            housing.sentiment = latest.priceChangePct > 0 ? 'positive' : 'caution';
            housing.metrics = new List<NeighborhoodMetric>{
                metric('Median Price', '$' + latest.medianPrice, latest.priceChangePct + '%', 'utility:currency'),
                metric('Inventory Change', latest.inventoryChangePct + '%', latest.inventoryChangePct > 0 ? 'Rising' : 'Falling', 'utility:bucket'),
                metric('Days on Market', latest.daysOnMarket + ' days', 'Stable', 'utility:clock')
            };
            profiles.add(housing);
        }

        return profiles;
    }

    private static NeighborhoodMetric metric(String label, String value, String trend, String icon) {
        NeighborhoodMetric m = new NeighborhoodMetric();
        m.label = label;
        m.value = value;
        m.trend = trend;
        m.icon = icon;
        return m;
    }

    private static MobilitySummary buildMobilitySummary(Property__c subject) {
        MobilitySummary mobility = new MobilitySummary();
        mobility.walk = scoreDetail(78, 'Walker’s Paradise', 'Most errands can be accomplished on foot.', new List<String>{
            'Sidewalk coverage above city average',
            'Farmers market within 0.3 mi',
            'Library and gym accessible walking distance'
        });
        mobility.transit = scoreDetail(64, 'Good Transit', 'Many nearby public transportation options.', new List<String>{
            'Light-rail station 0.4 mi',
            'Bus routes 12, 24, 38 at corner',
            'Peak hour express to downtown'
        });
        mobility.bike = scoreDetail(82, 'Very Bikeable', 'Flat terrain and dedicated bike lanes.', new List<String>{
            'Protected bike lanes on Maple Ave',
            'Bike-share dock 2 blocks away',
            'Trail access through River Greenway'
        });
        mobility.narrative = 'Balanced mobility with strong biking infrastructure and reliable transit for downtown commuters.';
        return mobility;
    }

    private static ScoreDetail scoreDetail(Integer score, String label, String description, List<String> highlights) {
        ScoreDetail detail = new ScoreDetail();
        detail.score = score;
        detail.label = label;
        detail.description = description;
        detail.highlights = highlights;
        return detail;
    }

    private static List<CommuteOption> buildCommuteOptions(Property__c subject) {
        List<CommuteOption> options = new List<CommuteOption>();
        options.add(commuteOption('Driving', 'Fastest route via US-101', 28, 12, new List<CommuteStep>{
            step('Head south on Maple Ave toward 3rd St', 3, 1),
            step('Merge onto US-101 S via ramp to Downtown', 12, 6),
            step('Take exit 432 for Market St', 2, 1),
            step('Arrive at 500 Market St', 1, 0)
        }));

        options.add(commuteOption('Transit', 'Light-rail + bus combination', 42, 11, new List<CommuteStep>{
            step('Walk to Maple & 5th Light-Rail Station', 5, 0),
            step('Board Green Line toward Downtown', 18, 9),
            step('Transfer to Bus 24 at Central Hub', 2, 0),
            step('Ride Bus 24 to Market & 4th', 12, 2),
            step('Walk to destination', 5, 0)
        }));

        options.add(commuteOption('Bike', 'Scenic River Trail detour avoids traffic', 35, 10, new List<CommuteStep>{
            step('Head east on Maple Ave toward River Trail', 5, 1),
            step('Follow River Trail southbound', 20, 7),
            step('Use bike lane on Market St', 8, 2)
        }));

        options.add(commuteOption('Ride-share', 'Shared ride, average wait 6 min', 30, 12, new List<CommuteStep>{
            step('Request ride via preferred app', 6, 0),
            step('Ride via US-101 S (estimated)', 22, 12),
            step('Drop-off at 500 Market St', 2, 0)
        }));

        return options;
    }

    private static CommuteOption commuteOption(String mode, String summary, Integer duration, Integer distance, List<CommuteStep> steps) {
        CommuteOption option = new CommuteOption();
        option.mode = mode;
        option.summary = summary;
        option.durationMinutes = duration;
        option.distanceMiles = distance;
        option.steps = steps;
        return option;
    }

    private static CommuteStep step(String instruction, Integer duration, Integer distance) {
        CommuteStep step = new CommuteStep();
        step.instruction = instruction;
        step.durationMinutes = duration;
        step.distanceMiles = distance;
        return step;
    }

    private static SchoolComparison buildSchoolComparison(Property__c subject) {
        SchoolComparison comparison = new SchoolComparison();
        comparison.schools = new List<SchoolDetail>();

        SchoolDetail elementary = school('Maple Grove Elementary', 'Elementary', '9/10', '92nd percentile', 0.4, 'High opportunity index with strong arts funding.');
        elementary.programs = new List<String>{
            'STEM lab (grades 3-5)',
            'Dual-language immersion (Spanish)',
            'After-school robotics club'
        };
        elementary.opportunityIndex = 'High';
        comparison.schools.add(elementary);

        SchoolDetail middle = school('Sequoia Middle School', 'Middle', '8/10', '88th percentile', 0.9, 'Renovated campus and new makerspace.');
        middle.programs = new List<String>{
            'Project-based learning cohorts',
            'Performing arts pathway',
            'AVID college preparedness'
        };
        middle.opportunityIndex = 'Moderate';
        comparison.schools.add(middle);

        SchoolDetail high = school('Redwood High School', 'High', '9/10', '94th percentile', 1.6, 'Top-tier AP participation; strong athletics.');
        high.programs = new List<String>{
            'AP Capstone diploma program',
            'BioTech academy (partnership with Stanford)',
            'Varsity athletics (State finalists 2023)'
        };
        high.opportunityIndex = 'High';
        comparison.schools.add(high);

        SchoolDetail charter = school('Innovate Prep Charter', 'K-8', '7/10', '80th percentile', 1.1, 'Lottery-based admissions with extended day schedule.');
        charter.programs = new List<String>{
            'Project lead the way (engineering)',
            'Daily enrichment clubs (coding, drama, chess)',
            'Small group tutoring (2x per week)'
        };
        charter.opportunityIndex = 'Moderate';
        comparison.schools.add(charter);

        comparison.narrative = 'Families benefit from a robust public school pipeline with charter alternatives, strong college readiness metrics, and well-funded extracurricular programs.';
        return comparison;
    }

    private static SchoolDetail school(String name, String level, String rating, String percentile, Decimal distance, String notes) {
        SchoolDetail detail = new SchoolDetail();
        detail.name = name;
        detail.level = level;
        detail.rating = rating;
        detail.testScorePercentile = percentile;
        detail.distanceMiles = distance;
        detail.notes = notes;
        return detail;
    }

    private static CrimeComparison buildCrimeComparison(Property__c subject) {
        CrimeComparison comparison = new CrimeComparison();
        comparison.safetyScore = 82;
        comparison.narrative = 'Area enjoys lower violent crime than the metro average, though property crime hotspots remain near commercial corridors. Community programs and increased patrols are trending positively.';

        comparison.trends = new List<CrimeTrend>();
        Integer currentYear = Date.today().year();
        for (Integer offset = 4; offset >= 0; offset--) {
            Integer year = currentYear - offset;
            CrimeTrend trend = new CrimeTrend();
            trend.year = year;
            trend.violentRate = Decimal.valueOf(2.5 + (Math.random() * 0.5));
            trend.propertyRate = Decimal.valueOf(12 + (Math.random() * 1.2));
            trend.cityAverage = Decimal.valueOf(3.1 + (Math.random() * 0.6));
            comparison.trends.add(trend);
        }

        comparison.categories = new List<CrimeCategorySummary>();
        comparison.categories.add(crimeSummary('Violent Crime', 2.3, 3.4, 'Falling', 'Community policing pilot reduced incidents 15% YoY.'));
        comparison.categories.add(crimeSummary('Property Crime', 12.2, 13.8, 'Stable', 'Package thefts concentrated near Maple & 8th.')); 
        comparison.categories.add(crimeSummary('Auto Theft', 1.1, 1.6, 'Rising', 'Deterrent lighting under installation at garages.'));
        comparison.categories.add(crimeSummary('Quality of Life', 4.2, 5.1, 'Falling', 'Noise complaints down after new quiet hours enforcement.'));

        return comparison;
    }

    private static CrimeCategorySummary crimeSummary(String category, Decimal subjectRate, Decimal metroRate, String direction, String notes) {
        CrimeCategorySummary summary = new CrimeCategorySummary();
        summary.category = category;
        summary.subjectRate = subjectRate;
        summary.metroRate = metroRate;
        summary.direction = direction;
        summary.notes = notes;
        return summary;
    }

    private static EnvironmentalRisk buildEnvironmentalRisk(Property__c subject) {
        EnvironmentalRisk risk = new EnvironmentalRisk();
        risk.floodScore = 74;
        risk.earthquakeScore = 62;
        risk.airQualityScore = 81;
        risk.climateProjectionScore = 68;
        risk.narrative = 'Overall moderate risk profile: flood mitigated by levee improvements, moderate seismic exposure, improving air quality, and manageable long-term climate impacts.';

        risk.factors = new List<EnvironmentalFactor>();
        risk.factors.add(environmentalFactor('Flood Zone', 'Property sits in FEMA Zone AE with 0.2% annual risk; nearby levee upgrades reduce exposure.', 'Owner maintains flood insurance; city levee Phase II completes 2025.', 'Risk trending downward with infrastructure investment.'));
        risk.factors.add(environmentalFactor('Earthquake', 'Proximity to San Andreas fault (25 mi) yields moderate shaking hazard.', 'Seismic retrofits recommended for chimneys/garage (estimated $8k).', 'State resilience grants under review for 2024 rollout.'));
        risk.factors.add(environmentalFactor('Air Quality', 'AQI averages 58 (Good) with occasional wildfire smoke events.', 'Smart HVAC with MERV-13 filters and community clean air center.', 'Expanding defensible space programs to reduce smoke impacts.'));
        risk.factors.add(environmentalFactor('Climate Projection', 'Projected +1.8°F by 2040; 6 additional heatwave days annually.', 'Cool roof credit approved; tree canopy initiative underway.', 'Municipality implementing cooling centers and water resiliency plan.'));
        return risk;
    }

    private static EnvironmentalFactor environmentalFactor(String label, String impact, String mitigation, String outlook) {
        EnvironmentalFactor factor = new EnvironmentalFactor();
        factor.label = label;
        factor.impact = impact;
        factor.mitigation = mitigation;
        factor.outlook = outlook;
        return factor;
    }

    private static DevelopmentOutlook buildDevelopmentOutlook(Property__c subject) {
        DevelopmentOutlook outlook = new DevelopmentOutlook();
        outlook.narrative = 'Multiple public and private projects are positioned to boost livability and property values, though short-term construction impacts should be monitored.';

        outlook.projects = new List<ProjectHighlight>();
        outlook.projects.add(project('Riverfront Commons', 'Mixed-use Retail & Residential', Date.today().year() + 2, '75k sq ft open-air retail with 120 loft apartments, public plaza, and culinary hall.', 'Expected to increase walkability and attract premium retailers.'));
        outlook.projects.add(project('Greenway Trail Extension', 'Infrastructure', Date.today().year() + 1, '2.3-mile multi-use trail connecting Maple Ave to downtown transit hub.', 'Improves bike connectivity, likely boosting active transportation scores.'));
        outlook.projects.add(project('Innovation Hub Campus', 'Commercial/Office', Date.today().year() + 3, '150k sq ft innovation labs with incubator space partnership with local university.', 'Could drive higher-income employment and weekday foot traffic.'));

        outlook.zoningChanges = new List<ZoningChange>();
        outlook.zoningChanges.add(zoning('Ordinance 22-14', 'Approved (2023)', 'Upzones Maple/Elm corridor from R2 to R3 allowing small multi-family infill.', 'Modest density increase; expect more modern triplexes and ADUs.'));
        outlook.zoningChanges.add(zoning('Ordinance 23-07', 'In Review', 'Establishes Transit-Oriented Development overlay near light-rail expansion.', 'Could support mid-rise mixed-use builds and reduce parking minimums.'));
        outlook.zoningChanges.add(zoning('Ordinance 24-02', 'Public Hearing Q3', 'Proposes green building incentives and expedited permits for adaptive reuse.', 'Encourages sustainable retrofits; may attract ESG-focused investors.'));

        return outlook;
    }

    private static ProjectHighlight project(String name, String type, Integer completionYear, String description, String impact) {
        ProjectHighlight highlight = new ProjectHighlight();
        highlight.name = name;
        highlight.type = type;
        highlight.completionYear = completionYear;
        highlight.description = description;
        highlight.potentialImpact = impact;
        return highlight;
    }

    private static ZoningChange zoning(String ordinance, String status, String summary, String expectedEffect) {
        ZoningChange change = new ZoningChange();
        change.ordinance = ordinance;
        change.status = status;
        change.summary = summary;
        change.expectedEffect = expectedEffect;
        return change;
    }

    private static List<MortgageScenario> buildMortgageScenarios(Property__c subject) {
        Decimal price = subject.Price__c != null ? subject.Price__c : 850000;
        List<MortgageScenario> scenarios = new List<MortgageScenario>();
        scenarios.add(mortgage('Conventional 30yr Fixed', 6.25, 360, 20, price, 'No PMI with 20% down. Standard conforming limits.'));
        scenarios.add(mortgage('Conventional 15yr Fixed', 5.75, 180, 25, price, 'Aggressive payoff, higher monthly, saves on total interest.'));
        scenarios.add(mortgage('FHA 30yr Fixed', 5.50, 360, 3.5, price, 'Includes upfront + monthly MIP; lower down payment.'));
        scenarios.add(mortgage('ARM 5/1', 5.10, 360, 10, price, 'Fixed for 5 years, adjusts annually capped +2%/yr.'));
        scenarios.add(mortgage('Jumbo 30yr Fixed', 6.45, 360, 20, price, 'For loans above conforming limit; stricter underwriting.'));
        return scenarios;
    }

    private static MortgageScenario mortgage(String loanType, Decimal rate, Integer term, Decimal downPercent, Decimal price, String notes) {
        MortgageScenario scenario = new MortgageScenario();
        scenario.loanType = loanType;
        scenario.interestRate = rate;
        scenario.termMonths = term;
        scenario.downPaymentPercent = downPercent;
        scenario.apr = rate + 0.25;
        scenario.notes = notes;

        Decimal principal = price * (1 - (downPercent / 100));
        Decimal monthlyRate = rate / 100 / 12;
        Decimal emi = (principal * monthlyRate * Decimal.valueOf(Math.pow(1 + (Double)monthlyRate, (Double)term))) /
            (Decimal.valueOf(Math.pow(1 + (Double)monthlyRate, (Double)term)) - 1);
        scenario.monthlyPrincipalInterest = emi.setScale(2);
        scenario.totalPaid5y = (emi * 60).setScale(2);
        scenario.totalPaid10y = (emi * 120).setScale(2);
        return scenario;
    }

    private static TotalCostOwnership buildTotalCostOwnership(Property__c subject) {
        TotalCostOwnership tco = new TotalCostOwnership();
        Decimal price = subject.Price__c != null ? subject.Price__c : 850000;

        tco.maintenanceAnnual = (price * 0.0125).setScale(2); // 1.25% of value
        tco.utilitiesAnnual = Decimal.valueOf(4200);
        tco.insuranceAnnual = Decimal.valueOf(1600);
        tco.propertyTaxAnnual = Decimal.valueOf(price * 0.012).setScale(2);
        tco.renovationReserveAnnual = Decimal.valueOf(2500);
        tco.opportunityCostAnnual = (price * 0.02 * 0.20).setScale(2); // 2% return on down payment assumption

        tco.lineItems = new List<TcoLineItem>();
        tco.lineItems.add(tcoLine('Maintenance', tco.maintenanceAnnual, '1.25% of purchase price for repairs/upkeep.'));
        tco.lineItems.add(tcoLine('Utilities', tco.utilitiesAnnual, 'Electric, gas, water, broadband.'));
        tco.lineItems.add(tcoLine('Insurance', tco.insuranceAnnual, 'Homeowners policy with endorsements.'));
        tco.lineItems.add(tcoLine('Property Taxes', tco.propertyTaxAnnual, 'Based on local millage and assessed value.'));
        tco.lineItems.add(tcoLine('Renovation Reserve', tco.renovationReserveAnnual, 'Future capital improvements every 8-10 years.'));
        tco.lineItems.add(tcoLine('Opportunity Cost', tco.opportunityCostAnnual, 'Foregone 2% return on down payment capital.'));

        Decimal yearOne = tco.maintenanceAnnual + tco.utilitiesAnnual + tco.insuranceAnnual + tco.propertyTaxAnnual + tco.renovationReserveAnnual + tco.opportunityCostAnnual;
        tco.totalYearOne = yearOne.setScale(2);
        tco.totalFiveYear = (yearOne * 5).setScale(2);
        tco.totalTenYear = (yearOne * 10).setScale(2);
        return tco;
    }

    private static TcoLineItem tcoLine(String label, Decimal annual, String assumption) {
        TcoLineItem line = new TcoLineItem();
        line.label = label;
        line.annualCost = annual;
        line.assumption = assumption;
        return line;
    }

    private static RentalAnalysis buildRentalAnalysis(Property__c subject) {
        RentalAnalysis rental = new RentalAnalysis();
        Decimal price = subject.Price__c != null ? subject.Price__c : 850000;
        rental.estimatedMonthlyRent = Decimal.valueOf(price * 0.0045).setScale(0); // 0.45% of price
        rental.annualGrossRent = (rental.estimatedMonthlyRent * 12).setScale(0);
        rental.vacancyRate = 0.045;
        rental.landlordCostAnnual = (rental.annualGrossRent * 0.35).setScale(0); // operating expenses 35%
        rental.netOperatingIncome = (rental.annualGrossRent * (1 - rental.vacancyRate) - rental.landlordCostAnnual).setScale(0);
        rental.capRate = ((rental.netOperatingIncome / price) * 100).setScale(2);
        rental.narrative = 'Solid rental fundamentals: healthy rent-to-price ratio, modest vacancy, and manageable operating responsibilities. Lease terms competitive for young professionals and small families.';

        rental.responsibilities = new List<RentalResponsibility>();
        rental.responsibilities.add(rentalResponsibility('Property Taxes', 'Paid by landlord', 'N/A', 'Escrowed through mortgage servicing.'));
        rental.responsibilities.add(rentalResponsibility('Maintenance under $500', 'Tenant handles minor upkeep', 'Tenant covers consumables', 'Lease clause reimburses tenant for approved repairs under $500.'));
        rental.responsibilities.add(rentalResponsibility('Landscape / Snow', 'Landlord hires landscaping service', 'Tenant shovels walkways', 'Monthly lawn service included; tenant responsible for light snow removal.'));
        rental.responsibilities.add(rentalResponsibility('Utilities', 'Tenant pays electric, gas, internet', 'Landlord covers water/sewer', 'Typical for single-family rentals in area.'));

        rental.scenarios = new List<RentalScenario>();
        rental.scenarios.add(rentalScenario('Base Case', rental.estimatedMonthlyRent, rental.vacancyRate, rental.netOperatingIncome, 'Market rent, average occupancy.'));
        rental.scenarios.add(rentalScenario('Premium Furnished', rental.estimatedMonthlyRent * 1.15, 0.08, rental.netOperatingIncome + 2500, 'Higher rent with 2-month vacancy for turnover.'));
        rental.scenarios.add(rentalScenario('Long-Term Corporate', rental.estimatedMonthlyRent * 1.25, 0.03, rental.netOperatingIncome + 5000, 'Corporate relocation contract with annual renewal.'));

        return rental;
    }

    private static RentalResponsibility rentalResponsibility(String item, String landlord, String tenant, String notes) {
        RentalResponsibility responsibility = new RentalResponsibility();
        responsibility.item = item;
        responsibility.landlord = landlord;
        responsibility.tenant = tenant;
        responsibility.notes = notes;
        return responsibility;
    }

    private static RentalScenario rentalScenario(String label, Decimal rent, Decimal vacancy, Decimal noi, String notes) {
        RentalScenario scenario = new RentalScenario();
        scenario.label = label;
        scenario.rent = rent.setScale(0);
        scenario.vacancy = vacancy;
        scenario.noi = noi.setScale(0);
        scenario.notes = notes;
        return scenario;
    }

    private static AppreciationOutlook buildAppreciationOutlook(Property__c subject, List<NeighborhoodTrend> trends) {
        AppreciationOutlook outlook = new AppreciationOutlook();
        outlook.history = new List<AppreciationHistory>();
        Integer currentYear = Date.today().year();
        for (Integer offset = 5; offset >= 1; offset--) {
            Integer year = currentYear - offset;
            AppreciationHistory history = new AppreciationHistory();
            history.year = year;
            history.subjectAppreciation = Decimal.valueOf(3.5 + (Math.random() * 1.5));
            history.cityAppreciation = Decimal.valueOf(3.1 + (Math.random() * 1.2));
            history.nationalAppreciation = Decimal.valueOf(2.4 + (Math.random() * 1.0));
            outlook.history.add(history);
        }

        outlook.projections = new List<AppreciationProjection>();
        for (Integer i = 1; i <= 5; i++) {
            AppreciationProjection projection = new AppreciationProjection();
            projection.year = currentYear + i;
            projection.conservative = Decimal.valueOf(2.0 + (i * 0.1));
            projection.baseline = Decimal.valueOf(3.0 + (i * 0.2));
            projection.optimistic = Decimal.valueOf(4.0 + (i * 0.3));
            outlook.projections.add(projection);
        }

        if (trends != null && !trends.isEmpty()) {
            Decimal latestMedian = trends[trends.size() - 1].medianPrice;
            Decimal annualGrowth = trends[trends.size() - 1].priceChangePct;
            outlook.narrative = 'Historical appreciation averaged ' + outlook.history[4].subjectAppreciation.setScale(1) + '% annually. Assuming ' + annualGrowth.setScale(1) + '% growth tied to current median price $' + latestMedian + ', baseline projections remain bullish with upside tied to forthcoming development and transit upgrades.';
        } else {
            outlook.narrative = 'Historical appreciation trends above national averages. Baseline projections assume continued demand, with conservative cases accounting for broader market normalization.';
        }

        return outlook;
    }

    private static RenovationComparison buildRenovationComparison(Property__c subject) {
        RenovationComparison comparison = new RenovationComparison();
        Decimal price = subject.Price__c != null ? subject.Price__c : 850000;

        comparison.improvements = new List<RenovationLineItem>();
        comparison.improvements.add(renovationLine('Kitchen Remodel', 45000, 65000, 'Quartz counters, energy-efficient appliances, soft-close cabinetry.'));
        comparison.improvements.add(renovationLine('Primary Bath Refresh', 18000, 25000, 'Walk-in shower, dual vanity, heated floors.'));
        comparison.improvements.add(renovationLine('Flooring & Paint', 12000, 18000, 'LVP flooring main level, low-VOC interior paint.'));
        comparison.improvements.add(renovationLine('Energy Upgrades', 9000, 14000, 'Solar-ready panel, smart thermostat, added insulation.'));

        Decimal totalBudget = 0;
        Decimal totalImpact = 0;
        for (RenovationLineItem item : comparison.improvements) {
            totalBudget += item.cost;
            totalImpact += item.valueImpact;
        }

        comparison.asIsScenario = renovationScenario(0, price, Decimal.valueOf(0), Decimal.valueOf(0), 0);
        Decimal postRenovationValue = price + totalImpact;
        comparison.renovatedScenario = renovationScenario(totalBudget, postRenovationValue, totalImpact, (totalImpact / totalBudget) * 100, 6);

        comparison.narrative = 'Targeted upgrades could yield approximately $' + totalImpact.setScale(0) + ' in added value against a $' + totalBudget.setScale(0) + ' budget, delivering an estimated ROI of ' + comparison.renovatedScenario.roi.setScale(1) + '%. Construction timeline projected at 6 months with staged contractor schedules.';
        return comparison;
    }

    private static RenovationLineItem renovationLine(String label, Decimal cost, Decimal impact, String notes) {
        RenovationLineItem line = new RenovationLineItem();
        line.label = label;
        line.cost = cost.setScale(0);
        line.valueImpact = impact.setScale(0);
        line.notes = notes;
        return line;
    }

    private static RenovationScenario renovationScenario(Decimal budget, Decimal value, Decimal equityGain, Decimal roi, Integer timeline) {
        RenovationScenario scenario = new RenovationScenario();
        scenario.budget = budget.setScale(0);
        scenario.postRenovationValue = value.setScale(0);
        scenario.equityGain = equityGain.setScale(0);
        scenario.roi = roi.setScale(2);
        scenario.timelineMonths = timeline;
        return scenario;
    }

    private static CustomScoreTemplate buildCustomScoreTemplate() {
        CustomScoreTemplate template = new CustomScoreTemplate();
        template.instructions = 'Assign weights (0-100) to each criterion; totals auto-normalize. Add optional notes per property to track priorities.';
        template.criteria = new List<ScoreCriterion>();
        template.criteria.add(scoreCriterion('location', 'Location Quality', 25, 'Proximity to work, schools, daily amenities.', 'slider'));
        template.criteria.add(scoreCriterion('financial', 'Financial Fit', 20, 'Mortgage affordability, taxes, insurance, cash reserves.', 'slider'));
        template.criteria.add(scoreCriterion('livability', 'Livability & Layout', 15, 'Beds/baths, floor plan, storage, outdoor space.', 'slider'));
        template.criteria.add(scoreCriterion('condition', 'Condition / Renovation Need', 15, 'Updates required, inspection findings, systems age.', 'slider'));
        template.criteria.add(scoreCriterion('neighborhood', 'Neighborhood Vibe', 10, 'Safety, community, future growth, noise.', 'slider'));
        template.criteria.add(scoreCriterion('mobility', 'Mobility & Commute', 5, 'Transit access, commute times, walk/bike friendliness.', 'slider'));
        template.criteria.add(scoreCriterion('schools', 'School Alignment', 5, 'Zoning fit, ratings, programs, special needs.', 'slider'));
        template.criteria.add(scoreCriterion('future', 'Future Potential', 5, 'Appreciation outlook, development pipeline, adaptability.', 'slider'));
        return template;
    }

    private static ScoreCriterion scoreCriterion(String key, String label, Integer weight, String description, String inputType) {
        ScoreCriterion criterion = new ScoreCriterion();
        criterion.key = key;
        criterion.label = label;
        criterion.suggestedWeight = Decimal.valueOf(weight);
        criterion.description = description;
        criterion.inputType = inputType;
        return criterion;
    }
}
