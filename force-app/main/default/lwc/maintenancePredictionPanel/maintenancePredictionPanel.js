import { LightningElement, api, track } from 'lwc';
import analyzeProperty from '@salesforce/apex/MaintenancePredictionService.analyzeProperty';

export default class MaintenancePredictionPanel extends LightningElement {
    @api propertyId;
    @track predictions;
    @track loading = false;
    @track error;
    generateAlerts = true;

    connectedCallback() {
        this.loadPredictions();
    }

    async loadPredictions() {
        if (!this.propertyId) {
            return;
        }
        this.loading = true;
        this.error = null;
        try {
            const results = await analyzeProperty({
                request: {
                    propertyId: this.propertyId,
                    generateAlerts: this.generateAlerts
                }
            });
            this.predictions = results;
        } catch (err) {
            this.error = err?.body?.message || err?.message || 'Unable to load maintenance predictions.';
        } finally {
            this.loading = false;
        }
    }

    handleToggleChange(event) {
        this.generateAlerts = event.detail.checked;
    }
}
