import { LightningElement, api } from 'lwc';

export default class PropertyReviewModeration extends LightningElement {
    @api flagged;
    @api reasons;
    @api confidence;
}
