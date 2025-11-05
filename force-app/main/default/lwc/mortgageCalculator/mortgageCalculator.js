import { LightningElement, track } from 'lwc';

const MONTHS_IN_YEAR = 12;

export default class MortgageCalculator extends LightningElement {
    @track price = null;
    @track interestRate = null; // annual percentage rate
    @track tenure = null; // years
    @track monthlyPayment = null;
    @track validationMessage = null;

    handlePriceChange(event) {
        const value = parseFloat(event.detail.value);
        this.price = Number.isFinite(value) && value > 0 ? value : null;
    }

    handleRateChange(event) {
        const value = parseFloat(event.detail.value);
        this.interestRate = Number.isFinite(value) && value >= 0 ? value : null;
    }

    handleTenureChange(event) {
        const value = parseFloat(event.detail.value);
        this.tenure = Number.isFinite(value) && value > 0 ? value : null;
    }

    get formattedPayment() {
        if (!Number.isFinite(this.monthlyPayment)) {
            return null;
        }

        return this.formatCurrency(this.monthlyPayment);
    }

    /**
     * Calculates the monthly mortgage payment when the user clicks Calculate.
     */
    calculatePayment() {
        if (!this.isInputValid()) {
            this.monthlyPayment = null;
            return;
        }

        const loanAmount = this.price;
        const monthlyRate = (this.interestRate / 100) / MONTHS_IN_YEAR;
        const totalPayments = this.tenure * MONTHS_IN_YEAR;

        this.monthlyPayment = this.calculateEmi(loanAmount, monthlyRate, totalPayments);
        this.validationMessage = null;
        // eslint-disable-next-line no-console
        console.log('[MortgageCalculator] Payment calculated');
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
    resetCalculator() {
        this.price = null;
        this.interestRate = null;
        this.tenure = null;
        this.monthlyPayment = null;
        this.validationMessage = null;
        // eslint-disable-next-line no-console
        console.log('[MortgageCalculator] Calculator reset');
    }

    /**
     * Validates calculator inputs before calculating EMI.
     * @returns {boolean} true when inputs are valid.
     */
    isInputValid() {
        if (!Number.isFinite(this.price) || this.price <= 0) {
            this.validationMessage = 'Enter a valid property price greater than zero.';
            return false;
        }

        if (!Number.isFinite(this.interestRate) || this.interestRate < 0) {
            this.validationMessage = 'Enter a valid annual interest rate (zero or positive).';
            return false;
        }

        if (!Number.isFinite(this.tenure) || this.tenure <= 0) {
            this.validationMessage = 'Enter a valid loan tenure in years (greater than zero).';
            return false;
        }

        this.validationMessage = null;
        return true;
    }
}
