public with sharing class MovingQuoteService {

    public class QuoteProfile {
        @AuraEnabled public Date moveDate;
        @AuraEnabled public String moveSize;
        @AuraEnabled public String distanceGroup;
        @AuraEnabled public List<String> services;
    }

    public class QuoteOption {
        @AuraEnabled public String companyName;
        @AuraEnabled public Decimal baseQuote;
        @AuraEnabled public Decimal totalWithServices;
        @AuraEnabled public Integer estimatedHours;
        @AuraEnabled public List<String> inclusions;
        @AuraEnabled public String notes;
    }

    @AuraEnabled(cacheable=true)
    public static List<QuoteOption> getMovingQuotes(Id propertyId, QuoteProfile profile) {
        Decimal base = 1250;
        if (profile != null) {
            if (profile.moveSize == '3BR') base += 400;
            if (profile.moveSize == '4Plus') base += 700;
            if (profile.distanceGroup == 'Regional (50-250 miles)') base += 950;
            if (profile.distanceGroup == 'Long Haul (>250 miles)') base += 1800;
            if (profile.services != null) {
                if (profile.services.contains('Packing')) base += 350;
                if (profile.services.contains('Storage')) base += 200;
                if (profile.services.contains('PianoHandling')) base += 250;
            }
        }

        List<QuoteOption> options = new List<QuoteOption>();
        options.add(option('SwiftMove Logistics', base, 18, new List<String>{'2-person crew', 'Standard coverage'}, 'Discounted packing materials included.'));
        options.add(option('Family Movers Co.', base + 180, 20, new List<String>{'3-person crew', 'Packing + unpacking'}, 'Eco-friendly packing materials, flexible scheduling.'));
        options.add(option('Premium Relocation', base + 420, 22, new List<String>{'White-glove service', 'Furniture assembly', 'Storage 30 days'}, 'Best for high-value items, includes furniture disassembly.'));
        return options;
    }

    private static QuoteOption option(String name, Decimal total, Integer hours, List<String> inclusions, String notes) {
        QuoteOption opt = new QuoteOption();
        opt.companyName = name;
        opt.baseQuote = (total * 0.7).setScale(0);
        opt.totalWithServices = total.setScale(0);
        opt.estimatedHours = hours;
        opt.inclusions = inclusions;
        opt.notes = notes;
        return opt;
    }
}
