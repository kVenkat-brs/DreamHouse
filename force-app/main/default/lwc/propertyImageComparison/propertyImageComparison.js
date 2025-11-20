import { LightningElement, api, track } from 'lwc';

export default class PropertyImageComparison extends LightningElement {
    @api media; // expected { photos: { before, after }, floorPlans: { before, after }, exterior: { before, after } }
    @track syncedPosition = 50;

    get sections() {
        if (!this.media) return [];
        const out = [];
        if (this.media.photos?.before && this.media.photos?.after) {
            out.push({ key: 'photos', label: 'Photos', before: this.media.photos.before, after: this.media.photos.after });
        }
        if (this.media.floorPlans?.before && this.media.floorPlans?.after) {
            out.push({ key: 'floorplans', label: 'Floor Plans', before: this.media.floorPlans.before, after: this.media.floorPlans.after });
        }
        if (this.media.exterior?.before && this.media.exterior?.after) {
            out.push({ key: 'exterior', label: 'Exterior', before: this.media.exterior.before, after: this.media.exterior.after });
        }
        return out;
    }

    get hasSections() {
        return this.sections.length > 0;
    }

    handleSliderChange(event) {
        this.syncedPosition = Number(event.detail.value);
        this.updateChildren();
    }

    handleChildPosition(event) {
        this.syncedPosition = event.detail.position;
        this.updateChildren(event.target);
    }

    updateChildren(exclude) {
        const sliders = this.template.querySelectorAll('c-image-compare-slider');
        sliders.forEach((slider) => {
            if (exclude && slider === exclude) return;
            slider.setPosition(this.syncedPosition);
        });
    }
}
