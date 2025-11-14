public with sharing class RateShoppingService {

    public class RateOfferDTO {
        @AuraEnabled public String lenderName;
        @AuraEnabled public Decimal rate; // %
        @AuraEnabled public Decimal apr;  // %
        @AuraEnabled public Decimal points; // % of loan amount
        @AuraEnabled public Decimal fees;   // absolute currency amount
        @AuraEnabled public Integer lockDays;
        @AuraEnabled public String productCode;
        @AuraEnabled public String notes;
        @AuraEnabled public Decimal monthly; // estimated monthly P&I
        @AuraEnabled public Decimal total3y; // estimated total cost over 3y (interest + fees + points)
        @AuraEnabled public Decimal total5y;
        @AuraEnabled public Decimal total10y;
    }

    @AuraEnabled(cacheable=true)
    public static List<RateOfferDTO> getOffers(Decimal loanAmount,
                                               Integer termMonths,
                                               Decimal ltvPct,
                                               String occupancy,
                                               String propertyType,
                                               Integer creditScore) {
        // In a real implementation, this method would call out to multiple
        // lender APIs (via Named Credentials) and normalize responses.
        // For now, return a set of mock offers tailored slightly by inputs.

        if (loanAmount == null || loanAmount <= 0 || termMonths == null || termMonths <= 0) {
            return new List<RateOfferDTO>();
        }

        Decimal baseRate = 7.00;
        if (creditScore != null) {
            if (creditScore >= 800) baseRate -= 0.50;
            else if (creditScore >= 740) baseRate -= 0.25;
            else if (creditScore <= 660) baseRate += 0.25;
        }
        if (ltvPct != null && ltvPct > 80) baseRate += 0.125;
        if (occupancy == 'investment') baseRate += 0.25;

        Integer n = termMonths;
        Decimal r = (baseRate/100)/12;
        Decimal emi = r == 0 ? (loanAmount/n) : (loanAmount * r * (Decimal.valueOf(Math.pow(1 + (Double)r, (Double)n)))) / ((Decimal.valueOf(Math.pow(1 + (Double)r, (Double)n))) - 1);

        List<RateOfferDTO> out = new List<RateOfferDTO>();
        out.add(offer('Acme Bank', baseRate,  baseRate + 0.10, 0.50, 1500, 30, 'FIXED30', 'Good for W2 borrowers', loanAmount, n));
        out.add(offer('HomeFirst Mortgage', baseRate - 0.10, baseRate, 0.25,  995, 45, 'FIXED30', 'Fast close available', loanAmount, n));
        out.add(offer('Citywide CU', baseRate - 0.20, baseRate - 0.10, 0.00,  700, 60, 'FIXED30', 'Members only special', loanAmount, n));
        out.add(offer('Neighborhood Lenders', baseRate + 0.05, baseRate + 0.15, 0.75, 1200, 30, 'FIXED30', 'Flexible underwriting', loanAmount, n));
        return out;
    }

    private static RateOfferDTO offer(String name, Decimal rate, Decimal apr, Decimal points, Decimal fees, Integer lockDays,
                                       String code, String notes, Decimal loanAmount, Integer termMonths) {
        RateOfferDTO dto = new RateOfferDTO();
        dto.lenderName = name;
        dto.rate = rate.setScale(3);
        dto.apr = apr.setScale(3);
        dto.points = points.setScale(3);
        dto.fees = fees.setScale(2);
        dto.lockDays = lockDays;
        dto.productCode = code;
        dto.notes = notes;
        Decimal r = (rate/100)/12;
        Integer n = termMonths;
        Decimal emi = r == 0 ? (loanAmount/n) : (loanAmount * r * (Decimal.valueOf(Math.pow(1 + (Double)r, (Double)n)))) / ((Decimal.valueOf(Math.pow(1 + (Double)r, (Double)n))) - 1);
        dto.monthly = emi.setScale(2);
        // Simple horizon totals: interest-only approximation using amortization factor for the period
        dto.total3y = ((emi * 36) - (loanAmount - principalAfter(loanAmount, r, n, 36))) + fees + (loanAmount * (points/100));
        dto.total5y = ((emi * 60) - (loanAmount - principalAfter(loanAmount, r, n, 60))) + fees + (loanAmount * (points/100));
        dto.total10y = ((emi * 120) - (loanAmount - principalAfter(loanAmount, r, n, 120))) + fees + (loanAmount * (points/100));
        return dto;
    }

    // Returns remaining principal after k payments
    private static Decimal principalAfter(Decimal P, Decimal r, Integer n, Integer k) {
        if (r == 0) {
            Decimal paid = (P/n) * k;
            return P - paid;
        }
        Double RR = 1 + (Double)r;
        Double a = Math.pow(RR, (Double)k);
        Double b = Math.pow(RR, (Double)n);
        Decimal emi = (P * r * (Decimal)b) / (((Decimal)b) - 1);
        // Remaining balance formula
        Decimal rem = (P * (Decimal)a) - (emi * (((Decimal)a) - 1) / r);
        return rem;
    }
}

