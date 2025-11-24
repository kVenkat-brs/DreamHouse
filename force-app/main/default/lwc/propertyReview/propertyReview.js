/*
 * Component: PropertyReview (LWC)
 *
 * Overview
 * - Displays reviews for the currently selected Property__c and lets users submit new reviews.
 * - Listens to Lightning Message Service (PropertySelected__c) to react to map/list selections.
 * - Loads reviews from Apex (PropertyController.getPropertyReviews) both reactively and imperatively.
 * - Validates inputs, confirms intent, and submits reviews via Apex (savePropertyReview).
 * - Surfaces user feedback with toasts and disables UI while loading/submitting.
 *
 * Key Concepts
 * - activePropertyId: The effective context record Id resolved from selectedPropertyId, @api propertyId, or recordId.
 * - Reactive loading: @wire(getPropertyReviews, { propertyId: '$propertyIdForWire' }) updates the list when context changes.
 * - Imperative loading: loadReviews()/refreshReviews() used after submit or on-demand refresh with explicit toasts.
 * - State flags: isLoading (list fetch in progress), isSubmitting (review save in progress).
 * - UX flow: Toggle form -> validate -> confirm -> submit -> toast -> reset form -> refresh list.
 */
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

// Fields to retrieve via getRecord for the active Property__c context.
// Currently only fetches the property's Name for lightweight UI display
// (e.g., headings or contextual labels). Add more fields here as needed
// and ensure they are referenced safely in the template/JS.
const PROPERTY_FIELDS = ['Property__c.Name'];

export default class PropertyReview extends LightningElement {
    @api propertyId;
    @api recordId;
    @api canSubmit;

    @track reviews = []; // List of review view-model items rendered in the UI
    showForm = false; // Whether the review submission form is visible
    draftRating = 0; // Current star rating selected in the form
    title = ''; // Draft review title entered by the user
    comment = ''; // Draft review comment entered by the user
    subscription; // LMS subscription reference for cleanup
    selectedPropertyId; // Active property context Id for which reviews are shown
    isSubmitting = false; // True while a review submission is in-flight
    isLoading = false; // True while reviews are being fetched from the server

    /**
     * Helper to show toast notifications consistently.
     * @param {string} title - Toast title text.
     * @param {string} message - Body message for the toast.
     * @param {('info'|'success'|'warning'|'error')} [variant='info'] - Toast variant.
     */
    showToast(title, message, variant = 'info') {
        this.dispatchEvent(
            new ShowToastEvent({ title, message, variant })
        );
    }

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
        // Set loading state; reactive wire will populate reviews when ready
        this.isLoading = true;
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

