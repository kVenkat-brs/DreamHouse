import { LightningElement, track, api } from 'lwc';
import getRecommendations from '@salesforce/apex/RecommendationService.getRecommendations';
import { formatCurrency } from 'c/realEstateUiUtils';

export default class PropertyRecommender extends LightningElement {
    @track prefs = {
        maxPrice: 1000000,
        minBeds: 3,
        minBaths: 2,
        city: '',
        tags: ''
    };
    @track items = [];
    @track isLoading = false;
    @track error;

    @api limitSize = 9;

    connectedCallback() {
        this.loadRecommendations();
    }

    handlePrefChange(event) {
        const { name, value } = event.target;
        this.prefs = { ...this.prefs, [name]: value };
    }

    async loadRecommendations() {
        this.isLoading = true;
        this.error = null;
        try {
            const result = await getRecommendations({ prefs: this.prefs, limitSize: this.limitSize });
            this.items = (result || []).map((item) => ({
                ...item,
                priceDisplay: formatCurrency(item.price),
                scoreDisplay: Math.round((item.score || 0) * 100)
            }));
        } catch (err) {
            this.error = this.normalizeError(err);
            this.items = [];
        } finally {
            this.isLoading = false;
        }
    }

    refresh() {
        this.loadRecommendations();
    }

    normalizeError(error) {
        if (!error) return 'Unknown error';
        if (typeof error === 'string') return error;
        if (error.body && error.body.message) return error.body.message;
        if (error.message) return error.message;
        return JSON.stringify(error);
    }
}
