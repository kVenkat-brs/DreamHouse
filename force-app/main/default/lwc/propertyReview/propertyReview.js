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
    title = '';
    comment = '';

    @wire(getRecord, { recordId: '$propertyId', fields: PROPERTY_FIELDS })
    property;

    connectedCallback() {
        this.loadReviews();
    }

    get propertyName() {
        return this.property?.data?.fields?.Name?.value;
    }

    get hasReviews() {
        return this.reviews.length > 0;
    }

    get canSubmitVisible() {
        return this.canSubmit !== false;
    }

    loadReviews() {
        // Placeholder: replace with server call to fetch reviews
        this.reviews = [];
    }

    toggleForm() {
        this.showForm = !this.showForm;
        if (!this.showForm) {
            this.resetDraft();
        }
    }

    handleRatingChange(event) {
        this.draftRating = Number(event.detail.value);
    }

    handleTitleChange(event) {
        this.title = event.target.value;
    }

    handleCommentChange(event) {
        this.comment = event.target.value;
    }

    handleSubmit(event) {
        event.preventDefault();
        if (!this.propertyId) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Missing property context',
                    message: 'Select a property before leaving a review.',
                    variant: 'error'
                })
            );
            return;
        }

        if (!this.draftRating || this.draftRating < 1) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Rating required',
                    message: 'Please choose a star rating before submitting.',
                    variant: 'error'
                })
            );
            return;
        }

        if (!this.title?.trim()) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Title required',
                    message: 'Please provide a short title for your review.',
                    variant: 'error'
                })
            );
            return;
        }

        if (!this.comment?.trim()) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Comment required',
                    message: 'Tell us a bit about your experience before submitting.',
                    variant: 'error'
                })
            );
            return;
        }

        const fields = { ...event.detail.fields };
        fields.Property__c = this.propertyId;
        fields.Rating__c = this.draftRating;
        fields.Title__c = this.title;
        fields.Comment__c = this.comment;

        this.template
            .querySelector('lightning-record-edit-form')
            .submit(fields);
    }

    cancelForm() {
        this.toggleForm();
        this.resetDraft();
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
        this.resetDraft();
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

    resetDraft() {
        this.draftRating = 0;
        this.title = '';
        this.comment = '';
    }
}
