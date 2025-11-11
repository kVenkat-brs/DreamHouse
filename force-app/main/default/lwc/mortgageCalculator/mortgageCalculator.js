import { LightningElement, track } from 'lwc';

const MONTHS_IN_YEAR = 12;

export default class MortgageCalculator extends LightningElement {
    activeSectionName = 'step1';
    activeSectionNameB = 'step1';
    theme = 'standard'; // standard | dark | pro
    comparisonMode = false;
    affordabilityMode = false;
    // Currency selection
    selectedCurrency = null; // ISO code, e.g., USD, EUR
    // Scenario A (default)
    @track price = null;
    @track interestRate = null; // annual percentage rate (derived from loan type unless overridden)
    @track tenure = null; // years
    @track monthlyPayment = null;
    @track validationMessage = null;
    @track loanType = 'fixed30'; // fixed30 | fixed15 | arm5_1 | fha | va
    @track armInitialRate = null; // optional ARM-specific input (A)
    @track armMargin = null; // optional ARM-specific input (A)

    // Scenario B (comparison)
    @track priceB = null;
    @track interestRateB = null; // annual percentage rate (derived from loan type unless overridden)
    @track tenureB = null; // years
    @track monthlyPaymentB = null;
    @track validationMessageB = null;
    @track schedule = [];
    @track scheduleB = [];
    @track loanTypeB = 'fixed30';
    @track armInitialRateB = null; // optional ARM-specific input (B)
    @track armMarginB = null; // optional ARM-specific input (B)

    // Savings goal state
    @track targetDown = null; // desired down payment/goal amount
    @track savingsCurrent = null; // current savings toward goal
    @track savingsMonthly = null; // monthly contribution
    @track monthsToGoal = null; // computed months to reach goal
    @track savingsMessage = null; // validation or info

    // Personal financial information (Pre-Approval)
    @track incomeAnnual = null; // gross annual income
    @track employmentYears = null; // years employed
    @track monthlyDebt = null; // total monthly debt obligations
    @track creditScoreRange = null; // selected credit score band key
    @track preApprovalAmount = null; // estimated max principal approval
    @track preApprovalMessage = null; // validation or info

    // Neighborhood explorer (map-like grid)
    neighborhoods = [
        { key: 'downtown', name: 'Downtown', avgPrice: 550000, taxRate: 1.2 },
        { key: 'suburb_north', name: 'North Suburb', avgPrice: 420000, taxRate: 1.05 },
        { key: 'suburb_south', name: 'South Suburb', avgPrice: 380000, taxRate: 1.15 },
        { key: 'waterfront', name: 'Waterfront', avgPrice: 750000, taxRate: 1.3 }
    ];
    selectedNeighborhoodKey = null;

    // Historical mortgage rates (approximate example dataset)
    ratesHistory = [
        { year: new Date().getFullYear() - 9, rate: 3.85 },
        { year: new Date().getFullYear() - 8, rate: 3.65 },
        { year: new Date().getFullYear() - 7, rate: 3.99 },
        { year: new Date().getFullYear() - 6, rate: 4.54 },
        { year: new Date().getFullYear() - 5, rate: 3.94 },
        { year: new Date().getFullYear() - 4, rate: 3.11 },
        { year: new Date().getFullYear() - 3, rate: 2.96 },
        { year: new Date().getFullYear() - 2, rate: 5.34 },
        { year: new Date().getFullYear() - 1, rate: 6.54 },
        { year: new Date().getFullYear(), rate: 6.90 }
    ];

    // Rent vs Buy analysis
    @track currentRent = null; // monthly rent
    @track rentIncrease = null; // annual % increase
    @track maintenanceMonthly = null; // monthly maintenance costs
    @track hoaMonthly = null; // monthly HOA fees

    goToStep(event) {
        const next = event?.target?.dataset?.step;
        const scenario = event?.target?.dataset?.scenario === 'B' ? 'B' : 'A';
        if (!next) return;
        if (scenario === 'B') {
            this.activeSectionNameB = next;
        } else {
            this.activeSectionName = next;
        }
    }

    get hostClass() {
        switch (this.theme) {
            case 'dark':
                return 'theme-dark';
            case 'pro':
                return 'theme-pro';
            default:
                return '';
        }
    }

    handleThemeChange(event) {
        const selected = event?.target?.dataset?.theme;
        if (!selected) return;
        this.theme = selected;
        // Toggle host class for theme
        const host = this.template.host;
        host.classList.remove('theme-dark', 'theme-pro');
        if (this.theme === 'dark') {
            host.classList.add('theme-dark');
        } else if (this.theme === 'pro') {
            host.classList.add('theme-pro');
        }
    }

    handleComparisonToggle(event) {
        this.comparisonMode = !!event.detail.checked;
    }

    handlePriceChange(event) {
        const value = parseFloat(event.detail.value);
        const scenario = event?.target?.dataset?.scenario === 'B' ? 'B' : 'A';
        const parsed = Number.isFinite(value) && value > 0 ? value : null;
        if (scenario === 'B') {
            this.priceB = parsed;
        } else {
            this.price = parsed;
        }
    }

    handleRateChange(event) {
        const value = parseFloat(event.detail.value);
        const scenario = event?.target?.dataset?.scenario === 'B' ? 'B' : 'A';
        const parsed = Number.isFinite(value) && value >= 0 ? value : null;
        if (scenario === 'B') {
            this.interestRateB = parsed;
        } else {
            this.interestRate = parsed;
        }
    }

    get loanTypeOptions() {
        return [
            { label: 'Fixed 30 Year', value: 'fixed30' },
            { label: 'Fixed 15 Year', value: 'fixed15' },
            { label: 'ARM 5/1', value: 'arm5_1' },
            { label: 'FHA', value: 'fha' },
            { label: 'VA', value: 'va' }
        ];
    }

