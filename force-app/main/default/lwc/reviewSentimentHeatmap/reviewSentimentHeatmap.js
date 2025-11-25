import { LightningElement, api, track, wire } from 'lwc';
import buildHeatmap from '@salesforce/apex/ReviewHeatmapService.buildHeatmap';

export default class ReviewSentimentHeatmap extends LightningElement {
    @api propertyId;
    grouping = 'city';
    @track buckets = [];

    get groupingOptions() {
        return [
            { label: 'City', value: 'city' },
            { label: 'Neighborhood', value: 'neighborhood' },
            { label: 'Property Type', value: 'propertyType' }
        ];
    }

    get mapMarkers() {
        return this.buckets
            .filter((bucket) => bucket.latitude && bucket.longitude)
            .map((bucket) => ({
                location: {
                    Latitude: bucket.latitude,
                    Longitude: bucket.longitude
                },
                title: bucket.label,
                description: `Avg Rating: ${bucket.averageRating}\nPositive: ${bucket.positive}\nNegative: ${bucket.negative}`,
                icon: this.markerIcon(bucket)
            }));
    }

    markerIcon(bucket) {
        if (bucket.positive >= bucket.negative) {
            return 'utility:like';
        }
        return 'utility:dislike';
    }

    @wire(buildHeatmap, { request: '$requestParams' })
    wiredHeatmap({ data, error }) {
        if (data) {
            this.buckets = data.buckets || [];
        } else if (error) {
            // eslint-disable-next-line no-console
            console.error('Heatmap load error', error);
        }
    }

    get requestParams() {
        return { grouping: this.grouping, propertyId: this.propertyId };
    }

    handleGroupingChange(event) {
        this.grouping = event.detail.value;
    }

    handleRefresh() {
        // Lightning wire handles reactive changes via grouping & propertyId
    }
}
