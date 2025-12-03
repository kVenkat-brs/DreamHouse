import { LightningElement, api, track } from 'lwc';
import generateResponse from '@salesforce/apex/ReviewResponseService.generateResponse';
import saveResponse from '@salesforce/apex/ReviewResponseService.saveResponse';

const DEFAULT_TONES = [
    { label: 'Professional', value: 'Professional' },
    { label: 'Friendly Luxury', value: 'Friendly Luxury' },
    { label: 'Concierge', value: 'Concierge' }
];

export default class ReviewResponsePanel extends LightningElement {
    @api reviewId;
    @track suggestion;
    @track loading = false;
    @track error;
    tone = 'Professional';
    includeFollowUp = true;
    hasPosted = false;
    showEditor = false;
    draftText = '';

    get toneOptions() {
        return DEFAULT_TONES;
    }

    get hasSuggestion() {
        return !!this.suggestion;
    }

    handleToneChange(event) {
        this.tone = event.detail.value;
    }

    handleFollowUpChange(event) {
        this.includeFollowUp = event.detail.checked;
    }

    handleDraftChange(event) {
        this.draftText = event.detail.value;
    }

    async generateSuggestion() {
        if (!this.reviewId) {
            return;
        }
        this.loading = true;
        this.error = null;
        try {
            const result = await generateResponse({
                request: {
                    reviewId: this.reviewId,
                    tone: this.tone,
                    includeFollowUp: this.includeFollowUp
                }
            });
            this.suggestion = result;
            this.draftText = result?.draftText || '';
        } catch (err) {
            this.error = err?.body?.message || err?.message || 'Unable to generate response.';
        } finally {
            this.loading = false;
        }
    }

    openEditor() {
        this.showEditor = true;
    }

    closeEditor() {
        this.showEditor = false;
    }

    async publishResponse() {
        if (!this.reviewId || !this.draftText?.trim()) {
            return;
        }
        this.loading = true;
        try {
            await saveResponse({
                reviewId: this.reviewId,
                finalText: this.draftText.trim(),
                tone: this.tone,
                confidence: this.suggestion?.confidence,
                provider: this.suggestion?.provider,
                markAsPosted: true
            });
            this.hasPosted = true;
            this.dispatchEvent(new CustomEvent('responsesent'));
        } catch (err) {
            this.error = err?.body?.message || err?.message || 'Unable to post response.';
        } finally {
            this.loading = false;
            this.showEditor = false;
        }
    }
}