    get typicalRates() {
        // Example typical rates for display; can be replaced with dynamic data
        return {
            fixed30: 7.0,
            fixed15: 6.5,
            arm5_1: 6.2,
            fha: 6.9,
            va: 6.8
        };
    }

    getDefaultRateForLoanType(type) {
        return this.typicalRates[type] ?? 7.0;
    }

    handleLoanTypeChange(event) {
        const scenario = event?.target?.dataset?.scenario === 'B' ? 'B' : 'A';
        const value = event.detail.value;
        if (scenario === 'B') {
            this.loanTypeB = value;
            this.interestRateB = this.getDefaultRateForLoanType(value);
        } else {
            this.loanType = value;
            this.interestRate = this.getDefaultRateForLoanType(value);
        }
    }

    handleArmFieldChange(event) {
        const field = event.target.name;
        const scenario = event?.target?.dataset?.scenario === 'B' ? 'B' : 'A';
        const val = parseFloat(event.detail.value);
        const parsed = Number.isFinite(val) && val >= 0 ? val : null;
        if (scenario === 'B') {
            if (field === 'armInitialRate') this.armInitialRateB = parsed;
            if (field === 'armMargin') this.armMarginB = parsed;
        } else {
            if (field === 'armInitialRate') this.armInitialRate = parsed;
            if (field === 'armMargin') this.armMargin = parsed;
        }
    }

    get showArmFieldsA() {
        return this.loanType === 'arm5_1';
    }
    get showArmFieldsB() {
        return this.loanTypeB === 'arm5_1';
    }

    handleTenureChange(event) {
        const value = parseFloat(event.detail.value);
        const scenario = event?.target?.dataset?.scenario === 'B' ? 'B' : 'A';
        const parsed = Number.isFinite(value) && value > 0 ? value : null;
        if (scenario === 'B') {
            this.tenureB = parsed;
        } else {
            this.tenure = parsed;
        }
    }

    get formattedPayment() {
        if (!Number.isFinite(this.monthlyPayment)) {
            return null;
        }
        return this.formatCurrency(this.monthlyPayment);
    }

    get formattedPaymentB() {
        if (!Number.isFinite(this.monthlyPaymentB)) {
            return null;
        }
        return this.formatCurrency(this.monthlyPaymentB);
    }

    get currencyCode() {
        // Prefer user-selected currency; fallback to locale-detected
        return this.selectedCurrency || this.detectCurrencyCode();
    }

    get columns() {
        const code = this.currencyCode;
        return [
            { label: 'Year', fieldName: 'year', type: 'number', cellAttributes: { alignment: 'left' } },
            { label: 'Principal', fieldName: 'principal', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Interest', fieldName: 'interest', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Balance', fieldName: 'balance', type: 'currency', typeAttributes: { currencyCode: code } }
        ];
    }

    get summaryA() {
        if (!Number.isFinite(this.monthlyPayment) || !Number.isFinite(this.price) || !Number.isFinite(this.tenure)) {
            return null;
        }
        const totalPayments = this.tenure * MONTHS_IN_YEAR;
        const totalPaid = this.monthlyPayment * totalPayments;
        const totalInterest = totalPaid - this.price;
        return {
            monthly: this.formatCurrency(this.monthlyPayment),
            principal: this.formatCurrency(this.price),
            totalPaid: this.formatCurrency(totalPaid),
            totalInterest: this.formatCurrency(totalInterest)
        };
    }

    get summaryB() {
        if (!Number.isFinite(this.monthlyPaymentB) || !Number.isFinite(this.priceB) || !Number.isFinite(this.tenureB)) {
            return null;
        }
        const totalPayments = this.tenureB * MONTHS_IN_YEAR;
        const totalPaid = this.monthlyPaymentB * totalPayments;
        const totalInterest = totalPaid - this.priceB;
        return {
            monthly: this.formatCurrency(this.monthlyPaymentB),
            principal: this.formatCurrency(this.priceB),
            totalPaid: this.formatCurrency(totalPaid),
            totalInterest: this.formatCurrency(totalInterest)
        };
    }

    // Pre-approval helpers
    get dtiPercent() {
        if (!Number.isFinite(this.incomeAnnual) || !Number.isFinite(this.monthlyDebt)) return null;
        const monthlyIncome = this.incomeAnnual / MONTHS_IN_YEAR;
        if (monthlyIncome <= 0) return null;
        const dti = (this.monthlyDebt / monthlyIncome) * 100;
        return Math.round(dti * 10) / 10; // one decimal place
    }

    get formattedPreApproval() {
        if (!Number.isFinite(this.preApprovalAmount)) return null;
        return this.formatCurrency(this.preApprovalAmount);
    }

    handleIncomeChange(event) {
        const val = parseFloat(event.detail.value);
        this.incomeAnnual = Number.isFinite(val) && val >= 0 ? val : null;
    }

    handleEmploymentChange(event) {
        const val = parseFloat(event.detail.value);
        this.employmentYears = Number.isFinite(val) && val >= 0 ? val : null;
    }

    handleDebtChange(event) {
        const val = parseFloat(event.detail.value);
        this.monthlyDebt = Number.isFinite(val) && val >= 0 ? val : null;
    }

    handleScoreChange(event) {
        this.creditScoreRange = event.detail.value || null;
    }

    get creditScoreOptions() {
        return [
            { label: '300–579 (Poor)', value: 'poor' },
            { label: '580–669 (Fair)', value: 'fair' },
            { label: '670–739 (Good)', value: 'good' },
            { label: '740–799 (Very Good)', value: 'verygood' },
            { label: '800–850 (Excellent)', value: 'excellent' }
        ];
    }

