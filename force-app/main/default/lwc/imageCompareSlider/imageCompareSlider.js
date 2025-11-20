import { LightningElement, api } from 'lwc';

const KEY_OFFSET = 5; // px movement for keyboard nudges

export default class ImageCompareSlider extends LightningElement {
    @api beforeSrc;
    @api afterSrc;
    @api label = 'Image comparison slider';
    @api position = 50; // percentage

    dragging = false;
    stageElement;

    renderedCallback() {
        if (!this.stageElement) {
            this.stageElement = this.template.querySelector('.compare__stage');
            this.renderImages();
        }
        this.updateMask();
    }

    @api
    setPosition(percent) {
        const value = Math.max(0, Math.min(100, Number(percent)));
        this.position = value;
        this.updateMask();
    }

    renderImages() {
        if (!this.stageElement) return;
        this.stageElement.innerHTML = `
            <div class="compare__image compare__image--before">
                <img src="${this.beforeSrc || ''}" alt="Before view">
            </div>
            <div class="compare__image compare__image--after">
                <img src="${this.afterSrc || ''}" alt="After view">
            </div>
        `;
    }

    updateMask() {
        const after = this.template.querySelector('.compare__image--after');
        if (after) {
            after.style.clipPath = `inset(0 0 0 ${this.position}%)`;
        }
    }

    handleDragStart(event) {
        event.preventDefault();
        this.dragging = true;
        window.addEventListener('mousemove', this.handleDragMove);
        window.addEventListener('mouseup', this.handleDragEnd);
    }

    handleTouchStart(event) {
        this.dragging = true;
        window.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        window.addEventListener('touchend', this.handleTouchEnd);
    }

    handleDragMove = (event) => {
        if (!this.dragging) return;
        this.updateFromClientX(event.clientX);
    };

    handleTouchMove = (event) => {
        if (!this.dragging) return;
        event.preventDefault();
        const touch = event.touches[0];
        this.updateFromClientX(touch.clientX);
    };

    handleDragEnd = () => {
        this.cleanupListeners();
    };

    handleTouchEnd = () => {
        this.cleanupListeners();
    };

    cleanupListeners() {
        this.dragging = false;
        window.removeEventListener('mousemove', this.handleDragMove);
        window.removeEventListener('mouseup', this.handleDragEnd);
        window.removeEventListener('touchmove', this.handleTouchMove);
        window.removeEventListener('touchend', this.handleTouchEnd);
    }

    updateFromClientX(clientX) {
        if (!this.stageElement) return;
        const rect = this.stageElement.getBoundingClientRect();
        const percent = ((clientX - rect.left) / rect.width) * 100;
        const clamped = Math.max(0, Math.min(100, percent));
        this.position = clamped;
        this.updateMask();
        this.dispatchChange();
    }

    handleKeyDown(event) {
        switch (event.key) {
            case 'ArrowLeft':
            case 'ArrowDown':
                this.setPosition(this.position - KEY_OFFSET);
                this.dispatchChange();
                break;
            case 'ArrowRight':
            case 'ArrowUp':
                this.setPosition(this.position + KEY_OFFSET);
                this.dispatchChange();
                break;
            case 'Home':
                this.setPosition(0);
                this.dispatchChange();
                break;
            case 'End':
                this.setPosition(100);
                this.dispatchChange();
                break;
            default:
        }
    }

    get handleStyle() {
        return `left: ${this.position}%`;
    }

    get ariaLabel() {
        return `${this.label} (${Math.round(this.position)} percent)`;
    }

    dispatchChange() {
        this.dispatchEvent(new CustomEvent('positionchange', {
            detail: {
                position: this.position
            }
        }));
    }
}
