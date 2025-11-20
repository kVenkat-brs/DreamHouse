import { LightningElement, api, track } from 'lwc';

export default class NeighborhoodComparison extends LightningElement {
    @track profiles = [];
    @track activeKey;

    @api
    set data(value) {
        if (!Array.isArray(value)) {
            this.profiles = [];
            this.activeKey = undefined;
            return;
        }
        this.profiles = value.map((profile, index) => ({
            key: profile.label || `profile-${index}`,
            ...profile,
            variant: profile.label === (this.activeKey || value[0]?.label) ? 'brand' : 'neutral'
        }));
        this.activeKey = this.profiles[0]?.key;
    }

    get activeProfile() {
        return this.profiles.find((profile) => profile.key === this.activeKey);
    }

    handleSelect(event) {
        const key = event.target.dataset.key;
        this.activeKey = key;
        this.profiles = this.profiles.map((profile) => ({
            ...profile,
            variant: profile.key === key ? 'brand' : 'neutral'
        }));
    }
}
