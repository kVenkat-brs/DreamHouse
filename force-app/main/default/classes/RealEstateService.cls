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
}
