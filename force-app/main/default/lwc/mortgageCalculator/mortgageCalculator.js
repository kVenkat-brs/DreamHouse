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

    // =========================
    // Property Tax Calculator (millage, assessment ratio, homestead)
    // =========================
    // Catalog with example locations. Values are illustrative and editable by users.
    taxLocationCatalog = [
        {
            key: 'atl_fulton_ga',
            label: 'Atlanta, GA (Fulton County) — example',
            mills: 41.0, // total mills (city + county + schools) ~ 41 → 4.1%
            assessmentRatioPct: 40, // Georgia residential assessment ratio
            homesteadTypical: 2000 // typical fixed homestead amount (example only)
        },
        {
            key: 'austin_travis_tx',
            label: 'Austin, TX (Travis County) — example',
            mills: 21.0, // ~2.1% combined (county + city + school) in mills
            assessmentRatioPct: 100, // Texas typically assesses at market value
            homesteadTypical: 100000 // Texas increased school homestead exemption (example)
        },
        {
            key: 'charleston_sc',
            label: 'Charleston, SC — example',
            mills: 250.0, // SC has high mills but low assessment ratios
            assessmentRatioPct: 4, // Primary residence often 4% (non‑primary 6%)
            homesteadTypical: 50000 // example state homestead for seniors/disabled (illustrative)
        },
        {
            key: 'custom',
            label: 'Custom (enter your own values)',
            mills: null,
            assessmentRatioPct: null,
            homesteadTypical: 0
        }
    ];

    @track taxLocationKey = 'custom';
    @track taxMarketValue = null; // defaults to price if available
    @track taxMills = null; // mills (per $1,000 of taxable assessed value)
    @track taxAssessmentRatioPct = null; // % of market value used as assessed value
    @track taxHomesteadType = 'none'; // none | fixed | percent
    @track taxHomesteadAmount = null; // fixed amount off assessed value
    @track taxHomesteadPercent = null; // percent off assessed value
    @track taxPrimaryResidence = true;
    @track taxMessage = null;

    get taxLocationOptions() {
        return this.taxLocationCatalog.map((l) => ({ label: l.label, value: l.key }));
    }

    handleTaxLocationChange(event) {
        const key = event.detail.value;
        this.taxLocationKey = key;
        const found = this.taxLocationCatalog.find((l) => l.key === key);
        if (found) {
            this.taxMills = Number.isFinite(found.mills) ? found.mills : this.taxMills;
            this.taxAssessmentRatioPct = Number.isFinite(found.assessmentRatioPct) ? found.assessmentRatioPct : this.taxAssessmentRatioPct;
            if (this.taxHomesteadType === 'fixed' && Number.isFinite(found.homesteadTypical)) {
                this.taxHomesteadAmount = found.homesteadTypical;
            }
        }
        if (!Number.isFinite(this.taxMarketValue) && Number.isFinite(this.price)) {
            this.taxMarketValue = this.price;
        }
        this.taxMessage = null;
    }

    handleTaxFieldChange(event) {
        const { name } = event.target;
        const raw = event.detail?.value;
        const num = parseFloat(raw);
        switch (name) {
            case 'taxMarketValue':
                this.taxMarketValue = Number.isFinite(num) && num >= 0 ? num : null;
                break;
            case 'taxMills':
                this.taxMills = Number.isFinite(num) && num >= 0 ? num : null;
                break;
            case 'taxAssessmentRatioPct':
                this.taxAssessmentRatioPct = Number.isFinite(num) && num >= 0 ? num : null;
                break;
            case 'taxHomesteadAmount':
                this.taxHomesteadAmount = Number.isFinite(num) && num >= 0 ? num : null;
                break;
            case 'taxHomesteadPercent':
                this.taxHomesteadPercent = Number.isFinite(num) && num >= 0 ? num : null;
                break;
            default:
                break;
        }
        this.taxMessage = null;
    }

    handleTaxHomesteadTypeChange(event) {
        this.taxHomesteadType = event.detail.value;
        this.taxMessage = null;
    }

    handleTaxPrimaryToggle(event) {
        this.taxPrimaryResidence = !!event.detail.checked;
        this.taxMessage = null;
    }

    // Computed assessment base (market value input falls back to price if empty)
    get taxEffectiveMarketValue() {
        const mv = Number.isFinite(this.taxMarketValue) ? this.taxMarketValue : (Number.isFinite(this.price) ? this.price : null);
        return Number.isFinite(mv) ? mv : null;
    }

    get taxAssessedValue() {
        const mv = this.taxEffectiveMarketValue;
        const ratioPct = Number.isFinite(this.taxAssessmentRatioPct) ? this.taxAssessmentRatioPct : null;
        if (!Number.isFinite(mv) || !Number.isFinite(ratioPct)) return null;
        return (mv * (ratioPct / 100));
    }

    get taxHomesteadDeduction() {
        // Apply homestead only when flagged as primary and type set
        if (!this.taxPrimaryResidence) return 0;
        const assessed = this.taxAssessedValue;
        if (!Number.isFinite(assessed)) return 0;
        if (this.taxHomesteadType === 'fixed') {
            return Number.isFinite(this.taxHomesteadAmount) ? Math.min(this.taxHomesteadAmount, assessed) : 0;
        }
        if (this.taxHomesteadType === 'percent') {
            const pct = Number.isFinite(this.taxHomesteadPercent) ? this.taxHomesteadPercent : 0;
            return Math.max(0, Math.min(assessed, assessed * (pct / 100)));
        }
        return 0;
    }

    get taxTaxableAssessed() {
        const assessed = this.taxAssessedValue;
        if (!Number.isFinite(assessed)) return null;
        const deduction = Number.isFinite(this.taxHomesteadDeduction) ? this.taxHomesteadDeduction : 0;
        return Math.max(0, assessed - deduction);
    }

    get taxAnnual() {
        const taxable = this.taxTaxableAssessed;
        const mills = Number.isFinite(this.taxMills) ? this.taxMills : null;
        if (!Number.isFinite(taxable) || !Number.isFinite(mills)) return null;
        // Mills are per $1,000 of taxable assessed value
        return (taxable / 1000) * mills;
    }

    get taxMonthly() {
        const annual = this.taxAnnual;
        return Number.isFinite(annual) ? (annual / 12) : null;
    }

    get taxSummary() {
        if (!Number.isFinite(this.taxAnnual)) return null;
        return {
            assessed: this.formatCurrency(this.taxAssessedValue),
            deduction: this.formatCurrency(this.taxHomesteadDeduction),
            taxable: this.formatCurrency(this.taxTaxableAssessed),
            annual: this.formatCurrency(this.taxAnnual),
            monthly: this.formatCurrency(this.taxMonthly)
        };
    }

    get taxHomesteadOptions() {
        return [
            { label: 'None', value: 'none' },
            { label: 'Fixed Amount', value: 'fixed' },
            { label: 'Percent', value: 'percent' }
        ];
    }

    get disableHomesteadAmount() {
        return this.taxHomesteadType !== 'fixed';
    }

    get disableHomesteadPercent() {
        return this.taxHomesteadType !== 'percent';
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
    // Points Purchase Analysis (break-even with tax effects)
    // =========================
    @track pointsPercent = null; // e.g., 1.0 for 1 point
    @track pointsRateNoPoints = null; // % APR without buying points (defaults to interestRate)
    @track pointsRateWithPoints = null; // % APR after buying points (optional)
    @track pointsResults = null; // summary object
    @track pointsMessage = null;

    handlePointsFieldChange(event) {
        const name = event.target.name;
        const v = parseFloat(event.detail.value);
        const parsed = Number.isFinite(v) ? v : null;
        if (name === 'pointsPercent') this.pointsPercent = parsed;
        if (name === 'pointsRateNoPoints') this.pointsRateNoPoints = parsed;
        if (name === 'pointsRateWithPoints') this.pointsRateWithPoints = parsed;
        this.pointsMessage = null;
    }

    calculatePointsAnalysis() {
        // Validate basic inputs
        const principal = Number.isFinite(this.price) && this.price > 0 ? this.price : null;
        const years = Number.isFinite(this.tenure) && this.tenure > 0 ? this.tenure : 30;
        const taxBracket = Number.isFinite(this.taxBracketPct) ? (this.taxBracketPct / 100) : 0;
        if (!principal) {
            this.pointsMessage = 'Enter a valid property price (loan amount).';
            this.pointsResults = null;
            return;
        }
        // Baseline rate (no points) defaults to current scenario interestRate
        const baseRate = Number.isFinite(this.pointsRateNoPoints) ? this.pointsRateNoPoints : (Number.isFinite(this.interestRate) ? this.interestRate : null);
        if (!Number.isFinite(baseRate)) {
            this.pointsMessage = 'Provide a valid baseline rate (no points).';
            this.pointsResults = null;
            return;
        }
        // Heuristic: if with-points rate not provided, reduce by 0.25% per point
        const points = Number.isFinite(this.pointsPercent) ? this.pointsPercent : 0;
        const withPointsRate = Number.isFinite(this.pointsRateWithPoints) ? this.pointsRateWithPoints : (baseRate - (0.25 * points));
        if (!Number.isFinite(withPointsRate) || withPointsRate <= 0) {
            this.pointsMessage = 'Provide a valid rate after buying points (or adjust points).';
            this.pointsResults = null;
            return;
        }

        const n = years * MONTHS_IN_YEAR;
        const rBase = (baseRate / 100) / MONTHS_IN_YEAR;
        const rDisc = (withPointsRate / 100) / MONTHS_IN_YEAR;
        const emiBase = this.calculateEmi(principal, rBase, n);
        const emiDisc = this.calculateEmi(principal, rDisc, n);

        const start = new Date();
        const schedBase = this.buildMonthlySchedule(principal, rBase, n, emiBase, start, { amount: 0, start: null, frequency: 'none', months: null });
        const schedDisc = this.buildMonthlySchedule(principal, rDisc, n, emiDisc, start, { amount: 0, start: null, frequency: 'none', months: null });

        // Upfront points cost and immediate tax benefit (simplified: fully deductible in year paid)
        const pointsCost = principal * (points / 100);
        const upfrontTaxBenefit = pointsCost * taxBracket;
        const upfrontNet = pointsCost - upfrontTaxBenefit;

        // Month-by-month net savings after tax: payment delta minus tax increase due to lower interest deduction
        let cumNet = 0;
        let breakEvenMonth = null;
        for (let i = 0; i < Math.min(schedBase.schedule.length, schedDisc.schedule.length); i++) {
            const paymentDelta = (emiBase - emiDisc);
            const interestDelta = (schedBase.schedule[i].interest || 0) - (schedDisc.schedule[i].interest || 0);
            const taxEffect = interestDelta * taxBracket; // reduced deduction -> higher taxes -> reduces savings
            const netMonthly = paymentDelta - taxEffect;
            cumNet += netMonthly;
            if (breakEvenMonth == null && cumNet >= upfrontNet) {
                breakEvenMonth = i + 1; // 1-based month count
            }
        }

        // Horizon summaries after tax (3/5/10 years)
        const sumNet = (months) => {
            const limit = Math.min(months, schedBase.schedule.length, schedDisc.schedule.length);
            let totalNet = 0;
            for (let i = 0; i < limit; i++) {
                const paymentDelta = (emiBase - emiDisc);
                const interestDelta = (schedBase.schedule[i].interest || 0) - (schedDisc.schedule[i].interest || 0);
                const taxEffect = interestDelta * taxBracket;
                totalNet += (paymentDelta - taxEffect);
            }
            return totalNet - upfrontNet; // subtract upfront net cost to show net benefit
        };
        const net3y = sumNet(36);
        const net5y = sumNet(60);
        const net10y = sumNet(120);

        const breakEvenDate = breakEvenMonth ? (() => { const d = new Date(start.getTime()); d.setMonth(d.getMonth() + breakEvenMonth); return d; })() : null;

        this.pointsResults = {
            baseRate,
            withPointsRate,
            emiBase,
            emiDisc,
            pointsCost,
            upfrontTaxBenefit,
            upfrontNet,
            breakEvenMonth,
            breakEvenDate,
            net3y,
            net5y,
            net10y
        };
        this.pointsMessage = null;
    }

    // =========================
    // Jumbo Loan Analyzer (stricter DTI, reserves, credit minimums)
    // =========================
    @track jumboLoanAmount = null; // defaults to price if not set
    @track jumboConformingLimit = 766550; // baseline single-unit limit (example)
    @track jumboMinCredit = 720; // typical jumbo minimum
    @track jumboExplicitReserves = null; // optional explicit liquid reserves amount
    @track jumboDecision = null; // approved | conditional | declined | not_jumbo
    @track jumboReasons = [];
    @track jumboSummary = null;

    handleJumboFieldChange(event) {
        const name = event.target.name;
        const v = parseFloat(event.detail.value);
        const parsed = Number.isFinite(v) ? v : null;
        if (name === 'jumboLoanAmount') this.jumboLoanAmount = parsed;
        if (name === 'jumboConformingLimit') this.jumboConformingLimit = parsed || this.jumboConformingLimit;
        if (name === 'jumboMinCredit') this.jumboMinCredit = parsed || this.jumboMinCredit;
        if (name === 'jumboExplicitReserves') this.jumboExplicitReserves = parsed;
    }

    calculateJumboAnalysis() {
        const loanAmt = Number.isFinite(this.jumboLoanAmount) && this.jumboLoanAmount > 0
            ? this.jumboLoanAmount
            : (Number.isFinite(this.price) ? this.price : null);
        const limit = Number.isFinite(this.jumboConformingLimit) ? this.jumboConformingLimit : 766550;
        if (!loanAmt) {
            this.jumboDecision = null;
            this.jumboReasons = ['Enter a valid loan amount (or set Price).'];
            this.jumboSummary = null;
            return;
        }
        if (loanAmt <= limit) {
            this.jumboDecision = 'not_jumbo';
            this.jumboReasons = ['Loan amount is at or below conforming limit.'];
            this.jumboSummary = {
                loanAmount: loanAmt,
                limit,
                note: 'This is not a jumbo loan under the current limit.'
            };
            return;
        }

        // Input context
        const annualRate = Number.isFinite(this.interestRate) ? this.interestRate : 7.0;
        const years = Number.isFinite(this.tenure) && this.tenure > 0 ? this.tenure : 30;
        const monthlyRate = (annualRate / 100) / MONTHS_IN_YEAR;
        const n = years * MONTHS_IN_YEAR;
        const payment = this.calculateEmi(loanAmt, monthlyRate, n);

        const monthlyIncome = Number.isFinite(this.incomeAnnual) ? (this.incomeAnnual / MONTHS_IN_YEAR) : null;
        const monthlyDebts = Number.isFinite(this.monthlyDebt) ? this.monthlyDebt : 0;
        const backCap = 0.38; // stricter jumbo back-end DTI
        const frontCap = 0.28; // keep front-end baseline

        const reasons = [];
        let decision = 'approved';

        // DTI checks
        if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0) {
            reasons.push('Provide annual income to evaluate DTI.');
            decision = 'conditional';
        } else {
            const front = (payment / monthlyIncome) * 100;
            const back = ((payment + monthlyDebts) / monthlyIncome) * 100;
            if (front > (frontCap * 100)) {
                decision = decision === 'approved' ? 'conditional' : decision;
                reasons.push(`Front‑end DTI ${front.toFixed(1)}% exceeds ${Math.round(frontCap*100)}% jumbo guideline.`);
            }
            if (back > (backCap * 100)) {
                decision = 'declined';
                reasons.push(`Back‑end DTI ${back.toFixed(1)}% exceeds ${Math.round(backCap*100)}% jumbo maximum.`);
            }
        }

        // Credit checks
        const actualScore = Number.isFinite(this.creditScoreValue) ? this.creditScoreValue : (
            this.creditScoreRange === 'excellent' ? 810 :
            this.creditScoreRange === 'verygood' ? 760 :
            this.creditScoreRange === 'good' ? 700 :
            this.creditScoreRange === 'fair' ? 630 : 580
        );
        if (actualScore < this.jumboMinCredit) {
            decision = 'declined';
            reasons.push(`Credit score ${actualScore} below jumbo minimum ${this.jumboMinCredit}.`);
        }

        // Reserves (6–12 months typical; scale by score and size)
        let reservesMonths = 6;
        if (actualScore < 740) reservesMonths = 9;
        if (loanAmt >= 1000000) reservesMonths = 12;
        const requiredReserves = (payment + monthlyDebts) * reservesMonths;
        const assets = Number.isFinite(this.jumboExplicitReserves)
            ? this.jumboExplicitReserves
            : (Number.isFinite(this.affDownPayment) ? this.affDownPayment : (Number.isFinite(this.investDownPayment) ? this.investDownPayment : 0));
        if (assets < requiredReserves) {
            decision = decision === 'approved' ? 'conditional' : decision;
            reasons.push(`Reserves short by ${this.formatCurrency(requiredReserves - assets)} (need ~${reservesMonths} months of housing + debts).`);
        }

        this.jumboDecision = decision;
        this.jumboReasons = reasons;
        this.jumboSummary = {
            loanAmount: loanAmt,
            limit,
            rate: annualRate,
            tenureYears: years,
            payment,
            reservesMonths,
            requiredReserves,
            availableReserves: assets
        };
    }

    // =========================
    // FHA Calculator (UFMIP, Annual MIP, Cancellation, Streamline Refi)
    // =========================
    @track fhaPrice = null;
    @track fhaDownPct = 3.5; // typical FHA minimum
    @track fhaUfmipPct = 1.75; // standard upfront MIP
    @track fhaFinanceUfmip = true; // finance UFMIP into loan
    @track fhaTermYears = 30;
    @track fhaAnnualMipPct = null; // optional override; if null, auto-derive
    @track fhaRate = null; // optional override; defaults to interestRate
    @track fhaResults = null;
    @track fhaMessage = null;

    // Streamline Refinance inputs
    @track fhaStreamCurrentBalance = null;
    @track fhaStreamCurrentRate = null;
    @track fhaStreamMonthsRemaining = null;
    @track fhaStreamNewRate = null;
    @track fhaStreamAnnualMipPct = null; // annual MIP for new loan
    @track fhaStreamUfmipPct = 1.75; // UFMIP on new streamline
    @track fhaStreamUfmipRefundPct = 0; // credit from prior UFMIP (percentage of new base loan)
    @track fhaStreamFinanceUfmip = true;
    @track fhaStreamClosingCosts = null;
    @track fhaStreamResults = null;
    @track fhaStreamMessage = null;

    handleFhaFieldChange(event) {
        const { name } = event.target;
        const v = parseFloat(event.detail.value);
        const parsed = Number.isFinite(v) ? v : null;
        switch (name) {
            case 'fhaPrice': this.fhaPrice = parsed; break;
            case 'fhaDownPct': this.fhaDownPct = parsed; break;
            case 'fhaUfmipPct': this.fhaUfmipPct = parsed; break;
            case 'fhaTermYears': this.fhaTermYears = Number.isFinite(v) ? Math.max(1, Math.floor(v)) : this.fhaTermYears; break;
            case 'fhaAnnualMipPct': this.fhaAnnualMipPct = parsed; break;
            case 'fhaRate': this.fhaRate = parsed; break;
            case 'fhaStreamCurrentBalance': this.fhaStreamCurrentBalance = parsed; break;
            case 'fhaStreamCurrentRate': this.fhaStreamCurrentRate = parsed; break;
            case 'fhaStreamMonthsRemaining': this.fhaStreamMonthsRemaining = Number.isFinite(v) ? Math.max(1, Math.floor(v)) : this.fhaStreamMonthsRemaining; break;
            case 'fhaStreamNewRate': this.fhaStreamNewRate = parsed; break;
            case 'fhaStreamAnnualMipPct': this.fhaStreamAnnualMipPct = parsed; break;
            case 'fhaStreamUfmipPct': this.fhaStreamUfmipPct = parsed; break;
            case 'fhaStreamUfmipRefundPct': this.fhaStreamUfmipRefundPct = parsed; break;
            case 'fhaStreamClosingCosts': this.fhaStreamClosingCosts = parsed; break;
            default: break;
        }
        this.fhaMessage = null;
        this.fhaStreamMessage = null;
    }

    handleFhaToggle(event) {
        const { name } = event.target;
        const checked = !!event.detail.checked;
        if (name === 'fhaFinanceUfmip') this.fhaFinanceUfmip = checked;
        if (name === 'fhaStreamFinanceUfmip') this.fhaStreamFinanceUfmip = checked;
    }

    fhaDeriveAnnualMipRate(ltvPct, years) {
        // Simplified FHA MIP matrix (approximate, for illustration)
        if (years <= 15) {
            if (ltvPct > 90) return 0.70; // >= 90% LTV ~0.70%
            return 0.45; // <= 90%
        }
        // 30-year
        if (ltvPct > 95) return 0.85; // >95%
        if (ltvPct > 90) return 0.80; // 90-95%
        return 0.50; // <=90%
    }

    calculateFha() {
        const price = Number.isFinite(this.fhaPrice) ? this.fhaPrice : (Number.isFinite(this.price) ? this.price : null);
        const downPct = Number.isFinite(this.fhaDownPct) ? this.fhaDownPct : 3.5;
        if (!Number.isFinite(price) || price <= 0) {
            this.fhaMessage = 'Enter a valid price or FHA loan amount basis.';
            this.fhaResults = null;
            return;
        }
        const baseLoan = price * (1 - (downPct / 100));
        const ufmipPct = Number.isFinite(this.fhaUfmipPct) ? this.fhaUfmipPct : 1.75;
        const ufmip = baseLoan * (ufmipPct / 100);
        const financedLoan = this.fhaFinanceUfmip ? (baseLoan + ufmip) : baseLoan;
        const years = Number.isFinite(this.fhaTermYears) ? this.fhaTermYears : 30;
        const rate = Number.isFinite(this.fhaRate) ? this.fhaRate : (Number.isFinite(this.interestRate) ? this.interestRate : 0);
        const monthlyRate = (rate / 100) / MONTHS_IN_YEAR;
        const n = years * MONTHS_IN_YEAR;
        const emi = this.calculateEmi(financedLoan, monthlyRate, n);
        const ltvPct = (baseLoan / price) * 100;
        const annualMipPct = Number.isFinite(this.fhaAnnualMipPct) ? this.fhaAnnualMipPct : this.fhaDeriveAnnualMipRate(ltvPct, years);
        const monthlyMip = financedLoan * ((annualMipPct / 100) / 12);

        // Cancellation rules (post-2013): down <10% → life-of-loan; >=10% → cancels after 11 years
        const cancels = downPct >= 10;
        let cancelMonth = null;
        let cancelDate = null;
        if (cancels) {
            cancelMonth = 11 * 12; // 132
            const start = new Date();
            cancelDate = new Date(start.getTime());
            cancelDate.setMonth(cancelDate.getMonth() + cancelMonth);
        }

        this.fhaResults = {
            price,
            downPct,
            baseLoan,
            ufmipPct,
            ufmip,
            financedLoan,
            rate,
            years,
            annualMipPct,
            monthlyMip,
            monthlyTotal: emi + monthlyMip,
            cancels,
            cancelMonth,
            cancelDate
        };
        this.fhaMessage = null;
    }

    calculateFhaStreamline() {
        // Validate inputs
        const curBal = this.fhaStreamCurrentBalance;
        const curRate = this.fhaStreamCurrentRate;
        const curMonths = this.fhaStreamMonthsRemaining;
        const newRate = this.fhaStreamNewRate;
        const annMip = this.fhaStreamAnnualMipPct;
        if (!Number.isFinite(curBal) || !Number.isFinite(curRate) || !Number.isFinite(curMonths) || !Number.isFinite(newRate)) {
            this.fhaStreamMessage = 'Enter current balance, rate, remaining months, and new rate.';
            this.fhaStreamResults = null;
            return;
        }
        const rCur = (curRate / 100) / MONTHS_IN_YEAR;
        const emiCur = this.calculateEmi(curBal, rCur, curMonths);
        const mipCur = Number.isFinite(annMip) ? (curBal * ((annMip / 100) / 12)) : 0;

        const ufmipPct = Number.isFinite(this.fhaStreamUfmipPct) ? this.fhaStreamUfmipPct : 1.75;
        const ufmipRefundPct = Number.isFinite(this.fhaStreamUfmipRefundPct) ? this.fhaStreamUfmipRefundPct : 0;
        const ufmipNetPct = Math.max(0, ufmipPct - ufmipRefundPct);
        const newBase = curBal; // streamline often uses current payoff as base
        const newUfmip = newBase * (ufmipNetPct / 100);
        const newPrincipal = this.fhaStreamFinanceUfmip ? (newBase + newUfmip) : newBase;
        const rNew = (newRate / 100) / MONTHS_IN_YEAR;
        const emiNew = this.calculateEmi(newPrincipal, rNew, curMonths);
        const mipNew = Number.isFinite(annMip) ? (newPrincipal * ((annMip / 100) / 12)) : 0;

        const closing = Number.isFinite(this.fhaStreamClosingCosts) ? this.fhaStreamClosingCosts : 0;
        const monthlySavings = (emiCur + mipCur) - (emiNew + mipNew);
        const breakEvenMonths = monthlySavings > 0 ? Math.ceil(closing / monthlySavings) : null;
        const breakEvenDate = Number.isFinite(breakEvenMonths) ? (() => { const d = new Date(); d.setMonth(d.getMonth() + breakEvenMonths); return d; })() : null;

        this.fhaStreamResults = {
            emiCur,
            mipCur,
            emiNew,
            mipNew,
            newUfmip,
            newPrincipal,
            monthlySavings,
            closing,
            breakEvenMonths,
            breakEvenDate
        };
        this.fhaStreamMessage = null;
    }

    // =========================
    // VA Loan Calculator (Funding Fee + IRRRL)
    // =========================
    @track vaPrice = null;
    @track vaDownPct = 0; // VA can be 0% down
    @track vaServiceType = 'regular'; // regular | reserve
    @track vaFirstUse = true;
    @track vaDisabled = false; // disability exemption
    @track vaFinanceFee = true;
    @track vaTermYears = 30;
    @track vaRate = null; // optional override
    @track vaResults = null;
    @track vaMessage = null;

    // IRRRL (VA streamline)
    @track vaIrrrlCurrentBalance = null;
    @track vaIrrrlCurrentRate = null;
    @track vaIrrrlMonthsRemaining = null;
    @track vaIrrrlNewRate = null;
    @track vaIrrrlFinanceFee = true;
    @track vaIrrrlClosingCosts = null;
    @track vaIrrrlResults = null;
    @track vaIrrrlMessage = null;

    handleVaFieldChange(event) {
        const { name } = event.target;
        const v = event.detail?.value;
        const num = parseFloat(v);
        const parsed = Number.isFinite(num) ? num : null;
        switch (name) {
            case 'vaPrice': this.vaPrice = parsed; break;
            case 'vaDownPct': this.vaDownPct = parsed; break;
            case 'vaTermYears': this.vaTermYears = Number.isFinite(num) ? Math.max(1, Math.floor(num)) : this.vaTermYears; break;
            case 'vaRate': this.vaRate = parsed; break;
            case 'vaServiceType': this.vaServiceType = v || 'regular'; break;
            case 'vaIrrrlCurrentBalance': this.vaIrrrlCurrentBalance = parsed; break;
            case 'vaIrrrlCurrentRate': this.vaIrrrlCurrentRate = parsed; break;
            case 'vaIrrrlMonthsRemaining': this.vaIrrrlMonthsRemaining = Number.isFinite(num) ? Math.max(1, Math.floor(num)) : this.vaIrrrlMonthsRemaining; break;
            case 'vaIrrrlNewRate': this.vaIrrrlNewRate = parsed; break;
            case 'vaIrrrlClosingCosts': this.vaIrrrlClosingCosts = parsed; break;
            default: break;
        }
        this.vaMessage = null;
        this.vaIrrrlMessage = null;
    }

    handleVaToggle(event) {
        const { name } = event.target;
        const checked = !!event.detail.checked;
        if (name === 'vaFirstUse') this.vaFirstUse = checked;
        if (name === 'vaDisabled') this.vaDisabled = checked;
        if (name === 'vaFinanceFee') this.vaFinanceFee = checked;
        if (name === 'vaIrrrlFinanceFee') this.vaIrrrlFinanceFee = checked;
    }

    vaFundingFeeRate(serviceType, firstUse, downPct, disabled, loanKind = 'purchase') {
        if (disabled) return 0.0; // funding fee waived
        if (loanKind === 'irrrl') return 0.5; // IRRRL typical funding fee
        // Purchase/cash-out simplified matrix (approximate common rates)
        const isReserve = (serviceType === 'reserve');
        const bracket = downPct >= 10 ? '10' : (downPct >= 5 ? '5' : '0');
        if (firstUse) {
            if (!isReserve) {
                // Regular military, first use
                if (bracket === '10') return 1.25;
                if (bracket === '5') return 1.50;
                return 2.15; // 0-4.99%
            }
            // Reserve/National Guard, first use
            if (bracket === '10') return 1.50;
            if (bracket === '5') return 1.75;
            return 2.40;
        }
        // Subsequent use (both service types share 3.3% top bracket in many cases)
        if (bracket === '10') return isReserve ? 1.50 : 1.25;
        if (bracket === '5') return isReserve ? 1.75 : 1.50;
        return 3.30; // 0-4.99%
    }

    calculateVa() {
        const price = Number.isFinite(this.vaPrice) ? this.vaPrice : (Number.isFinite(this.price) ? this.price : null);
        if (!Number.isFinite(price) || price <= 0) {
            this.vaMessage = 'Enter a valid price or VA loan amount basis.';
            this.vaResults = null;
            return;
        }
        const downPct = Number.isFinite(this.vaDownPct) && this.vaDownPct >= 0 ? this.vaDownPct : 0;
        const baseLoan = price * (1 - (downPct / 100));
        const feePct = this.vaFundingFeeRate(this.vaServiceType, this.vaFirstUse, downPct, this.vaDisabled, 'purchase');
        const fee = baseLoan * (feePct / 100);
        const financedLoan = this.vaFinanceFee ? (baseLoan + fee) : baseLoan;
        const years = Number.isFinite(this.vaTermYears) ? this.vaTermYears : 30;
        const rate = Number.isFinite(this.vaRate) ? this.vaRate : (Number.isFinite(this.interestRate) ? this.interestRate : 0);
        const r = (rate / 100) / MONTHS_IN_YEAR;
        const n = years * MONTHS_IN_YEAR;
        const emi = this.calculateEmi(financedLoan, r, n);

        this.vaResults = {
            price,
            downPct,
            serviceType: this.vaServiceType,
            firstUse: this.vaFirstUse,
            disabled: this.vaDisabled,
            baseLoan,
            feePct,
            fee,
            financedLoan,
            rate,
            years,
            monthly: emi
        };
        this.vaMessage = null;
    }

    calculateVaIrrrl() {
        const bal = this.vaIrrrlCurrentBalance;
        const curRate = this.vaIrrrlCurrentRate;
        const months = this.vaIrrrlMonthsRemaining;
        const newRate = this.vaIrrrlNewRate;
        if (!Number.isFinite(bal) || !Number.isFinite(curRate) || !Number.isFinite(months) || !Number.isFinite(newRate)) {
            this.vaIrrrlMessage = 'Enter current balance, current rate, months remaining, and new rate.';
            this.vaIrrrlResults = null;
            return;
        }
        const feePct = this.vaFundingFeeRate(this.vaServiceType, this.vaFirstUse, 0, this.vaDisabled, 'irrrl');
        const fee = this.vaIrrrlFinanceFee ? (bal * (feePct / 100)) : 0;
        const newPrincipal = this.vaIrrrlFinanceFee ? (bal + fee) : bal;
        const rCur = (curRate / 100) / MONTHS_IN_YEAR;
        const rNew = (newRate / 100) / MONTHS_IN_YEAR;
        const emiCur = this.calculateEmi(bal, rCur, months);
        const emiNew = this.calculateEmi(newPrincipal, rNew, months);
        const closing = Number.isFinite(this.vaIrrrlClosingCosts) ? this.vaIrrrlClosingCosts : 0;
        const monthlySavings = emiCur - emiNew;
        const breakEvenMonths = monthlySavings > 0 ? Math.ceil(closing / monthlySavings) : null;
        const breakEvenDate = Number.isFinite(breakEvenMonths) ? (() => { const d = new Date(); d.setMonth(d.getMonth() + breakEvenMonths); return d; })() : null;

        this.vaIrrrlResults = {
            feePct,
            fee,
            newPrincipal,
            emiCur,
            emiNew,
            monthlySavings,
            closing,
            breakEvenMonths,
            breakEvenDate
        };
        this.vaIrrrlMessage = null;
    }

    // =========================
    // USDA Loan Analyzer (eligibility + guarantee fees)
    // =========================
    @track usdaPrice = null;
    @track usdaDownPct = 0; // typically 0% down
    @track usdaTermYears = 30;
    @track usdaRate = null; // optional override; defaults to calculator rate
    @track usdaUpfrontFeePct = 1.0; // USDA upfront guarantee fee (approx.)
    @track usdaAnnualFeePct = 0.35; // Annual fee (basis points %)
    @track usdaFinanceUpfront = true;
    @track usdaAreaLimit = null; // Income limit for household (annual)
    @track usdaHouseholdIncome = null; // Borrower household income (annual)
    @track usdaRuralEligible = false; // Geographic eligibility toggle (proxy for live check)
    @track usdaZip = null; // optional informational field
    @track usdaResults = null;
    @track usdaMessage = null;

    handleUsdaFieldChange(event) {
        const { name } = event.target;
        const v = event.detail?.value;
        const num = parseFloat(v);
        const parsed = Number.isFinite(num) ? num : null;
        switch (name) {
            case 'usdaPrice': this.usdaPrice = parsed; break;
            case 'usdaDownPct': this.usdaDownPct = parsed; break;
            case 'usdaTermYears': this.usdaTermYears = Number.isFinite(num) ? Math.max(1, Math.floor(num)) : this.usdaTermYears; break;
            case 'usdaRate': this.usdaRate = parsed; break;
            case 'usdaUpfrontFeePct': this.usdaUpfrontFeePct = parsed; break;
            case 'usdaAnnualFeePct': this.usdaAnnualFeePct = parsed; break;
            case 'usdaAreaLimit': this.usdaAreaLimit = parsed; break;
            case 'usdaHouseholdIncome': this.usdaHouseholdIncome = parsed; break;
            case 'usdaZip': this.usdaZip = v; break;
            default: break;
        }
        this.usdaMessage = null;
    }

    handleUsdaToggle(event) {
        const { name } = event.target;
        const checked = !!event.detail.checked;
        if (name === 'usdaFinanceUpfront') this.usdaFinanceUpfront = checked;
        if (name === 'usdaRuralEligible') this.usdaRuralEligible = checked;
    }

    calculateUsda() {
        const price = Number.isFinite(this.usdaPrice) ? this.usdaPrice : (Number.isFinite(this.price) ? this.price : null);
        if (!Number.isFinite(price) || price <= 0) {
            this.usdaMessage = 'Enter a valid price or USDA loan amount basis.';
            this.usdaResults = null;
            return;
        }
        if (!Number.isFinite(this.usdaAreaLimit) || this.usdaAreaLimit <= 0 || !Number.isFinite(this.usdaHouseholdIncome) || this.usdaHouseholdIncome < 0) {
            this.usdaMessage = 'Enter area income limit and your household income (annual).';
            this.usdaResults = null;
            return;
        }

        const downPct = Number.isFinite(this.usdaDownPct) ? this.usdaDownPct : 0;
        const baseLoan = price * (1 - (downPct / 100));
        const upfrontPct = Number.isFinite(this.usdaUpfrontFeePct) ? this.usdaUpfrontFeePct : 1.0;
        const annualFeePct = Number.isFinite(this.usdaAnnualFeePct) ? this.usdaAnnualFeePct : 0.35;
        const upfrontFee = baseLoan * (upfrontPct / 100);
        const financedLoan = this.usdaFinanceUpfront ? (baseLoan + upfrontFee) : baseLoan;
        const years = Number.isFinite(this.usdaTermYears) ? this.usdaTermYears : 30;
        const rate = Number.isFinite(this.usdaRate) ? this.usdaRate : (Number.isFinite(this.interestRate) ? this.interestRate : 0);
        const r = (rate / 100) / MONTHS_IN_YEAR;
        const n = years * MONTHS_IN_YEAR;
        const emi = this.calculateEmi(financedLoan, r, n);
        const monthlyAnnualFee = financedLoan * ((annualFeePct / 100) / 12);

        // Eligibility checks
        const geographicEligible = !!this.usdaRuralEligible; // proxy toggle (offline)
        const incomeEligible = this.usdaHouseholdIncome <= this.usdaAreaLimit; // user-provided limit already sized to household
        const eligible = geographicEligible && incomeEligible;

        const reasons = [];
        if (!geographicEligible) reasons.push('Property not marked as rural-eligible (toggle to confirm eligibility).');
        if (!incomeEligible) reasons.push('Household income exceeds entered area limit.');

        this.usdaResults = {
            price,
            downPct,
            baseLoan,
            upfrontPct,
            upfrontFee,
            financedLoan,
            annualFeePct,
            monthlyAnnualFee,
            rate,
            years,
            monthlyPI: emi,
            monthlyTotal: emi + monthlyAnnualFee,
            geographicEligible,
            incomeEligible,
            eligible,
            reasons,
            zip: this.usdaZip
        };
        this.usdaMessage = null;
    }

    // =========================
    // Stress Testing (rate shocks, job loss, downturns)
    // =========================
    @track stressRateShocksInput = '-1,0,1,2'; // CSV of percentage point changes
    @track stressJobLossMonths = 3; // months with zero income
    @track stressIncomeDropPct = 20; // % income reduction (non-zero months)
    @track stressExpenseIncreasePct = 10; // % increase to non-housing debts/expenses
    @track stressValueDropPct = 15; // % property value decline
    @track stressReserves = null; // fallback reserves; defaults to savingsCurrent if null
    @track stressRows = [];
    @track stressMessage = null;

    handleStressFieldChange(event) {
        const { name } = event.target;
        const v = event.detail?.value;
        if (name === 'stressRateShocksInput') {
            this.stressRateShocksInput = v ?? '';
            return;
        }
        const num = parseFloat(v);
        const parsed = Number.isFinite(num) ? num : null;
        switch (name) {
            case 'stressJobLossMonths': this.stressJobLossMonths = Number.isFinite(num) ? Math.max(0, Math.floor(num)) : this.stressJobLossMonths; break;
            case 'stressIncomeDropPct': this.stressIncomeDropPct = parsed ?? this.stressIncomeDropPct; break;
            case 'stressExpenseIncreasePct': this.stressExpenseIncreasePct = parsed ?? this.stressExpenseIncreasePct; break;
            case 'stressValueDropPct': this.stressValueDropPct = parsed ?? this.stressValueDropPct; break;
            case 'stressReserves': this.stressReserves = parsed; break;
            default: break;
        }
        this.stressMessage = null;
    }

    get stressColumns() {
        const code = this.currencyCode;
        return [
            { label: 'Scenario', fieldName: 'name' },
            { label: 'Rate (%)', fieldName: 'rate', type: 'number', typeAttributes: { maximumFractionDigits: 2 } },
            { label: 'Payment', fieldName: 'payment', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Front DTI (%)', fieldName: 'front', type: 'number', typeAttributes: { maximumFractionDigits: 1 } },
            { label: 'Back DTI (%)', fieldName: 'back', type: 'number', typeAttributes: { maximumFractionDigits: 1 } },
            { label: 'LTV (%)', fieldName: 'ltv', type: 'number', typeAttributes: { maximumFractionDigits: 1 } },
            { label: 'Runway (mo)', fieldName: 'runway', type: 'number', typeAttributes: { maximumFractionDigits: 0 } },
            { label: 'Covers Job Loss', fieldName: 'covers', type: 'text' },
            { label: 'Status', fieldName: 'status' }
        ];
    }

    parseRateShocks() {
        const raw = (this.stressRateShocksInput || '').split(',');
        const arr = raw
            .map((s) => parseFloat(String(s).trim()))
            .filter((v) => Number.isFinite(v));
        return arr.length ? arr : [0];
    }

    runStressTests() {
        // Validate core inputs
        if (!Number.isFinite(this.price) || this.price <= 0 || !Number.isFinite(this.tenure) || this.tenure <= 0) {
            this.stressMessage = 'Enter valid price and tenure to run stress tests.';
            this.stressRows = [];
            return;
        }
        const baseRate = Number.isFinite(this.interestRate) ? this.interestRate : this.getDefaultRateForLoanType(this.loanType);
        const down = Number.isFinite(this.affDownPayment) ? this.affDownPayment : (Number.isFinite(this.investDownPayment) ? this.investDownPayment : 0);
        const principal = Math.max(0, this.price - (down || 0));
        const n = this.tenure * MONTHS_IN_YEAR;
        const monthlyIncome = Number.isFinite(this.incomeAnnual) ? (this.incomeAnnual / MONTHS_IN_YEAR) : null;
        const baseDebts = Number.isFinite(this.monthlyDebt) ? this.monthlyDebt : 0;
        const reserves = Number.isFinite(this.stressReserves) ? this.stressReserves : (Number.isFinite(this.savingsCurrent) ? this.savingsCurrent : 0);

        const valueDrop = Number.isFinite(this.stressValueDropPct) ? (this.stressValueDropPct / 100) : 0.15;
        const newValue = this.price * (1 - valueDrop);
        const expenseBump = Number.isFinite(this.stressExpenseIncreasePct) ? (this.stressExpenseIncreasePct / 100) : 0.10;
        const incDrop = Number.isFinite(this.stressIncomeDropPct) ? (this.stressIncomeDropPct / 100) : 0.20;
        const jobLossMonths = Number.isFinite(this.stressJobLossMonths) ? this.stressJobLossMonths : 0;

        const rows = [];
        for (const shock of this.parseRateShocks()) {
            const rate = Math.max(0, baseRate + shock);
            const r = (rate / 100) / MONTHS_IN_YEAR;
            const payment = this.calculateEmi(principal, r, n);

            // Income/expense under stress
            const stressedIncome = monthlyIncome != null ? Math.max(0, monthlyIncome * (1 - incDrop)) : null;
            const stressedDebts = baseDebts * (1 + expenseBump);

            const front = stressedIncome ? Math.round(((payment) / stressedIncome) * 1000) / 10 : null;
            const back = stressedIncome ? Math.round(((payment + stressedDebts) / stressedIncome) * 1000) / 10 : null;

            // LTV with value drop
            const ltv = newValue > 0 ? Math.round(((principal) / newValue) * 1000) / 10 : null;

            // Runway months with reserves to cover payment during job loss
            const runway = payment > 0 ? Math.floor((reserves || 0) / payment) : null;
            const covers = (runway != null && jobLossMonths > 0) ? (runway >= jobLossMonths ? 'Yes' : `No (${runway} mo)`) : 'N/A';

            // Status
            let status = 'OK';
            if (back != null && back > 43) status = 'At Risk';
            else if (front != null && front > 31) status = 'Watch';
            if (ltv != null && ltv > 97) status = status === 'At Risk' ? status : 'Watch';
            if (jobLossMonths > 0 && runway != null && runway < jobLossMonths) status = 'At Risk';

            rows.push({
                id: `shock_${shock}`,
                name: shock === 0 ? 'Base' : (shock > 0 ? `+${shock}%` : `${shock}%`),
                rate,
                payment,
                front,
                back,
                ltv,
                runway,
                covers,
                status
            });
        }

        this.stressRows = rows;
        this.stressMessage = null;
    }

    // =========================
    // Advanced Affordability (holistic costs + lifestyle)
    // =========================
    @track affLifestyleFood = null; // monthly
    @track affLifestyleTransport = null; // monthly
    @track affLifestyleChildcare = null; // monthly
    @track affLifestyleHealthcare = null; // monthly
    @track affLifestyleSavingsGoal = null; // target monthly savings
    @track affPropertyTaxMonthly = null; // explicit monthly property tax input (optional override)
    @track affInsuranceMonthly = null; // explicit monthly homeowner insurance (optional override)
    @track affHoaMonthly = null; // explicit HOA (optional override)
    @track affMaxComfortablePrice = null;
    @track affComfortMessage = null;

    handleAffHolisticChange(event) {
        const { name } = event.target;
        const v = parseFloat(event.detail?.value);
        const parsed = Number.isFinite(v) && v >= 0 ? v : null;
        if (['affLifestyleFood','affLifestyleTransport','affLifestyleChildcare','affLifestyleHealthcare','affLifestyleSavingsGoal','affPropertyTaxMonthly','affInsuranceMonthly','affHoaMonthly'].includes(name)) {
            this[name] = parsed;
        }
        this.affComfortMessage = null;
    }

    // Finds comfortable max home price ensuring: income - lifestyle - debts - tax/ins/HOA - savings >= housing P&I
    computeComfortablePrice() {
        const incomeMonthly = Number.isFinite(this.affMonthlyIncome) ? this.affMonthlyIncome : (Number.isFinite(this.incomeAnnual) ? (this.incomeAnnual / 12) : null);
        if (!Number.isFinite(incomeMonthly) || incomeMonthly <= 0) {
            this.affComfortMessage = 'Enter your monthly income (or annual income).';
            this.affMaxComfortablePrice = null;
            return;
        }
        const debts = Number.isFinite(this.affMonthlyDebts) ? this.affMonthlyDebts : (Number.isFinite(this.monthlyDebt) ? this.monthlyDebt : 0);
        const save = Number.isFinite(this.affLifestyleSavingsGoal) ? this.affLifestyleSavingsGoal : 0;
        const lifestyle = (this.affLifestyleFood||0) + (this.affLifestyleTransport||0) + (this.affLifestyleChildcare||0) + (this.affLifestyleHealthcare||0);

        // Fixed monthly housing add-ons
        const hoa = Number.isFinite(this.affHoaMonthly) ? this.affHoaMonthly : (Number.isFinite(this.hoaMonthly) ? this.hoaMonthly : 0);
        const tax = Number.isFinite(this.affPropertyTaxMonthly) ? this.affPropertyTaxMonthly : (Number.isFinite(this.estimatedMonthlyTaxValueA) ? this.estimatedMonthlyTaxValueA : 0);
        const ins = Number.isFinite(this.affInsuranceMonthly) ? this.affInsuranceMonthly : 0;

        const availableForPI = incomeMonthly - (debts + save + lifestyle + hoa + tax + ins);
        if (availableForPI <= 0) {
            this.affComfortMessage = 'Your current expenses exceed income for home purchase. Reduce expenses or increase income.';
            this.affMaxComfortablePrice = 0;
            return;
        }

        // Translate available P&I into principal using selected rate/term
        const annualRate = Number.isFinite(this.interestRate) ? this.interestRate : this.getDefaultRateForLoanType(this.loanType);
        const years = Number.isFinite(this.tenure) && this.tenure > 0 ? this.tenure : 30;
        const r = (annualRate / 100) / MONTHS_IN_YEAR;
        const n = years * MONTHS_IN_YEAR;
        const principal = this.paymentToPrincipal(availableForPI, r, n);

        // Add down payment to get max price
        const down = Number.isFinite(this.affDownPayment) ? this.affDownPayment : 0;
        this.affMaxComfortablePrice = Math.max(0, principal + down);
        this.affComfortMessage = null;
    }

    // =========================
    // Loan Modification Calculator
    // =========================
    @track modCurrentBalance = null;
    @track modCurrentRate = null; // % APR
    @track modMonthsRemaining = null; // months
    @track modRateReductionPct = null; // percentage points to reduce (optional)
    @track modNewRate = null; // optional explicit new rate
    @track modTermExtensionMonths = null; // months to add (optional)
    @track modNewTermMonths = null; // optional explicit new term (months)
    @track modPrincipalForgiveness = null; // amount to deduct from principal
    @track modResults = null;
    @track modMessage = null;

    handleModFieldChange(event) {
        const { name } = event.target;
        const v = parseFloat(event.detail?.value);
        const parsed = Number.isFinite(v) ? v : null;
        switch (name) {
            case 'modCurrentBalance': this.modCurrentBalance = parsed; break;
            case 'modCurrentRate': this.modCurrentRate = parsed; break;
            case 'modMonthsRemaining': this.modMonthsRemaining = Number.isFinite(v) ? Math.max(1, Math.floor(v)) : this.modMonthsRemaining; break;
            case 'modRateReductionPct': this.modRateReductionPct = parsed; break;
            case 'modNewRate': this.modNewRate = parsed; break;
            case 'modTermExtensionMonths': this.modTermExtensionMonths = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : this.modTermExtensionMonths; break;
            case 'modNewTermMonths': this.modNewTermMonths = Number.isFinite(v) ? Math.max(1, Math.floor(v)) : this.modNewTermMonths; break;
            case 'modPrincipalForgiveness': this.modPrincipalForgiveness = parsed; break;
            default: break;
        }
        this.modMessage = null;
    }

    evaluateLoanModification() {
        const curBal = this.modCurrentBalance;
        const curRate = this.modCurrentRate;
        const curMonths = this.modMonthsRemaining;
        if (!Number.isFinite(curBal) || curBal <= 0 || !Number.isFinite(curRate) || curRate < 0 || !Number.isFinite(curMonths) || curMonths <= 0) {
            this.modMessage = 'Enter current balance, current rate, and remaining months.';
            this.modResults = null;
            return;
        }
        const rCur = (curRate / 100) / MONTHS_IN_YEAR;
        const emiCur = this.calculateEmi(curBal, rCur, curMonths);

        // Determine new terms
        const forgiveness = Math.max(0, Number.isFinite(this.modPrincipalForgiveness) ? this.modPrincipalForgiveness : 0);
        const newPrincipal = Math.max(0, curBal - forgiveness);
        const newRate = Number.isFinite(this.modNewRate)
            ? Math.max(0, this.modNewRate)
            : (Number.isFinite(this.modRateReductionPct) ? Math.max(0, curRate - this.modRateReductionPct) : curRate);
        const rNew = (newRate / 100) / MONTHS_IN_YEAR;

        let newMonths = Number.isFinite(this.modNewTermMonths) ? Math.floor(this.modNewTermMonths) : null;
        if (!Number.isFinite(newMonths)) {
            const ext = Number.isFinite(this.modTermExtensionMonths) ? Math.floor(this.modTermExtensionMonths) : 0;
            newMonths = Math.max(1, curMonths + ext);
        }

        const emiNew = this.calculateEmi(newPrincipal, rNew, newMonths);

        // Build schedules to compute remaining interest totals
        const start = new Date();
        const schedCur = this.buildMonthlySchedule(curBal, rCur, curMonths, emiCur, start, { amount: 0, start: null, frequency: 'none', months: null });
        const schedNew = this.buildMonthlySchedule(newPrincipal, rNew, newMonths, emiNew, start, { amount: 0, start: null, frequency: 'none', months: null });
        const sumInterest = (sched) => sched.schedule.reduce((acc, m) => acc + (m.interest || 0), 0);
        const curInterest = sumInterest(schedCur);
        const newInterest = sumInterest(schedNew);

        const monthlySavings = emiCur - emiNew;
        const interestSaved = curInterest - newInterest;
        const paymentReductionPct = emiCur > 0 ? Math.round(((emiCur - emiNew) / emiCur) * 1000) / 10 : null;

        // Estimated new maturity date
        const newMat = new Date(start.getTime());
        newMat.setMonth(newMat.getMonth() + newMonths);

        this.modResults = {
            curRate,
            curMonths,
            curPayment: emiCur,
            curInterest,
            newRate,
            newMonths,
            newPayment: emiNew,
            newInterest,
            forgiveness,
            newPrincipal,
            monthlySavings,
            interestSaved,
            paymentReductionPct,
            newMaturity: newMat
        };
        this.modMessage = null;
    }

    // =========================
    // Reverse Mortgage Calculator (HECM-style approximation)
    // =========================
    @track revHomeValue = null;
    @track revExistingMortgage = 0;
    @track revBorrowerAge = 62;
    @track revExpectedRate = 5.0; // annual expected rate
    @track revAnnualMipPct = 0.5; // annual MIP (basis points %)
    @track revOrigination = 0; // origination/costs
    @track revServiceSetAside = 0; // SFSA
    @track revOtherSetAsides = 0; // life/repair set-asides
    @track revInitialDraw = 0; // initial advance at closing
    @track revTermYears = 20; // used for term/tenure payment modeling
    @track revPlfOverride = null; // optional PLF override (%)
    @track revNatLendingLimit = 1149825; // cap for MCA
    @track revResults = null;
    @track revMessage = null;
    @track revLocRows = [];
    @track revBalRows = [];

    handleReverseFieldChange(event) {
        const { name } = event.target;
        const vStr = event.detail?.value;
        const vNum = parseFloat(vStr);
        const parsed = Number.isFinite(vNum) ? vNum : null;
        switch (name) {
            case 'revHomeValue': this.revHomeValue = parsed; break;
            case 'revExistingMortgage': this.revExistingMortgage = parsed ?? 0; break;
            case 'revBorrowerAge': this.revBorrowerAge = Number.isFinite(vNum) ? Math.max(18, Math.floor(vNum)) : this.revBorrowerAge; break;
            case 'revExpectedRate': this.revExpectedRate = parsed ?? this.revExpectedRate; break;
            case 'revAnnualMipPct': this.revAnnualMipPct = parsed ?? this.revAnnualMipPct; break;
            case 'revOrigination': this.revOrigination = parsed ?? 0; break;
            case 'revServiceSetAside': this.revServiceSetAside = parsed ?? 0; break;
            case 'revOtherSetAsides': this.revOtherSetAsides = parsed ?? 0; break;
            case 'revInitialDraw': this.revInitialDraw = parsed ?? 0; break;
            case 'revTermYears': this.revTermYears = Number.isFinite(vNum) ? Math.max(1, Math.floor(vNum)) : this.revTermYears; break;
            case 'revPlfOverride': this.revPlfOverride = parsed; break;
            case 'revNatLendingLimit': this.revNatLendingLimit = parsed ?? this.revNatLendingLimit; break;
            default: break;
        }
        this.revMessage = null;
    }

    // Very simplified PLF approximation: increases with age, decreases with expected rate
    reversePlf(age, expRate) {
        if (Number.isFinite(this.revPlfOverride) && this.revPlfOverride > 0) return Math.min(0.75, Math.max(0.1, this.revPlfOverride / 100));
        const a = Math.max(62, Math.min(95, age));
        // Base at 62 with 5% ~ 0.35; +0.01 per year; -0.02 per rate point above 5%
        const base = 0.35 + (a - 62) * 0.01 - (Math.max(0, expRate - 5) * 0.02);
        return Math.min(0.75, Math.max(0.1, Math.round(base * 100) / 100));
    }

    computeReverseMortgage() {
        const value = Number.isFinite(this.revHomeValue) ? this.revHomeValue : (Number.isFinite(this.price) ? this.price : null);
        if (!Number.isFinite(value) || value <= 0) {
            this.revMessage = 'Enter a valid home value.';
            this.revResults = null;
            return;
        }
        const age = this.revBorrowerAge || 62;
        const expRate = Number.isFinite(this.revExpectedRate) ? this.revExpectedRate : 5.0;
        const mipAnn = Number.isFinite(this.revAnnualMipPct) ? this.revAnnualMipPct : 0.5;
        const mca = Math.min(value, Number.isFinite(this.revNatLendingLimit) ? this.revNatLendingLimit : value);
        const plf = this.reversePlf(age, expRate); // fraction
        const principalLimit = mca * plf;

        const obligations = (this.revExistingMortgage || 0) + (this.revOrigination || 0) + (this.revServiceSetAside || 0) + (this.revOtherSetAsides || 0);
        const netAtClosing = Math.max(0, principalLimit - obligations);
        const initialDraw = Math.min(netAtClosing, Math.max(0, this.revInitialDraw || 0));
        const locStart = Math.max(0, netAtClosing - initialDraw);

        // Tenure payment (term-like) using exp rate + MIP as effective accrual
        const effAnnual = (expRate / 100) + (mipAnn / 100);
        const r = effAnnual / 12;
        const n = Math.max(12, (this.revTermYears || 20) * 12);
        const tenurePayment = r > 0 ? (locStart * r) / (1 - Math.pow(1 + r, -n)) : (locStart / n);

        // Project line of credit growth on unused funds (10-year projection)
        const years = 10;
        const locRows = [];
        let loc = locStart;
        for (let y = 1; y <= years; y++) {
            // assume no additional draws; unused grows at effAnnual
            loc = loc * Math.pow(1 + effAnnual, 1);
            locRows.push({ id: `loc_${y}`, year: y, line: loc });
        }

        // Project loan balance under tenure draws and accrual; compare to value (non-recourse)
        const balRows = [];
        let bal = initialDraw;
        let propVal = value;
        const appr = 0.03; // assume 3% appreciation
        for (let y = 1; y <= years; y++) {
            for (let m = 0; m < 12; m++) {
                bal = bal * (1 + r) + tenurePayment; // accrual on balance plus monthly advance
            }
            propVal = propVal * (1 + appr);
            balRows.push({ id: `bal_${y}`, year: y, balance: bal, value: propVal, nonrecourse: bal > propVal ? 'Covered (non-recourse)' : 'Equity remains' });
        }

        this.revLocRows = locRows;
        this.revBalRows = balRows;
        this.revResults = {
            mca,
            plfPct: Math.round(plf * 1000) / 10,
            principalLimit,
            obligations,
            netAtClosing,
            initialDraw,
            lineOfCreditStart: locStart,
            expectedRate: expRate,
            annualMipPct: mipAnn,
            tenurePayment
        };
        this.revMessage = null;
    }

    get reverseColumnsLoc() {
        const code = this.currencyCode;
        return [
            { label: 'Year', fieldName: 'year', type: 'number' },
            { label: 'Line of Credit', fieldName: 'line', type: 'currency', typeAttributes: { currencyCode: code } }
        ];
    }
    get reverseColumnsBal() {
        const code = this.currencyCode;
        return [
            { label: 'Year', fieldName: 'year', type: 'number' },
            { label: 'Loan Balance', fieldName: 'balance', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Home Value', fieldName: 'value', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Non-Recourse', fieldName: 'nonrecourse' }
        ];
    }

    // =========================
    // Bridge Loan Calculator (purchase before sale)
    // =========================
    @track bridgePurchasePrice = null;
    @track bridgeDownPct = 20; // % down on new purchase
    @track bridgeExistingValue = null; // current home value
    @track bridgeExistingMortgage = null; // current payoff
    @track bridgeExistingMortgageMonthly = null; // current monthly payment
    @track bridgeSalePrice = null; // expected sale price of current home
    @track bridgeSellCostPct = 6.0; // % selling costs
    @track bridgeMonthsToSale = 3; // overlap months
    @track bridgeRate = 9.0; // annual interest on bridge (interest-only)
    @track bridgeClosingCostsPurchase = 0; // purchase-side closing costs
    @track bridgeCarryOtherMonthly = 0; // taxes/insurance/HOA during overlap
    @track bridgeLtvMaxPct = 80; // max CLTV allowed on bridge
    @track bridgePermRate = null; // optional override for new mortgage rate
    @track bridgePermYears = 30;
    @track bridgeResults = null;
    @track bridgeMessage = null;

    handleBridgeFieldChange(event) {
        const { name } = event.target;
        const raw = event.detail?.value;
        const num = parseFloat(raw);
        const parsed = Number.isFinite(num) ? num : null;
        switch (name) {
            case 'bridgePurchasePrice': this.bridgePurchasePrice = parsed; break;
            case 'bridgeDownPct': this.bridgeDownPct = parsed ?? this.bridgeDownPct; break;
            case 'bridgeExistingValue': this.bridgeExistingValue = parsed; break;
            case 'bridgeExistingMortgage': this.bridgeExistingMortgage = parsed; break;
            case 'bridgeExistingMortgageMonthly': this.bridgeExistingMortgageMonthly = parsed; break;
            case 'bridgeSalePrice': this.bridgeSalePrice = parsed; break;
            case 'bridgeSellCostPct': this.bridgeSellCostPct = parsed ?? this.bridgeSellCostPct; break;
            case 'bridgeMonthsToSale': this.bridgeMonthsToSale = Number.isFinite(num) ? Math.max(0, Math.floor(num)) : this.bridgeMonthsToSale; break;
            case 'bridgeRate': this.bridgeRate = parsed ?? this.bridgeRate; break;
            case 'bridgeClosingCostsPurchase': this.bridgeClosingCostsPurchase = parsed ?? 0; break;
            case 'bridgeCarryOtherMonthly': this.bridgeCarryOtherMonthly = parsed ?? 0; break;
            case 'bridgeLtvMaxPct': this.bridgeLtvMaxPct = parsed ?? this.bridgeLtvMaxPct; break;
            case 'bridgePermRate': this.bridgePermRate = parsed; break;
            case 'bridgePermYears': this.bridgePermYears = Number.isFinite(num) ? Math.max(1, Math.floor(num)) : this.bridgePermYears; break;
            default: break;
        }
        this.bridgeMessage = null;
    }

    computeBridgeLoan() {
        const price = Number.isFinite(this.bridgePurchasePrice) ? this.bridgePurchasePrice : (Number.isFinite(this.price) ? this.price : null);
        const downPct = Number.isFinite(this.bridgeDownPct) ? this.bridgeDownPct : 20;
        const existVal = this.bridgeExistingValue;
        const existPayoff = this.bridgeExistingMortgage;
        const salePrice = this.bridgeSalePrice;
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(existVal) || !Number.isFinite(existPayoff)) {
            this.bridgeMessage = 'Enter purchase price, existing home value and payoff.';
            this.bridgeResults = null;
            return;
        }
        const sellPct = Number.isFinite(this.bridgeSellCostPct) ? (this.bridgeSellCostPct / 100) : 0.06;
        const months = Number.isFinite(this.bridgeMonthsToSale) ? this.bridgeMonthsToSale : 0;
        const bridgeR = (Number.isFinite(this.bridgeRate) ? this.bridgeRate : 9) / 100 / 12;
        const closingPurchase = Number.isFinite(this.bridgeClosingCostsPurchase) ? this.bridgeClosingCostsPurchase : 0;
        const carryOther = Number.isFinite(this.bridgeCarryOtherMonthly) ? this.bridgeCarryOtherMonthly : 0;
        const existMonthly = Number.isFinite(this.bridgeExistingMortgageMonthly) ? this.bridgeExistingMortgageMonthly : 0;

        // Equity available for bridge
        const ltvMax = Number.isFinite(this.bridgeLtvMaxPct) ? (this.bridgeLtvMaxPct / 100) : 0.8;
        const maxLien = Math.min(existVal, existVal * ltvMax);
        const availableEquity = Math.max(0, maxLien - (existPayoff || 0));

        // Cash needed at purchase
        const down = price * (downPct / 100);
        const cashNeeded = down + closingPurchase;
        const bridgeDraw = Math.min(availableEquity, cashNeeded);
        const cashToClose = Math.max(0, cashNeeded - bridgeDraw);

        // New permanent mortgage on purchase
        const ratePerm = Number.isFinite(this.bridgePermRate) ? this.bridgePermRate : (Number.isFinite(this.interestRate) ? this.interestRate : 0);
        const permR = (ratePerm / 100) / 12;
        const permN = (Number.isFinite(this.bridgePermYears) ? this.bridgePermYears : 30) * 12;
        const newPrincipal = Math.max(0, price - down);
        const newPmt = this.calculateEmi(newPrincipal, permR, permN);

        // Carry costs during overlap
        const bridgeInterestMonthly = bridgeDraw * bridgeR;
        const monthlyCarry = bridgeInterestMonthly + existMonthly + carryOther + newPmt;
        const totalCarry = monthlyCarry * months;

        // Exit at sale
        let netProceeds = null;
        if (Number.isFinite(salePrice)) {
            const sellingCosts = salePrice * sellPct;
            netProceeds = salePrice - sellingCosts - (existPayoff || 0) - bridgeDraw;
        }

        // Simple sensitivity if sale slips 3 months
        const slipMonths = months + 3;
        const slipCarry = monthlyCarry * slipMonths;

        this.bridgeResults = {
            availableEquity,
            bridgeDraw,
            cashToClose,
            newMortgagePrincipal: newPrincipal,
            newMortgageRate: ratePerm,
            newMortgagePayment: newPmt,
            monthlyCarry,
            totalCarry,
            monthsOverlap: months,
            netProceedsAtSale: netProceeds,
            slipMonths,
            slipCarry
        };
        this.bridgeMessage = null;
    }

    // =========================
    // Recasting Calculator (principal curtailment vs refinance)
    // =========================
    @track recastCurrentBalance = null;
    @track recastRate = null; // % APR current
    @track recastMonthsRemaining = null;
    @track recastLumpSum = null; // principal curtailment
    @track recastFee = 0; // small administrative fee
    // Refi comparison
    @track recastRefiRate = null; // % APR new
    @track recastRefiTermMonths = null; // months
    @track recastRefiCosts = 0; // total refi costs
    @track recastRefiFinanceCosts = true; // roll costs into new loan
    @track recastResults = null;
    @track recastMessage = null;

    handleRecastFieldChange(event) {
        const { name } = event.target;
        const v = parseFloat(event.detail?.value);
        const parsed = Number.isFinite(v) ? v : null;
        switch (name) {
            case 'recastCurrentBalance': this.recastCurrentBalance = parsed; break;
            case 'recastRate': this.recastRate = parsed; break;
            case 'recastMonthsRemaining': this.recastMonthsRemaining = Number.isFinite(v) ? Math.max(1, Math.floor(v)) : this.recastMonthsRemaining; break;
            case 'recastLumpSum': this.recastLumpSum = parsed; break;
            case 'recastFee': this.recastFee = parsed ?? 0; break;
            case 'recastRefiRate': this.recastRefiRate = parsed; break;
            case 'recastRefiTermMonths': this.recastRefiTermMonths = Number.isFinite(v) ? Math.max(1, Math.floor(v)) : this.recastRefiTermMonths; break;
            case 'recastRefiCosts': this.recastRefiCosts = parsed ?? 0; break;
            default: break;
        }
        this.recastMessage = null;
    }

    handleRecastToggle(event) {
        const { name } = event.target;
        const checked = !!event.detail.checked;
        if (name === 'recastRefiFinanceCosts') this.recastRefiFinanceCosts = checked;
    }

    evaluateRecast() {
        const curBal = this.recastCurrentBalance;
        const curRate = this.recastRate;
        const curMonths = this.recastMonthsRemaining;
        if (!Number.isFinite(curBal) || curBal <= 0 || !Number.isFinite(curRate) || curRate < 0 || !Number.isFinite(curMonths) || curMonths <= 0) {
            this.recastMessage = 'Enter current balance, rate, and remaining months.';
            this.recastResults = null;
            return;
        }
        const rCur = (curRate / 100) / MONTHS_IN_YEAR;
        const pmtCur = this.calculateEmi(curBal, rCur, curMonths);
        const start = new Date();
        const schedCur = this.buildMonthlySchedule(curBal, rCur, curMonths, pmtCur, start, { amount: 0, start: null, frequency: 'none', months: null });
        const interestRemaining = schedCur.totalInterest ?? schedCur.schedule.reduce((a, m) => a + (m.interest || 0), 0);

        // Recast after lump sum
        const lump = Math.max(0, Number.isFinite(this.recastLumpSum) ? this.recastLumpSum : 0);
        const fee = Math.max(0, Number.isFinite(this.recastFee) ? this.recastFee : 0);
        const newPrincipalRecast = Math.max(0, curBal - lump);
        const pmtRecast = this.calculateEmi(newPrincipalRecast, rCur, curMonths);
        const schedRecast = this.buildMonthlySchedule(newPrincipalRecast, rCur, curMonths, pmtRecast, start, { amount: 0, start: null, frequency: 'none', months: null });
        const interestRecast = schedRecast.totalInterest ?? schedRecast.schedule.reduce((a, m) => a + (m.interest || 0), 0);
        const reductionRecast = pmtCur - pmtRecast;

        // Refinance comparison (assume no lump unless user also plans to pay it)
        const rateNew = Number.isFinite(this.recastRefiRate) ? this.recastRefiRate : null;
        const termNew = Number.isFinite(this.recastRefiTermMonths) ? this.recastRefiTermMonths : curMonths;
        let pmtRefi = null, newPrincipalRefi = null, interestRefi = null;
        if (Number.isFinite(rateNew)) {
            const rNew = (rateNew / 100) / MONTHS_IN_YEAR;
            const costs = Math.max(0, Number.isFinite(this.recastRefiCosts) ? this.recastRefiCosts : 0);
            newPrincipalRefi = this.recastRefiFinanceCosts ? (curBal + costs) : curBal;
            pmtRefi = this.calculateEmi(newPrincipalRefi, rNew, termNew);
            const schedRefi = this.buildMonthlySchedule(newPrincipalRefi, rNew, termNew, pmtRefi, start, { amount: 0, start: null, frequency: 'none', months: null });
            interestRefi = schedRefi.totalInterest ?? schedRefi.schedule.reduce((a, m) => a + (m.interest || 0), 0);
        }

        // Break-even: extra monthly savings of refi vs recast against extra upfront cost
        let extraUpfront = null, extraMonthly = null, breakEvenMonths = null;
        if (Number.isFinite(pmtRefi)) {
            extraUpfront = Math.max(0, (this.recastRefiCosts || 0) - fee);
            extraMonthly = Math.max(0, pmtRecast - pmtRefi);
            breakEvenMonths = extraMonthly > 0 ? Math.ceil(extraUpfront / extraMonthly) : null;
        }

        this.recastResults = {
            current: { payment: pmtCur, interest: interestRemaining, balance: curBal },
            recast: { payment: pmtRecast, interest: interestRecast, principal: newPrincipalRecast, lump, fee, reduction: reductionRecast },
            refinance: Number.isFinite(pmtRefi) ? { payment: pmtRefi, interest: interestRefi, principal: newPrincipalRefi, rate: rateNew, termMonths: termNew, costs: (this.recastRefiCosts || 0), financeCosts: this.recastRefiFinanceCosts } : null,
            comparison: Number.isFinite(pmtRefi) ? { extraUpfront, extraMonthly, breakEvenMonths } : null
        };
        this.recastMessage = null;
    }

    // =========================
    // Home Sale Calculator (net proceeds after payoff, costs, taxes)
    // =========================
    @track salePrice = null;
    @track saleCommissionPct = 5.0; // % of sale price
    @track saleClosingCostPct = 1.0; // % of sale price
    @track saleClosingCostFixed = 0; // additional fixed costs
    @track saleMortgagePayoff1 = null; // primary payoff
    @track saleMortgagePayoff2 = 0; // second lien payoff (optional)
    @track salePurchaseBasis = null; // original purchase price (basis)
    @track saleImprovements = 0; // capital improvements added to basis
    @track saleCapGainRatePct = 15.0; // estimated LTCG %
    @track saleExclusion = 250000; // Sec 121 exclusion (single default)
    @track saleStateGainRatePct = 0; // optional state tax %
    @track saleResults = null;
    @track saleMessage = null;

    handleSaleFieldChange(event) {
        const { name } = event.target;
        const v = parseFloat(event.detail?.value);
        const parsed = Number.isFinite(v) ? v : null;
        switch (name) {
            case 'salePrice': this.salePrice = parsed; break;
            case 'saleCommissionPct': this.saleCommissionPct = parsed ?? this.saleCommissionPct; break;
            case 'saleClosingCostPct': this.saleClosingCostPct = parsed ?? this.saleClosingCostPct; break;
            case 'saleClosingCostFixed': this.saleClosingCostFixed = parsed ?? 0; break;
            case 'saleMortgagePayoff1': this.saleMortgagePayoff1 = parsed; break;
            case 'saleMortgagePayoff2': this.saleMortgagePayoff2 = parsed ?? 0; break;
            case 'salePurchaseBasis': this.salePurchaseBasis = parsed; break;
            case 'saleImprovements': this.saleImprovements = parsed ?? 0; break;
            case 'saleCapGainRatePct': this.saleCapGainRatePct = parsed ?? this.saleCapGainRatePct; break;
            case 'saleExclusion': this.saleExclusion = parsed ?? this.saleExclusion; break;
            case 'saleStateGainRatePct': this.saleStateGainRatePct = parsed ?? 0; break;
            default: break;
        }
        this.saleMessage = null;
    }

    computeHomeSale() {
        const price = this.salePrice;
        const payoff1 = this.saleMortgagePayoff1;
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(payoff1) || payoff1 < 0) {
            this.saleMessage = 'Enter sale price and primary mortgage payoff.';
            this.saleResults = null;
            return;
        }
        const comm = (Number.isFinite(this.saleCommissionPct) ? this.saleCommissionPct : 0) / 100;
        const closePct = (Number.isFinite(this.saleClosingCostPct) ? this.saleClosingCostPct : 0) / 100;
        const closeFixed = Number.isFinite(this.saleClosingCostFixed) ? this.saleClosingCostFixed : 0;
        const commission = price * comm;
        const closing = price * closePct + closeFixed;
        const sellingCosts = commission + closing;
        const payoff2 = Number.isFinite(this.saleMortgagePayoff2) ? this.saleMortgagePayoff2 : 0;
        const totalPayoff = payoff1 + payoff2;

        const grossProceeds = price - sellingCosts;
        const proceedsBeforeTax = grossProceeds - totalPayoff;

        // Capital gains
        const basis = (Number.isFinite(this.salePurchaseBasis) ? this.salePurchaseBasis : 0) + (Number.isFinite(this.saleImprovements) ? this.saleImprovements : 0);
        const gain = Math.max(0, price - sellingCosts - basis);
        const exclusion = Math.max(0, Number.isFinite(this.saleExclusion) ? this.saleExclusion : 0);
        const taxableGain = Math.max(0, gain - exclusion);
        const fedRate = (Number.isFinite(this.saleCapGainRatePct) ? this.saleCapGainRatePct : 0) / 100;
        const stateRate = (Number.isFinite(this.saleStateGainRatePct) ? this.saleStateGainRatePct : 0) / 100;
        const taxFed = taxableGain * fedRate;
        const taxState = taxableGain * stateRate;
        const taxes = taxFed + taxState;

        const netProceeds = proceedsBeforeTax - taxes;

        this.saleResults = {
            commission,
            closing,
            sellingCosts,
            payoff1,
            payoff2,
            totalPayoff,
            grossProceeds,
            proceedsBeforeTax,
            gain,
            exclusion,
            taxableGain,
            taxFed,
            taxState,
            taxes,
            netProceeds
        };
        this.saleMessage = null;
    }

    // =========================
    // Payment Calendar (due dates, grace, late fees, history)
    // =========================
    @track payCalStartDate = null; // ISO date string
    @track payCalDueDay = 1; // 1..31
    @track payCalGraceDays = 5; // grace period in days
    @track payCalLateFeeFlat = 0; // fixed late fee
    @track payCalLateFeePct = 0; // percent of amount due
    @track payCalMonths = 12; // number of months to generate
    @track payCalRows = [];
    @track payCalMessage = null;
    @track payCalHistory = []; // { month: number (1-based), paidDate: Date, amount: number }

    handlePayCalFieldChange(event) {
        const { name } = event.target;
        const vRaw = event.detail?.value;
        const num = parseFloat(vRaw);
        switch (name) {
            case 'payCalStartDate':
                this.payCalStartDate = vRaw || null;
                break;
            case 'payCalDueDay':
                this.payCalDueDay = Number.isFinite(num) ? Math.max(1, Math.min(31, Math.floor(num))) : this.payCalDueDay;
                break;
            case 'payCalGraceDays':
                this.payCalGraceDays = Number.isFinite(num) ? Math.max(0, Math.floor(num)) : this.payCalGraceDays;
                break;
            case 'payCalLateFeeFlat':
                this.payCalLateFeeFlat = Number.isFinite(num) ? Math.max(0, num) : this.payCalLateFeeFlat;
                break;
            case 'payCalLateFeePct':
                this.payCalLateFeePct = Number.isFinite(num) ? Math.max(0, num) : this.payCalLateFeePct;
                break;
            case 'payCalMonths':
                this.payCalMonths = Number.isFinite(num) ? Math.max(1, Math.floor(num)) : this.payCalMonths;
                break;
            default:
                break;
        }
        this.payCalMessage = null;
    }

    get payCalColumns() {
        const code = this.currencyCode;
        return [
            { label: 'Month #', fieldName: 'month', type: 'number' },
            { label: 'Due Date', fieldName: 'dueDisplay' },
            { label: 'Grace Date', fieldName: 'graceDisplay' },
            { label: 'Amount Due', fieldName: 'amount', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Paid Date', fieldName: 'paidDisplay' },
            { label: 'Paid Amount', fieldName: 'paidAmount', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Late Fee', fieldName: 'lateFee', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Status', fieldName: 'status' }
        ];
    }

    // Add/overwrite a payment record in history
    addPaymentRecord(monthIndex, paidDateIso, amount) {
        if (!Number.isFinite(monthIndex) || monthIndex < 1) return;
        const idx = this.payCalHistory.findIndex((p) => p.month === monthIndex);
        const record = { month: monthIndex, paidDate: paidDateIso ? new Date(paidDateIso) : null, amount: Number.isFinite(amount) ? amount : null };
        if (idx >= 0) this.payCalHistory.splice(idx, 1, record); else this.payCalHistory.push(record);
    }

    // Entry point from UI
    handleAddPayment(event) {
        const monthIdx = parseInt(this._uiPayMonth || '0', 10);
        const paidIso = this._uiPayDate || null;
        const amt = parseFloat(this._uiPayAmount || '');
        this.addPaymentRecord(monthIdx, paidIso, amt);
        this.generatePaymentCalendar();
    }

    handlePayEntryFieldChange(event) {
        const { name } = event.target;
        const v = event.detail?.value;
        if (name === 'uiPayMonth') this._uiPayMonth = v;
        if (name === 'uiPayDate') this._uiPayDate = v;
        if (name === 'uiPayAmount') this._uiPayAmount = v;
    }

    // Helper to compute days in month
    daysInMonth(year, monthIndex1) {
        return new Date(year, monthIndex1, 0).getDate();
    }

    // Build payment schedule rows
    generatePaymentCalendar() {
        // Determine monthly payment amount (EMI)
        let amount = this.monthlyPayment;
        if (!Number.isFinite(amount)) {
            if (Number.isFinite(this.price) && Number.isFinite(this.interestRate) && Number.isFinite(this.tenure) && this.tenure > 0) {
                const r = (this.interestRate / 100) / MONTHS_IN_YEAR;
                amount = this.calculateEmi(this.price, r, this.tenure * MONTHS_IN_YEAR);
            } else {
                this.payCalMessage = 'Enter price, rate, and term to generate calendar or ensure monthly payment is available.';
                this.payCalRows = [];
                return;
            }
        }

        const start = this.payCalStartDate ? new Date(this.payCalStartDate) : new Date();
        const months = Number.isFinite(this.payCalMonths) ? this.payCalMonths : 12;
        const dueDay = Number.isFinite(this.payCalDueDay) ? this.payCalDueDay : 1;
        const grace = Number.isFinite(this.payCalGraceDays) ? this.payCalGraceDays : 0;
        const lateFlat = Number.isFinite(this.payCalLateFeeFlat) ? this.payCalLateFeeFlat : 0;
        const latePct = Number.isFinite(this.payCalLateFeePct) ? this.payCalLateFeePct : 0;

        const rows = [];
        for (let i = 0; i < months; i++) {
            const y = start.getFullYear();
            const m0 = start.getMonth();
            const date = new Date(y, m0 + i, 1);
            const dim = this.daysInMonth(date.getFullYear(), date.getMonth() + 1);
            const dueDate = new Date(date.getFullYear(), date.getMonth(), Math.min(dueDay, dim));
            const graceDate = new Date(dueDate.getTime());
            graceDate.setDate(graceDate.getDate() + grace);

            // Find payment history for this month
            const hist = this.payCalHistory.find((h) => h.month === (i + 1));
            const paidDate = hist?.paidDate || null;
            const paidAmount = Number.isFinite(hist?.amount) ? hist.amount : null;

            let status = 'Pending';
            let lateFee = 0;
            if (paidDate) {
                if (paidDate > graceDate) {
                    status = 'Paid Late';
                    lateFee = Math.max(lateFlat, amount * (latePct / 100));
                } else {
                    status = 'Paid On Time';
                }
            } else {
                const today = new Date();
                if (today > graceDate) status = 'Late';
            }

            rows.push({
                id: `pm_${i + 1}`,
                month: i + 1,
                dueDate,
                dueDisplay: dueDate.toLocaleDateString(),
                graceDisplay: graceDate.toLocaleDateString(),
                amount,
                paidDisplay: paidDate ? paidDate.toLocaleDateString() : '',
                paidAmount: paidAmount || null,
                lateFee,
                status
            });
        }

        this.payCalRows = rows;
        this.payCalMessage = null;
    }

    // =========================
    // Prepayment Penalty Analyzer
    // =========================
    @track ppAmount = null; // intended prepayment amount
    @track ppPrepayMonth = 1; // months since loan start (1-based)
    @track ppStartDate = null; // ISO, optional for date display
    @track ppPenaltyType = 'percent'; // percent | monthsInterest | tiered
    @track ppPercent = 2.0; // used when type=percent (e.g., 2%)
    @track ppMonthsInterest = 6; // used when type=monthsInterest (e.g., 6 months)
    @track ppPenaltyWindowMonths = 24; // months within which penalty applies (for percent/monthsInterest)
    @track ppTierScheduleText = '12:2;24:1;36:0'; // months:percent;...
    @track ppFreePctAnnual = 20; // % of outstanding allowed each year without penalty
    @track ppWaiverOnSale = true; // waives penalty if sold (owner-occupied rule)
    @track ppIsSale = false; // this prepayment due to sale
    @track ppResults = null;
    @track ppMessage = null;

    handlePpFieldChange(event) {
        const { name } = event.target;
        const raw = event.detail?.value;
        const num = parseFloat(raw);
        const parsed = Number.isFinite(num) ? num : null;
        switch (name) {
            case 'ppAmount': this.ppAmount = parsed; break;
            case 'ppPrepayMonth': this.ppPrepayMonth = Number.isFinite(num) ? Math.max(1, Math.floor(num)) : this.ppPrepayMonth; break;
            case 'ppStartDate': this.ppStartDate = raw || null; break;
            case 'ppPenaltyType': this.ppPenaltyType = raw || this.ppPenaltyType; break;
            case 'ppPercent': this.ppPercent = parsed ?? this.ppPercent; break;
            case 'ppMonthsInterest': this.ppMonthsInterest = Number.isFinite(num) ? Math.max(0, Math.floor(num)) : this.ppMonthsInterest; break;
            case 'ppPenaltyWindowMonths': this.ppPenaltyWindowMonths = Number.isFinite(num) ? Math.max(0, Math.floor(num)) : this.ppPenaltyWindowMonths; break;
            case 'ppTierScheduleText': this.ppTierScheduleText = String(raw ?? ''); break;
            case 'ppFreePctAnnual': this.ppFreePctAnnual = parsed ?? this.ppFreePctAnnual; break;
            default: break;
        }
        this.ppMessage = null;
    }

    handlePpToggleChange(event) {
        const { name } = event.target;
        const checked = !!event.detail.checked;
        if (name === 'ppWaiverOnSale') this.ppWaiverOnSale = checked;
        if (name === 'ppIsSale') this.ppIsSale = checked;
    }

    parseTierSchedule(text) {
        // Format: "months:percent;months:percent;..." e.g., 12:2;24:1;36:0
        const out = [];
        const parts = String(text || '').split(';').map((s) => s.trim()).filter(Boolean);
        for (const p of parts) {
            const [mStr, pctStr] = p.split(':').map((s) => s.trim());
            const m = parseInt(mStr, 10);
            const pct = parseFloat(pctStr);
            if (Number.isFinite(m) && Number.isFinite(pct)) out.push({ months: m, percent: pct });
        }
        // sort ascending by months
        out.sort((a, b) => a.months - b.months);
        return out;
    }

    getOutstandingAtMonth(principal, monthlyRate, totalMonths, monthlyPmt, monthIndex1) {
        const start = new Date();
        const sched = this.buildMonthlySchedule(principal, monthlyRate, totalMonths, monthlyPmt, start, { amount: 0, start: null, frequency: 'none', months: null });
        const idx = Math.min(Math.max(1, monthIndex1), sched.schedule.length) - 1;
        return Math.max(0, sched.schedule[idx]?.balance ?? principal);
    }

    computePrepayPenalty() {
        // Validate base loan context
        if (!Number.isFinite(this.ppAmount) || this.ppAmount <= 0) {
            this.ppMessage = 'Enter a valid prepayment amount.';
            this.ppResults = null;
            return;
        }
        if (!Number.isFinite(this.price) || !Number.isFinite(this.tenure) || this.tenure <= 0) {
            this.ppMessage = 'Enter price and term (tenure) to evaluate prepayment.';
            this.ppResults = null;
            return;
        }

        // Loan math
        const down = Number.isFinite(this.affDownPayment) ? this.affDownPayment : 0;
        const principal0 = Math.max(0, (this.price || 0) - down);
        const totalMonths = this.tenure * MONTHS_IN_YEAR;
        const annualRate = Number.isFinite(this.interestRate) ? this.interestRate : this.getDefaultRateForLoanType(this.loanType);
        const r = (annualRate / 100) / MONTHS_IN_YEAR;
        const emi = this.calculateEmi(principal0, r, totalMonths);

        const m = Number.isFinite(this.ppPrepayMonth) ? Math.max(1, Math.floor(this.ppPrepayMonth)) : 1;
        const outstanding = this.getOutstandingAtMonth(principal0, r, totalMonths, emi, m);

        // Waiver on sale
        if (this.ppWaiverOnSale && this.ppIsSale) {
            const date = this.ppStartDate ? new Date(this.ppStartDate) : new Date();
            const prepayDate = new Date(date.getFullYear(), date.getMonth() + (m - 1), date.getDate());
            this.ppResults = { penalty: 0, waived: true, reason: 'Waived due to sale', prepayDate };
            this.ppMessage = null;
            return;
        }

        // Free allowance per year
        const freePct = Number.isFinite(this.ppFreePctAnnual) ? (this.ppFreePctAnnual / 100) : 0;
        const freeAllowance = outstanding * freePct;
        const prepayEffective = Math.max(0, this.ppAmount - freeAllowance);

        // Base penalty
        let penalty = 0;
        let tierPctUsed = null;
        const withinWindow = !Number.isFinite(this.ppPenaltyWindowMonths) || this.ppPenaltyWindowMonths <= 0 ? true : (m <= this.ppPenaltyWindowMonths);

        if (this.ppPenaltyType === 'percent') {
            if (withinWindow) {
                const pct = Number.isFinite(this.ppPercent) ? (this.ppPercent / 100) : 0;
                penalty = prepayEffective * pct;
            } else {
                penalty = 0;
            }
        } else if (this.ppPenaltyType === 'monthsInterest') {
            if (withinWindow) {
                const months = Number.isFinite(this.ppMonthsInterest) ? this.ppMonthsInterest : 0;
                penalty = prepayEffective * r * months;
            } else {
                penalty = 0;
            }
        } else if (this.ppPenaltyType === 'tiered') {
            const tiers = this.parseTierSchedule(this.ppTierScheduleText);
            let pct = 0;
            for (const t of tiers) {
                if (m <= t.months) { pct = t.percent; break; }
                pct = t.percent; // last tier applies if greater than all
            }
            tierPctUsed = pct;
            penalty = prepayEffective * (pct / 100);
        }

        // Optimal month search (next 36 months)
        let optimalMonth = m;
        let optimalPenalty = penalty;
        for (let k = m; k <= m + 36; k++) {
            let p = 0;
            const withinWin = !Number.isFinite(this.ppPenaltyWindowMonths) || this.ppPenaltyWindowMonths <= 0 ? true : (k <= this.ppPenaltyWindowMonths);
            const outstandingK = this.getOutstandingAtMonth(principal0, r, totalMonths, emi, k);
            const freeK = outstandingK * freePct;
            const eff = Math.max(0, this.ppAmount - freeK);
            if (this.ppPenaltyType === 'percent') {
                p = withinWin ? eff * ((Number.isFinite(this.ppPercent) ? this.ppPercent : 0) / 100) : 0;
            } else if (this.ppPenaltyType === 'monthsInterest') {
                const months = Number.isFinite(this.ppMonthsInterest) ? this.ppMonthsInterest : 0;
                p = withinWin ? eff * r * months : 0;
            } else {
                const tiers = this.parseTierSchedule(this.ppTierScheduleText);
                let pct = 0;
                for (const t of tiers) { if (k <= t.months) { pct = t.percent; break; } pct = t.percent; }
                p = eff * (pct / 100);
            }
            if (p < optimalPenalty) { optimalPenalty = p; optimalMonth = k; }
            if (p === 0) { optimalPenalty = 0; optimalMonth = k; break; }
        }

        const baseDate = this.ppStartDate ? new Date(this.ppStartDate) : new Date();
        const prepayDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + (m - 1), baseDate.getDate());
        const optimalDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + (optimalMonth - 1), baseDate.getDate());

        this.ppResults = {
            penalty,
            waived: false,
            tierPctUsed,
            prepayDate,
            optimalMonth,
            optimalDate,
            optimalPenalty,
            outstandingAtPrepay: outstanding,
            freeAllowance,
            prepayEffective
        };
        this.ppMessage = null;
    }

    // =========================
    // CLTV / HLTV Calculator (multiple liens + lender profiles)
    // =========================
    @track cltvValue = null; // property value
    @track cltvProfile = 'conv80'; // lender profile key
    @track cltvMaxCustom = null; // optional custom max CLTV
    // Lien 1
    @track cltvLien1Position = '1st';
    @track cltvLien1Type = 'closed'; // closed | heloc
    @track cltvLien1Balance = null;
    @track cltvLien1Limit = null; // for HELOC
    @track cltvLien1UseLimit = true; // include limit in HLTV for HELOC
    // Lien 2
    @track cltvLien2Position = '2nd';
    @track cltvLien2Type = 'heloc';
    @track cltvLien2Balance = null;
    @track cltvLien2Limit = null;
    @track cltvLien2UseLimit = true;
    // Lien 3
    @track cltvLien3Position = '3rd';
    @track cltvLien3Type = 'closed';
    @track cltvLien3Balance = null;
    @track cltvLien3Limit = null;
    @track cltvLien3UseLimit = true;
    @track cltvResults = null;
    @track cltvMessage = null;

    get cltvProfileOptions() {
        return [
            { label: 'Conventional (80% CLTV)', value: 'conv80' },
            { label: 'Portfolio (85% CLTV)', value: 'port85' },
            { label: 'HELOC Aggressive (90% HLTV)', value: 'heloc90' },
            { label: 'Custom', value: 'custom' }
        ];
    }

    cltvRequirements(key) {
        switch (key) {
            case 'conv80': return { maxCltv: 80, maxHltv: 80 };
            case 'port85': return { maxCltv: 85, maxHltv: 85 };
            case 'heloc90': return { maxCltv: 90, maxHltv: 90 };
            case 'custom':
            default:
                return { maxCltv: Number.isFinite(this.cltvMaxCustom) ? this.cltvMaxCustom : null, maxHltv: Number.isFinite(this.cltvMaxCustom) ? this.cltvMaxCustom : null };
        }
    }

    handleCltvFieldChange(event) {
        const { name } = event.target;
        const raw = event.detail?.value;
        const num = parseFloat(raw);
        const parsed = Number.isFinite(num) ? num : null;
        switch (name) {
            case 'cltvValue': this.cltvValue = parsed; break;
            case 'cltvProfile': this.cltvProfile = raw || this.cltvProfile; break;
            case 'cltvMaxCustom': this.cltvMaxCustom = parsed; break;
            case 'cltvLien1Position': this.cltvLien1Position = raw || this.cltvLien1Position; break;
            case 'cltvLien1Type': this.cltvLien1Type = raw || this.cltvLien1Type; break;
            case 'cltvLien1Balance': this.cltvLien1Balance = parsed; break;
            case 'cltvLien1Limit': this.cltvLien1Limit = parsed; break;
            case 'cltvLien2Position': this.cltvLien2Position = raw || this.cltvLien2Position; break;
            case 'cltvLien2Type': this.cltvLien2Type = raw || this.cltvLien2Type; break;
            case 'cltvLien2Balance': this.cltvLien2Balance = parsed; break;
            case 'cltvLien2Limit': this.cltvLien2Limit = parsed; break;
            case 'cltvLien3Position': this.cltvLien3Position = raw || this.cltvLien3Position; break;
            case 'cltvLien3Type': this.cltvLien3Type = raw || this.cltvLien3Type; break;
            case 'cltvLien3Balance': this.cltvLien3Balance = parsed; break;
            case 'cltvLien3Limit': this.cltvLien3Limit = parsed; break;
            default: break;
        }
        this.cltvMessage = null;
    }

    handleCltvToggleChange(event) {
        const { name } = event.target;
        const checked = !!event.detail.checked;
        if (name === 'cltvLien1UseLimit') this.cltvLien1UseLimit = checked;
        if (name === 'cltvLien2UseLimit') this.cltvLien2UseLimit = checked;
        if (name === 'cltvLien3UseLimit') this.cltvLien3UseLimit = checked;
    }

    computeCltv() {
        if (!Number.isFinite(this.cltvValue) || this.cltvValue <= 0) {
            this.cltvMessage = 'Enter a valid property value.';
            this.cltvResults = null;
            return;
        }
        const liens = [
            { pos: this.cltvLien1Position, type: this.cltvLien1Type, bal: this.cltvLien1Balance, lim: this.cltvLien1Limit, useLimit: this.cltvLien1UseLimit },
            { pos: this.cltvLien2Position, type: this.cltvLien2Type, bal: this.cltvLien2Balance, lim: this.cltvLien2Limit, useLimit: this.cltvLien2UseLimit },
            { pos: this.cltvLien3Position, type: this.cltvLien3Type, bal: this.cltvLien3Balance, lim: this.cltvLien3Limit, useLimit: this.cltvLien3UseLimit }
        ];
        const value = this.cltvValue;
        let totalBal = 0; // sum of principal balances
        let totalHltvBase = 0; // balances plus HELOC limits when required
        const rows = [];
        liens.forEach((l, idx) => {
            if (!Number.isFinite(l.bal) && !(l.type === 'heloc' && Number.isFinite(l.lim))) return;
            const bal = Number.isFinite(l.bal) ? l.bal : 0;
            const lim = Number.isFinite(l.lim) ? l.lim : 0;
            totalBal += bal;
            totalHltvBase += (l.type === 'heloc' && l.useLimit) ? Math.max(bal, lim) : bal;
            rows.push({ id: `lien_${idx+1}`, position: l.pos, type: l.type, balance: bal, limit: l.type === 'heloc' ? lim : null });
        });

        const cltvPct = value > 0 ? (totalBal / value) * 100 : null;
        const hltvPct = value > 0 ? (totalHltvBase / value) * 100 : null;
        const req = this.cltvRequirements(this.cltvProfile);
        const meetsCltv = req.maxCltv != null ? (cltvPct <= req.maxCltv + 1e-9) : null;
        const meetsHltv = req.maxHltv != null ? (hltvPct <= req.maxHltv + 1e-9) : null;

        this.cltvResults = {
            value,
            totalBalance: totalBal,
            totalHltvBase,
            cltvPct: cltvPct != null ? Math.round(cltvPct * 10) / 10 : null,
            hltvPct: hltvPct != null ? Math.round(hltvPct * 10) / 10 : null,
            meetsCltv,
            meetsHltv,
            requirement: req,
            liens: rows
        };
        this.cltvMessage = null;
    }

    // =========================
    // PMI/MIP Cancellation Tracker
    // =========================
    @track pmiStartDate = null; // ISO loan start date
    @track pmiAsOfDate = null; // ISO today (optional)
    @track pmiCurrentAppraisal = null; // current appraised value (optional)
    @track pmiSeasoningMonths = 24; // months required before request with new appraisal
    @track pmiResults = null;
    @track pmiMessage = null;

    handlePmiFieldChange(event) {
        const { name } = event.target;
        const raw = event.detail?.value;
        const num = parseFloat(raw);
        const parsed = Number.isFinite(num) ? num : null;
        switch (name) {
            case 'pmiStartDate': this.pmiStartDate = raw || null; break;
            case 'pmiAsOfDate': this.pmiAsOfDate = raw || null; break;
            case 'pmiCurrentAppraisal': this.pmiCurrentAppraisal = parsed; break;
            case 'pmiSeasoningMonths': this.pmiSeasoningMonths = Number.isFinite(num) ? Math.max(0, Math.floor(num)) : this.pmiSeasoningMonths; break;
            default: break;
        }
        this.pmiMessage = null;
    }

    monthsBetweenDates(d1, d2) {
        const a = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
        const b = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
        return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    }

    computePmiMipTracker() {
        // Validate base inputs
        if (!Number.isFinite(this.price) || !Number.isFinite(this.tenure) || this.tenure <= 0) {
            this.pmiMessage = 'Enter price and term to evaluate PMI/MIP.';
            this.pmiResults = null;
            return;
        }
        const years = this.tenure;
        const totalMonths = years * MONTHS_IN_YEAR;
        const annualRate = Number.isFinite(this.interestRate) ? this.interestRate : this.getDefaultRateForLoanType(this.loanType);
        const r = (annualRate / 100) / MONTHS_IN_YEAR;
        const down = Number.isFinite(this.affDownPayment) ? this.affDownPayment : 0;
        const origValue = this.price;
        const principal0 = Math.max(0, origValue - down);
        const emi = this.calculateEmi(principal0, r, totalMonths);
        const start = this.pmiStartDate ? new Date(this.pmiStartDate) : new Date();
        const asOf = this.pmiAsOfDate ? new Date(this.pmiAsOfDate) : new Date();

        // Build amortization to read balances
        const sched = this.buildMonthlySchedule(principal0, r, totalMonths, emi, start, { amount: 0, start: null, frequency: 'none', months: null });

        // Find first month where balance/original value <= thresholds
        const threshReq = 0.80 * origValue;
        const threshAuto = 0.78 * origValue;
        let monthReq = null;
        let monthAuto = null;
        for (let i = 0; i < sched.schedule.length; i++) {
            const bal = sched.schedule[i].balance || 0;
            if (monthReq == null && bal <= threshReq) monthReq = i + 1;
            if (monthAuto == null && bal <= threshAuto) { monthAuto = i + 1; break; }
        }

        // Current status
        const monthsElapsed = Math.max(0, Math.min(this.monthsBetweenDates(start, asOf), sched.schedule.length - 1));
        const balNow = sched.schedule[monthsElapsed]?.balance ?? principal0;
        const ltvOrigNow = Math.round(((balNow / origValue) * 1000)) / 10;

        // Current appraisal path (optional): eligibility to request at <=80% of current value with seasoning
        const appraisal = Number.isFinite(this.pmiCurrentAppraisal) ? this.pmiCurrentAppraisal : null;
        const ltvCurrNow = appraisal ? (Math.round(((balNow / appraisal) * 1000)) / 10) : null;
        const seasoningOk = monthsElapsed >= (Number.isFinite(this.pmiSeasoningMonths) ? this.pmiSeasoningMonths : 0);
        const requestEligibleNow = appraisal ? (ltvCurrNow <= 80 && seasoningOk) : (ltvOrigNow <= 80);

        // Dates
        const dateReq = monthReq ? new Date(start.getFullYear(), start.getMonth() + monthReq - 1, start.getDate()) : null;
        const dateAuto = monthAuto ? new Date(start.getFullYear(), start.getMonth() + monthAuto - 1, start.getDate()) : null;

        // FHA MIP rules (simplified): down >= 10% -> cancel after 11 years, else life of loan
        let mipCancels = null;
        let mipCancelDate = null;
        if (this.loanType === 'fha') {
            const downPct = origValue > 0 ? (down / origValue) * 100 : 0;
            if (downPct >= 10) {
                mipCancels = 11 * 12; // months
                mipCancelDate = new Date(start.getFullYear(), start.getMonth() + mipCancels - 1, start.getDate());
            } else {
                mipCancels = null; // life of loan
            }
        }

        this.pmiResults = {
            loanType: this.loanType,
            originalValue: origValue,
            originalBalance: principal0,
            ltvOrigNow,
            ltvCurrNow,
            monthsElapsed,
            requestAt80Month: monthReq,
            autoAt78Month: monthAuto,
            requestAt80Date: dateReq,
            autoAt78Date: dateAuto,
            requestEligibleNow,
            seasoningOk,
            mipCancelsAtMonth: mipCancels,
            mipCancelDate
        };
        this.pmiMessage = null;
    }

    // =========================
    // Loan Process Timeline (milestones + dependencies)
    // =========================
    @track timelineStartDate = null; // ISO date for app start
    @track timelineTargetCloseDate = null; // optional target close
    @track timelineRows = [];
    @track timelineMessage = null;
    // Adjustable durations (calendar days)
    @track tlDurApplication = 1;
    @track tlDurDisclosures = 1;
    @track tlDurAppraisalOrder = 1;
    @track tlDurAppraisal = 7;
    @track tlDurInitialUW = 3;
    @track tlDurConditionsIssue = 1;
    @track tlDurConditionsSubmit = 5;
    @track tlDurFinalUW = 2;
    @track tlDurCD = 3; // 3-day CD waiting period
    @track tlDurClosing = 1;
    @track tlDurFunding = 1;

    handleTimelineFieldChange(event) {
        const { name } = event.target;
        const raw = event.detail?.value;
        const n = parseFloat(raw);
        if (name === 'timelineStartDate') this.timelineStartDate = raw || null;
        if (name === 'timelineTargetCloseDate') this.timelineTargetCloseDate = raw || null;
        const assignInt = (key) => { this[key] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : this[key]; };
        if (name === 'tlDurApplication') assignInt('tlDurApplication');
        if (name === 'tlDurDisclosures') assignInt('tlDurDisclosures');
        if (name === 'tlDurAppraisalOrder') assignInt('tlDurAppraisalOrder');
        if (name === 'tlDurAppraisal') assignInt('tlDurAppraisal');
        if (name === 'tlDurInitialUW') assignInt('tlDurInitialUW');
        if (name === 'tlDurConditionsIssue') assignInt('tlDurConditionsIssue');
        if (name === 'tlDurConditionsSubmit') assignInt('tlDurConditionsSubmit');
        if (name === 'tlDurFinalUW') assignInt('tlDurFinalUW');
        if (name === 'tlDurCD') assignInt('tlDurCD');
        if (name === 'tlDurClosing') assignInt('tlDurClosing');
        if (name === 'tlDurFunding') assignInt('tlDurFunding');
        this.timelineMessage = null;
    }

    get timelineColumns() {
        return [
            { label: 'Milestone', fieldName: 'name' },
            { label: 'Depends On', fieldName: 'dependsOn' },
            { label: 'Start', fieldName: 'startDisplay' },
            { label: 'End', fieldName: 'endDisplay' },
            { label: 'Duration (days)', fieldName: 'duration', type: 'number' },
            { label: 'Status', fieldName: 'status' }
        ];
    }

    timelineDefinition() {
        // Graph with dependencies; keys map to duration fields
        return [
            { key: 'application', name: 'Application', durKey: 'tlDurApplication', deps: [] },
            { key: 'disclosures', name: 'Disclosures', durKey: 'tlDurDisclosures', deps: ['application'] },
            { key: 'appr_order', name: 'Appraisal Ordered', durKey: 'tlDurAppraisalOrder', deps: ['application'] },
            { key: 'appraisal', name: 'Appraisal Completed', durKey: 'tlDurAppraisal', deps: ['appr_order'] },
            { key: 'initial_uw', name: 'Initial Underwriting', durKey: 'tlDurInitialUW', deps: ['disclosures'] },
            { key: 'conds_issue', name: 'Conditions Issued', durKey: 'tlDurConditionsIssue', deps: ['initial_uw'] },
            { key: 'conds_submit', name: 'Conditions Submitted', durKey: 'tlDurConditionsSubmit', deps: ['conds_issue'] },
            { key: 'final_uw', name: 'Final UW / CTC', durKey: 'tlDurFinalUW', deps: ['conds_submit', 'appraisal'] },
            { key: 'cd', name: 'Closing Disclosure (CD)', durKey: 'tlDurCD', deps: ['final_uw'] },
            { key: 'closing', name: 'Closing', durKey: 'tlDurClosing', deps: ['cd'] },
            { key: 'funding', name: 'Funding', durKey: 'tlDurFunding', deps: ['closing'] }
        ];
    }

    addDays(date, days) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        d.setDate(d.getDate() + days);
        return d;
    }

    generateTimeline() {
        const def = this.timelineDefinition();
        const start = this.timelineStartDate ? new Date(this.timelineStartDate) : new Date();
        // compute est dates
        const dateMap = new Map();
        const rows = [];
        for (const node of def) {
            let estStart = start;
            if (node.deps && node.deps.length) {
                for (const dep of node.deps) {
                    const depEnd = dateMap.get(dep)?.end;
                    if (depEnd && depEnd > estStart) estStart = depEnd;
                }
            }
            const duration = Math.max(0, this[node.durKey] || 0);
            const estEnd = this.addDays(estStart, duration);
            dateMap.set(node.key, { start: estStart, end: estEnd });
            rows.push({
                id: node.key,
                name: node.name,
                dependsOn: (node.deps || []).map((k) => def.find((n) => n.key === k)?.name).filter(Boolean).join(', '),
                startDisplay: estStart.toLocaleDateString(),
                endDisplay: estEnd.toLocaleDateString(),
                duration,
                status: 'Not Started'
            });
        }
        // Target close analysis
        if (this.timelineTargetCloseDate) {
            const target = new Date(this.timelineTargetCloseDate);
            const funding = rows.find((r) => r.id === 'funding');
            if (funding) {
                const targetDiff = Math.ceil((target - dateMap.get('funding').end) / (1000*60*60*24));
                // Append a summary row
                rows.push({
                    id: 'summary',
                    name: 'Target Close Delta',
                    dependsOn: '',
                    startDisplay: '',
                    endDisplay: target.toLocaleDateString(),
                    duration: targetDiff,
                    status: targetDiff >= 0 ? 'On Track / Ahead' : 'Behind'
                });
            }
        }
        this.timelineRows = rows;
        this.timelineMessage = null;
    }
    // =========================
    // Construction Loan Calculator
    // =========================
    @track consBudget = null; // total project budget (max line)
    @track consMonths = null; // construction period in months
    @track consRate = null; // annual % interest during construction
    @track consPermRate = null; // permanent loan rate (%)
    @track consPermYears = 30; // amortization term (years)
    @track consConvFees = 0; // conversion/closing fees at perm
    @track consCapitalizeInterest = true; // add interest to principal at conversion
    @track consDrawScheduleText = '';
    @track consRows = [];
    @track consResults = null;
    @track consMessage = null;

    handleConstructionFieldChange(event) {
        const { name } = event.target;
        const raw = event.detail?.value;
        const num = parseFloat(raw);
        const parsed = Number.isFinite(num) ? num : null;
        switch (name) {
            case 'consBudget': this.consBudget = parsed; break;
            case 'consMonths': this.consMonths = Number.isFinite(num) ? Math.max(1, Math.floor(num)) : this.consMonths; break;
            case 'consRate': this.consRate = parsed; break;
            case 'consPermRate': this.consPermRate = parsed; break;
            case 'consPermYears': this.consPermYears = Number.isFinite(num) ? Math.max(1, Math.floor(num)) : this.consPermYears; break;
            case 'consConvFees': this.consConvFees = parsed ?? 0; break;
            case 'consDrawScheduleText': this.consDrawScheduleText = String(raw ?? ''); break;
            default: break;
        }
        this.consMessage = null;
    }

    handleConstructionToggle(event) {
        const { name } = event.target;
        const checked = !!event.detail.checked;
        if (name === 'consCapitalizeInterest') this.consCapitalizeInterest = checked;
    }

    generateEqualDraws() {
        if (!Number.isFinite(this.consBudget) || !Number.isFinite(this.consMonths) || this.consMonths <= 0) {
            this.consMessage = 'Enter total budget and construction months to auto-generate draws.';
            return;
        }
        const per = this.consBudget / this.consMonths;
        const lines = [];
        for (let m = 1; m <= this.consMonths; m++) lines.push(`${m},${Math.round(per * 100) / 100}`);
        this.consDrawScheduleText = lines.join('\n');
        this.consMessage = null;
    }

    parseDrawSchedule() {
        const items = [];
        const text = this.consDrawScheduleText || '';
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        for (const line of lines) {
            // formats accepted: "month,amount" or "month:amount"
            const parts = line.split(/[:|,]/).map((s) => s.trim());
            if (parts.length >= 2) {
                const m = parseInt(parts[0], 10);
                const a = parseFloat(parts[1]);
                if (Number.isFinite(m) && m >= 1 && Number.isFinite(a) && a >= 0) {
                    items.push({ month: m, amount: a });
                }
            }
        }
        return items.sort((a, b) => a.month - b.month);
    }

    computeConstructionLoan() {
        // Validate
        if (!Number.isFinite(this.consBudget) || this.consBudget <= 0 || !Number.isFinite(this.consMonths) || this.consMonths <= 0) {
            this.consMessage = 'Enter a valid total budget and construction months.';
            this.consRows = [];
            this.consResults = null;
            return;
        }
        const rAnn = Number.isFinite(this.consRate) ? this.consRate : (Number.isFinite(this.interestRate) ? this.interestRate : 0);
        const r = (rAnn / 100) / 12;
        const draws = this.parseDrawSchedule();
        if (!draws.length) {
            this.consMessage = 'Provide a draw schedule (month,amount) per line or use Equal Draws.';
            this.consRows = [];
            this.consResults = null;
            return;
        }
        // Build month-by-month schedule up to consMonths
        let balance = 0;
        let cumInterest = 0;
        const rows = [];
        let totalDrawn = 0;
        for (let m = 1; m <= this.consMonths; m++) {
            const draw = draws.filter((d) => d.month === m).reduce((acc, d) => acc + d.amount, 0);
            totalDrawn += draw;
            // approximate interest for month on average balance: previous balance plus half of new draw
            const avgBal = balance + draw / 2;
            const interest = avgBal * r;
            cumInterest += interest;
            const endBal = balance + draw; // interest-only (not reducing principal)
            rows.push({ id: m, month: m, draw, balance: endBal, interest, cumInterest });
            balance = endBal;
        }

        // Conversion to permanent loan
        const capInterest = this.consCapitalizeInterest ? cumInterest : 0;
        const convFees = Number.isFinite(this.consConvFees) ? this.consConvFees : 0;
        const permPrincipal = Math.max(0, totalDrawn + capInterest + convFees);
        const permRate = Number.isFinite(this.consPermRate) ? this.consPermRate : (Number.isFinite(this.interestRate) ? this.interestRate : 0);
        const permYears = Number.isFinite(this.consPermYears) ? this.consPermYears : 30;
        const permR = (permRate / 100) / 12;
        const permN = permYears * 12;
        const permPmt = this.calculateEmi(permPrincipal, permR, permN);

        this.consRows = rows;
        this.consResults = {
            totalDrawn,
            totalConstructionInterest: cumInterest,
            capitalizedInterest: capInterest,
            conversionFees: convFees,
            permanentPrincipal: permPrincipal,
            permanentRate: permRate,
            permanentYears: permYears,
            permanentPayment: permPmt
        };
        this.consMessage = null;
    }

    // =========================
    // =========================
    // Escrow Analysis (tax/insurance reserves and projections)
    // =========================
    @track escrowStartMonth = (new Date().getMonth() + 1);
    @track escrowStartBalance = null;
    @track escrowMonthlyCurrent = null;
    @track escrowCushionMonths = 2;
    @track taxAnnual = null;
    @track taxMonth1 = 1;
    @track taxMonth2 = null;
    @track insuranceAnnual = null;
    @track insuranceMonth = 1;
    @track escrowRows = [];
    @track escrowMessage = null;
    @track escrowSummary = null;

    get monthOptions() {
        return [
            { label: 'January', value: 1 },
            { label: 'February', value: 2 },
            { label: 'March', value: 3 },
            { label: 'April', value: 4 },
            { label: 'May', value: 5 },
            { label: 'June', value: 6 },
            { label: 'July', value: 7 },
            { label: 'August', value: 8 },
            { label: 'September', value: 9 },
            { label: 'October', value: 10 },
            { label: 'November', value: 11 },
            { label: 'December', value: 12 }
        ];
    }

    handleEscrowFieldChange(event) {
        const name = event.target.name;
        const raw = event.detail?.value;
        const num = parseFloat(raw);
        const parsed = Number.isFinite(num) ? num : null;
        switch (name) {
            case 'escrowStartMonth': this.escrowStartMonth = parseInt(raw, 10) || 1; break;
            case 'escrowStartBalance': this.escrowStartBalance = parsed; break;
            case 'escrowMonthlyCurrent': this.escrowMonthlyCurrent = parsed; break;
            case 'escrowCushionMonths': this.escrowCushionMonths = Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 2; break;
            case 'taxAnnual': this.taxAnnual = parsed; break;
            case 'taxMonth1': this.taxMonth1 = parseInt(raw, 10) || null; break;
            case 'taxMonth2': this.taxMonth2 = raw ? (parseInt(raw, 10) || null) : null; break;
            case 'insuranceAnnual': this.insuranceAnnual = parsed; break;
            case 'insuranceMonth': this.insuranceMonth = parseInt(raw, 10) || null; break;
            default: break;
        }
        this.escrowMessage = null;
    }

    get escrowColumns() {
        const code = this.currencyCode;
        return [
            { label: 'Month', fieldName: 'month' },
            { label: 'Beginning', fieldName: 'begin', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Deposit', fieldName: 'deposit', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Disbursement', fieldName: 'disburse', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Ending', fieldName: 'end', type: 'currency', typeAttributes: { currencyCode: code } }
        ];
    }

    computeEscrowAnalysis() {
        if (!Number.isFinite(this.taxAnnual) || this.taxAnnual < 0 || !Number.isFinite(this.insuranceAnnual) || this.insuranceAnnual < 0) {
            this.escrowMessage = 'Enter valid annual Property Tax and Insurance amounts.';
            this.escrowRows = [];
            this.escrowSummary = null;
            return;
        }
        const startBal = Number.isFinite(this.escrowStartBalance) ? this.escrowStartBalance : 0;
        const baseMonthly = (this.taxAnnual + this.insuranceAnnual) / 12;
        const monthlyDeposit = Number.isFinite(this.escrowMonthlyCurrent) ? this.escrowMonthlyCurrent : baseMonthly;
        const startMonth = (Number.isFinite(this.escrowStartMonth) && this.escrowStartMonth >= 1 && this.escrowStartMonth <= 12) ? this.escrowStartMonth : 1;
        const taxMonths = [this.taxMonth1, this.taxMonth2].filter((m) => Number.isFinite(m) && m >= 1 && m <= 12);
        const twoTax = taxMonths.length === 2;
        const taxPerDisb = twoTax ? (this.taxAnnual / 2) : this.taxAnnual;
        const insMonth = this.insuranceMonth;

        let bal = startBal;
        let minBal = Number.POSITIVE_INFINITY;
        const rows = [];
        const monthName = (i) => this.monthOptions[i - 1]?.label || `M${i}`;
        for (let k = 0; k < 12; k++) {
            const monthNum = ((startMonth - 1 + k) % 12) + 1;
            const begin = bal;
            const deposit = monthlyDeposit;
            let disburse = 0;
            if (taxMonths.includes(monthNum)) disburse += taxPerDisb;
            if (insMonth === monthNum) disburse += (this.insuranceAnnual || 0);
            const end = begin + deposit - disburse;
            bal = end;
            if (end < minBal) minBal = end;
            rows.push({ id: k + 1, month: monthName(monthNum), begin, deposit, disburse, end });
        }

        const cushionAmount = (this.taxAnnual + this.insuranceAnnual) * (Math.min(2, this.escrowCushionMonths || 0) / 12);
        const shortage = Math.max(0, cushionAmount - minBal);
        const surplus = Math.max(0, minBal - cushionAmount);
        const recommendedMonthly = baseMonthly + (shortage > 0 ? (shortage / 12) : 0);

        this.escrowRows = rows;
        this.escrowSummary = {
            baseMonthly,
            cushionAmount,
            minBalance: minBal,
            shortage,
            surplus,
            recommendedMonthly
        };
        this.escrowMessage = null;
    }

    resetEscrow() {
        this.escrowStartBalance = null;
        this.escrowMonthlyCurrent = null;
        this.escrowCushionMonths = 2;
        this.taxAnnual = null;
        this.taxMonth1 = 1;
        this.taxMonth2 = null;
        this.insuranceAnnual = null;
        this.insuranceMonth = 1;
        this.escrowRows = [];
        this.escrowSummary = null;
        this.escrowMessage = null;
    }

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
            { label: 'Rent (Net)', fieldName: 'renting', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Buy (Net)', fieldName: 'buying', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Equity', fieldName: 'equity', type: 'currency', typeAttributes: { currencyCode: code } },
            { label: 'Delta (Buy - Rent)', fieldName: 'delta', type: 'currency', typeAttributes: { currencyCode: code } }
        ];
    }

    get rentBuyRows() {
        const horizons = [5, 10, 30];
        return horizons.map((y) => {
            const adv = this.computeAdvancedRentBuy(y);
            return {
                id: `h${y}`,
                horizon: `${y} years`,
                renting: adv?.rentNet ?? null,
                buying: adv?.buyNet ?? null,
                equity: adv?.equity ?? null,
                delta: adv?.delta ?? null
            };
        });
    }

    computeAdvancedRentBuy(years) {
        if (!Number.isFinite(this.price) || !Number.isFinite(this.tenure) || this.tenure <= 0) return null;
        const n = this.tenure * MONTHS_IN_YEAR;
        const r = (Number.isFinite(this.interestRate) ? this.interestRate : this.getDefaultRateForLoanType(this.loanType)) / 100 / 12;
        const down = Number.isFinite(this.affDownPayment) ? this.affDownPayment : 0;
        const principal = Math.max(0, (this.price || 0) - down);
        const emi = this.calculateEmi(principal, r, n);
        const start = new Date();
        const sched = this.buildMonthlySchedule(principal, r, n, emi, start, { amount: 0, start: null, frequency: 'none', months: null });
        const months = Math.min(years * 12, sched.schedule.length);

        let totalInterest = 0;
        for (let i = 0; i < months; i++) totalInterest += (sched.schedule[i].interest || 0);
        const propertyTaxMonthly = Number.isFinite(this.estimatedMonthlyTaxValueA) ? this.estimatedMonthlyTaxValueA : 0;
        const hoa = Number.isFinite(this.hoaMonthly) ? this.hoaMonthly : 0;
        const maintenance = Number.isFinite(this.maintenanceMonthly) ? this.maintenanceMonthly : 0;
        const ins = Number.isFinite(this.insuranceMonthly) ? this.insuranceMonthly : 0;
        const buyCarrying = (propertyTaxMonthly + hoa + maintenance + ins) * months;
        const bracket = Number.isFinite(this.taxBracketPct) ? this.taxBracketPct / 100 : 0;
        const taxBenefit = (totalInterest + propertyTaxMonthly * months) * bracket;
        const oppAnnual = Number.isFinite(this.opportunityAnnualPct) ? (this.opportunityAnnualPct / 100) : 0.04;
        const oppCost = down * (Math.pow(1 + oppAnnual, years) - 1);
        const appr = Number.isFinite(this.appreciationAnnualPct) ? (this.appreciationAnnualPct / 100) : 0.03;
        const valueAtHorizon = (this.price || 0) * Math.pow(1 + appr, years);
        const balanceAtHorizon = sched.schedule[months - 1]?.balance ?? principal;
        const equity = Math.max(0, valueAtHorizon - balanceAtHorizon);
        const buyNet = totalInterest + buyCarrying + oppCost - taxBenefit;

        const rent0 = Number.isFinite(this.currentRent) ? this.currentRent : 0;
        const rentInc = Number.isFinite(this.rentIncrease) ? (this.rentIncrease / 100) : 0;
        let rentTotal = 0;
        let rentMonthly = rent0;
        for (let y = 1; y <= years; y++) { rentTotal += rentMonthly * 12; rentMonthly *= (1 + rentInc); }
        const renterSavings = (hoa + maintenance + ins) * years * 12;
        const rentNet = Math.max(0, rentTotal - renterSavings);
        const delta = buyNet - rentNet;
        return { buyNet, rentNet, delta, equity };
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
