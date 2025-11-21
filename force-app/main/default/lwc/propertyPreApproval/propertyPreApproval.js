import { LightningElement, api, track } from 'lwc';
import getPreApprovalOptions from '@salesforce/apex/LenderIntegrationService.getPreApprovalOptions';

export default class PropertyPreApproval extends LightningElement {
    @api recordId;
    @track options;
    loading = false;
    error;

    creditScore = 760;
    annualIncome = 160000;
    downPaymentPercent = 20;
    debtToIncome = 32;

    connectedCallback() {
        this.fetchOptions();
    }

    handleProfileChange(event) {
        const field = event.target.dataset.field;
        this[field] = event.detail.value;
    }

    handleRefresh() {
        this.fetchOptions();
    }

    fetchOptions() {
        this.loading = true;
        const profile = {
            creditScore: Number(this.creditScore),
            annualIncome: Number(this.annualIncome),
            downPaymentPercent: Number(this.downPaymentPercent),
            debtToIncome: Number(this.debtToIncome)
        };
        getPreApprovalOptions({ propertyId: this.recordId, profile })
            .then((result) => {
                this.options = result;
                this.error = undefined;
                this.loading = false;
            })
            .catch((err) => {
                this.error = err;
                this.options = undefined;
                this.loading = false;
            });
    }
}
