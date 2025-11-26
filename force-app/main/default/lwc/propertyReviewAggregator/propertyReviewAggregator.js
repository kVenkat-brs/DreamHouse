import { LightningElement, api, wire, track } from 'lwc';
import aggregate from '@salesforce/apex/ReviewAggregationService.aggregate';

export default class PropertyReviewAggregator extends LightningElement {
    @api propertyId;
    blendedRating;
    @track reviews = [];

    @wire(aggregate, { propertyId: '$propertyId' })
    wiredAggregate({ data, error }) {
        if (data) {
            this.blendedRating = data.blendedRating;
            this.reviews = (data.reviews || []).map((review) => ({
                ...review,
                key: `${review.source}-${review.date}`
            }));
        } else if (error) {
            // eslint-disable-next-line no-console
            console.error('Aggregation failed', error);
        }
    }
}
