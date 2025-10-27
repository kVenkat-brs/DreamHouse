import { LightningElement, api, wire, track } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import PROPERTY_OBJECT from '@salesforce/schema/Property__c';
import PROPERTY_REVIEW_OBJECT from '@salesforce/schema/Property_Review__c';
import PROPERTY_FIELD from '@salesforce/schema/Property_Review__c.Property__c';
import RATING_FIELD from '@salesforce/schema/Property_Review__c.Rating__c';

const FIELDS = [
    'Property__c.Id',
    'Property__c.Name'
];

export default class PropertyReview extends LightningElement {
    @api propertyId;
    @api canSubmit;

    @track reviews = [];
    showForm = false;
    draftRating = 0;

    @wire(getRecord, { recordId: '$propertyId', fields: FIELDS })
    property;

    get propertyName() {
        return this.property?.data?.fields?.Name?.value;
    }

    get hasReviews() {
        return this.reviews.length > 0;
    }

    get canSubmitVisible() {
        return this.canSubmit !== false;
    }

    connectedCallback() {
        this.loadReviews();
    }

    loadReviews() {
        // Placeholder: replace with server call to fetch reviews
        this.reviews = [];
    }

    toggleForm() {
        this.showForm = !this.showForm;
    }

    handleRatingChange(event) {
        this.draftRating = event.detail;
    }

    cancelForm() {
        this.toggleForm();
        this.draftRating = 0;
    }

    handleSuccess() {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Review submitted',
                message: 'Thank you for sharing your feedback!',
                variant: 'success'
            })
        );
        this.toggleForm();
        this.draftRating = 0;
        this.loadReviews();
    }

    handleError(event) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Unable to submit review',
                message: event.detail?.message || 'Try again later.',
                variant: 'error'
            })
        );
    }
}
