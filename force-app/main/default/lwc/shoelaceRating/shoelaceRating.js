import { LightningElement, api } from 'lwc';

export default class ShoelaceRating extends LightningElement {
    @api max = 5;
    @api precision = 1;
    @api value = 0;
    @api readOnly = false;

    renderedCallback() {
        this.applyValue();
    }

    applyValue() {
        const rating = this.template.querySelector('sl-rating');
        if (!rating) {
            return;
        }
        rating.max = this.max;
        rating.precision = this.precision;
        rating.value = this.value;
        rating.readonly = this.readOnly;
    }

    handleChange(event) {
        this.value = event.target.value;
        this.dispatchEvent(
            new CustomEvent('change', {
                detail: { value: this.value }
            })
        );
    }
}