    /**
     * Estimate pre-approval amount using DTI rules and current calculator rate/tenure.
     * Uses front-end ratio baseline 28% and back-end 36% with score-based adjustment.
     */
    calculatePreApproval() {
        // Validate inputs
        if (!Number.isFinite(this.incomeAnnual) || this.incomeAnnual <= 0) {
            this.preApprovalMessage = 'Enter a valid annual income greater than zero.';
            this.preApprovalAmount = null;
            return;
        }
        if (!Number.isFinite(this.monthlyDebt) || this.monthlyDebt < 0) {
            this.preApprovalMessage = 'Enter your total monthly debt payments (zero or more).';
            this.preApprovalAmount = null;
            return;
        }
        if (!this.creditScoreRange) {
            this.preApprovalMessage = 'Select your credit score range to refine the estimate.';
            this.preApprovalAmount = null;
            return;
        }

        const monthlyIncome = this.incomeAnnual / MONTHS_IN_YEAR;
        // Determine max housing payment by DTI rules
        const baseFront = 0.28; // 28% of monthly income
        const baseBack = 0.36; // 36% of monthly income minus debts
        const scoreAdj = this.getScoreAdjustment(this.creditScoreRange); // e.g., 0.95..1.05
        const housingByFront = monthlyIncome * baseFront * scoreAdj;
        const housingByBack = Math.max(0, monthlyIncome * baseBack - this.monthlyDebt) * scoreAdj;
        const targetPayment = Math.min(housingByFront, housingByBack);

        // Derive assumed rate/tenure from calculator (Scenario A), with fallbacks
        const annualRate = Number.isFinite(this.interestRate) && this.interestRate >= 0 ? this.interestRate : 7.0;
        const years = Number.isFinite(this.tenure) && this.tenure > 0 ? this.tenure : 30;
        const monthlyRate = (annualRate / 100) / MONTHS_IN_YEAR;
        const totalPayments = years * MONTHS_IN_YEAR;

        const principal = this.paymentToPrincipal(targetPayment, monthlyRate, totalPayments);
        this.preApprovalAmount = Math.max(0, principal);
        this.preApprovalMessage = null;
    }

    resetPreApproval() {
        this.incomeAnnual = null;
        this.employmentYears = null;
        this.monthlyDebt = null;
        this.creditScoreRange = null;
        this.preApprovalAmount = null;
        this.preApprovalMessage = null;
    }

    getScoreAdjustment(rangeKey) {
        // Conservative adjustments by score band
        const map = {
            poor: 0.95,
            fair: 0.97,
            good: 1.0,
            verygood: 1.02,
            excellent: 1.05
        };
        return map[rangeKey] || 1.0;
    }

    paymentToPrincipal(payment, monthlyRate, totalPayments) {
        if (payment <= 0) return 0;
        if (monthlyRate === 0) return payment * totalPayments;
        const g = Math.pow(1 + monthlyRate, totalPayments);
        return payment * (g - 1) / (monthlyRate * g);
    }

    // Neighborhood explorer helpers
    handleNeighborhoodClick(event) {
        const key = event?.currentTarget?.dataset?.key;
        if (key) {
            this.selectedNeighborhoodKey = key;
        }
    }

    get neighborhoodsView() {
        return (this.neighborhoods || []).map((n) => {
            const monthly = this.estimateMonthlyFor(n.avgPrice);
            return {
                key: n.key,
                name: n.name,
                avgPrice: this.formatCurrency(n.avgPrice),
                taxRate: `${n.taxRate}%`,
                monthly: monthly ? this.formatCurrency(monthly) : '—',
                selected: n.key === this.selectedNeighborhoodKey
            };
        });
    }

    estimateMonthlyFor(price) {
        if (!Number.isFinite(this.interestRate) || !Number.isFinite(this.tenure) || !Number.isFinite(price)) {
            return null;
        }
        const monthlyRate = (this.interestRate / 100) / MONTHS_IN_YEAR;
        const totalPayments = this.tenure * MONTHS_IN_YEAR;
        return this.calculateEmi(price, monthlyRate, totalPayments);
    }

    get neighborhoodComparison() {
        if (!this.selectedNeighborhoodKey) return null;
        const nb = (this.neighborhoods || []).find((n) => n.key === this.selectedNeighborhoodKey);
        if (!nb) return null;
        const nbMonthly = this.estimateMonthlyFor(nb.avgPrice);
        const baseMonthly = this.estimateMonthlyFor(this.price);
        return {
            neighborhoodName: nb.name,
            baseMonthly: baseMonthly != null ? this.formatCurrency(baseMonthly) : null,
            neighborhoodMonthly: nbMonthly != null ? this.formatCurrency(nbMonthly) : null,
            delta: baseMonthly != null && nbMonthly != null ? this.formatCurrency(nbMonthly - baseMonthly) : null
        };
    }

    // Historical mortgage rates view model
    get trendsMaxRate() {
        return Math.max(...this.ratesHistory.map((r) => r.rate));
    }

    get ratesTrendView() {
        const max = this.trendsMaxRate || 1;
        return this.ratesHistory.map((r) => {
            const pct = Math.max(4, Math.round((r.rate / max) * 100));
            return {
                key: String(r.year),
                year: r.year,
                rate: r.rate.toFixed(2),
                barStyle: `height:${pct}%`,
                aria: `Year ${r.year}, average rate ${r.rate.toFixed(2)}%`
            };
        });
    }

    // Rent vs Buy calculations
    handleRentChange(event) {
        const val = parseFloat(event.detail.value);
        this.currentRent = Number.isFinite(val) && val >= 0 ? val : null;
    }

    handleRentIncreaseChange(event) {
        const val = parseFloat(event.detail.value);
        this.rentIncrease = Number.isFinite(val) && val >= 0 ? val : null;
    }

    handleMaintenanceChange(event) {
        const val = parseFloat(event.detail.value);
        this.maintenanceMonthly = Number.isFinite(val) && val >= 0 ? val : null;
    }

