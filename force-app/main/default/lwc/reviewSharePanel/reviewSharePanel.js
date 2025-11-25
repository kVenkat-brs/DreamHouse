import { LightningElement, api } from 'lwc';
import generateReport from '@salesforce/apex/ReviewReportService.generateReport';

export default class ReviewSharePanel extends LightningElement {
    @api propertyId;
    reportUrl;

    handleCopy() {
        const link = window.location.href;
        navigator.clipboard.writeText(link)
            .then(() => this.dispatchEvent(new CustomEvent('notify', { detail: 'Link copied to clipboard.' })))
            .catch(() => this.dispatchEvent(new CustomEvent('notify', { detail: 'Copy failed.' })));
    }

    shareTwitter() {
        const url = encodeURIComponent(window.location.href);
        const text = encodeURIComponent('Check out these property reviews!');
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    }

    handleReport() {
        if (!this.propertyId) {
            return;
        }
        generateReport({ propertyId: this.propertyId })
            .then((response) => {
                this.reportUrl = response?.downloadUrl;
            })
            .catch((error) => {
                // eslint-disable-next-line no-console
                console.error('Report error', error);
            });
    }
}
