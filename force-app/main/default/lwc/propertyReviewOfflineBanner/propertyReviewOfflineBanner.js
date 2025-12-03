import { LightningElement, api } from 'lwc';

export default class PropertyReviewOfflineBanner extends LightningElement {
    @api status = 'online';
    @api pendingCount = 0;
    @api lastSync;

    get isOffline() {
        return this.status === 'offline';
    }

    get statusLabel() {
        return this.isOffline ? 'Offline Mode' : 'Online';
    }

    get statusHelp() {
        if (this.isOffline) {
            return 'Cached reviews displayed. New submissions will sync automatically when online.';
        }
        return this.lastSync ? `Last synced ${new Date(this.lastSync).toLocaleString()}` : 'Connected';
    }

    get iconName() {
        return this.isOffline ? 'utility:offline' : 'utility:success';
    }
}
