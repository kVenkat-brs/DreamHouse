public with sharing class ArmCalculator {
    public class ArmEntry {
        @AuraEnabled public Integer monthNumber;
        @AuraEnabled public Date dueDate;
        @AuraEnabled public Decimal annualRatePercent;
        @AuraEnabled public Decimal payment;
        @AuraEnabled public Decimal interest;
        @AuraEnabled public Decimal principal;
        @AuraEnabled public Decimal balance;
    }

    public class ArmSchedule {
        @AuraEnabled public List<ArmEntry> entries;
        @AuraEnabled public Decimal totalInterest;
        @AuraEnabled public Decimal totalPaid;
        @AuraEnabled public Integer totalPayments;
        @AuraEnabled public Date payoffDate;
    }

    /**
     * Projects an ARM schedule over the full loan term using adjustment inputs.
     * - principal: starting loan balance
     * - termYears: total loan term in years
     * - startDate: first payment due date; if null, uses today
     * - initialRatePercent: initial annual interest rate (e.g., 6.5)
     * - firstAdjustmentMonths: months until the first rate adjustment occurs
     * - adjustPeriodMonths: months between subsequent adjustments
     * - indexRatesPercent: series of index values (annual %) applied at each adjustment
     * - marginPercent: annual margin added to the index
     * - periodicCapUpPercent/DownPercent: max up/down change per adjustment (annual % points)
     * - lifetimeCapLowPercent/HighPercent: absolute min/max annual rates over loan life
     */
    @AuraEnabled(cacheable=true)
    public static ArmSchedule projectArm(
        Decimal principal,
        Integer termYears,
        Date startDate,
        Decimal initialRatePercent,
        Integer firstAdjustmentMonths,
        Integer adjustPeriodMonths,
        List<Decimal> indexRatesPercent,
        Decimal marginPercent,
        Decimal periodicCapUpPercent,
        Decimal periodicCapDownPercent,
        Decimal lifetimeCapLowPercent,
        Decimal lifetimeCapHighPercent
    ) {
        // Validate inputs and set defaults
        if (principal == null || principal <= 0 || termYears == null || termYears <= 0 || initialRatePercent == null || initialRatePercent < 0) {
            return emptySchedule();
        }
        if (startDate == null) startDate = Date.today();
        if (firstAdjustmentMonths == null || firstAdjustmentMonths < 0) firstAdjustmentMonths = 60; // default 5/1 ARM
        if (adjustPeriodMonths == null || adjustPeriodMonths <= 0) adjustPeriodMonths = 12;
        if (marginPercent == null) marginPercent = 0;
        if (periodicCapUpPercent == null) periodicCapUpPercent = 1.0;
        if (periodicCapDownPercent == null) periodicCapDownPercent = 1.0;
        if (lifetimeCapLowPercent == null) lifetimeCapLowPercent = 0;
        if (lifetimeCapHighPercent == null) lifetimeCapHighPercent = initialRatePercent + 5;

        Integer totalMonths = termYears * 12;
        Decimal balance = principal;
        Decimal currentAnnualRate = initialRatePercent;
        Decimal monthlyRate = toMonthlyRate(currentAnnualRate);
        Decimal payment = pmt(balance, monthlyRate, totalMonths);

        // Build set of adjustment months and iterate index series
        Integer nextAdjMonth = (firstAdjustmentMonths > 0) ? firstAdjustmentMonths + 1 : 1;
        Integer indexPtr = 0;

        List<ArmEntry> entries = new List<ArmEntry>();
        Decimal totalInterest = 0;
        Date due = startDate;
        for (Integer m = 1; m <= totalMonths && balance > 0; m++) {
            // Adjustment boundary: apply caps and recalc payment based on remaining term
            if (m == nextAdjMonth) {
                Decimal newIndex = (indexRatesPercent != null && indexPtr < indexRatesPercent.size()) ? indexRatesPercent[indexPtr] : null;
                if (newIndex != null) {
                    Decimal targetRate = newIndex + marginPercent; // annual target
                    // Apply periodic caps relative to current rate
                    Decimal maxUp = currentAnnualRate + periodicCapUpPercent;
                    Decimal maxDown = currentAnnualRate - periodicCapDownPercent;
                    Decimal capped = targetRate;
                    if (capped > maxUp) capped = maxUp;
                    if (capped < maxDown) capped = maxDown;
                    // Apply lifetime caps
                    if (capped > lifetimeCapHighPercent) capped = lifetimeCapHighPercent;
                    if (capped < lifetimeCapLowPercent) capped = lifetimeCapLowPercent;
                    currentAnnualRate = capped;
                    monthlyRate = toMonthlyRate(currentAnnualRate);
                    Integer remaining = totalMonths - (m - 1);
                    payment = pmt(balance, monthlyRate, remaining);
                    indexPtr++;
                }
                nextAdjMonth += adjustPeriodMonths;
            }

            Decimal interest = (monthlyRate == 0) ? 0 : (balance * monthlyRate);
            Decimal principalPaid = payment - interest;
            if (principalPaid < 0) principalPaid = 0;
            if (principalPaid > balance) principalPaid = balance;
            balance -= principalPaid;
            totalInterest += interest;

            ArmEntry e = new ArmEntry();
            e.monthNumber = m;
            e.dueDate = due;
            e.annualRatePercent = currentAnnualRate;
            e.payment = round2(payment);
            e.interest = round2(interest);
            e.principal = round2(principalPaid);
            e.balance = round2(balance);
            entries.add(e);

            // advance due date ~ one month
            due = due.addMonths(1);
        }

        ArmSchedule sch = new ArmSchedule();
        sch.entries = entries;
        sch.totalPayments = entries.size();
        sch.totalInterest = round2(totalInterest);
        Decimal totalPaid = 0;
        for (ArmEntry e : entries) totalPaid += e.payment;
        sch.totalPaid = round2(totalPaid);
        sch.payoffDate = (entries.isEmpty()) ? startDate : entries[entries.size()-1].dueDate;
        return sch;
    }

    // Helpers
    private static Decimal pmt(Decimal principal, Decimal monthlyRate, Integer months) {
        if (months == null || months <= 0) return 0;
        if (monthlyRate == 0) return principal / months;
        Decimal g = (Decimal)Math.pow(1 + (Double)monthlyRate, months);
        return principal * monthlyRate * g / (g - 1);
    }
    private static Decimal toMonthlyRate(Decimal annualPercent) {
        return (annualPercent == null) ? 0 : (annualPercent / 100) / 12;
    }
    private static Decimal round2(Decimal d) { return (d == null) ? null : d.setScale(2); }

    private static ArmSchedule emptySchedule() {
        ArmSchedule s = new ArmSchedule();
        s.entries = new List<ArmEntry>();
        s.totalInterest = 0;
        s.totalPaid = 0;
        s.totalPayments = 0;
        s.payoffDate = Date.today();
        return s;
    }
}

