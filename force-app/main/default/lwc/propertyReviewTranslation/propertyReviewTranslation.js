import { LightningElement, api, track } from 'lwc';
import translateReview from '@salesforce/apex/ReviewTranslationService.translateReview';

export default class PropertyReviewTranslation extends LightningElement {
    @api text;
    targetLanguage = 'en';
    @track translation;

    get languageOptions() {
        return [
            { label: 'English', value: 'en' },
            { label: 'Spanish', value: 'es' },
            { label: 'French', value: 'fr' },
            { label: 'German', value: 'de' },
            { label: 'Japanese', value: 'ja' }
        ];
    }

    handleLanguageChange(event) {
        this.targetLanguage = event.detail.value;
    }

    handleTranslate() {
        translateReview({ text: this.text, targetLanguage: this.targetLanguage })
            .then((response) => {
                this.translation = response;
            })
            .catch((error) => {
                // eslint-disable-next-line no-console
                console.error('Translation failed', error);
            });
    }
}
