import { LightningElement, track } from 'lwc';

const MONTHS_IN_YEAR = 12;

export default class MortgageCalculator extends LightningElement {
    @track price = null;
    @track interestRate = null; // annual percentage rate
    @track tenure = null; // years
    @track monthlyPayment = null;

    handlePriceChange(event) {
        const value = parseFloat(event.detail.value);
        this.price = Number.isFinite(value) && value >= 0 ? value : null;
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
            return;
        }

        const loanAmount = this.price;
        const monthlyRate = (this.interestRate / 100) / MONTHS_IN_YEAR;
        const totalPayments = this.tenure * MONTHS_IN_YEAR;

        const payment = this.calculateEmi(loanAmount, monthlyRate, totalPayments);

        this.monthlyPayment = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(payment);
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

    isInputValid() {
        return (
            Number.isFinite(this.price) && this.price > 0 &&
            Number.isFinite(this.interestRate) && this.interestRate >= 0 &&
            Number.isFinite(this.tenure) && this.tenure > 0
        );
    }
}
