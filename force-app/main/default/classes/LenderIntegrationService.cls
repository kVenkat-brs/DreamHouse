public with sharing class LenderIntegrationService {

    public class BuyerProfile {
        @AuraEnabled public Decimal creditScore;
        @AuraEnabled public Decimal annualIncome;
        @AuraEnabled public Decimal downPaymentPercent;
        @AuraEnabled public Decimal debtToIncome;
    }

    public class PreApprovalOption {
        @AuraEnabled public String lenderName;
        @AuraEnabled public String program;
        @AuraEnabled public Decimal interestRate;
        @AuraEnabled public Decimal apr;
        @AuraEnabled public Integer lockDays;
        @AuraEnabled public Decimal estimatedMonthlyPayment;
        @AuraEnabled public Decimal closingCosts;
        @AuraEnabled public Decimal approvedAmount;
        @AuraEnabled public String notes;
    }

    @AuraEnabled(cacheable=true)
    public static List<PreApprovalOption> getPreApprovalOptions(Id propertyId, BuyerProfile profile) {
        Property__c prop = [SELECT Price__c FROM Property__c WHERE Id = :propertyId LIMIT 1];
        Decimal price = prop.Price__c != null ? prop.Price__c : 850000;

        Decimal downPercent = profile != null && profile.downPaymentPercent != null ? profile.downPaymentPercent : 20;
        Decimal loanAmount = price * (1 - (downPercent / 100));

        List<PreApprovalOption> options = new List<PreApprovalOption>();
        options.add(option('FirstHome Mortgage', '30yr Conventional', 6.19, loanAmount, 30, 1.25, 'Waived appraisal for strong credit.'));
        options.add(option('GreenLeaf Credit Union', '15yr Conventional', 5.68, loanAmount, 45, 1.05, 'Requires 25% down, includes rate float-down.'));
        options.add(option('Neighborhood Bank', 'FHA 30yr', 5.45, loanAmount * 0.96, 60, 1.35, 'Upfront and monthly MIP included; flexible underwriting.'));
        options.add(option('Tech Capital', '5/1 ARM Jumbo', 5.05, loanAmount, 45, 1.1, 'Rate fixed 5 yrs then adjusts annually, 2/2/5 caps.'));
        return options;
    }

    private static PreApprovalOption option(String name, String program, Decimal rate, Decimal amount, Integer lockDays, Decimal closingPct, String notes) {
        PreApprovalOption opt = new PreApprovalOption();
        opt.lenderName = name;
        opt.program = program;
        opt.interestRate = rate.setScale(2);
        opt.apr = (rate + 0.27).setScale(2);
        opt.lockDays = lockDays;
        opt.approvedAmount = amount.setScale(0);
        opt.closingCosts = (amount * (closingPct/100)).setScale(0);
        opt.estimatedMonthlyPayment = calcMonthly(amount, rate, 360);
        opt.notes = notes;
        return opt;
    }

    private static Decimal calcMonthly(Decimal principal, Decimal rate, Integer termMonths) {
        Decimal monthlyRate = rate / 100 / 12;
        Decimal numerator = principal * monthlyRate * Decimal.valueOf(Math.pow(1 + (Double)monthlyRate, (Double)termMonths));
        Decimal denominator = Decimal.valueOf(Math.pow(1 + (Double)monthlyRate, (Double)termMonths)) - 1;
        return (numerator / denominator).setScale(2);
    }
}
