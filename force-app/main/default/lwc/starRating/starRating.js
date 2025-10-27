import { LightningElement, api } from 'lwc';

const DEFAULT_MAX = 5;

export default class StarRating extends LightningElement {
    @api max = DEFAULT_MAX;
    @api rating;
    @api readOnly;

    get currentRating() {
        return this.rating || 0;
    }

    get isReadOnly() {
        return this.readOnly === true;
    }

    get stars() {
        const stars = [];
        const current = this.currentRating;
        for (let i = 1; i <= this.max; i += 1) {
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
        if (this.isReadOnly) {
            return;
        }
        const value = Number(event.currentTarget.dataset.value);
        if (this.rating === value) {
            return;
        }
        this.rating = value;
        this.dispatchChange();
    }

    handleFocus(event) {
        if (this.isReadOnly) {
            return;
        }
        const value = Number(event.currentTarget.dataset.value);
        if (value !== this.currentRating) {
            this.rating = value;
        }
    }

    handleKeyDown(event) {
        if (this.isReadOnly) {
            return;
        }
        let newRating = this.currentRating;
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            newRating = Math.min(this.max, this.currentRating + 1);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            newRating = Math.max(1, this.currentRating - 1);
        } else if (event.key === 'Home') {
            newRating = 1;
        } else if (event.key === 'End') {
            newRating = this.max;
        } else {
            return;
        }

        if (newRating !== this.currentRating) {
            this.rating = newRating;
            this.dispatchChange();
        }
        event.preventDefault();
    }

    dispatchChange() {
        this.dispatchEvent(new CustomEvent('change', { detail: this.rating }));
    }
}
