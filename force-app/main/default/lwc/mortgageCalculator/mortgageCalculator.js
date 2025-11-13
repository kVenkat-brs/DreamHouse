import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getRates from '@salesforce/apex/CurrencyService.getRates';

const MONTHS_IN_YEAR = 12;

export default class MortgageCalculator extends LightningElement {
    activeSectionName = 'step1';
    activeSectionNameB = 'step1';
    theme = 'standard'; // standard | dark | pro
    comparisonMode = false;
    affordabilityMode = false;
    investmentMode = false;
    // Currency selection
    selectedCurrency = null; // ISO code, e.g., USD, EUR
    @track fxRates = null; // map of code->rate relative to selectedCurrency
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
    @track preApprovalDecision = null; // 'approved' | 'conditional' | 'declined'
    @track preApprovalReasons = []; // strings describing decision rationale

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
        host.classList.remove('theme-dark', 'theme-pro', 'theme-high-contrast');
        if (this.theme === 'dark') {
            host.classList.add('theme-dark');
        } else if (this.theme === 'pro') {
            host.classList.add('theme-pro');
        }
    }

    toggleHighContrast(event) {
        const on = !!event.detail.checked;
        const host = this.template.host;
        if (on) {
            host.classList.add('theme-high-contrast');
        } else {
            host.classList.remove('theme-high-contrast');
        }
    }

    // Mobile bottom nav focus helpers
    focusInputs() {
        const el = this.template.querySelector('lightning-accordion');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    focusResults() {
        const el = this.template.querySelector('h2.slds-text-title_caps');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    focusPlans() {
        const el = this.template.querySelector('#scenario-planner-heading');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    // Credit score slider → dynamic band mapping and impact analysis
    creditScoreValue = 720; // default

    get creditScoreBand() {
        return this.bandFromScore(this.creditScoreValue);
    }

    bandFromScore(score) {
        if (score >= 800) return 'excellent';
        if (score >= 740) return 'verygood';
        if (score >= 670) return 'good';
        if (score >= 580) return 'fair';
        return 'poor';
    }

    rateAdjustmentForBand(band) {
        const adj = {
            excellent: -0.5,
            verygood: -0.25,
            good: 0,
            fair: 0.5,
            poor: 1.0
        };
        return adj[band] ?? 0;
    }

    rateForBand(band) {
        const base = this.getDefaultRateForLoanType(this.loanType);
        const adjusted = base + this.rateAdjustmentForBand(band);
        return Math.max(0, Math.round(adjusted * 100) / 100);
    }

    handleCreditSliderChange(event) {
        const val = parseInt(event.detail.value, 10);
        if (!Number.isFinite(val)) return;
        this.creditScoreValue = val;
        // Dynamically set current scenario interest rate based on band
        this.interestRate = this.rateForBand(this.creditScoreBand);
    }

    get creditImpactColumns() {
        const code = this.currencyCode;
        return [
            { label: 'Band', fieldName: 'band' },
            { label: 'Rate (%)', fieldName: 'rate', type: 'number', typeAttributes: { minimumIntegerDigits: 1, maximumFractionDigits: 2 } },
            { label: 'Monthly', fieldName: 'monthly', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Total Interest', fieldName: 'interest', type: 'currency', typeAttributes: { currencyCode: code } }
        ];
    }

    get creditImpactRows() {
        // Need price and tenure for meaningful comparison
        if (!Number.isFinite(this.price) || !Number.isFinite(this.tenure) || this.tenure <= 0) {
            return [];
        }
        const bands = ['excellent', 'verygood', 'good', 'fair', 'poor'];
        const rows = [];
        const totalPayments = this.tenure * MONTHS_IN_YEAR;
        for (const band of bands) {
            const rate = this.rateForBand(band);
            const monthlyRate = (rate / 100) / MONTHS_IN_YEAR;
            const m = this.calculateEmi(this.price, monthlyRate, totalPayments);
            const totalPaid = m * totalPayments;
            const totalInterest = totalPaid - this.price;
            rows.push({
                id: band,
                band,
                rate,
                monthly: m,
                interest: totalInterest
            });
        }
        return rows.sort((a, b) => (b._score - a._score));
    }

    // =========================
    // Lender comparison (rates/APR/fees + recommendation)
    // =========================
    lendersCatalog = [
        { id: 'acme', name: 'Acme Bank', rateAdj: 0.0,  aprAdj: 0.10, baseFee: 1500, points: 0.50, specialties: ['fixed30', 'fixed15'] },
        { id: 'homefirst', name: 'HomeFirst Mortgage', rateAdj: -0.05, aprAdj: 0.05, baseFee:  995, points: 0.25, specialties: ['fha', 'va'] },
        { id: 'citywide', name: 'Citywide Credit Union', rateAdj: -0.10, aprAdj: 0.00, baseFee:  700, points: 0.00, specialties: ['fixed30', 'arm5_1'] },
        { id: 'neighborhood', name: 'Neighborhood Lenders', rateAdj: 0.05,  aprAdj: 0.12, baseFee: 1200, points: 0.75, specialties: ['arm5_1', 'fixed15'] }
    ];

    get lenderComparisonColumns() {
        const code = this.currencyCode;
        return [
            { label: 'Lender', fieldName: 'lender' },
            { label: 'Rate (%)', fieldName: 'rate', type: 'number', typeAttributes: { minimumIntegerDigits: 1, maximumFractionDigits: 2 } },
            { label: 'APR (%)', fieldName: 'apr', type: 'number', typeAttributes: { minimumIntegerDigits: 1, maximumFractionDigits: 2 } },
            { label: 'Points (%)', fieldName: 'points', type: 'number', typeAttributes: { minimumIntegerDigits: 1, maximumFractionDigits: 2 } },
            { label: 'Fees', fieldName: 'fees', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Monthly', fieldName: 'monthly', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Total Cost 3y', fieldName: 'total3y', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Total Cost 5y', fieldName: 'total5y', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Total Cost 10y', fieldName: 'total10y', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Recommendation', fieldName: 'recommendation' }
        ];
    }

    get lenderComparisonRows() {
        if (!this.lendersCatalog || !this.lendersCatalog.length) return [];
        const baseRate = this.getDefaultRateForLoanType(this.loanType);
        const band = this.creditScoreBand || 'good';
        const bandAdj = this.rateAdjustmentForBand(band);
        const price = Number.isFinite(this.price) ? this.price : null;
        const tenure = Number.isFinite(this.tenure) && this.tenure > 0 ? this.tenure : null;
        const totalPayments = tenure ? tenure * MONTHS_IN_YEAR : null;

        const start = new Date();
        const rows = this.lendersCatalog.map((l) => {
            const rate = Math.max(0, Math.round((baseRate + bandAdj + l.rateAdj) * 100) / 100);
            const apr = Math.max(0, Math.round((rate + l.aprAdj) * 100) / 100);
            let monthly = null;
            let total3y = null, total5y = null, total10y = null;
            const pointsCost = price ? (price * ((l.points || 0) / 100)) : 0;
            if (price && totalPayments) {
                const monthlyRate = (rate / 100) / MONTHS_IN_YEAR;
                monthly = this.calculateEmi(price, monthlyRate, totalPayments);
                // Build baseline monthly schedule once and sum interest to horizons
                const sched = this.buildMonthlySchedule(price, monthlyRate, totalPayments, monthly, start, { amount: 0, start: null, frequency: 'none', months: null });
                const sumInterest = (m) => {
                    const limit = Math.min(m, sched.schedule.length);
                    let sum = 0;
                    for (let i = 0; i < limit; i++) sum += (sched.schedule[i].interest || 0);
                    return sum;
                };
                const fees = l.baseFee || 0;
                total3y = sumInterest(36) + fees + pointsCost;
                total5y = sumInterest(60) + fees + pointsCost;
                total10y = sumInterest(120) + fees + pointsCost;
            }
            // Simple recommendation reasons
            const aligns = l.specialties?.includes(this.loanType);
            const rec = aligns ? 'Specializes in your loan type' : (l.baseFee <= 800 ? 'Low fees' : (rate <= baseRate + bandAdj ? 'Competitive rate' : 'Standard offer'));
            return {
                id: l.id,
                lender: l.name,
                rate,
                apr,
                points: l.points || 0,
                fees: l.baseFee,
                monthly,
                total3y,
                total5y,
                total10y,
                recommendation: rec,
                _score: (monthly ? -monthly : 0) - (l.baseFee / 500) + (aligns ? 1 : 0) - ((l.points || 0) / 2) // internal score for ranking
            };
        });

        // Mark top pick
        const sorted = [...rows].sort((a, b) => b._score - a._score);
        if (sorted.length) {
            const topId = sorted[0].id;
            rows.forEach((r) => {
                if (r.id === topId) {
                    r.recommendation = (r.recommendation ? r.recommendation + ' — ' : '') + 'Top pick for your profile';
                }
                delete r._score;
            });
        }
        return rows;
    }

    // =========================
    // Credit Score Simulation (hard inquiry + new mortgage + payment history)
    // =========================
    @track simStartScore = 720;
    @track simMonths = 60;
    @track simHardInquiries = 1;
    @track simOnTimePct = 100; // 0-100
    @track creditSimRows = [];
    @track creditSimSummary = null;

    handleCreditSimFieldChange(event) {
        const { name, value } = event.target;
        const n = parseFloat(value);
        if (['simStartScore','simMonths','simHardInquiries','simOnTimePct'].includes(name)) {
            this[name] = Number.isFinite(n) ? n : this[name];
        }
    }

    runCreditSimulation() {
        const startScore = Number.isFinite(this.simStartScore) ? this.simStartScore : 720;
        const months = Math.min(360, Math.max(1, Number.isFinite(this.simMonths) ? Math.floor(this.simMonths) : 60));
        const inquiries = Math.max(0, Number.isFinite(this.simHardInquiries) ? Math.floor(this.simHardInquiries) : 0);
        const onTime = Math.min(100, Math.max(0, Number.isFinite(this.simOnTimePct) ? this.simOnTimePct : 100));

        let score = startScore;
        const rows = [];
        const startDate = new Date();

        // Immediate effects
        // Hard inquiries: ~5 points each, recovers linearly over 12 months
        const inquiryHit = -5 * inquiries;
        // New mortgage account (credit mix + new account age): ~-10 first 3 months
        const newAcctInitialHit = -10;
        // High balance large mortgage slight initial impact
        const loanAmt = Number.isFinite(this.loanAmount) ? this.loanAmount : (Number.isFinite(this.price) ? this.price : 0);
        const largeLoanHit = loanAmt > 500000 ? -5 : 0;

        // Payment history monthly expected delta: base +0.5 per on-time month, expected penalty for late fraction
        const monthlyOnTimeBoost = 0.5 * (onTime / 100);
        const monthlyLatePenalty = -2.0 * ((100 - onTime) / 100);
        const monthlyHistoryDelta = monthlyOnTimeBoost + monthlyLatePenalty; // can be negative

        // Rate-related effect: lower rate improves affordability slightly (tiny positive), higher rate negative
        const rate = Number.isFinite(this.interestRate) ? this.interestRate : this.getDefaultRateForLoanType(this.loanType);
        const rateAdj = Math.max(-0.3, Math.min(0.3, (7 - rate) * 0.05));

        // Apply immediate hits at month 1
        for (let m = 1; m <= months; m++) {
            let delta = 0;
            let noteParts = [];
            if (m === 1) {
                delta += inquiryHit + newAcctInitialHit + largeLoanHit;
                if (inquiryHit) noteParts.push(`Inquiry impact ${inquiryHit}`);
                if (newAcctInitialHit) noteParts.push('New mortgage opened');
                if (largeLoanHit) noteParts.push('Large loan balance');
            }
            // Recover inquiries over 12 months
            if (inquiryHit !== 0 && m <= 12) {
                delta += (-inquiryHit) / 12; // gradual recovery
            }
            // New account impact fades over first 3 months (offset half back over 3 months)
            if (m <= 3 && newAcctInitialHit) {
                delta += (-newAcctInitialHit) / 6; // slow recovery
            }
            // Payment history expected effect
            delta += monthlyHistoryDelta;
            // Rate affordability small adjustment each month
            delta += rateAdj / 12;

            score = Math.max(300, Math.min(850, score + delta));

            const d = new Date(startDate.getTime());
            d.setMonth(d.getMonth() + m - 1);
            rows.push({ id: m, month: m, date: d, score: Math.round(score), note: noteParts.join('; ') });
        }

        this.creditSimRows = rows;
        const endScore = rows.length ? rows[rows.length - 1].score : startScore;
        this.creditSimSummary = { start: startScore, end: endScore, change: endScore - startScore };
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
     * Automated Pre‑Approval engine
     * - Inputs: incomeAnnual, monthlyDebt, creditScoreRange, assets (down payment/reserves via affDownPayment or investDownPayment)
     * - Rules: Baseline front/back DTI caps, score‑based adjustments, minimum credit band, reserves requirement
     * - Output: preApprovalAmount (max principal), decision (approved|conditional|declined), reasons list
     */
    calculatePreApproval() {
        // Validate inputs
        if (!Number.isFinite(this.incomeAnnual) || this.incomeAnnual <= 0) {
            this.preApprovalMessage = 'Enter a valid annual income greater than zero.';
            this.preApprovalAmount = null;
            this.preApprovalDecision = null;
            this.preApprovalReasons = [];
            return;
        }
        if (!Number.isFinite(this.monthlyDebt) || this.monthlyDebt < 0) {
            this.preApprovalMessage = 'Enter your total monthly debt payments (zero or more).';
            this.preApprovalAmount = null;
            this.preApprovalDecision = null;
            this.preApprovalReasons = [];
            return;
        }
        if (!this.creditScoreRange) {
            this.preApprovalMessage = 'Select your credit score range to refine the estimate.';
            this.preApprovalAmount = null;
            this.preApprovalDecision = null;
            this.preApprovalReasons = [];
            return;
        }

        const monthlyIncome = this.incomeAnnual / MONTHS_IN_YEAR;
        // Determine max housing payment by DTI rules (score‑adjusted)
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

        // Assets / Reserves (use the greater of affDownPayment or investDownPayment if present)
        const downPayment = Number.isFinite(this.affDownPayment) ? this.affDownPayment : (Number.isFinite(this.investDownPayment) ? this.investDownPayment : 0);
        const reservesMonthly = Math.max(0, targetPayment + (Number.isFinite(this.monthlyDebt) ? this.monthlyDebt : 0));
        const requiredReservesMonths = this.creditScoreRange === 'poor' ? 6 : this.creditScoreRange === 'fair' ? 3 : 2; // simple heuristic
        const requiredReserves = reservesMonthly * requiredReservesMonths;
        const liquidAssets = downPayment; // treat provided down payment as proof of liquid assets for this heuristic

        // Decision logic
        const reasons = [];
        let decision = 'approved';
        // Minimum credit band
        if (this.creditScoreRange === 'poor') {
            decision = 'conditional';
            reasons.push('Credit score in Poor band; additional documentation or higher down payment may be required.');
        }
        // DTI checks against unadjusted baselines
        const frontDTI = Math.round(((targetPayment) / monthlyIncome) * 1000) / 10;
        const backDTI = Math.round(((targetPayment + this.monthlyDebt) / monthlyIncome) * 1000) / 10;
        if (frontDTI > 31) {
            decision = decision === 'approved' ? 'conditional' : decision;
            reasons.push(`Front‑end DTI ${frontDTI}% exceeds 31% threshold.`);
        }
        if (backDTI > 43) {
            decision = 'declined';
            reasons.push(`Back‑end DTI ${backDTI}% exceeds 43% maximum.`);
        }
        // Employment seasoning (if provided)
        if (Number.isFinite(this.employmentYears) && this.employmentYears < 2) {
            decision = decision === 'approved' ? 'conditional' : decision;
            reasons.push('Less than 2 years employment history.');
        }
        // Reserves sufficiency
        if (liquidAssets < requiredReserves) {
            decision = decision === 'approved' ? 'conditional' : decision;
            reasons.push(`Insufficient reserves: need approx ${this.formatCurrency(requiredReserves)} in liquid assets.`);
        }

        this.preApprovalAmount = Math.max(0, principal);
        this.preApprovalDecision = decision;
        this.preApprovalReasons = reasons;
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

    get formattedPreApproval() {
        if (!Number.isFinite(this.preApprovalAmount)) return null;
        return this.formatCurrency(this.preApprovalAmount);
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
    get estimatedMonthlyTaxValueA() {
        const rate = this.propertyTaxRate;
        const price = this.price;
        if (!Number.isFinite(rate) || !Number.isFinite(price)) return 0;
        const factor = this.propertyType === 'multi' ? 1.05 : this.propertyType === 'condo' ? 0.95 : this.propertyType === 'townhouse' ? 0.98 : 1.0;
        return (price * (rate / 100) * factor) / 12;
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
    // Investment Property Mode (ROI, Cap Rate, Cash Flow)
    // =========================
    @track investRentalMonthly = null;
    @track investVacancyPct = null; // %
    @track investMgmtPct = null; // % of effective rent
    @track investMaintPct = null; // % of effective rent
    @track investDownPayment = null; // amount
    @track investSummary = null;
    @track investMessage = null;

    handleInvestmentToggle(event) {
        this.investmentMode = !!event.detail.checked;
    }

    handleInvestFieldChange(event) {
        const name = event.target.name;
        const v = parseFloat(event.detail.value);
        const parsed = Number.isFinite(v) && v >= 0 ? v : null;
        switch (name) {
            case 'investRentalMonthly': this.investRentalMonthly = parsed; break;
            case 'investVacancyPct': this.investVacancyPct = parsed; break;
            case 'investMgmtPct': this.investMgmtPct = parsed; break;
            case 'investMaintPct': this.investMaintPct = parsed; break;
            case 'investDownPayment': this.investDownPayment = parsed; break;
            default: break;
        }
    }

    calculateInvestmentRoi() {
        // Validate essentials
        if (!Number.isFinite(this.price) || this.price <= 0) {
            this.investMessage = 'Enter a valid property price to analyze investment returns.';
            this.investSummary = null;
            return;
        }
        if (!Number.isFinite(this.investRentalMonthly) || this.investRentalMonthly < 0) {
            this.investMessage = 'Enter expected monthly rental income (zero or more).';
            this.investSummary = null;
            return;
        }
        const rent = this.investRentalMonthly;
        const vac = Number.isFinite(this.investVacancyPct) ? this.investVacancyPct / 100 : 0;
        const mgmt = Number.isFinite(this.investMgmtPct) ? this.investMgmtPct / 100 : 0;
        const maint = Number.isFinite(this.investMaintPct) ? this.investMaintPct / 100 : 0;
        const hoa = Number.isFinite(this.hoaMonthly) ? this.hoaMonthly : 0;
        const tax = Number.isFinite(this.estimatedMonthlyTaxValueA) ? this.estimatedMonthlyTaxValueA : 0;

        const effective = rent * (1 - vac);
        const mgmtExp = effective * mgmt;
        const maintExp = effective * maint;
        const noiMonthly = effective - mgmtExp - maintExp - hoa - tax;
        const noiAnnual = noiMonthly * 12;

        // Financing
        const annualRate = Number.isFinite(this.interestRate) ? this.interestRate : this.getDefaultRateForLoanType(this.loanType);
        const years = Number.isFinite(this.tenure) && this.tenure > 0 ? this.tenure : 30;
        const monthlyRate = (annualRate / 100) / MONTHS_IN_YEAR;
        const totalPayments = years * MONTHS_IN_YEAR;
        const down = Number.isFinite(this.investDownPayment) ? this.investDownPayment : 0;
        const principal = Math.max(0, (this.price || 0) - down);
        const debtServiceMonthly = principal > 0 ? this.calculateEmi(principal, monthlyRate, totalPayments) : 0;

        const cashFlowMonthly = noiMonthly - debtServiceMonthly;
        const capRatePct = this.price > 0 ? (noiAnnual / this.price) * 100 : null;
        const cocPct = down > 0 ? ((cashFlowMonthly * 12) / down) * 100 : null;

        this.investSummary = {
            effective,
            noiMonthly,
            cashFlowMonthly,
            capRatePct: capRatePct != null ? Math.round(capRatePct * 10) / 10 : null,
            cocPct: cocPct != null ? Math.round(cocPct * 10) / 10 : null,
            debtServiceMonthly,
            taxMonthly: tax,
            hoaMonthly: hoa
        };
        this.investMessage = null;
    }

    resetInvestment() {
        this.investRentalMonthly = null;
        this.investVacancyPct = null;
        this.investMgmtPct = null;
        this.investMaintPct = null;
        this.investDownPayment = null;
        this.investSummary = null;
        this.investMessage = null;
    }

    // =========================
    // What‑If Scenario Planner (Best/Worst/Expected)
    // =========================
    @track scenarioDraft = { name: 'expected', price: null, rate: null, tenure: null };
    @track scenarios = [];

    get scenarioNameOptions() {
        return [
            { label: 'Best Case', value: 'best' },
            { label: 'Expected', value: 'expected' },
            { label: 'Worst Case', value: 'worst' }
        ];
    }

    handleScenarioFieldChange(event) {
        const name = event.target.name;
        const v = event.detail.value;
        if (name === 'scenarioName') {
            this.scenarioDraft = { ...this.scenarioDraft, name: v };
            return;
        }
        const num = parseFloat(v);
        const parsed = Number.isFinite(num) && num >= 0 ? num : null;
        if (name === 'scenarioPrice') this.scenarioDraft = { ...this.scenarioDraft, price: parsed };
        if (name === 'scenarioRate') this.scenarioDraft = { ...this.scenarioDraft, rate: parsed };
        if (name === 'scenarioTenure') this.scenarioDraft = { ...this.scenarioDraft, tenure: parsed };
    }

    resetScenarioDraft() {
        this.scenarioDraft = { name: 'expected', price: null, rate: null, tenure: null };
    }

    saveScenario() {
        const d = this.scenarioDraft || {};
        if (!d.name) { d.name = 'expected'; }
        if (!Number.isFinite(d.price) || d.price <= 0 || !Number.isFinite(d.rate) || d.rate < 0 || !Number.isFinite(d.tenure) || d.tenure <= 0) {
            // eslint-disable-next-line no-console
            console.warn('[MortgageCalculator] Invalid scenario draft, missing price/rate/tenure');
            return;
        }
        const monthlyRate = (d.rate / 100) / MONTHS_IN_YEAR;
        const totalPayments = d.tenure * MONTHS_IN_YEAR;
        const monthly = this.calculateEmi(d.price, monthlyRate, totalPayments);
        const totalPaid = monthly * totalPayments;
        const totalInterest = totalPaid - d.price;
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const scenario = {
            id,
            name: d.name,
            price: d.price,
            rate: d.rate,
            tenure: d.tenure,
            monthly,
            totalPaid,
            totalInterest,
            compare: false
        };
        this.scenarios = [...this.scenarios, scenario];
        this.resetScenarioDraft();
    }

    toggleCompareScenario(event) {
        const id = event?.currentTarget?.dataset?.id;
        if (!id) return;
        this.scenarios = this.scenarios.map((s) => (s.id === id ? { ...s, compare: !s.compare } : s));
    }

    deleteScenario(event) {
        const id = event?.currentTarget?.dataset?.id;
        if (!id) return;
        this.scenarios = this.scenarios.filter((s) => s.id !== id);
    }

    clearScenarios() {
        this.scenarios = [];
    }

    get compareScenarios() {
        const sel = this.scenarios.filter((s) => s.compare);
        return sel.length ? sel.slice(0, 3) : this.scenarios.slice(0, 3);
    }

    // =========================
    // Tax Implications (interest + property tax deductions)
    // =========================
    @track taxBracketPct = null; // user's marginal tax bracket %
    @track filingStatus = 'single'; // single | married_joint | married_separate | head_household
    @track otherSaltAnnual = null; // other state+local taxes besides property tax
    @track loanStartYear = null; // loan origination year to determine MI cap (pre-2018 vs post)

    handleTaxBracketChange(event) {
        const v = parseFloat(event.detail.value);
        this.taxBracketPct = Number.isFinite(v) && v >= 0 ? v : null;
    }

    handleFilingStatusChange(event) {
        this.filingStatus = event.detail.value;
    }

    handleOtherSaltChange(event) {
        const v = parseFloat(event.detail.value);
        this.otherSaltAnnual = Number.isFinite(v) && v >= 0 ? v : null;
    }

    handleLoanStartYearChange(event) {
        const v = parseInt(event.detail.value, 10);
        this.loanStartYear = Number.isFinite(v) && v > 1900 ? v : null;
    }

    get filingStatusOptions() {
        return [
            { label: 'Single', value: 'single' },
            { label: 'Married Filing Jointly', value: 'married_joint' },
            { label: 'Married Filing Separately', value: 'married_separate' },
            { label: 'Head of Household', value: 'head_household' }
        ];
    }

    get taxImplicationSummary() {
        if (!Number.isFinite(this.price) || !Number.isFinite(this.tenure) || !Number.isFinite(this.interestRate)) {
            return null;
        }
        const monthlyRate = (this.interestRate / 100) / MONTHS_IN_YEAR;
        const totalPayments = this.tenure * MONTHS_IN_YEAR;
        const emi = this.calculateEmi(this.price, monthlyRate, totalPayments);
        // Use yearly schedule to estimate first-year mortgage interest deduction
        const yearly = this.buildAmortizationSchedule(this.price, monthlyRate, totalPayments, emi);
        const firstYear = yearly && yearly.schedule && yearly.schedule.length ? yearly.schedule[0] : null;
        const annualMortgageInterest = firstYear ? firstYear.interest : 0;
        // Property tax: use monthly estimate * 12 if available
        const monthlyTax = Number.isFinite(this.estimatedMonthlyTaxValueA) ? this.estimatedMonthlyTaxValueA : 0;
        const annualPropertyTax = monthlyTax * 12;

        // Mortgage interest deduction cap logic
        const year = this.loanStartYear || new Date().getFullYear();
        const cap = (year <= 2017) ? 1000000 : 750000; // USD limits under current law
        const loanPrincipal = this.price; // if down payment tracked, substitute price*(1 - downPct)
        const capRatio = loanPrincipal > 0 ? Math.min(1, cap / loanPrincipal) : 1;
        const deductibleInterest = annualMortgageInterest * capRatio;

        // SALT cap for property taxes
        let saltCap = 10000;
        if (this.filingStatus === 'married_separate') saltCap = 5000;
        // If other state/local taxes are provided, reduce remaining SALT capacity
        const otherSalt = Number.isFinite(this.otherSaltAnnual) ? this.otherSaltAnnual : 0;
        const remainingSalt = Math.max(0, saltCap - otherSalt);
        const deductiblePropertyTax = Math.min(annualPropertyTax, remainingSalt);

        const bracket = Number.isFinite(this.taxBracketPct) ? this.taxBracketPct / 100 : null;
        const totalDeductible = deductibleInterest + deductiblePropertyTax;
        const estSavings = bracket != null ? totalDeductible * bracket : null;
        return {
            annualMortgageInterest,
            deductibleInterest,
            annualPropertyTax,
            deductiblePropertyTax,
            totalDeductible,
            estSavings,
            saltCap,
            otherSalt,
            loanCapApplied: cap,
            capRatio
        };
    }

    // =========================
    // Payment Calendar (monthly schedule + extra payment planner)
    // =========================
    @track calendarStartDate = null; // YYYY-MM-DD
    @track extraAmount = null; // currency amount applied as extra to principal
    @track extraStartMonth = null; // first payment index (1-based)
    @track extraFrequency = 'none'; // none | one | monthly
    @track extraMonths = null; // number of months to apply (for monthly frequency); null = until payoff
    @track monthlySchedule = [];
    @track calendarSummary = null;
    @track calendarMessage = null;

    get calendarColumns() {
        const code = this.currencyCode;
        return [
            { label: '#', fieldName: 'n', type: 'number', cellAttributes: { alignment: 'left' } },
            { label: 'Due Date', fieldName: 'dueDate', type: 'date', typeAttributes: { year: 'numeric', month: 'short', day: '2-digit' } },
            { label: 'Interest', fieldName: 'interest', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Principal', fieldName: 'principal', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Extra', fieldName: 'extra', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Balance', fieldName: 'balance', type: 'currency', typeAttributes: { currencyCode: code } }
        ];
    }

    handleCalendarFieldChange(event) {
        const name = event.target.name;
        const val = event.detail.value;
        if (name === 'calendarStartDate') {
            this.calendarStartDate = val;
            return;
        }
        if (name === 'extraFrequency') {
            this.extraFrequency = val;
            return;
        }
        const num = parseFloat(val);
        const parsed = Number.isFinite(num) && num >= 0 ? num : null;
        if (name === 'extraAmount') this.extraAmount = parsed;
        if (name === 'extraStartMonth') this.extraStartMonth = parsed;
        if (name === 'extraMonths') this.extraMonths = parsed;
    }

    resetCalendarPlanner() {
        this.calendarStartDate = null;
        this.extraAmount = null;
        this.extraStartMonth = null;
        this.extraFrequency = 'none';
        this.extraMonths = null;
        this.monthlySchedule = [];
        this.calendarSummary = null;
        this.calendarMessage = null;
    }

    generateCalendar() {
        // Validate base inputs
        if (!Number.isFinite(this.price) || !Number.isFinite(this.interestRate) || !Number.isFinite(this.tenure) || this.price <= 0 || this.tenure <= 0 || this.interestRate < 0) {
            this.calendarMessage = 'Enter valid price, rate, and tenure to generate a payment calendar.';
            this.monthlySchedule = [];
            this.calendarSummary = null;
            return;
        }
        const p = this.price;
        const r = (this.interestRate / 100) / MONTHS_IN_YEAR;
        const n = this.tenure * MONTHS_IN_YEAR;
        const emi = this.calculateEmi(p, r, n);

        const start = this.calendarStartDate ? new Date(this.calendarStartDate) : new Date();
        const extras = {
            amount: Number.isFinite(this.extraAmount) ? this.extraAmount : 0,
            start: Number.isFinite(this.extraStartMonth) ? Math.max(1, Math.floor(this.extraStartMonth)) : null,
            frequency: this.extraFrequency || 'none',
            months: Number.isFinite(this.extraMonths) ? Math.max(1, Math.floor(this.extraMonths)) : null
        };

        // Baseline (no extras)
        const base = this.buildMonthlySchedule(p, r, n, emi, start, { amount: 0, start: null, frequency: 'none', months: null });
        // With extras
        const withExtras = this.buildMonthlySchedule(p, r, n, emi, start, extras);

        this.monthlySchedule = withExtras.schedule;
        this.monthlyScheduleBaseline = base.schedule;
        const baselineInterest = base.totalInterest;
        const baselineMonths = base.payments;
        const newInterest = withExtras.totalInterest;
        const newMonths = withExtras.payments;
        const payoffDate = withExtras.lastDate;
        this.calendarSummary = {
            baselineMonths,
            newMonths,
            monthsSaved: baselineMonths - newMonths,
            baselineInterest: baselineInterest,
            newInterest: newInterest,
            interestSaved: baselineInterest - newInterest,
            payoffDate
        };
        this.calendarBaselineSummary = {
            payments: baselineMonths,
            totalInterest: baselineInterest,
            payoffDate: base.lastDate
        };
        // Interest savings quick scenarios
        const scenarios = [50, 100, 200, 500];
        const rows = [];
        scenarios.forEach((amt) => {
            const s = this.buildMonthlySchedule(p, r, n, emi, start, { amount: amt, start: 1, frequency: 'monthly', months: null });
            rows.push({ id: `extra_${amt}`, extra: amt, monthsSaved: baselineMonths - s.payments, interestSaved: baselineInterest - s.totalInterest });
        });
        this.interestSavingsRows = rows;
        this.calendarMessage = null;
    }

    /**
     * Builds a per-month amortization schedule with optional extra payment planner.
     * @returns {{schedule:Array, payments:number, totalInterest:number, lastDate: Date}}
     */
    buildMonthlySchedule(principal, monthlyRate, totalPayments, emi, startDate, extras) {
        const rows = [];
        let balance = principal;
        let totalInterest = 0;
        let paymentCount = 0;
        let current = new Date(startDate.getTime());
        for (let i = 1; i <= totalPayments && balance > 0; i++) {
            const interest = monthlyRate === 0 ? 0 : balance * monthlyRate;
            let principalPaid = emi - interest;
            if (principalPaid > balance) principalPaid = balance;
            let extra = 0;
            if (extras && extras.amount > 0) {
                const applyOne = extras.frequency === 'one' && extras.start === i;
                const applyMonthly = extras.frequency === 'monthly' && extras.start && i >= extras.start && (!extras.months || i < extras.start + extras.months);
                if (applyOne || applyMonthly) {
                    extra = Math.min(extras.amount, Math.max(0, balance - principalPaid));
                }
            }
            const totalPrincipal = principalPaid + extra;
            balance -= totalPrincipal;
            totalInterest += interest;
            paymentCount++;
            // push row
            rows.push({
                n: i,
                dueDate: new Date(current.getTime()),
                interest,
                principal: principalPaid,
                extra,
                balance: Math.max(0, balance)
            });
            // advance month
            current.setMonth(current.getMonth() + 1);
        }
        return { schedule: rows, payments: paymentCount, totalInterest, lastDate: rows.length ? rows[rows.length - 1].dueDate : startDate };
    }

    // =========================
    // Home Equity & HELOC
    // =========================
    @track equityHomeValue = null; // current market value
    @track equityMonthsElapsed = null; // months since loan start
    @track equityAppreciationPct = null; // annual % appreciation
    @track equityYearsProjection = null; // years to project
    @track helocMaxLtvPct = 80; // typical max CLTV
    @track helocDrawAmount = null; // desired draw amount
    @track helocRatePct = null; // annual interest-only rate for HELOC
    @track helocTermYears = 10; // amortization term for HELOC when amortizing
    @track helocAmortize = false; // amortize HELOC instead of interest-only

    handleEquityFieldChange(event) {
        const name = event.target.name;
        const v = parseFloat(event.detail.value);
        const parsed = Number.isFinite(v) && v >= 0 ? v : null;
        switch (name) {
            case 'equityHomeValue': this.equityHomeValue = parsed; break;
            case 'equityMonthsElapsed': this.equityMonthsElapsed = parsed; break;
            case 'equityAppreciationPct': this.equityAppreciationPct = parsed; break;
            case 'equityYearsProjection': this.equityYearsProjection = parsed; break;
            case 'helocMaxLtvPct': this.helocMaxLtvPct = parsed; break;
            case 'helocDrawAmount': this.helocDrawAmount = parsed; break;
            case 'helocRatePct': this.helocRatePct = parsed; break;
            case 'helocTermYears': this.helocTermYears = parsed; break;
            default: break;
        }
    }

    handleEquityToggle(event) {
        const name = event.target.name;
        const checked = !!event.detail.checked;
        if (name === 'helocAmortize') this.helocAmortize = checked;
    }

    loanBalanceAfter(principal, monthlyRate, totalPayments, k) {
        const kk = Math.max(0, Math.min(totalPayments, Math.floor(k || 0)));
        if (monthlyRate === 0) {
            return principal * ((totalPayments - kk) / totalPayments);
        }
        const g = Math.pow(1 + monthlyRate, totalPayments);
        const gk = Math.pow(1 + monthlyRate, kk);
        return principal * (g - gk) / (g - 1);
    }

    get equitySummary() {
        if (!Number.isFinite(this.price) || !Number.isFinite(this.tenure) || !Number.isFinite(this.interestRate) || !Number.isFinite(this.equityHomeValue)) {
            return null;
        }
        const monthlyRate = (this.interestRate / 100) / MONTHS_IN_YEAR;
        const totalPayments = this.tenure * MONTHS_IN_YEAR;
        const monthsPaid = Number.isFinite(this.equityMonthsElapsed) ? Math.max(0, Math.min(totalPayments, Math.floor(this.equityMonthsElapsed))) : 0;
        const balance = this.loanBalanceAfter(this.price, monthlyRate, totalPayments, monthsPaid);
        const equity = this.equityHomeValue - balance;
        const ltv = this.equityHomeValue > 0 ? (balance / this.equityHomeValue) * 100 : null;
        return { balance, equity, ltv };
    }

    get equityProjectionColumns() {
        const code = this.currencyCode;
        return [
            { label: 'Year', fieldName: 'year', type: 'number' },
            { label: 'Home Value', fieldName: 'value', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Loan Balance', fieldName: 'balance', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Equity', fieldName: 'equity', type: 'currency', typeAttributes: { currencyCode: code } }
        ];
    }

    get equityProjectionRows() {
        if (!Number.isFinite(this.price) || !Number.isFinite(this.tenure) || !Number.isFinite(this.interestRate) || !Number.isFinite(this.equityHomeValue) || !Number.isFinite(this.equityYearsProjection)) {
            return [];
        }
        const annualApp = Number.isFinite(this.equityAppreciationPct) ? this.equityAppreciationPct / 100 : 0;
        const monthlyRate = (this.interestRate / 100) / MONTHS_IN_YEAR;
        const totalPayments = this.tenure * MONTHS_IN_YEAR;
        const startMonths = Number.isFinite(this.equityMonthsElapsed) ? Math.max(0, Math.floor(this.equityMonthsElapsed)) : 0;
        const rows = [];
        for (let y = 1; y <= Math.max(0, Math.floor(this.equityYearsProjection)); y++) {
            const monthsFromStart = startMonths + y * 12;
            const bal = this.loanBalanceAfter(this.price, monthlyRate, totalPayments, monthsFromStart);
            const value = this.equityHomeValue * Math.pow(1 + annualApp, y);
            rows.push({ year: y, value, balance: bal, equity: value - bal });
        }
        return rows;
    }

    get helocSummary() {
        const eq = this.equitySummary;
        if (!eq || !Number.isFinite(this.helocMaxLtvPct)) return null;
        const maxLtv = this.helocMaxLtvPct / 100;
        const homeValue = this.equityHomeValue;
        const available = homeValue && eq.balance != null ? Math.max(0, homeValue * maxLtv - eq.balance) : null;
        const draw = Number.isFinite(this.helocDrawAmount) ? Math.min(this.helocDrawAmount, available || 0) : null;
        const monthlyRate = Number.isFinite(this.helocRatePct) ? (this.helocRatePct / 100) / MONTHS_IN_YEAR : null;
        const monthlyInt = monthlyRate != null && draw != null ? draw * monthlyRate : null;
        let amortPayment = null;
        if (this.helocAmortize && monthlyRate != null && draw != null && Number.isFinite(this.helocTermYears) && this.helocTermYears > 0) {
            const n = this.helocTermYears * MONTHS_IN_YEAR;
            amortPayment = monthlyRate === 0 ? (draw / n) : (draw * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
        }
        return { available, draw, monthlyInt, amortPayment };
    }

    // Combined LTV analysis (CLTV) scenarios
    get cltvRows() {
        const eq = this.equitySummary;
        if (!eq || !Number.isFinite(this.equityHomeValue)) return [];
        const hv = this.equityHomeValue;
        const baseBal = eq.balance || 0;
        const helocDraw = Number.isFinite(this.helocDrawAmount) ? this.helocDrawAmount : 0;
        const cashout = Number.isFinite(this.refiCashOut) ? this.refiCashOut : 0;
        const rows = [];
        const pct = (num) => hv > 0 ? (num / hv) * 100 : null;
        rows.push({ id: 'base', scenario: 'Base Mortgage', cltv: pct(baseBal) });
        if (helocDraw > 0) {
            rows.push({ id: 'heloc', scenario: 'With HELOC Draw', cltv: pct(baseBal + helocDraw) });
        }
        if (cashout > 0) {
            rows.push({ id: 'cashout', scenario: 'With Cash-Out Refi', cltv: pct(baseBal + cashout) });
        }
        return rows;
    }

    get cltvColumns() {
        return [
            { label: 'Scenario', fieldName: 'scenario' },
            { label: 'CLTV (%)', fieldName: 'cltv', type: 'number', typeAttributes: { maximumFractionDigits: 1 } }
        ];
    }

    // =========================
    // Location-based Natural Disaster Risk & Insurance Impact
    // =========================
    @track riskFlood = 'none'; // none | moderate | high
    @track riskEarthquake = 'none'; // none | moderate | high
    @track riskHurricane = 'none'; // none | moderate | high

    get riskLevelOptions() {
        return [
            { label: 'None', value: 'none' },
            { label: 'Moderate', value: 'moderate' },
            { label: 'High', value: 'high' }
        ];
    }

    handleRiskChange(event) {
        const name = event.target.name;
        const val = event.detail.value;
        if (name === 'riskFlood') this.riskFlood = val;
        if (name === 'riskEarthquake') this.riskEarthquake = val;
        if (name === 'riskHurricane') this.riskHurricane = val;
    }

    // Example baseline monthly surcharges (can be replaced with real underwriting tables)
    riskCost(peril, level) {
        const table = {
            flood: { none: 0, moderate: 50, high: 150 },
            eq: { none: 0, moderate: 40, high: 120 },
            hurricane: { none: 0, moderate: 60, high: 180 }
        };
        if (peril === 'flood') return table.flood[level] ?? 0;
        if (peril === 'eq') return table.eq[level] ?? 0;
        if (peril === 'hurricane') return table.hurricane[level] ?? 0;
        return 0;
    }

    get riskInsuranceBreakdown() {
        const flood = this.riskCost('flood', this.riskFlood);
        const eq = this.riskCost('eq', this.riskEarthquake);
        const hurricane = this.riskCost('hurricane', this.riskHurricane);
        const total = flood + eq + hurricane;
        return { flood, eq, hurricane, total };
    }

    get monthlyWithRisk() {
        const base = this.buyingMonthlyCost; // includes EMI + maint + HOA
        if (!Number.isFinite(base)) return null;
        return base + this.riskInsuranceBreakdown.total;
    }

    // =========================
    // Comprehensive DTI Calculator (lender profiles and thresholds)
    // =========================
    @track dtiIncome = null; // gross monthly income
    @track dtiAuto = null;
    @track dtiStudent = null;
    @track dtiCredit = null;
    @track dtiOther = null;
    @track dtiChildcare = null; // future/known obligations
    @track dtiHousingOverride = null; // optional override for housing payment
    @track dtiLender = 'conventional'; // conventional | fha | va | usda | custom
    @track dtiCustomFront = null; // %
    @track dtiCustomBack = null; // %

    get dtiLenderOptions() {
        return [
            { label: 'Conventional (28/36)', value: 'conventional' },
            { label: 'FHA (31/43)', value: 'fha' },
            { label: 'VA (back 41)', value: 'va' },
            { label: 'USDA (29/41)', value: 'usda' },
            { label: 'Custom', value: 'custom' }
        ];
    }

    handleDtiFieldChange(event) {
        const { name, value } = event.target;
        const numeric = parseFloat(value);
        if (['dtiLender'].includes(name)) {
            this.dtiLender = value;
            return;
        }
        this[name] = Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
    }

    get dtiHousingPayment() {
        if (Number.isFinite(this.dtiHousingOverride)) return this.dtiHousingOverride;
        // Default to EMI + maintenance + HOA + risk surcharges if available
        const base = this.buyingMonthlyCost; // includes EMI + maint + HOA
        const risk = this.riskInsuranceBreakdown?.total || 0;
        return Number.isFinite(base) ? base + risk : null;
    }

    get dtiTotalDebts() {
        const vals = [this.dtiAuto, this.dtiStudent, this.dtiCredit, this.dtiOther, this.dtiChildcare];
        return vals.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
    }

    get dtiFront() {
        if (!Number.isFinite(this.dtiIncome) || this.dtiIncome <= 0) return null;
        const housing = this.dtiHousingPayment;
        if (!Number.isFinite(housing)) return null;
        return Math.round(((housing / this.dtiIncome) * 100) * 10) / 10;
    }

    get dtiBack() {
        if (!Number.isFinite(this.dtiIncome) || this.dtiIncome <= 0) return null;
        const housing = this.dtiHousingPayment;
        if (!Number.isFinite(housing)) return null;
        const debts = this.dtiTotalDebts;
        return Math.round((((housing + debts) / this.dtiIncome) * 100) * 10) / 10;
    }

    get dtiThresholds() {
        const profiles = {
            conventional: { front: 28, back: 36 },
            fha: { front: 31, back: 43 },
            va: { front: null, back: 41 },
            usda: { front: 29, back: 41 }
        };
        if (this.dtiLender === 'custom') {
            return { front: Number.isFinite(this.dtiCustomFront) ? this.dtiCustomFront : null, back: Number.isFinite(this.dtiCustomBack) ? this.dtiCustomBack : null };
        }
        return profiles[this.dtiLender] || profiles.conventional;
    }

    get dtiQualification() {
        const front = this.dtiFront;
        const back = this.dtiBack;
        const th = this.dtiThresholds;
        if (front == null || back == null) return null;
        const frontOk = th.front == null ? true : front <= th.front;
        const backOk = th.back == null ? true : back <= th.back;
        const qualifies = frontOk && backOk;
        let message = qualifies ? 'Meets lender DTI requirements.' : 'Exceeds lender DTI thresholds.';
        if (!frontOk && th.front != null) message += ` Front DTI ${front}% > ${th.front}%.`;
        if (!backOk && th.back != null) message += ` Back DTI ${back}% > ${th.back}%.`;
        return { front, back, frontMax: th.front, backMax: th.back, qualifies, message };
    }

    // =========================
    // Share, PDF, CSV, Email Results
    // =========================
    @track emailTo = '';
    @track emailSubject = '';
    @track emailBody = '';
    @track emailTemplate = 'plain';

    get emailTemplateOptions() {
        return [
            { label: 'Plain Summary', value: 'plain' },
            { label: 'Detailed (with Amortization)', value: 'detailed' },
            { label: 'Comparison Focus', value: 'compare' }
        ];
    }

    handleEmailFieldChange(event) {
        const { name, value } = event.target;
        this[name] = value;
    }

    getResultsSummary() {
        const lines = [];
        if (Number.isFinite(this.price)) lines.push(`Price: ${this.formatCurrency(this.price)}`);
        if (Number.isFinite(this.interestRate)) lines.push(`Rate: ${this.interestRate}%`);
        if (Number.isFinite(this.tenure)) lines.push(`Tenure: ${this.tenure} years`);
        if (Number.isFinite(this.monthlyPayment)) lines.push(`Monthly: ${this.formatCurrency(this.monthlyPayment)}`);
        if (this.summaryA) {
            lines.push(`Total Paid: ${this.summaryA.totalPaid}`);
            lines.push(`Total Interest: ${this.summaryA.totalInterest}`);
        }
        if (this.lenderComparisonRows?.length) {
            const top = this.lenderComparisonRows[0];
            lines.push(`Top Lender: ${top.lender} @ ${top.rate}% APR ${top.apr}%`);
        }
        return lines.join('\n');
    }

    async handleShare() {
        const text = this.getResultsSummary();
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Mortgage Summary', text });
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                this.dispatchEvent(new ShowToastEvent({ title: 'Copied', message: 'Summary copied to clipboard', variant: 'success' }));
            } else {
                this.dispatchEvent(new ShowToastEvent({ title: 'Share unavailable', message: 'Copy the summary manually.', variant: 'warning' }));
            }
        } catch (e) {
            this.dispatchEvent(new ShowToastEvent({ title: 'Share canceled', message: e?.message || 'User canceled or unsupported.', variant: 'info' }));
        }
    }

    exportCsv() {
        // Prefer exporting lender comparison or amortization schedule if available
        const headers = [];
        let rows = [];
        if (this.lenderComparisonRows?.length) {
            headers.push(['Lender', 'Rate', 'APR', 'Fees', 'Monthly', 'Recommendation']);
            rows = this.lenderComparisonRows.map(r => [r.lender, r.rate, r.apr, r.fees, r.monthly, r.recommendation]);
        } else if (this.monthlySchedule?.length) {
            headers.push(['#', 'Due Date', 'Interest', 'Principal', 'Extra', 'Balance']);
            rows = this.monthlySchedule.map(r => [r.n, new Date(r.dueDate).toISOString().slice(0,10), r.interest, r.principal, r.extra, r.balance]);
        } else {
            headers.push(['Field', 'Value']);
            const summary = this.getResultsSummary().split('\n').map(line => line.split(': '));
            rows = summary;
        }
        const csv = [headers[0].join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mortgage-results.csv';
        a.click();
        URL.revokeObjectURL(url);
        this.dispatchEvent(new ShowToastEvent({ title: 'Exported', message: 'CSV downloaded', variant: 'success' }));
    }

    generatePdf() {
        // Placeholder: open print dialog with a simple summary; integrate with Apex for true PDF service
        const w = window.open('', '_blank', 'noopener');
        if (!w) {
            this.dispatchEvent(new ShowToastEvent({ title: 'Popup blocked', message: 'Allow popups to generate PDF.', variant: 'warning' }));
            return;
        }
        const summary = this.getResultsSummary().replace(/\n/g, '<br/>');
        w.document.write(`<html><head><title>Mortgage Summary</title></head><body><h1>Mortgage Summary</h1><p>${summary}</p></body></html>`);
        w.document.close();
        w.focus();
        w.print();
    }

    sendEmail() {
        // Placeholder: Wire to Apex email service; current impl shows a toast
        if (!this.emailTo) {
            this.dispatchEvent(new ShowToastEvent({ title: 'Recipient required', message: 'Enter an email address.', variant: 'error' }));
            return;
        }
        this.dispatchEvent(new ShowToastEvent({ title: 'Email queued', message: `Prepared email to ${this.emailTo} (template: ${this.emailTemplate}). Integrate with Apex to send.`, variant: 'success' }));
    }

    // =========================
    // Payment Acceleration (Bi-weekly, Extra Monthly, Lump Sum)
    // =========================
    @track biweeklyEnabled = false;
    @track accelExtraMonthly = null; // currency amount
    @track accelLumpAmount = null; // currency amount
    @track accelLumpStartMonth = null; // payment index (1-based)
    @track accelRows = [];
    @track accelMessage = null;

    handleAccelToggle(event) {
        this.biweeklyEnabled = !!event.detail.checked;
    }

    handleAccelFieldChange(event) {
        const name = event.target.name;
        const v = parseFloat(event.detail.value);
        const parsed = Number.isFinite(v) && v >= 0 ? v : null;
        if (name === 'accelExtraMonthly') this.accelExtraMonthly = parsed;
        if (name === 'accelLumpAmount') this.accelLumpAmount = parsed;
        if (name === 'accelLumpStartMonth') this.accelLumpStartMonth = parsed;
    }

    // Frequency selection for accelerated schedules
    @track accelFrequency = 'biweekly';
    get accelFrequencyOptions() {
        return [
            { label: 'Bi-weekly (26/yr)', value: 'biweekly' },
            { label: 'Semi-monthly (24/yr)', value: 'semiMonthly' },
            { label: 'Monthly (12/yr)', value: 'monthly' },
            { label: 'Weekly (52/yr)', value: 'weekly' }
        ];
    }
    handleAccelFrequencyChange(event) {
        this.accelFrequency = event.detail.value || 'biweekly';
    }

    computeAcceleration() {
        // Validate base loan inputs
        if (!Number.isFinite(this.price) || !Number.isFinite(this.interestRate) || !Number.isFinite(this.tenure) || this.price <= 0 || this.tenure <= 0) {
            this.accelMessage = 'Enter valid price, rate, and tenure to evaluate acceleration strategies.';
            this.accelRows = [];
            return;
        }
        const p = this.price;
        const rMonthly = (this.interestRate / 100) / MONTHS_IN_YEAR;
        const n = this.tenure * MONTHS_IN_YEAR;
        const start = this.calendarStartDate ? new Date(this.calendarStartDate) : new Date();
        const emi = this.calculateEmi(p, rMonthly, n);

        // Baseline
        const base = this.buildMonthlySchedule(p, rMonthly, n, emi, start, { amount: 0, start: null, frequency: 'none', months: null });

        // Accelerated frequency variants (including bi-weekly)
        let biw = null;
        if (this.biweeklyEnabled) {
            biw = this.buildAcceleratedSchedule(p, this.interestRate, emi, start, this.accelFrequency || 'biweekly');
        }

        // Extra monthly
        let extraMonthly = null;
        if (Number.isFinite(this.accelExtraMonthly) && this.accelExtraMonthly > 0) {
            extraMonthly = this.buildMonthlySchedule(p, rMonthly, n, emi, start, { amount: this.accelExtraMonthly, start: 1, frequency: 'monthly', months: null });
        }

        // Lump sum
        let lump = null;
        if (Number.isFinite(this.accelLumpAmount) && this.accelLumpAmount > 0 && Number.isFinite(this.accelLumpStartMonth) && this.accelLumpStartMonth > 0) {
            lump = this.buildMonthlySchedule(p, rMonthly, n, emi, start, { amount: this.accelLumpAmount, start: Math.floor(this.accelLumpStartMonth), frequency: 'one', months: 1 });
        }

        const rows = [];
        const fmtRow = (name, s) => {
            return {
                id: name,
                strategy: name,
                payments: s.payments,
                monthsSaved: base.payments - s.payments,
                interestSaved: base.totalInterest - s.totalInterest,
                payoffDate: s.lastDate
            };
        };
        rows.push(fmtRow('Baseline', base));
        if (biw) rows.push(fmtRow('Bi-weekly', biw));
        if (extraMonthly) rows.push(fmtRow('Extra Monthly', extraMonthly));
        if (lump) rows.push(fmtRow('Lump Sum', lump));

        this.accelRows = rows;
        this.accelMessage = null;
    }

    get accelColumns() {
        const code = this.currencyCode;
        return [
            { label: 'Strategy', fieldName: 'strategy' },
            { label: 'Payments (months)', fieldName: 'payments', type: 'number' },
            { label: 'Months Saved', fieldName: 'monthsSaved', type: 'number' },
            { label: 'Interest Saved', fieldName: 'interestSaved', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Payoff', fieldName: 'payoffDate', type: 'date', typeAttributes: { year: 'numeric', month: 'short', day: '2-digit' } }
        ];
    }

    // Flexible accelerated schedule builder supporting multiple payment frequencies
    // 'monthly' (12/yr), 'biweekly' (26/yr), 'weekly' (52/yr), 'semiMonthly' (24/yr)
    buildAcceleratedSchedule(principal, annualRatePercent, monthlyEmi, startDate, frequency = 'biweekly') {
        const freqMap = {
            monthly: { periodsPerYear: 12, daysPerPeriod: 30, payment: monthlyEmi },
            semiMonthly: { periodsPerYear: 24, daysPerPeriod: 15, payment: monthlyEmi / 2 },
            biweekly: { periodsPerYear: 26, daysPerPeriod: 14, payment: monthlyEmi / 2 },
            weekly: { periodsPerYear: 52, daysPerPeriod: 7, payment: monthlyEmi / 4 },
        };
        const cfg = freqMap[frequency] || freqMap.biweekly;
        const ratePerPeriod = (annualRatePercent / 100) / cfg.periodsPerYear;
        let balance = principal;
        let totalInterest = 0;
        let periods = 0;
        let current = new Date(startDate.getTime());
        while (balance > 0 && periods < cfg.periodsPerYear * this.tenure + 240) { // generous cap
            const interest = balance * ratePerPeriod;
            let principalPaid = cfg.payment - interest;
            if (principalPaid < 0) principalPaid = 0;
            if (principalPaid > balance) principalPaid = balance;
            balance -= principalPaid;
            totalInterest += interest;
            periods += 1;
            current.setDate(current.getDate() + cfg.daysPerPeriod);
        }
        const monthsApprox = Math.ceil((periods / cfg.periodsPerYear) * 12);
        return { schedule: [], payments: monthsApprox, totalInterest, lastDate: current, frequency };
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
    @track refiPointsPercent = 0; // discount points on new loan (% of new principal)
    @track refiIncludeTax = false; // include tax effects in break-even
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
            case 'refiPointsPercent': this.refiPointsPercent = Number.isFinite(val) && val >= 0 ? val : 0; break;
            default: break;
        }
    }

    handleRefiToggle(event) {
        const name = event.target.name;
        const checked = !!event.detail.checked;
        if (name === 'refiIncludeTax') this.refiIncludeTax = checked;
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

        const points = (Number.isFinite(this.refiPointsPercent) ? (this.refiPointsPercent / 100) : 0) * newP;
        const costs = (Number.isFinite(this.refiClosingCosts) ? this.refiClosingCosts : 0) + points;
        const breakevenMonthsSimple = delta > 0 ? (costs / delta) : null;

        // Detailed break-even with after-tax effects and month-by-month savings
        const includeTax = !!this.refiIncludeTax;
        const bracket = Number.isFinite(this.taxBracketPct) ? this.taxBracketPct / 100 : 0;
        const start = this.calendarStartDate ? new Date(this.calendarStartDate) : new Date();
        const curSched = this.buildMonthlySchedule(curP, curR, curN, curM, start, { amount: 0, start: null, frequency: 'none', months: null });
        const newSched = this.buildMonthlySchedule(newP, newR, newN, newM, start, { amount: 0, start: null, frequency: 'none', months: null });
        let cum = 0; let detailedMonths = null; let detailedDate = null;
        const len = Math.min(curSched.schedule.length, newSched.schedule.length);
        for (let i = 0; i < len; i++) {
            const curRow = curSched.schedule[i];
            const newRow = newSched.schedule[i];
            const paymentSavings = curM - newM;
            const interestSavings = (curRow.interest || 0) - (newRow.interest || 0);
            const monthBenefit = includeTax ? (paymentSavings + (interestSavings * bracket)) : paymentSavings;
            cum += monthBenefit;
            if (detailedMonths === null && cum >= costs && monthBenefit > 0) {
                detailedMonths = i + 1;
                detailedDate = newRow.dueDate;
            }
        }

        return {
            curM, newM, delta,
            curTotalInterest, newTotalInterest, interestDelta,
            principalNew: newP,
            breakevenMonths: breakevenMonthsSimple,
            breakevenMonthsDetailed: detailedMonths,
            breakevenDate: detailedDate,
            costs,
            points
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
            breakeven: c.breakevenMonths != null ? `${Math.ceil(c.breakevenMonths)} months` : 'N/A',
            breakevenDetailed: c.breakevenMonthsDetailed != null ? `${c.breakevenMonthsDetailed} months` : 'N/A',
            breakevenDate: c.breakevenDate,
            closingCosts: fmt(c.costs),
            pointsPaid: fmt(c.points)
        };
    }

    // What-if scenarios for refinance
    get refiScenarioColumns() {
        const code = this.currencyCode;
        return [
            { label: 'Rate %', fieldName: 'rate', type: 'number', typeAttributes: { maximumFractionDigits: 2 } },
            { label: 'Term (yrs)', fieldName: 'term', type: 'number' },
            { label: 'Cash-out', fieldName: 'cashout', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'New Monthly', fieldName: 'newMonthly', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Monthly Change', fieldName: 'monthlyChange', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Costs+Points', fieldName: 'costs', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Break-even (mo)', fieldName: 'breakeven', type: 'number' },
            { label: 'Break-even (detailed)', fieldName: 'breakevenDetailed', type: 'number' }
        ];
    }

    get refiScenarioRows() {
        if (!this.refiValid) return [];
        const rates = [this.refiNewRate - 0.25, this.refiNewRate, this.refiNewRate + 0.25].filter((r) => Number.isFinite(r) && r > 0);
        const terms = Array.from(new Set([this.refiNewTermYears, 15, 30].filter((t) => Number.isFinite(t) && t > 0)));
        const cashouts = Array.from(new Set([this.refiCashOut || 0, 0]));
        const rows = [];
        rates.slice(0,3).forEach((r) => {
            terms.slice(0,3).forEach((t) => {
                cashouts.slice(0,2).forEach((co) => {
                    // compute quick projection for each scenario
                    const curP = this.refiCurrentBalance;
                    const curR = (this.refiCurrentRate / 100) / MONTHS_IN_YEAR;
                    const curN = this.refiRemainingTermYears * MONTHS_IN_YEAR;
                    const newP = curP + (Number.isFinite(co) ? co : 0) + (Number.isFinite(this.refiClosingCosts) ? this.refiClosingCosts : 0);
                    const newR = (r / 100) / MONTHS_IN_YEAR;
                    const newN = t * MONTHS_IN_YEAR;
                    const curM = this.calculateEmi(curP, curR, curN);
                    const newM = this.calculateEmi(newP, newR, newN);
                    const delta = curM - newM;
                    const points = (Number.isFinite(this.refiPointsPercent) ? (this.refiPointsPercent / 100) : 0) * newP;
                    const costs = (Number.isFinite(this.refiClosingCosts) ? this.refiClosingCosts : 0) + points;
                    const breakeven = delta > 0 ? Math.ceil(costs / delta) : null;
                    // detailed months approximation using payment difference only
                    rows.push({ id: `${r}-${t}-${co}`, rate: Math.round(r * 100) / 100, term: t, cashout: co, newMonthly: newM, monthlyChange: delta, costs, breakeven, breakevenDetailed: breakeven });
                });
            });
        });
        return rows;
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
        // Fetch from Apex CurrencyService and cache locally
        this.refreshExchangeRates(this.selectedCurrency);
    }

    // Placeholder for exchange-rate API call (no network in this environment)
    refreshExchangeRates(currencyCode) {
        if (!currencyCode) return Promise.resolve();
        return getRates({ base: currencyCode })
            .then((rates) => {
                this.fxRates = rates;
                this.dispatchEvent(new ShowToastEvent({ title: 'Currency updated', message: `Rates loaded for ${currencyCode}.`, variant: 'success' }));
            })
            .catch(() => {
                this.dispatchEvent(new ShowToastEvent({ title: 'Rates unavailable', message: 'Using fallback conversions.', variant: 'warning' }));
            });
    }

    convertAmount(amount, toCode) {
        if (!Number.isFinite(amount)) return amount;
        const code = (toCode || this.currencyCode || 'USD').toUpperCase();
        if (!this.fxRates || !this.fxRates[code]) {
            return amount; // fallback to raw value
        }
        return amount * this.fxRates[code];
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
