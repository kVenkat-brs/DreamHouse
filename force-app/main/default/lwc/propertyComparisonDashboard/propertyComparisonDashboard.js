import { LightningElement, api, wire } from 'lwc';
import getPropertyInsights from '@salesforce/apex/RealEstateService.getPropertyInsights';

export default class PropertyComparisonDashboard extends LightningElement {
    @api recordId;
    loading = true;
    error;
    insights;

    @wire(getPropertyInsights, { propertyId: '$recordId' })
    wiredInsights({ error, data }) {
        if (data) {
            this.insights = data;
            this.error = undefined;
            this.loading = false;
        } else if (error) {
            this.error = error;
            this.insights = undefined;
            this.loading = false;
        }
    }

    get hasInsights() {
        return !!this.insights;
    }

    get snapshotStatus() {
        return this.insights?.snapshot?.status;
    }

    get listPrice() {
        return this.formatCurrency(this.insights?.snapshot?.listPrice);
    }

    get estimatedValue() {
        return this.formatCurrency(this.insights?.snapshot?.estimatedValue);
    }

    get change30d() {
        return this.formatPercent(this.insights?.snapshot?.valueChange30d);
    }

    get change12m() {
        return this.formatPercent(this.insights?.snapshot?.valueChange12m);
    }

    get valuations() {
        return this.insights?.valuations;
    }

    get valuationSummary() {
        if (!this.valuations) {
            return [];
        }
        return [
            { label: 'Zestimate', value: this.formatCurrency(this.valuations.zestimate) },
            { label: 'Redfin Estimate', value: this.formatCurrency(this.valuations.redfinEstimate) },
            { label: 'Custom Value', value: this.formatCurrency(this.valuations.customValue) }
        ];
    }

    get hasRadarData() {
        return this.insights?.lifestyle && this.insights?.lifestyle.categories?.length;
    }

    get radarAttributes() {
        return this.insights?.lifestyle?.categories?.map((cat) => cat.label);
    }

    get radarDatasets() {
        if (!this.hasRadarData) return [];
        return [
            {
                label: 'Lifestyle Fit',
                data: this.insights.lifestyle.categories.map((cat) => cat.score),
                backgroundColor: 'rgba(1, 118, 211, 0.2)',
                borderColor: '#0176d3'
            }
        ];
    }

    get mapLayers() {
        return this.insights?.mapLayers;
    }

    get media() {
        return this.insights?.media;
    }

    get mediaAvailable() {
        const media = this.media;
        if (!media) return false;
        return Object.values(media).some((section) => section?.before && section?.after);
    }

    get tours() {
        return this.insights?.tours;
    }

    get toursAvailable() {
        const tours = this.tours;
        return tours && Object.keys(tours).length > 0;
    }

    get timeline() {
        return this.insights?.timeline;
    }

    get seasonalMetrics() {
        return this.insights?.seasonal?.seasonalMetrics;
    }

    get seasonalRecommendation() {
        return this.insights?.seasonal?.recommendation;
    }

    get mortgageScenarios() {
        return this.insights?.mortgageComparisons;
    }

    get tco() {
        return this.insights?.totalCost;
    }

    get descriptionInsights() {
        return this.insights?.descriptionInsights || {};
    }

    handleReset() {
        const radar = this.template.querySelector('c-property-radar-chart');
        if (radar) {
            radar.refreshChart(this.radarAttributes, this.radarDatasets);
        }
    }

    formatCurrency(value) {
        if (value == null) return '—';
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value);
    }

    formatPercent(value) {
        if (value == null) return '—';
        return Number(value).toFixed(2);
    }
}
