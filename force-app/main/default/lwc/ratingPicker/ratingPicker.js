import { LightningElement, api } from 'lwc';

const DEFAULT_MAX = 5;
const DEFAULT_VALUE = 0;

export default class RatingPicker extends LightningElement {
    @api max = DEFAULT_MAX;
    @api value = DEFAULT_VALUE;
    @api readOnly = false;

    get normalizedMax() {
        const parsed = Number(this.max);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX;
    }

    get normalizedValue() {
        const parsed = Number(this.value);
        if (!Number.isFinite(parsed)) {
            return DEFAULT_VALUE;
        }
        return Math.min(Math.max(parsed, 0), this.normalizedMax);
    }

    get displayValue() {
        return this.normalizedValue;
    }

    get tabIndex() {
        return this.readOnly ? -1 : 0;
    }

    get stars() {
        const stars = [];
        const current = this.normalizedValue;
        for (let i = 1; i <= this.normalizedMax; i += 1) {
            const filled = i <= current;
            stars.push({
                value: i,
                className: `rating__star ${filled ? 'rating__star--filled' : ''}`,
                icon: filled ? 'utility:favorite' : 'utility:favorite_outline',
                ariaLabel: `${i} ${i === 1 ? 'star' : 'stars'}`
            });
        }
        return stars;
    }

    handleClick(event) {
        if (this.readOnly) {
            return;
        }
        const value = Number(event.currentTarget.dataset.value);
        this.updateValue(value);
    }

    handleFocus(event) {
        if (this.readOnly) {
            return;
        }
        const value = Number(event.currentTarget.dataset.value);
        if (value !== this.normalizedValue) {
            this.updateValue(value, false);
        }
    }

    handleKeydown(event) {
        if (this.readOnly) {
            return;
        }

        let newValue = this.normalizedValue;
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            newValue = Math.min(this.normalizedMax, newValue + 1);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            newValue = Math.max(1, newValue - 1);
        } else if (event.key === 'Home') {
            newValue = 1;
        } else if (event.key === 'End') {
            newValue = this.normalizedMax;
        } else {
            return;
        }

        event.preventDefault();
        this.updateValue(newValue);
    }

    updateValue(newValue, fireEvent = true) {
        if (newValue === this.normalizedValue) {
            return;
        }
        this.value = newValue;
        if (fireEvent) {
            this.dispatchEvent(
                new CustomEvent('change', {
                    detail: { value: this.value }
                })
            );
        }
    }
}
