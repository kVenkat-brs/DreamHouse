import { LightningElement, api, wire, track } from 'lwc';
import { subscribe, unsubscribe, MessageContext } from 'lightning/messageService';
import { getRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import savePropertyReview from '@salesforce/apex/PropertyController.savePropertyReview';

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
    selectedPropertyId;
    isSubmitting = false;

    @wire(getRecord, { recordId: '$propertyIdForWire', fields: PROPERTY_FIELDS })
    property;

    @wire(MessageContext)
    setMessageContext(context) {
        this.messageContext = context;
        this.subscribeToSelection();
    }

    connectedCallback() {
        this.selectedPropertyId = this.propertyId || this.recordId || null;
        this.loadReviews();
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
            this.selectedPropertyId = message.propertyId;
            this.loadReviews();
        }
    }

    get propertyName() {
        return this.property?.data?.fields?.Name?.value;
    }

    get propertyIdForWire() {
        return this.selectedPropertyId || this.propertyId || this.recordId || null;
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
        } else if (!this.activePropertyId) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'No property selected',
                    message: 'Pick a property on the map or list before leaving a review.',
                    variant: 'error'
                })
            );
            this.showForm = false;
        }
    }

    handleRatingChange(event) {
        this.draftRating = Number(event.detail.value);
        this.lastTouchedField = 'rating';
    }

    handleTitleChange(event) {
        this.title = event.target.value;
        this.lastTouchedField = 'title';
    }

    handleCommentChange(event) {
        this.comment = event.target.value;
        this.lastTouchedField = 'comment';
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

        const reviewBody = this.title?.trim()
            ? `${this.title.trim()} — ${this.comment.trim()}`
            : this.comment.trim();

        this.isSubmitting = true;

        savePropertyReview({
            propertyId: activePropertyId,
            rating: this.draftRating,
            comment: reviewBody
        })
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Review submitted',
                        message: 'Thank you for sharing your feedback!',
                        variant: 'success'
                    })
                );
                this.showForm = false;
                this.resetDraft();
                this.loadReviews();
            })
            .catch((error) => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Unable to submit review',
                        message: error?.body?.message || error?.message || 'Try again later.',
                        variant: 'error'
                    })
                );
            })
            .finally(() => {
                this.isSubmitting = false;
            });
    }

    cancelForm() {
        this.toggleForm();
        this.resetDraft();
    }

    resetDraft() {
        this.draftRating = 0;
        this.title = '';
        this.comment = '';
    }
}
