import { LightningElement, api, track } from 'lwc';
import submitDispute from '@salesforce/apex/ReviewDisputeService.submitDispute';
import getMyDisputes from '@salesforce/apex/ReviewDisputeService.getMyDisputes';

export default class PropertyReviewDispute extends LightningElement {
    @api reviewId;
    @track disputes = [];
    showForm = false;
    reason = '';
    evidenceInput = '';

    connectedCallback() {
        this.loadDisputes();
    }

    loadDisputes() {
        getMyDisputes({ reviewId: this.reviewId })
            .then((result) => {
                this.disputes = result || [];
            })
            .catch((error) => {
                // eslint-disable-next-line no-console
                console.error('Failed to load disputes', error);
            });
    }

    toggleForm() {
        this.showForm = !this.showForm;
    }

    handleReasonChange(event) {
        this.reason = event.target.value;
    }

    handleEvidenceChange(event) {
        this.evidenceInput = event.target.value;
    }

    handleSubmit() {
        if (!this.reason.trim()) {
            return;
        }
        const links = (this.evidenceInput || '')
            .split(/[,\s]+/)
            .map((link) => link.trim())
            .filter(Boolean);
        submitDispute({ request: { reviewId: this.reviewId, reason: this.reason, evidenceLinks: links } })
            .then(() => {
                this.showForm = false;
                this.reason = '';
                this.evidenceInput = '';
                this.loadDisputes();
            })
            .catch((error) => {
                // eslint-disable-next-line no-console
                console.error('Dispute submission failed', error);
            });
    }
}
