import { LightningElement, track } from 'lwc';

const MONTHS_IN_YEAR = 12;

export default class MortgageCalculator extends LightningElement {
    @track price = null;
    @track interestRate = null; // annual percentage rate
    @track tenure = null; // years
    @track monthlyPayment = null;
    @track formattedPayment = null;
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

    calculatePayment() {
        if (!this.isInputValid()) {
            this.monthlyPayment = null;
            this.formattedPayment = null;
            return;
        }

        const loanAmount = this.price;
        const monthlyRate = (this.interestRate / 100) / MONTHS_IN_YEAR;
        const totalPayments = this.tenure * MONTHS_IN_YEAR;

        const payment = this.calculateEmi(loanAmount, monthlyRate, totalPayments);
        this.monthlyPayment = payment;
        this.formattedPayment = this.formatCurrency(payment);
        this.validationMessage = null;
    }

    /**
     * Calculates the monthly repayment using the standard EMI formula:
     * EMI = [P × R × (1 + R)^N] / [(1 + R)^N – 1]
     * Where P = principal, R = monthly interest rate, N = total number of payments.
     */
    calculateEmi(principal, monthlyRate, totalPayments) {
        if (monthlyRate === 0) {
            return principal / totalPayments;
        }

        const growthFactor = Math.pow(1 + monthlyRate, totalPayments);
        return (principal * monthlyRate * growthFactor) / (growthFactor - 1);
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: this.detectCurrencyCode()
        }).format(amount);
    }

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

    resetCalculator() {
        this.price = null;
        this.interestRate = null;
        this.tenure = null;
        this.monthlyPayment = null;
        this.formattedPayment = null;
        this.validationMessage = null;
    }

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
