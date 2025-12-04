import { LightningElement, api, track } from 'lwc';
import translateReview from '@salesforce/apex/ReviewTranslationService.translateReview';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import translationSectionLabel from '@salesforce/label/c.ReviewTranslationSectionAria';
import translateToLabel from '@salesforce/label/c.ReviewTranslationTranslateTo';
import translateButtonLabel from '@salesforce/label/c.ReviewTranslationActionTranslate';
import translationHeadingLabel from '@salesforce/label/c.ReviewTranslationTranslationLabel';
import sentimentLabel from '@salesforce/label/c.ReviewTranslationSentimentLabel';
import confidenceLabel from '@salesforce/label/c.ReviewTranslationConfidenceLabel';
import culturalHeadingLabel from '@salesforce/label/c.ReviewTranslationCulturalHeading';
import toneHeadingLabel from '@salesforce/label/c.ReviewTranslationToneHeading';
import translatingAltText from '@salesforce/label/c.ReviewTranslationSpinnerAltText';
import translationErrorTitle from '@salesforce/label/c.ReviewTranslationErrorTitle';
import translationErrorMessage from '@salesforce/label/c.ReviewTranslationErrorMessage';
import { eventHandler } from 'c/utilsDecorators';

export default class PropertyReviewTranslation extends LightningElement {
    @api text;
    @track translation;
    targetLanguage = 'en';
    isTranslating = false;

    labels = {
        translationSectionLabel,
        translateToLabel,
        translateButtonLabel,
        translationHeadingLabel,
        sentimentLabel,
        confidenceLabel,
        culturalHeadingLabel,
        toneHeadingLabel,
        translatingAltText,
        errorToastTitle: translationErrorTitle,
        errorToastMessage: translationErrorMessage
    };

    get languageOptions() {
        return [
            { label: 'English', value: 'en' },
            { label: 'Spanish', value: 'es' },
            { label: 'French', value: 'fr' },
            { label: 'German', value: 'de' },
            { label: 'Japanese', value: 'ja' }
        ];
    }

    @eventHandler
    handleLanguageChange(event) {
        this.targetLanguage = event.detail.value;
    }

    @eventHandler
    handleTranslate() {
        this.translate();
    }

    translate() {
        if (!this.text) {
            return;
        }
        this.isTranslating = true;
        translateReview({ text: this.text, targetLanguage: this.targetLanguage })
            .then((response) => {
                this.translation = response;
            })
            .catch((error) => {
                // eslint-disable-next-line no-console
                console.error('Translation failed', error);
                this.dispatchToast(
                    this.labels.errorToastTitle,
                    this.extractErrorMessage(error),
                    'error'
                );
            })
            .finally(() => {
                this.isTranslating = false;
            });
    }

    get culturalNotes() {
        const notes = this.translation?.culturalAdjustments || [];
        return notes.map((note, index) => ({ key: `cultural-${index}`, value: note }));
    }

    get toneNotes() {
        const notes = this.translation?.toneAdjustments || [];
        return notes.map((note, index) => ({ key: `tone-${index}`, value: note }));
    }

    @eventHandler
    handleTranslationError(event) {
        const message = event?.detail?.message || this.labels.errorToastMessage;
        this.dispatchToast(this.labels.errorToastTitle, message, 'error');
    }

    extractErrorMessage(error) {
        if (!error) {
            return this.labels.errorToastMessage;
        }

        if (Array.isArray(error.body) && error.body.length) {
            return error.body[0]?.message || this.labels.errorToastMessage;
        }

        if (typeof error.body?.message === 'string') {
            return error.body.message;
        }

        if (typeof error.message === 'string') {
            return error.message;
        }

        return this.labels.errorToastMessage;
    }

    dispatchToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
}
