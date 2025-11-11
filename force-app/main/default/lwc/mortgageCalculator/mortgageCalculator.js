import { LightningElement, track } from 'lwc';

const MONTHS_IN_YEAR = 12;

export default class MortgageCalculator extends LightningElement {
    activeSectionName = 'step1';
    activeSectionNameB = 'step1';
    theme = 'standard'; // standard | dark | pro
    comparisonMode = false;
    // Scenario A (default)
    @track price = null;
    @track interestRate = null; // annual percentage rate
    @track tenure = null; // years
    @track monthlyPayment = null;
    @track validationMessage = null;

    // Scenario B (comparison)
    @track priceB = null;
    @track interestRateB = null; // annual percentage rate
    @track tenureB = null; // years
    @track monthlyPaymentB = null;
    @track validationMessageB = null;

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
        } else {
            this.monthlyPayment = emi;
            this.validationMessage = null;
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
     * Formats the EMI amount based on the detected locale.
     * @param {number} amount - EMI value.
     * @returns {string} Localized currency string.
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: this.detectCurrencyCode()
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
        };
        const resetB = () => {
            this.priceB = null;
            this.interestRateB = null;
            this.tenureB = null;
            this.monthlyPaymentB = null;
            this.validationMessageB = null;
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
