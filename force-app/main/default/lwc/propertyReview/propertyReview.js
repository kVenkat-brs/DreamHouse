import { LightningElement, api, wire, track } from 'lwc';
import { subscribe, unsubscribe, MessageContext } from 'lightning/messageService';
import { getRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import PROPERTY_SELECTED from '@salesforce/messageChannel/PropertySelected__c';

const PROPERTY_FIELDS = ['Property__c.Name'];

export default class PropertyReview extends LightningElement {
    @api propertyId;
    @api recordId;
    @api canSubmit;

    @track reviews = [];
    showForm = false;
    draftRating = 0;
    title = '';
    comment = '';
    subscription;

    @wire(getRecord, { recordId: '$propertyIdForWire', fields: PROPERTY_FIELDS })
    property;

    @wire(MessageContext)
    messageContext;

    connectedCallback() {
        this.loadReviews();
        this.subscribeToSelection();
    }

    disconnectedCallback() {
        if (this.subscription) {
            unsubscribe(this.subscription);
            this.subscription = null;
        }
    }

    subscribeToSelection() {
        if (this.subscription || !this.messageContext) {
            return;
        }

        this.subscription = subscribe(
            this.messageContext,
            PROPERTY_SELECTED,
            (message) => this.handlePropertySelected(message)
        );
    }

    handlePropertySelected(message) {
        if (message?.propertyId) {
            this.propertyId = message.propertyId;
            this.loadReviews();
        }
    }

    get propertyName() {
        return this.property?.data?.fields?.Name?.value;
    }

    get propertyIdForWire() {
        return this.propertyId || this.recordId || null;
    }

    get activePropertyId() {
        return this.propertyIdForWire;
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
        const activePropertyId = this.activePropertyId;
        if (!activePropertyId) {
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
        fields.Property__c = activePropertyId;
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
