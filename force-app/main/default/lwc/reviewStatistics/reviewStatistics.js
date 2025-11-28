import { LightningElement, api, track } from 'lwc';
import buildStatistics from '@salesforce/apex/ReviewStatisticsService.buildStatistics';

let chartJsInitialized = false;

export default class ReviewStatistics extends LightningElement {
    @api propertyId;
    @api benchmarkIds = [];

    @track distribution = [];
    @track trendPoints = [];
    loading = true;
    error;
    charts;

    renderedCallback() {
        if (chartJsInitialized) {
            return;
        }
        chartJsInitialized = true;
        Promise.all([
            loadScript(this, ChartJs)
        ]).then(() => {
            this.initializeCharts();
        }).catch((error) => {
            this.error = error;
            this.loading = false;
        });
    }
}
