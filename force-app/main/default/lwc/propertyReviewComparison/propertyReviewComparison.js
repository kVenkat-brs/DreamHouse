import { LightningElement, api, track } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import compareProperties from '@salesforce/apex/ReviewComparisonService.compareProperties';
import chartJs from '@salesforce/resourceUrl/ChartJs';

export default class PropertyReviewComparison extends LightningElement {
    @api propertyId;
    competitorInput = '';
    @track metrics = [];
    chartInitialized = false;
    ratingChart;
    sentimentChart;

    get hasData() {
        return this.metrics.length > 0;
    }

    handleCompetitorChange(event) {
        this.competitorInput = event.target.value;
    }

    handleCompare() {
        const competitorIds = (this.competitorInput || '')
            .split(/[,\s]+/)
            .map((id) => id.trim())
            .filter(Boolean);
        compareProperties({ request: { propertyId: this.propertyId, competitorIds } })
            .then((response) => {
                this.metrics = response?.metrics || [];
                this.renderCharts();
            })
            .catch((error) => {
                // eslint-disable-next-line no-console
                console.error('Comparison failed', error);
            });
    }

    renderCharts() {
        if (!this.chartInitialized) {
            loadScript(this, chartJs).then(() => {
                this.chartInitialized = true;
                this.renderCharts();
            });
            return;
        }
        this.renderRatingChart();
        this.renderSentimentChart();
    }

    renderRatingChart() {
        const container = this.template.querySelector('.comparison__chart');
        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        const labels = this.metrics.map((metric) => metric.name);
        const data = this.metrics.map((metric) => metric.averageRating);
        if (this.ratingChart) {
            this.ratingChart.destroy();
        }
        // eslint-disable-next-line no-undef
        this.ratingChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Average Rating',
                        data,
                        backgroundColor: '#0176d3'
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5
                    }
                }
            }
        });
    }

    renderSentimentChart() {
        const container = this.template.querySelector('.comparison__chart--sentiment');
        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        const labels = this.metrics.map((metric) => metric.name);
        const datasets = [
            { label: 'Positive', data: this.metrics.map((metric) => metric.sentimentPositive), backgroundColor: '#2e8540' },
            { label: 'Neutral', data: this.metrics.map((metric) => metric.sentimentNeutral), backgroundColor: '#1b5297' },
            { label: 'Negative', data: this.metrics.map((metric) => metric.sentimentNegative), backgroundColor: '#c23934' }
        ];
        if (this.sentimentChart) {
            this.sentimentChart.destroy();
        }
        // eslint-disable-next-line no-undef
        this.sentimentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets
            },
            options: {
                responsive: true,
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true }
                }
            }
        });
    }
}
