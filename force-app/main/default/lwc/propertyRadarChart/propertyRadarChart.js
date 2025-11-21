import { LightningElement, api } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import CHARTJS from '@salesforce/resourceUrl/Chartjs';

export default class PropertyRadarChart extends LightningElement {
    @api attributes; // array of { label, ... }
    @api datasets;   // array of { label, data: [], color }

    chart;
    chartInitialized = false;

    renderedCallback() {
        if (this.chartInitialized) {
            return;
        }
        loadScript(this, CHARTJS + '/Chart.min.js')
            .then(() => {
                this.chartInitialized = true;
                this.initChart();
            })
            .catch((error) => {
                console.error('Chart.js failed to load', error);
            });
    }

    @api
    refreshChart(attributes, datasets) {
        this.attributes = attributes;
        this.datasets = datasets;
        if (this.chart) {
            this.chart.data.labels = attributes;
            this.chart.data.datasets = this.normalizeDatasets(datasets);
            this.chart.update();
        }
    }

    handleReset() {
        if (this.chart) {
            this.chart.reset();
        }
    }

    initChart() {
        const ctx = this.template.querySelector('canvas').getContext('2d');
        const config = {
            type: 'radar',
            data: {
                labels: this.attributes || [],
                datasets: this.normalizeDatasets(this.datasets || [])
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${context.raw}`
                        }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        ticks: {
                            backdropColor: 'rgba(255,255,255,0.75)'
                        }
                    }
                }
            }
        };
        this.chart = new window.Chart(ctx, config);
    }

    normalizeDatasets(datasets) {
        return (datasets || []).map((set) => ({
            label: set.label,
            data: set.data,
            fill: true,
            backgroundColor: set.backgroundColor || 'rgba(1,118,211,0.15)',
            borderColor: set.borderColor || '#0176d3',
            pointBackgroundColor: set.pointBackgroundColor || '#0176d3'
        }));
    }
}
