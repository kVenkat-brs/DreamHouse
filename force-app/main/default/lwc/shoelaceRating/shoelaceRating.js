import { LightningElement, api } from 'lwc';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';

import SHOELACE_JS from '@salesforce/resourceUrl/shoelace_js';
import SHOELACE_CSS from '@salesforce/resourceUrl/shoelace_css';

export default class ShoelaceRating extends LightningElement {
    @api max = 5;
    @api precision = 1;
    @api value = 0;
    @api readOnly = false;

    ratingEl;
    loadingPromise;

    renderedCallback() {
        if (this.ratingEl) {
            this.syncAttributes();
            return;
        }

        if (!this.loadingPromise) {
            this.loadingPromise = Promise.all([
                loadScript(this, SHOELACE_JS),
                loadStyle(this, SHOELACE_CSS)
            ])
                .then(() => {
                    this.createRating();
                    this.syncAttributes();
                })
                .catch((error) => {
                    // Surface the failure but allow the form to stay usable
                    // eslint-disable-next-line no-console
                    console.error('Failed to load rating control', error);
                });
        }
    }

    createRating() {
        if (this.ratingEl) {
            return;
        }

        const host = this.template.querySelector('.shoelace-rating-host');
        if (!host) {
            return;
        }

        this.ratingEl = document.createElement('sl-rating');
        this.ratingEl.classList.add('shoelace-rating');
        this.ratingEl.style.setProperty('--symbol-size', '1.5rem');
        this.ratingEl.style.setProperty('--symbol-spacing', '0.25rem');
        this.ratingEl.addEventListener('sl-change', (event) => {
            this.value = event.target.value;
            this.dispatchEvent(
                new CustomEvent('change', {
                    detail: { value: this.value }
                })
            );
        });

        host.appendChild(this.ratingEl);
    }

    syncAttributes() {
        if (!this.ratingEl) {
            return;
        }
        this.ratingEl.max = Number(this.max) || 5;
        this.ratingEl.precision = Number(this.precision) || 1;
        this.ratingEl.value = Number(this.value) || 0;
        this.ratingEl.readonly = this.readOnly === true || this.readOnly === 'true';
    }
}
