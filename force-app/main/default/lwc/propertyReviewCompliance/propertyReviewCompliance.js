import { LightningElement, api } from 'lwc';

export default class PropertyReviewCompliance extends LightningElement {
    @api compliant;
    @api violations;
    @api confidence;
}
