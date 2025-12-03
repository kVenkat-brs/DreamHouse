import { LightningElement, api, track } from 'lwc';
import getTimeline from '@salesforce/apex/SentimentEvolutionService.getTimeline';

export default class SentimentEvolutionTimeline extends LightningElement {
    @api propertyId;
    @track timeline;
    @track loading = false;
    @track error;
    range = 26;

    connectedCallback() {
        this.loadTimeline();
    }

    handleRangeChange(event) {
        this.range = Number(event.detail.value);
        this.loadTimeline();
    }

    async loadTimeline() {
        if (!this.propertyId) {
            return;
        }
        this.loading = true;
        this.error = null;
        try {
            const data = await getTimeline({ propertyId: this.propertyId, weeksBack: this.range });
            this.timeline = data;
            this.renderChart();
        } catch (err) {
            this.error = err?.body?.message || err?.message || 'Unable to load sentiment timeline.';
        } finally {
            this.loading = false;
        }
    }

    renderChart() {
        const container = this.template.querySelector('canvas');
        if (!container || !this.timeline) {
            return;
        }
        const ctx = container.getContext('2d');
        const labels = (this.timeline.points || []).map((point) => point.periodStart);
        const scores = (this.timeline.points || []).map((point) => point.averageSentiment);
        const rolling = (this.timeline.points || []).map((point) => point.rollingAverageSentiment);

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }
        this.chartInstance = new window.Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Average Sentiment',
                        data: scores,
                        borderColor: '#0176d3',
                        fill: false
                    },
                    {
                        label: 'Rolling Average',
                        data: rolling,
                        borderColor: '#45a755',
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        suggestedMin: -1,
                        suggestedMax: 1
                    }
                }
            }
        });
    }
}