        try {
            this.subscription = subscribe(
                this.messageContext,
                PROPERTY_SELECTED,
                (message) => this.handlePropertySelected(message)
            );
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[PropertyReview] Failed to subscribe to PROPERTY_SELECTED:', e);
            this.showToast(
                'Subscription error',
                `Unable to subscribe to property selection updates: ${e?.message || 'Unknown error'}`,
                'error'
            );
        }
    }

    /**
     * Handles selection notifications and refreshes reviews for the new property.
     * @param {{ propertyId: string }} message - The LMS payload containing a propertyId.
     */
    handlePropertySelected(message) {
        // eslint-disable-next-line no-console
        console.log('[PropertyReview] LMS message received:', JSON.stringify(message));
        if (message?.propertyId) {
            this.selectedPropertyId = message.propertyId;
            // eslint-disable-next-line no-console
            console.log('[PropertyReview] Selected propertyId set to:', this.selectedPropertyId);
            // Reactive wire will reload reviews automatically
            this.isLoading = true;
        } else {
            // eslint-disable-next-line no-console
            console.log('[PropertyReview] LMS message missing propertyId');
        }
    }

    get propertyName() {
        return this.property?.data?.fields?.Name?.value;
    }

    /**
     * Reactive wire that refreshes reviews whenever the active property id changes
     * using the reactive getter `propertyIdForWire`.
     */
    @wire(getPropertyReviews, { propertyId: '$propertyIdForWire' })
    wiredReviews({ data, error }) {
        // eslint-disable-next-line no-console
        console.log('[PropertyReview] @wire getPropertyReviews propertyId:', this.propertyIdForWire);
        if (data) {
            this.reviews = this.transformReviews(data);
        } else if (error) {
            this.reviews = [];
            this.showToast(
                'Unable to load reviews',
                error?.body?.message || error?.message || 'Try again later.',
                'error'
            );
        }
        this.isLoading = false;
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

    transformReviews(records) {
        if (!Array.isArray(records)) {
            return [];
        }
        const total = records.length;
        return records.map((record, index) => this.buildReviewView(record, index, total));
    }

    buildReviewView(record, index, total) {
        const reviewer = this.normalizeReviewerName(record.reviewerName || 'Anonymous');
        const keywords = this.normalizeKeywords(record.keywords);
        const sentimentLabel = record.sentimentLabel || 'Neutral';
        const sentimentScore = this.normalizeScore(record.sentimentScore);
        const qualityScore = this.normalizeScore(record.qualityScore);
        const qualityLabel = record.qualityLabel || 'Basic';
        const qualityFactors = this.normalizeKeywords(record.qualityFactors);
        const fraudRisk = this.normalizeScore(record.fraudRisk);
        const fraudReasons = this.normalizeKeywords(record.fraudReasons);
        const suspicious = Boolean(record.suspicious);

        return {
            id: record.id,
            propertyId: record.propertyId,
            rating: record.rating,
            comment: record.comment,
            reviewer,
            createdDate: record.createdDate,
            title: record.title,
            sentimentLabel,
            sentimentScore,
            sentimentKeywords: keywords,
            sentimentKeywordSummary: keywords.join(', '),
            sentimentClass: this.resolveSentimentClass(sentimentLabel),
            sentimentAssistive: this.formatSentimentAssistive(sentimentLabel, sentimentScore),
            qualityLabel,
            qualityScore,
            qualityScoreDisplay: this.formatQualityScore(qualityScore),
            qualityClass: this.resolveQualityClass(qualityLabel),
            qualityAssistive: this.formatQualityAssistive(qualityLabel, qualityScore),
            qualityFactors,
            qualityFactorsSummary: qualityFactors.join('; '),
            suspicious,
            fraudBadgeClass: this.resolveFraudClass(suspicious, fraudRisk),
            fraudAssistive: this.formatFraudAssistive(suspicious, fraudRisk, fraudReasons),
            fraudReasonSummary: fraudReasons.join('; '),
            hasDivider: index < total - 1,
            dividerKey: `${record.id}-divider`
        };
    }

    normalizeReviewerName(name) {
        if (!name) {
            return 'Anonymous';
        }
        return name
            .split(/\s+/)
            .filter(Boolean)
            .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
            .join(' ');
    }

    normalizeKeywords(rawKeywords) {
        if (!Array.isArray(rawKeywords)) {
            return [];
        }
        const cleaned = rawKeywords
            .filter((keyword) => typeof keyword === 'string' && keyword.trim().length)
            .map((keyword) => keyword.trim());
        return Array.from(new Set(cleaned));
    }

    normalizeScore(score) {
        const numeric = Number(score);
        return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : null;
    }

    resolveSentimentClass(label) {
        const normalized = (label || 'Neutral').toLowerCase();
        const base = 'slds-badge property-review__sentiment';
        if (normalized === 'positive') {
            return `${base} property-review__sentiment--positive`;
        }
        if (normalized === 'negative') {
            return `${base} property-review__sentiment--negative`;
        }
        return `${base} property-review__sentiment--neutral`;
    }

    formatSentimentAssistive(label, score) {
        const normalizedLabel = (label || 'Neutral').toLowerCase();
        if (score === null || score === undefined || Number.isNaN(score)) {
            return `Sentiment ${normalizedLabel}`;
        }
        const formattedScore = score >= 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
        return `Sentiment ${normalizedLabel} (${formattedScore})`;
    }

    resolveQualityClass(label) {
        const normalized = (label || 'Basic').toLowerCase();
        const base = 'slds-badge property-review__quality-badge';
        if (normalized === 'insightful') {
            return `${base} property-review__quality-badge--insightful`;
        }
        if (normalized === 'helpful') {
            return `${base} property-review__quality-badge--helpful`;
        }
        return `${base} property-review__quality-badge--basic`;
    }

    formatQualityScore(score) {
        if (score === null || score === undefined || Number.isNaN(score)) {
            return '—';
        }
        return score.toFixed(2);
    }

    formatQualityAssistive(label, score) {
        const normalizedLabel = label || 'Basic';
        if (score === null || score === undefined || Number.isNaN(score)) {
            return `Quality ${normalizedLabel}`;
        }
        return `Quality ${normalizedLabel} (${score.toFixed(2)})`;
    }

    resolveFraudClass(suspicious, score) {
        const base = 'slds-badge property-review__fraud-badge';
        if (!suspicious) {
            return `${base} property-review__fraud-badge--clear`;
        }
        if (score >= 0.7) {
            return `${base} property-review__fraud-badge--high`;
        }
        return `${base} property-review__fraud-badge--medium`;
    }

    formatFraudAssistive(suspicious, score, reasons) {
        if (!suspicious) {
            return 'Fraud check: clear';
        }
        const formattedScore = score === null || Number.isNaN(score) ? '' : ` (${score.toFixed(2)})`;
        const details = Array.isArray(reasons) && reasons.length ? ` Reasons: ${reasons.join('; ')}` : '';
        return `Flagged as suspicious${formattedScore}.${details}`.trim();
    }

    /**
     * True when there is no selected property context; use to disable the form UI.
     */
    get isReviewFormDisabled() {
        return !this.activePropertyId;
    }

    /**
     * Computed reviews where reviewer names are capitalized for display.
     */
    get formattedReviews() {
        const toTitle = (name) => {
            if (!name) return 'Anonymous';
            return name
                .split(/\s+/)
                .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
                .join(' ');
        };
        return (this.reviews || []).map((r) => ({
            ...r,
            reviewer: toTitle(r.reviewer)
        }));
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
            return Promise.resolve();
        }

        // eslint-disable-next-line no-console
        console.log('[PropertyReview] Loading reviews for propertyId:', activePropertyId);
        return getPropertyReviews({ propertyId: activePropertyId })
            .then((records) => {
                this.reviews = this.transformReviews(records);
                // Notify the user about the result of loading reviews
                if (this.reviewCount === 0) {
                    this.showToast('No reviews found', 'There are no reviews for this property yet.', 'info');
                } else {
                    this.showToast(
                        'Reviews loaded',
                        `${this.reviewCount} review${this.reviewCount === 1 ? '' : 's'} loaded.`,
                        'success'
                    );
                }
            })
            .catch((error) => {
                this.reviews = [];
                this.showToast(
                    'Unable to load reviews',
                    error?.body?.message || error?.message || 'Try again later.',
                    'error'
                );
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    /**
     * Public helper to refresh the review list and surface a success toast when complete.
     */
    refreshReviews() {
        const maybePromise = this.loadReviews();
        if (maybePromise && typeof maybePromise.then === 'function') {
            return maybePromise.then(() => {
                this.showToast('Reviews refreshed', 'Latest reviews loaded.', 'success');
            });
        }
        // Fallback if loadReviews didn't return a promise
        this.showToast('Reviews refreshed', 'Latest reviews loaded.', 'success');
        return Promise.resolve();
    }

    /**
     * Toggles the visibility of the review submission form and resets state when hidden.
     */
    toggleForm() {
        const wasOpen = this.showForm;
        this.showForm = !this.showForm;
        if (!this.showForm) {
            // If the user closes the form mid-entry, clear any draft values
            const hasDraft =
                (this.draftRating && this.draftRating > 0) ||
                (this.title && this.title.trim().length > 0) ||
                (this.comment && this.comment.trim().length > 0);
            if (wasOpen && hasDraft) {
                this.resetDraft();
            }
        } else if (!this.activePropertyId) {
            this.showToast(
                'No property selected',
                'Pick a property on the map or list before leaving a review.',
                'error'
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
        // Guard against rapid double-submission clicks
        if (this.isSubmitting) {
            this.showToast('Please wait', 'A submission is already in progress.', 'warning');
            return;
        }
        const activePropertyId = this.activePropertyId;
        if (!activePropertyId) {
            this.showToast(
                'Missing property context',
                'Select a property before leaving a review.',
                'error'
            );
            return;
        }

        if (!this.draftRating || this.draftRating < 1) {
            this.showToast(
                'Rating required',
                'Please choose a star rating before submitting.',
                'error'
            );
            return;
        }

        if (!this.comment?.trim()) {
            this.showToast(
                'Comment required',
                'Tell us a bit about your experience before submitting.',
                'error'
            );
            return;
        }

        // Ensure the comment has a reasonable minimum length
        const cleanedComment = this.comment.trim();
        if (cleanedComment.length < 10) {
            this.showToast(
                'Comment too short',
                'Please enter at least 10 characters in your review comment.',
                'error'
            );
            return;
        }

        // Lock the UI before opening confirmation to avoid multiple submissions
        this.isSubmitting = true;

        // Ask for user confirmation before submitting the review
        const confirmed = await LightningConfirm.open({
            message: 'Are you sure you want to post this review?',
            label: 'Confirm Review Submission'
        });

        if (!confirmed) {
            this.isSubmitting = false;
            return;
        }

        savePropertyReview({
            propertyId: activePropertyId,
            rating: this.draftRating,
            comment: cleanedComment,
            title: this.title ? this.title.trim() : null
        })
            .then(() => {
                this.showToast('Review submitted', 'Thank you for sharing your feedback!', 'success');
                this.showForm = false;
                this.resetDraft();
                this.loadReviews();
            })
            .catch((error) => {
                this.showToast(
                    'Unable to submit review',
                    error?.body?.message || error?.message || 'Try again later.',
                    'error'
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
        this.lastTouchedField = undefined;
    }

    handleMediaReady(event) {
        // eslint-disable-next-line no-console
        console.log('[PropertyReview] Visual media processed:', event.detail);
    }
}
