import { LightningElement, api } from 'lwc';

export default class ShoelaceRating extends LightningElement {
    @api max = 5;
    @api precision = 1;
    @api value = 0;
    @api readOnly = false;

    ratingEl;

    renderedCallback() {
        if (!this.ratingEl) {
            this.createRating();
        }
        this.syncAttributes();
    }

    createRating() {
        this.ratingEl = document.createElement('sl-rating');
        this.ratingEl.classList.add('shoelace-rating');
        this.ratingEl.setAttribute('style', '--symbol-size:1.5rem; --symbol-spacing:0.25rem;');
        this.ratingEl.addEventListener('sl-change', (event) => {
            this.value = event.target.value;
            this.dispatchEvent(
                new CustomEvent('change', {
                    detail: { value: this.value }
                })
            );
        });
        this.template.querySelector('.shoelace-rating-host').appendChild(this.ratingEl);
        this.syncAttributes();
    }

    syncAttributes() {
        if (!this.ratingEl) {
            return;
        }
        this.ratingEl.max = this.max;
        this.ratingEl.precision = this.precision;
        this.ratingEl.value = this.value;
        this.ratingEl.readonly = this.readOnly;
    }
}
