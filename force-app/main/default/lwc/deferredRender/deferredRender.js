import { LightningElement, api } from 'lwc';

const DEFAULT_ROOT_MARGIN = '0px 0px 200px 0px';

export default class DeferredRender extends LightningElement {
    @api threshold = 0;
    @api rootMargin = DEFAULT_ROOT_MARGIN;
    @api alwaysRender = false;
    @api placeholderClass;
    @api placeholderText = 'Loading…';

    hasBeenRendered = false;
    isLoading = true;

    connectedCallback() {
        if (this.alwaysRender) {
            this.hasBeenRendered = true;
            this.isLoading = false;
            return;
        }
        if (!('IntersectionObserver' in window)) {
            this.hasBeenRendered = true;
            this.isLoading = false;
            return;
        }
        this.observer = new IntersectionObserver(this.handleIntersect.bind(this), {
            root: null,
            rootMargin: this.rootMargin,
            threshold: this.threshold
        });
    }

    renderedCallback() {
        if (this.hasBeenRendered || this.alwaysRender) {
            return;
        }
        if (this.observer) {
            this.observer.observe(this.template.host);
        }
    }

    disconnectedCallback() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }

    handleIntersect(entries) {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                this.hasBeenRendered = true;
                this.isLoading = false;
                if (this.observer) {
                    this.observer.disconnect();
                }
            }
        });
    }

    get wrapperClass() {
        const classes = ['deferred-render'];
        if (this.placeholderClass && !this.hasBeenRendered) {
            classes.push(this.placeholderClass);
        }
        return classes.join(' ');
    }
}