    handleHoaChange(event) {
        const val = parseFloat(event.detail.value);
        this.hoaMonthly = Number.isFinite(val) && val >= 0 ? val : null;
    }

    rentingTotal(years) {
        if (!Number.isFinite(this.currentRent) || this.currentRent < 0) return null;
        const annualRent0 = this.currentRent * 12;
        const r = Number.isFinite(this.rentIncrease) ? this.rentIncrease / 100 : 0;
        if (r === 0) return annualRent0 * years;
        const factor = Math.pow(1 + r, years);
        return annualRent0 * (factor - 1) / r;
    }

    get buyingMonthlyCost() {
        // Use computed monthlyPayment if available; otherwise estimate from current inputs
        let m = this.monthlyPayment;
        if (!Number.isFinite(m)) {
            if (!Number.isFinite(this.price) || !Number.isFinite(this.interestRate) || !Number.isFinite(this.tenure)) return null;
            const monthlyRate = (this.interestRate / 100) / MONTHS_IN_YEAR;
            const total = this.tenure * MONTHS_IN_YEAR;
            m = this.calculateEmi(this.price, monthlyRate, total);
        }
        const maint = Number.isFinite(this.maintenanceMonthly) ? this.maintenanceMonthly : 0;
        const hoa = Number.isFinite(this.hoaMonthly) ? this.hoaMonthly : 0;
        return m + maint + hoa;
    }

    buyingTotal(years) {
        const bm = this.buyingMonthlyCost;
        if (!Number.isFinite(bm)) return null;
        return bm * 12 * years;
    }

    get rentBuyColumns() {
        const code = this.currencyCode;
        return [
            { label: 'Horizon', fieldName: 'horizon' },
            { label: 'Renting', fieldName: 'renting', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Buying', fieldName: 'buying', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Difference (Buy - Rent)', fieldName: 'delta', type: 'currency', typeAttributes: { currencyCode: code } }
        ];
    }

    get rentBuyRows() {
        const horizons = [5, 10, 30];
        return horizons.map((y) => {
            const rent = this.rentingTotal(y);
            const buy = this.buyingTotal(y);
            const delta = rent != null && buy != null ? (buy - rent) : null;
            return {
                id: `h${y}`,
                horizon: `${y} years`,
                renting: rent != null ? rent : null,
                buying: buy != null ? buy : null,
                delta: delta != null ? delta : null
            };
        });
    }

    // =========================
    // Pre‑Qualification Wizard (5‑Step)
    // =========================
    wizardStep = 1; // 1..5
    wizEmployment = null; // employed | self | unemployed
    wizCreditRange = null; // reuse credit bands: poor|fair|good|verygood|excellent
    wizDownPct = null; // percent number
    wizGiftFunds = null; // yes|no
    wizIncomeMonthly = null; // number
    wizDebtsMonthly = null; // number
    wizSummary = null; // computed eligibility summary
    wizError = null; // step-specific validation

    get wizardProgress() {
        const pct = Math.round(((this.wizardStep - 1) / 4) * 100);
        return Math.max(0, Math.min(100, pct));
    }

    get wizardStepTitle() {
        switch (this.wizardStep) {
            case 1: return 'Employment Status';
            case 2: return 'Credit Profile';
            case 3: return 'Down Payment';
            case 4: return 'Income & Debts';
            case 5: return 'Summary';
            default: return 'Pre‑Qualification';
        }
    }

    get wizardEmploymentOptions() {
        return [
            { label: 'Employed', value: 'employed' },
            { label: 'Self‑employed', value: 'self' },
            { label: 'Unemployed', value: 'unemployed' }
        ];
    }

    get wizardGiftOptions() {
        return [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' }
        ];
    }

    handleWizardSelect(event) {
        const name = event.target.name;
        const val = event.detail.value;
        if (name === 'wizEmployment') this.wizEmployment = val;
        if (name === 'wizCreditRange') this.wizCreditRange = val;
        if (name === 'wizGiftFunds') this.wizGiftFunds = val;
        this.wizError = null;
    }

    handleWizardInput(event) {
        const name = event.target.name;
        const v = parseFloat(event.detail.value);
        const parsed = Number.isFinite(v) ? v : null;
        if (name === 'wizDownPct') this.wizDownPct = parsed;
        if (name === 'wizIncomeMonthly') this.wizIncomeMonthly = parsed;
        if (name === 'wizDebtsMonthly') this.wizDebtsMonthly = parsed;
        this.wizError = null;
    }

    get wizardRequiresGift() {
        return Number.isFinite(this.wizDownPct) && this.wizDownPct < 3;
    }

    get wizardFrontDTI() {
        if (!Number.isFinite(this.wizIncomeMonthly)) return null;
        const targetHousing = this.wizIncomeMonthly * 0.28;
        return Math.round((targetHousing / this.wizIncomeMonthly) * 1000) / 10;
    }

    get wizardBackDTI() {
        if (!Number.isFinite(this.wizIncomeMonthly)) return null;
        const debts = Number.isFinite(this.wizDebtsMonthly) ? this.wizDebtsMonthly : 0;
        const targetHousing = this.wizIncomeMonthly * 0.28;
        return Math.round(((targetHousing + debts) / this.wizIncomeMonthly) * 1000) / 10;
    }

    get canWizardNext() {
        switch (this.wizardStep) {
            case 1:
                return !!this.wizEmployment;
            case 2:
                return !!this.wizCreditRange;
            case 3:
                return Number.isFinite(this.wizDownPct) && (!this.wizardRequiresGift || !!this.wizGiftFunds);
            case 4:
                return Number.isFinite(this.wizIncomeMonthly) && this.wizIncomeMonthly > 0 && Number.isFinite(this.wizDebtsMonthly) && this.wizDebtsMonthly >= 0;
            case 5:
                return true;
            default:
                return false;
        }
    }

    prevWizardStep() {
        this.wizError = null;
        this.wizardStep = Math.max(1, this.wizardStep - 1);
    }

