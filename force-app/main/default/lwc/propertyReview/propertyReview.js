import { LightningElement, api, wire, track } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const PROPERTY_FIELDS = ['Property__c.Name'];

export default class PropertyReview extends LightningElement {
    @api propertyId;
    @api canSubmit;

    @track reviews = [];
    showForm = false;
    draftRating = 0;

    @wire(getRecord, { recordId: '$propertyId', fields: PROPERTY_FIELDS })
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
        this.syncRatingField();
    }

    syncRatingField() {
        const ratingField = this.template.querySelector('lightning-input-field[data-field="rating"]');
        if (ratingField) {
            ratingField.value = this.draftRating;
        }
    }

    cancelForm() {
        this.toggleForm();
        this.draftRating = 0;
        this.syncRatingField();
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

    renderedCallback() {
        this.syncRatingField();
    }
}
