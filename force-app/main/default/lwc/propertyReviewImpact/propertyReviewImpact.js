import { LightningElement, api, wire } from 'lwc';
import evaluateImpact from '@salesforce/apex/ReviewImpactService.evaluateImpact';

export default class PropertyReviewImpact extends LightningElement {
    @api propertyId;
    impact;

    @wire(evaluateImpact, { propertyId: '$propertyId' })
    wiredImpact({ data, error }) {
        if (data) {
            this.impact = data;
        } else if (error) {
            // eslint-disable-next-line no-console
            console.error('Impact load error', error);
        }
    }
}