    nextWizardStep() {
        if (!this.canWizardNext) {
            this.wizError = 'Please complete the required fields to continue.';
            return;
        }
        if (this.wizardStep < 5) {
            this.wizardStep += 1;
            if (this.wizardStep === 5) {
                this.computeWizardSummary();
            }
        }
    }

    computeWizardSummary() {
        // Simple eligibility heuristic
        const employedOk = this.wizEmployment && this.wizEmployment !== 'unemployed';
        const creditOk = this.wizCreditRange && this.wizCreditRange !== 'poor';
        const downOk = Number.isFinite(this.wizDownPct) && (this.wizDownPct >= 3 || this.wizGiftFunds === 'yes');
        const backDTI = this.wizardBackDTI;
        const dtiOk = backDTI != null && backDTI <= 43;

        const eligible = employedOk && creditOk && downOk && dtiOk;
        this.wizSummary = {
            employedOk,
            creditOk,
            downOk,
            dtiOk,
            backDTI,
            eligible
        };
    }

    // =========================
    // Affordability Mode (Max Price by DTI)
    // =========================
    @track affMonthlyIncome = null; // gross monthly income
    @track affMonthlyDebts = null; // monthly non-housing debts
    @track affDownPayment = null; // down payment amount
    @track affordTargetPayment = null; // computed monthly housing payment cap
    @track affordMaxPrincipal = null; // computed max loan principal
    @track affordMaxHomePrice = null; // principal + down payment
    @track affMessage = null;

    handleAffordabilityToggle(event) {
        this.affordabilityMode = !!event.detail.checked;
    }

    handleAffIncomeChange(event) {
        const v = parseFloat(event.detail.value);
        this.affMonthlyIncome = Number.isFinite(v) && v >= 0 ? v : null;
    }

    handleAffDebtsChange(event) {
        const v = parseFloat(event.detail.value);
        this.affMonthlyDebts = Number.isFinite(v) && v >= 0 ? v : null;
    }

    handleAffDownChange(event) {
        const v = parseFloat(event.detail.value);
        this.affDownPayment = Number.isFinite(v) && v >= 0 ? v : null;
    }

    get affFrontCap() {
        if (!Number.isFinite(this.affMonthlyIncome)) return null;
        return this.affMonthlyIncome * 0.28; // 28% front-end rule
    }

    get affBackCap() {
        if (!Number.isFinite(this.affMonthlyIncome)) return null;
        const base = this.affMonthlyIncome * 0.36; // 36% back-end rule
        const debts = Number.isFinite(this.affMonthlyDebts) ? this.affMonthlyDebts : 0;
        return Math.max(0, base - debts);
    }

    get affRateTenure() {
        // Use Scenario A settings as the affordability basis
        const rate = Number.isFinite(this.interestRate) ? this.interestRate : this.getDefaultRateForLoanType(this.loanType);
        const years = Number.isFinite(this.tenure) && this.tenure > 0 ? this.tenure : 30;
        return { rate, years };
    }

    calculateAffordability() {
        // Validate inputs
        if (!Number.isFinite(this.affMonthlyIncome) || this.affMonthlyIncome <= 0) {
            this.affMessage = 'Enter a valid gross monthly income greater than zero.';
            this.clearAffordanceResults();
            return;
        }
        if (!Number.isFinite(this.affMonthlyDebts) || this.affMonthlyDebts < 0) {
            this.affMessage = 'Enter your total monthly non-housing debts (zero or more).';
            this.clearAffordanceResults();
            return;
        }
        const { rate, years } = this.affRateTenure;
        const monthlyRate = (rate / 100) / MONTHS_IN_YEAR;
        const totalPayments = years * MONTHS_IN_YEAR;

        const front = this.affFrontCap;
        const back = this.affBackCap;
        const targetPayment = Math.min(front ?? Infinity, back ?? Infinity);
        if (!Number.isFinite(targetPayment) || targetPayment <= 0) {
            this.affMessage = 'Unable to determine a target payment from your inputs.';
            this.clearAffordanceResults();
            return;
        }

        const principal = this.paymentToPrincipal(targetPayment, monthlyRate, totalPayments);
        const dp = Number.isFinite(this.affDownPayment) ? this.affDownPayment : 0;
        this.affordTargetPayment = targetPayment;
        this.affordMaxPrincipal = principal;
        this.affordMaxHomePrice = principal + dp;
        this.affMessage = null;
    }

    clearAffordanceResults() {
        this.affordTargetPayment = null;
        this.affordMaxPrincipal = null;
        this.affordMaxHomePrice = null;
    }

    resetAffordability() {
        this.affMonthlyIncome = null;
        this.affMonthlyDebts = null;
        this.affDownPayment = null;
        this.clearAffordanceResults();
        this.affMessage = null;
    }

    get formattedAffordance() {
        if (!Number.isFinite(this.affordMaxHomePrice)) return null;
        return {
            payment: this.formatCurrency(this.affordTargetPayment),
            principal: this.formatCurrency(this.affordMaxPrincipal),
            price: this.formatCurrency(this.affordMaxHomePrice)
        };
    }

    get affFrontDTI() {
        if (!Number.isFinite(this.affordTargetPayment) || !Number.isFinite(this.affMonthlyIncome) || this.affMonthlyIncome <= 0) return null;
        return Math.round((this.affordTargetPayment / this.affMonthlyIncome) * 1000) / 10;
    }

    get affBackDTI() {
        if (!Number.isFinite(this.affordTargetPayment) || !Number.isFinite(this.affMonthlyIncome) || this.affMonthlyIncome <= 0) return null;
        const debts = Number.isFinite(this.affMonthlyDebts) ? this.affMonthlyDebts : 0;
        return Math.round(((this.affordTargetPayment + debts) / this.affMonthlyIncome) * 1000) / 10;
    }

