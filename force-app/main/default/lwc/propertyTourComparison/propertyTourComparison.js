import { LightningElement, api, track } from 'lwc';

const PAGE_SIZE = 2;

export default class PropertyTourComparison extends LightningElement {
    @track tours = [];
    @track index = 0;

    @api
    set tourMap(value) {
        if (!value) {
            this.tours = [];
            return;
        }
        const arr = Object.keys(value).map((key) => ({ key, ...value[key] }));
        this.tours = arr;
        this.index = 0;
    }

    get visibleTours() {
        return this.tours.slice(this.index, this.index + PAGE_SIZE);
    }

    get isPrevDisabled() {
        return this.index <= 0;
    }

    get isNextDisabled() {
        return this.index + PAGE_SIZE >= this.tours.length;
    }

    handlePrev() {
        if (!this.isPrevDisabled) {
            this.index = Math.max(0, this.index - PAGE_SIZE);
        }
    }

    handleNext() {
        if (!this.isNextDisabled) {
            this.index = Math.min(this.tours.length - PAGE_SIZE, this.index + PAGE_SIZE);
        }
    }
}
