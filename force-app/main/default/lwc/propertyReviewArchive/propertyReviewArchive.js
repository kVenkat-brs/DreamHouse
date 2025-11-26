import { LightningElement, track, api } from 'lwc';
import searchArchives from '@salesforce/apex/ReviewArchiveService.searchArchives';

export default class PropertyReviewArchive extends LightningElement {
    @api propertyId;
    query = '';
    @track archives = [];

    connectedCallback() {
        this.handleSearch();
    }

    handleQueryChange(event) {
        this.query = event.target.value;
    }

    handleSearch() {
        searchArchives({ queryText: this.query })
            .then((data) => {
                this.archives = data || [];
            })
            .catch((error) => {
                // eslint-disable-next-line no-console
                console.error('Archive search failed', error);
            });
    }
}