    // =========================
    // Property Type dynamic inputs
    // =========================
    @track propertyType = 'single_family';
    @track propertyTypeB = 'single_family';
    @track propertyTaxRate = null; // Annual % (A)
    @track propertyTaxRateB = null; // Annual % (B)
    @track rentalIncome = null; // Monthly (A)
    @track rentalIncomeB = null; // Monthly (B)

    get propertyTypeOptions() {
        return [
            { label: 'Single Family', value: 'single_family' },
            { label: 'Condo', value: 'condo' },
            { label: 'Townhouse', value: 'townhouse' },
            { label: 'Multi-Family', value: 'multi' }
        ];
    }

    handlePropertyTypeChange(event) {
        const scenario = event?.target?.dataset?.scenario === 'B' ? 'B' : 'A';
        const value = event.detail.value;
        if (scenario === 'B') {
            this.propertyTypeB = value;
        } else {
            this.propertyType = value;
        }
    }

    handleTaxChange(event) {
        const scenario = event?.target?.dataset?.scenario === 'B' ? 'B' : 'A';
        const val = parseFloat(event.detail.value);
        const parsed = Number.isFinite(val) && val >= 0 ? val : null;
        if (scenario === 'B') {
            this.propertyTaxRateB = parsed;
        } else {
            this.propertyTaxRate = parsed;
        }
    }

    handleRentalChange(event) {
        const scenario = event?.target?.dataset?.scenario === 'B' ? 'B' : 'A';
        const val = parseFloat(event.detail.value);
        const parsed = Number.isFinite(val) && val >= 0 ? val : null;
        if (scenario === 'B') {
            this.rentalIncomeB = parsed;
        } else {
            this.rentalIncome = parsed;
        }
    }

    get showHoaA() {
        return this.propertyType === 'condo' || this.propertyType === 'townhouse' || this.propertyType === 'multi';
    }
    get showHoaB() {
        return this.propertyTypeB === 'condo' || this.propertyTypeB === 'townhouse' || this.propertyTypeB === 'multi';
    }
    get showRentalA() {
        return this.propertyType === 'multi';
    }
    get showRentalB() {
        return this.propertyTypeB === 'multi';
    }

    get estimatedMonthlyTaxA() {
        const rate = this.propertyTaxRate;
        const price = this.price;
        if (!Number.isFinite(rate) || !Number.isFinite(price)) return null;
        const factor = this.propertyType === 'multi' ? 1.05 : this.propertyType === 'condo' ? 0.95 : this.propertyType === 'townhouse' ? 0.98 : 1.0;
        const monthly = (price * (rate / 100) * factor) / 12;
        return this.formatCurrency(monthly);
    }
    get estimatedMonthlyTaxB() {
        const rate = this.propertyTaxRateB;
        // For simplicity use Scenario A priceB if provided, else price
        const price = this.priceB ?? this.price;
        if (!Number.isFinite(rate) || !Number.isFinite(price)) return null;
        const factor = this.propertyTypeB === 'multi' ? 1.05 : this.propertyTypeB === 'condo' ? 0.95 : this.propertyTypeB === 'townhouse' ? 0.98 : 1.0;
        const monthly = (price * (rate / 100) * factor) / 12;
        return this.formatCurrency(monthly);
    }

    // =========================
    // Refinance Calculator (Current vs New)
    // =========================
    @track refiCurrentBalance = null;
    @track refiRemainingTermYears = null;
    @track refiCurrentRate = null; // % APR
    @track refiNewRate = null; // % APR
    @track refiNewTermYears = null;
    @track refiCashOut = 0;
    @track refiClosingCosts = 0;
    @track refiMessage = null;

    handleRefiChange(event) {
        const name = event.target.name;
        const val = parseFloat(event.detail.value);
        const parsed = Number.isFinite(val) && val >= 0 ? val : null;
        switch (name) {
            case 'refiCurrentBalance': this.refiCurrentBalance = parsed; break;
            case 'refiRemainingTermYears': this.refiRemainingTermYears = parsed; break;
            case 'refiCurrentRate': this.refiCurrentRate = parsed; break;
            case 'refiNewRate': this.refiNewRate = parsed; break;
            case 'refiNewTermYears': this.refiNewTermYears = parsed; break;
            case 'refiCashOut': this.refiCashOut = Number.isFinite(val) && val >= 0 ? val : 0; break;
            case 'refiClosingCosts': this.refiClosingCosts = Number.isFinite(val) && val >= 0 ? val : 0; break;
            default: break;
        }
    }

    get refiValid() {
        return (
            Number.isFinite(this.refiCurrentBalance) && this.refiCurrentBalance > 0 &&
            Number.isFinite(this.refiRemainingTermYears) && this.refiRemainingTermYears > 0 &&
            Number.isFinite(this.refiCurrentRate) && this.refiCurrentRate >= 0 &&
            Number.isFinite(this.refiNewRate) && this.refiNewRate >= 0 &&
            Number.isFinite(this.refiNewTermYears) && this.refiNewTermYears > 0
        );
    }

    get refiComputed() {
        if (!this.refiValid) {
            return null;
        }
        const curP = this.refiCurrentBalance;
        const curR = (this.refiCurrentRate / 100) / MONTHS_IN_YEAR;
        const curN = this.refiRemainingTermYears * MONTHS_IN_YEAR;
        const newP = curP + (Number.isFinite(this.refiCashOut) ? this.refiCashOut : 0) + (Number.isFinite(this.refiClosingCosts) ? this.refiClosingCosts : 0);
        const newR = (this.refiNewRate / 100) / MONTHS_IN_YEAR;
        const newN = this.refiNewTermYears * MONTHS_IN_YEAR;

        const curM = this.calculateEmi(curP, curR, curN);
        const newM = this.calculateEmi(newP, newR, newN);
        const delta = curM - newM;

        const curTotalInterest = curM * curN - curP;
        const newTotalInterest = newM * newN - newP;
        const interestDelta = newTotalInterest - curTotalInterest; // could be positive or negative

        const costs = Number.isFinite(this.refiClosingCosts) ? this.refiClosingCosts : 0;
        const breakevenMonths = delta > 0 ? (costs / delta) : null;

        return {
            curM, newM, delta,
            curTotalInterest, newTotalInterest, interestDelta,
            principalNew: newP,
            breakevenMonths
        };
    }

