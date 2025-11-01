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

        let payment;
        if (monthlyRate === 0) {
            payment = loanAmount / totalPayments;
        } else {
            const factor = Math.pow(1 + monthlyRate, totalPayments);
            payment = (loanAmount * monthlyRate * factor) / (factor - 1);
        }

        this.monthlyPayment = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(payment);
    }

    isInputValid() {
        return (
            Number.isFinite(this.price) && this.price > 0 &&
            Number.isFinite(this.interestRate) && this.interestRate >= 0 &&
            Number.isFinite(this.tenure) && this.tenure > 0
        );
    }
}
