import { LightningElement, api, wire, track } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';

import SHOELACE_JS from '@salesforce/resourceUrl/shoelace_js';
import SHOELACE_CSS from '@salesforce/resourceUrl/shoelace_css';

const PROPERTY_FIELDS = ['Property__c.Name'];

export default class PropertyReview extends LightningElement {
    @api propertyId;
    @api canSubmit;

    @track reviews = [];
    showForm = false;
    draftRating = 0;

    shoelaceInitialized = false;

    @wire(getRecord, { recordId: '$propertyId', fields: PROPERTY_FIELDS })
    property;

    connectedCallback() {
        this.loadReviews();
    }

    renderedCallback() {
        if (this.shoelaceInitialized) {
            return;
        }
        this.shoelaceInitialized = true;
        Promise.all([
            loadScript(this, `${SHOELACE_JS}/shoelace.js`),
            loadStyle(this, `${SHOELACE_CSS}`)
        ]).catch((error) => {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Unable to load rating control',
                    message: error.message,
                    variant: 'error'
                })
            );
        });
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
    }

    handleRatingChange(event) {
        this.draftRating = event.detail.value;
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

        const fields = { ...event.detail.fields };
        fields.Property__c = this.propertyId;
        fields.Rating__c = this.draftRating;

        this.template
            .querySelector('lightning-record-edit-form')
            .submit(fields);
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