    get refiSummary() {
        const c = this.refiComputed;
        if (!c) return null;
        const fmt = (v) => this.formatCurrency(v);
        return {
            currentMonthly: fmt(c.curM),
            newMonthly: fmt(c.newM),
            monthlyChange: fmt(c.delta),
            currentInterest: fmt(c.curTotalInterest),
            newInterest: fmt(c.newTotalInterest),
            interestChange: fmt(c.interestDelta),
            principalNew: fmt(c.principalNew),
            breakeven: c.breakevenMonths != null ? `${Math.ceil(c.breakevenMonths)} months` : 'N/A'
        };
    }

    // Savings: derived progress percent (0..100)
    get goalProgress() {
        if (!Number.isFinite(this.targetDown) || this.targetDown <= 0) return 0;
        const pct = ((this.savingsCurrent || 0) / this.targetDown) * 100;
        return Math.max(0, Math.min(100, Math.round(pct)));
    }

    get goalReached() {
        return Number.isFinite(this.targetDown) && Number.isFinite(this.savingsCurrent) && this.savingsCurrent >= this.targetDown;
    }

    get timelineDisplay() {
        if (this.goalReached) {
            return 'Goal reached! You have met or exceeded your target amount.';
        }
        if (!Number.isFinite(this.monthsToGoal)) return null;
        const months = Math.max(0, Math.ceil(this.monthsToGoal));
        const years = Math.floor(months / 12);
        const rem = months % 12;
        return `${months} month${months === 1 ? '' : 's'} (${years} year${years === 1 ? '' : 's'} ${rem} month${rem === 1 ? '' : 's'})`;
    }

    // Savings handlers
    handleTargetChange(event) {
        const val = parseFloat(event.detail.value);
        this.targetDown = Number.isFinite(val) && val >= 0 ? val : null;
    }

    handleSavingsCurrentChange(event) {
        const val = parseFloat(event.detail.value);
        this.savingsCurrent = Number.isFinite(val) && val >= 0 ? val : null;
    }

    handleSavingsMonthlyChange(event) {
        const val = parseFloat(event.detail.value);
        this.savingsMonthly = Number.isFinite(val) && val >= 0 ? val : null;
    }

    calculateSavingsTimeline() {
        // Validate inputs
        if (!Number.isFinite(this.targetDown) || this.targetDown <= 0) {
            this.savingsMessage = 'Enter a valid savings goal greater than zero.';
            this.monthsToGoal = null;
            return;
        }
        if (!Number.isFinite(this.savingsCurrent) || this.savingsCurrent < 0) {
            this.savingsMessage = 'Enter your current savings (zero or more).';
            this.monthsToGoal = null;
            return;
        }
        if (this.goalReached) {
            this.savingsMessage = null;
            this.monthsToGoal = 0;
            return;
        }
        if (!Number.isFinite(this.savingsMonthly) || this.savingsMonthly <= 0) {
            this.savingsMessage = 'Enter a positive monthly savings amount to calculate a timeline.';
            this.monthsToGoal = null;
            return;
        }

        const remaining = Math.max(0, this.targetDown - this.savingsCurrent);
        this.monthsToGoal = remaining / this.savingsMonthly;
        this.savingsMessage = null;
    }

    resetSavings() {
        this.targetDown = null;
        this.savingsCurrent = null;
        this.savingsMonthly = null;
        this.monthsToGoal = null;
        this.savingsMessage = null;
    }

    /**
     * Calculates the monthly mortgage payment when the user clicks Calculate.
     */
    calculatePayment(event) {
        const scenario = event?.target?.dataset?.scenario === 'B' ? 'B' : 'A';
        if (!this.isInputValid(scenario)) {
            if (scenario === 'B') this.monthlyPaymentB = null; else this.monthlyPayment = null;
            return;
        }
        const price = scenario === 'B' ? this.priceB : this.price;
        const interestRate = scenario === 'B' ? this.interestRateB : this.interestRate;
        const tenure = scenario === 'B' ? this.tenureB : this.tenure;

        const loanAmount = price;
        const monthlyRate = (interestRate / 100) / MONTHS_IN_YEAR;
        const totalPayments = tenure * MONTHS_IN_YEAR;

        const emi = this.calculateEmi(loanAmount, monthlyRate, totalPayments);
        if (scenario === 'B') {
            this.monthlyPaymentB = emi;
            this.validationMessageB = null;
            this.scheduleB = this.buildAmortizationSchedule(loanAmount, monthlyRate, totalPayments, emi);
        } else {
            this.monthlyPayment = emi;
            this.validationMessage = null;
            this.schedule = this.buildAmortizationSchedule(loanAmount, monthlyRate, totalPayments, emi);
        }
        // eslint-disable-next-line no-console
        console.log(`[MortgageCalculator] Payment calculated for ${scenario}`);
    }

    /**
     * Calculates the monthly repayment using the standard EMI formula:
     * EMI = [P × R × (1 + R)^N] / [(1 + R)^N – 1]
     * Where P = principal, R = monthly interest rate, N = total number of payments.
     */
    /**
     * EMI = [P × R × (1 + R)^N] / [(1 + R)^N – 1]
     * @param {number} principal - Total loan amount.
     * @param {number} monthlyRate - Interest rate per month.
     * @param {number} totalPayments - Total number of monthly payments.
     * @returns {number} EMI payment.
     */
    calculateEmi(principal, monthlyRate, totalPayments) {
        if (monthlyRate === 0) {
            return principal / totalPayments;
        }

        const growthFactor = Math.pow(1 + monthlyRate, totalPayments);
        return (principal * monthlyRate * growthFactor) / (growthFactor - 1);
    }

