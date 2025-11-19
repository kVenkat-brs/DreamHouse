public with sharing class RecommendationService {
    public class Preferences {
        @AuraEnabled public Decimal maxPrice;
        @AuraEnabled public Integer minBeds;
        @AuraEnabled public Integer minBaths;
        @AuraEnabled public String city;
        @AuraEnabled public String tags; // comma or space separated
        @AuraEnabled public Map<String, Decimal> weights; // e.g., { price: 0.4, beds: 0.3, baths: 0.3 }
        @AuraEnabled public List<Id> recentViewed; // optional: boost familiar items
    }

    public class Recommendation {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public Decimal price;
        @AuraEnabled public Integer beds;
        @AuraEnabled public Integer baths;
        @AuraEnabled public String city;
        @AuraEnabled public String tags;
        @AuraEnabled public Decimal score; // 0..1
    }

    @AuraEnabled(cacheable=true)
    public static List<Recommendation> getRecommendations(Preferences prefs, Integer limitSize) {
        Integer lim = limitSize == null ? 10 : limitSize;
        // Load candidate properties (broader than filters to allow scoring to decide)
        List<Property__c> props = [
            SELECT Id, Name, Price__c, Beds__c, Baths__c, City__c, Tags__c
            FROM Property__c
            WITH USER_MODE
            LIMIT 200
        ];

        // Compute stats for normalization
        Decimal minPrice = null, maxPrice = null;
        Integer minBeds = null, maxBeds = null, minBaths = null, maxBaths = null;
        for (Property__c p : props) {
            if (p.Price__c != null) {
                minPrice = (minPrice == null || p.Price__c < minPrice) ? p.Price__c : minPrice;
                maxPrice = (maxPrice == null || p.Price__c > maxPrice) ? p.Price__c : maxPrice;
            }
            if (p.Beds__c != null) {
                minBeds = (minBeds == null || p.Beds__c < minBeds) ? Integer.valueOf(p.Beds__c) : minBeds;
                maxBeds = (maxBeds == null || p.Beds__c > maxBeds) ? Integer.valueOf(p.Beds__c) : maxBeds;
            }
            if (p.Baths__c != null) {
                minBaths = (minBaths == null || p.Baths__c < minBaths) ? Integer.valueOf(p.Baths__c) : minBaths;
                maxBaths = (maxBaths == null || p.Baths__c > maxBaths) ? Integer.valueOf(p.Baths__c) : maxBaths;
            }
        }

        // Default weights
        Map<String, Decimal> w = (prefs != null && prefs.weights != null) ? prefs.weights : new Map<String, Decimal>();
        if (w.isEmpty()) {
            w.put('price', 0.4);
            w.put('beds', 0.3);
            w.put('baths', 0.3);
        }
        Decimal wSum = 0;
        for (Decimal v : w.values()) wSum += (v == null ? 0 : v);
        if (wSum == 0) wSum = 1;
        for (String k : new List<String>(w.keySet())) {
            w.put(k, w.get(k) / wSum);
        }

        // Prepare tag and city filters (soft)
        Set<String> prefTags = new Set<String>();
        if (prefs != null && String.isNotBlank(prefs.tags)) {
            for (String t : prefs.tags.split('[,;\s]+')) {
                if (String.isNotBlank(t)) prefTags.add(t.toLowerCase());
            }
        }
        String prefCity = prefs != null ? prefs.city : null;

        // Collaborative proxy: popularity via review count and avg rating
        Map<Id, Integer> reviewCounts = new Map<Id, Integer>();
        Map<Id, Decimal> reviewAverages = new Map<Id, Decimal>();
        AggregateResult[] agg = [
            SELECT Property__c pid, COUNT(Id) cnt, AVG(Rating__c) avgRate
            FROM Property_Review__c
            WHERE Property__c IN :props
            GROUP BY Property__c
        ];
        for (AggregateResult ar : agg) {
            reviewCounts.put((Id)ar.get('pid'), (Integer)ar.get('cnt'));
            reviewAverages.put((Id)ar.get('pid'), (Decimal)ar.get('avgRate'));
        }

        // Prepare recent viewed set for a small familiarity boost
        Set<Id> recent = new Set<Id>();
        if (prefs != null && prefs.recentViewed != null) recent.addAll(prefs.recentViewed);

        // Score each property
        List<Recommendation> out = new List<Recommendation>();
        for (Property__c p : props) {
            Decimal score = 0;

            // Price: cheaper is better relative to range; admire staying under max
            if (p.Price__c != null && maxPrice != null && minPrice != null && maxPrice != minPrice) {
                Decimal r = (p.Price__c - minPrice) / (maxPrice - minPrice); // 0..1 high=expensive
                Decimal priceScore = 1 - r; // lower price → higher score
                if (prefs != null && prefs.maxPrice != null && p.Price__c > prefs.maxPrice) {
                    priceScore *= 0.5; // penalty if over budget
                }
                score += (w.get('price') != null ? w.get('price') : 0) * priceScore;
            }

            // Beds and baths: higher is better within range; boost if over min
            if (p.Beds__c != null && maxBeds != null && minBeds != null && maxBeds != minBeds) {
                Decimal r = (Decimal.valueOf(p.Beds__c) - minBeds) / (maxBeds - minBeds);
                Decimal bedScore = r;
                if (prefs != null && prefs.minBeds != null && p.Beds__c < prefs.minBeds) bedScore *= 0.5;
                score += (w.get('beds') != null ? w.get('beds') : 0) * bedScore;
            }
            if (p.Baths__c != null && maxBaths != null && minBaths != null && maxBaths != minBaths) {
                Decimal r = (Decimal.valueOf(p.Baths__c) - minBaths) / (maxBaths - minBaths);
                Decimal bathScore = r;
                if (prefs != null && prefs.minBaths != null && p.Baths__c < prefs.minBaths) bathScore *= 0.5;
                score += (w.get('baths') != null ? w.get('baths') : 0) * bathScore;
            }

            // Soft matching on city
            if (String.isNotBlank(prefCity)) {
                if (p.City__c != null && p.City__c.equalsIgnoreCase(prefCity)) {
                    score += 0.05;
                }
            }

            // Soft matching on tags
            if (!prefTags.isEmpty() && String.valueOf(p.Tags__c) != null) {
                Set<String> ptags = new Set<String>();
                for (String t : String.valueOf(p.Tags__c).split('[,;\s]+')) {
                    if (String.isNotBlank(t)) ptags.add(t.toLowerCase());
                }
                Integer overlap = 0;
                for (String t : prefTags) if (ptags.contains(t)) overlap++;
                if (overlap > 0) score += Math.min(0.1, Decimal.valueOf(overlap) * 0.03);
            }

            // Popularity proxy
            Integer cnt = reviewCounts.get(p.Id);
            Decimal avg = reviewAverages.get(p.Id);
            if (cnt != null && cnt > 0) {
                Decimal pop = Math.min(0.1, Decimal.valueOf(cnt) * 0.01);
                score += pop;
            }
            if (avg != null) {
                Decimal star = (avg / 5) * 0.1; // up to +0.1
                score += star;
            }

            // Familiarity boost if recently viewed
            if (!recent.isEmpty() && recent.contains(p.Id)) {
                score += 0.03;
            }

            Recommendation rOut = new Recommendation();
            rOut.id = p.Id;
            rOut.name = p.Name;
            rOut.price = p.Price__c;
            rOut.beds = p.Beds__c == null ? null : Integer.valueOf(p.Beds__c);
            rOut.baths = p.Baths__c == null ? null : Integer.valueOf(p.Baths__c);
            rOut.city = p.City__c;
            rOut.tags = p.Tags__c;
            rOut.score = score;
            out.add(rOut);
        }

        out.sort(new ComparatorDesc());
        if (out.size() > lim) out.removeRange(lim, out.size());
        return out;
    }

    public class ComparatorDesc implements System.Comparator {
        public Integer compare(Object a, Object b) {
            Recommendation ra = (Recommendation)a;
            Recommendation rb = (Recommendation)b;
            Decimal da = ra.score == null ? 0 : ra.score;
            Decimal db = rb.score == null ? 0 : rb.score;
            if (da == db) return 0;
            return da > db ? -1 : 1;
        }
    }
}
