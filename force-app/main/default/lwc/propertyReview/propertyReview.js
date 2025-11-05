// Core LWC base class and decorators used for exposing @api props,
// wiring data services, and tracking reactive state.
import { LightningElement, api, wire, track } from 'lwc';
// Lightning Message Service utilities for subscribing/publishing to cross-component events.
import { subscribe, unsubscribe, MessageContext } from 'lightning/messageService';
// UI Record API helper to fetch the related property record metadata.
import { getRecord } from 'lightning/uiRecordApi';
// Toast notifications for success and error feedback.
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
// Modal-style confirmation dialog presented before submitting a review.
import LightningConfirm from 'lightning/confirm';
// Apex method that retrieves existing reviews for the active property.
import getPropertyReviews from '@salesforce/apex/PropertyController.getPropertyReviews';
// Apex method that saves a new review when the form is submitted.
import savePropertyReview from '@salesforce/apex/PropertyController.savePropertyReview';

// Lightning Message Channel that notifies this component when a property is selected elsewhere.
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
    // True while reviews are being loaded from the server
    isLoading = false;

    @wire(getRecord, { recordId: '$propertyIdForWire', fields: PROPERTY_FIELDS })
    property;

    @wire(MessageContext)
    setMessageContext(context) {
        this.messageContext = context;
        this.subscribeToSelection();
    }

    /**
     * Lifecycle hook fired when the component is inserted into the DOM.
     * Initializes the selected property context and loads existing reviews.
     */
    connectedCallback() {
        this.selectedPropertyId = this.propertyId || this.recordId || null;
        this.loadReviews();
        // Debug trace to indicate component initialization lifecycle
        // eslint-disable-next-line no-console
        console.log('[PropertyReview] connectedCallback: component initialized');
    }

    /**
     * Lifecycle hook fired when the component is removed from the DOM.
     * Cleans up the Lightning Message Service subscription.
     */
    disconnectedCallback() {
        if (this.subscription) {
            unsubscribe(this.subscription);
            this.subscription = null;
        }
        // eslint-disable-next-line no-console
        console.log('[PropertyReview] disconnectedCallback: component destroyed');
    }

    /**
     * Subscribes to the PropertySelected message channel so the component reacts
     * whenever a property is chosen elsewhere in the UI.
     */
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

    /**
     * Handles selection notifications and refreshes reviews for the new property.
     * @param {{ propertyId: string }} message - The LMS payload containing a propertyId.
     */
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

    get reviewCount() {
        return this.reviews.length;
    }

    get canSubmitVisible() {
        return this.canSubmit !== false;
    }

    /**
     * Loads the review list for the current property by calling the Apex controller.
     */
    loadReviews() {
        const activePropertyId = this.activePropertyId;
        this.isLoading = true;
        if (!activePropertyId) {
            this.reviews = [];
            this.isLoading = false;
            return;
        }

        getPropertyReviews({ propertyId: activePropertyId })
            .then((records) => {
                const items = records || [];
                this.reviews = items.map((record, index) => ({
                    id: record.id,
                    propertyId: record.propertyId,
                    rating: record.rating,
                    comment: record.comment,
                    reviewer: record.reviewerName || 'Anonymous',
                    createdDate: record.createdDate,
                    title: record.title,
                    hasDivider: index < items.length - 1
                }));
                // Notify the user about the result of loading reviews
                if (this.reviewCount === 0) {
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'No reviews found',
                            message: 'There are no reviews for this property yet.',
                            variant: 'info'
                        })
                    );
                } else {
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Reviews loaded',
                            message: `${this.reviewCount} review${this.reviewCount === 1 ? '' : 's'} loaded.`,
                            variant: 'success'
                        })
                    );
                }
            })
            .catch((error) => {
                this.reviews = [];
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Unable to load reviews',
                        message: error?.body?.message || error?.message || 'Try again later.',
                        variant: 'error'
                    })
                );
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    /**
     * Toggles the visibility of the review submission form and resets state when hidden.
     */
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
        } else {
            this.draftRating = this.draftRating > 0 ? this.draftRating : 3;
        }
    }

    /**
     * Captures updates from the rating picker control.
     * @param {CustomEvent} event - Contains the selected rating in event.detail.value.
     */
    handleRatingChange(event) {
        this.draftRating = Number(event.detail.value);
        this.lastTouchedField = 'rating';
    }

    /**
     * Tracks changes to the free-form comment textarea.
     * @param {Event} event - Standard input event carrying the textarea value.
     */
    handleCommentChange(event) {
        this.comment = event.target.value;
        this.lastTouchedField = 'comment';
    }

    /**
     * Tracks changes to the optional review title input.
     * @param {Event} event - Standard input event carrying the title value.
     */
    handleTitleChange(event) {
        this.title = event.target.value;
        this.lastTouchedField = 'title';
    }

    /**
     * Validates user input and persists the review through Apex.
     * @param {Event} event - Form submit event.
     */
    async handleSubmit(event) {
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

        // Ensure the comment has a reasonable minimum length
        const cleanedComment = this.comment.trim();
        if (cleanedComment.length < 10) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Comment too short',
                    message: 'Please enter at least 10 characters in your review comment.',
                    variant: 'error'
                })
            );
            return;
        }

        // Ask for user confirmation before submitting the review
        const confirmed = await LightningConfirm.open({
            message: 'Are you sure you want to post this review?',
            label: 'Confirm Review Submission'
        });

        if (!confirmed) {
            return;
        }

        this.isSubmitting = true;

        savePropertyReview({
            propertyId: activePropertyId,
            rating: this.draftRating,
            comment: cleanedComment,
            title: this.title ? this.title.trim() : null
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

    /**
     * Cancels form entry and hides the submission UI.
     */
    cancelForm() {
        this.toggleForm();
        this.resetDraft();
    }

    /**
     * Clears any draft inputs so the form starts fresh next time it is opened.
     */
    resetDraft() {
        this.draftRating = 0;
        this.title = '';
        this.comment = '';
    }
}