    /**
     * Builds an amortization schedule aggregated by year.
     * @param {number} principal
     * @param {number} monthlyRate
     * @param {number} totalPayments
     * @param {number} emi
     * @returns {Array<{year:number, principal:number, interest:number, balance:number}>}
     */
    buildAmortizationSchedule(principal, monthlyRate, totalPayments, emi) {
        const schedule = [];
        let balance = principal;
        let yearPrincipal = 0;
        let yearInterest = 0;
        let year = 1;
        for (let m = 1; m <= totalPayments; m++) {
            const interestPaid = monthlyRate === 0 ? 0 : balance * monthlyRate;
            let principalPaid = emi - interestPaid;
            if (principalPaid > balance) principalPaid = balance; // guard for final month rounding
            balance -= principalPaid;
            yearPrincipal += principalPaid;
            yearInterest += interestPaid;
            if (m % 12 === 0 || m === totalPayments) {
                schedule.push({
                    year,
                    principal: Math.max(0, yearPrincipal),
                    interest: Math.max(0, yearInterest),
                    balance: Math.max(0, balance)
                });
                year++;
                yearPrincipal = 0;
                yearInterest = 0;
            }
            if (balance <= 0) {
                // Exhausted early due to zero rate case
                while (m % 12 !== 0) {
                    // Fill remaining months in year with zeros to close out the year row
                    m++;
                    if (m % 12 === 0) {
                        schedule.push({ year, principal: yearPrincipal, interest: yearInterest, balance: 0 });
                        year++;
                        yearPrincipal = 0;
                        yearInterest = 0;
                    }
                }
                break;
            }
        }
        return schedule;
    }

    /**
     * Formats the EMI amount based on the detected locale.
     * @param {number} amount - EMI value.
     * @returns {string} Localized currency string.
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: this.currencyCode
        }).format(amount);
    }

    /**
     * Determines the appropriate currency code for formatting the EMI.
     * @returns {string} Currency code, e.g., USD or INR.
     */
    detectCurrencyCode() {
        const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
        const currencyMap = {
            'en-IN': 'INR',
            'hi-IN': 'INR',
            'bn-IN': 'INR',
            'en-US': 'USD'
        };

        if (currencyMap[locale]) {
            return currencyMap[locale];
        }

        if (locale && locale.endsWith('-IN')) {
            return 'INR';
        }

        return 'USD';
    }

    // Currency selection UI support
    get currencyOptions() {
        return [
            { label: 'US Dollar (USD)', value: 'USD' },
            { label: 'Euro (EUR)', value: 'EUR' },
            { label: 'British Pound (GBP)', value: 'GBP' },
            { label: 'Indian Rupee (INR)', value: 'INR' },
            { label: 'Japanese Yen (JPY)', value: 'JPY' },
            { label: 'Australian Dollar (AUD)', value: 'AUD' },
            { label: 'Canadian Dollar (CAD)', value: 'CAD' }
        ];
    }

    handleCurrencyChange(event) {
        this.selectedCurrency = event.detail.value;
        // Placeholder: Integrate with exchange-rate API to convert entered values
        // TODO: fetch and cache FX rates (Apex or platform events) then apply conversions as needed
        // this.refreshExchangeRates(this.selectedCurrency);
    }

    // Placeholder for exchange-rate API call (no network in this environment)
    refreshExchangeRates(currencyCode) {
        // Intentionally left as a stub. In production, call an Apex method that integrates
        // with a reliable FX service and stores rates in a custom object or platform cache.
        // Example signature:
        // return getFxRates({ base: currencyCode }).then(rates => { this.fxRates = rates; });
        return Promise.resolve();
    }

    /**
     * Clears all calculator inputs and the calculated result.
     */
    resetCalculator(event) {
        const scenario = event?.target?.dataset?.scenario;
        const resetA = () => {
            this.price = null;
            this.interestRate = null;
            this.tenure = null;
            this.monthlyPayment = null;
            this.validationMessage = null;
            this.schedule = [];
        };
        const resetB = () => {
            this.priceB = null;
            this.interestRateB = null;
            this.tenureB = null;
            this.monthlyPaymentB = null;
            this.validationMessageB = null;
            this.scheduleB = [];
        };
        if (scenario === 'B') {
            resetB();
        } else if (scenario === 'A') {
            resetA();
        } else {
            // No scenario specified -> reset both
            resetA();
            resetB();
        }
        // eslint-disable-next-line no-console
        console.log(`[MortgageCalculator] Calculator reset ${scenario || 'A+B'}`);
    }

    /**
     * Validates calculator inputs before calculating EMI.
     * @returns {boolean} true when inputs are valid.
     */
    isInputValid(scenario = 'A') {
        const price = scenario === 'B' ? this.priceB : this.price;
        const rate = scenario === 'B' ? this.interestRateB : this.interestRate;
        const tenure = scenario === 'B' ? this.tenureB : this.tenure;
        const setMessage = (msg) => {
            if (scenario === 'B') this.validationMessageB = msg; else this.validationMessage = msg;
        };

        if (!Number.isFinite(price) || price <= 0) {
            setMessage('Enter a valid property price greater than zero.');
            return false;
        }
        if (!Number.isFinite(rate) || rate < 0) {
            setMessage('Enter a valid annual interest rate (zero or positive).');
            return false;
        }
        if (!Number.isFinite(tenure) || tenure <= 0) {
            setMessage('Enter a valid loan tenure in years (greater than zero).');
            return false;
        }
        setMessage(null);
        return true;
    }
}
