import { LightningElement, api, wire } from 'lwc';
import getReviewTimeline from '@salesforce/apex/PropertyController.getReviewTimeline';

export default class PropertyReviewTimeline extends LightningElement {
    @api recordId;
    ratingFilter = 'all';
    seasonFilter = 'all';
    speed = 3;

    timelineData;
    events = [];
    displayEvents = [];
    animationFrame;
    progress = 0;
    playing = true;

    @wire(getReviewTimeline, { propertyId: '$recordId' })
    wiredTimeline({ data, error }) {
        if (data) {
            this.timelineData = data;
            this.events = data.events || [];
            this.prepareEvents();
            this.renderBars();
            this.startAnimation();
        } else if (error) {
            // eslint-disable-next-line no-console
            console.error('Timeline load error', error);
        }
    }

    disconnectedCallback() {
        cancelAnimationFrame(this.animationFrame);
    }

    get ratingOptions() {
        return [
            { label: 'All Ratings', value: 'all' },
            { label: '5 Stars', value: '5' },
            { label: '4 Stars', value: '4' },
            { label: '3 Stars', value: '3' },
            { label: '2 Stars', value: '2' },
            { label: '1 Star', value: '1' }
        ];
    }

    get seasonOptions() {
        return [
            { label: 'All Seasons', value: 'all' },
            { label: 'Winter', value: 'Winter' },
            { label: 'Spring', value: 'Spring' },
            { label: 'Summer', value: 'Summer' },
            { label: 'Autumn', value: 'Autumn' }
        ];
    }

    get hasData() {
        return (this.timelineData?.buckets || []).length > 0;
    }

    handleRatingFilterChange(event) {
        this.ratingFilter = event.detail.value;
        this.renderBars();
    }

    handleSeasonFilterChange(event) {
        this.seasonFilter = event.detail.value;
        this.renderBars();
    }

    handleSpeedChange(event) {
        this.speed = Number(event.detail.value);
    }

    startAnimation() {
        cancelAnimationFrame(this.animationFrame);
        let last = performance.now();
        const step = (timestamp) => {
            const delta = timestamp - last;
            last = timestamp;
            if (this.playing) {
                this.progress += delta * (this.speed / 2000);
                if (this.progress > 1) {
                    this.progress = 0;
                }
                this.applyAnimation();
            }
            this.animationFrame = requestAnimationFrame(step);
        };
        this.animationFrame = requestAnimationFrame(step);
    }

    prepareEvents() {
        this.displayEvents = (this.events || []).map((evt, index) => ({
            key: `${evt.label}-${index}`,
            label: evt.label,
            date: evt.date ? new Date(evt.date).toLocaleDateString() : 'N/A'
        }));
    }

    get filteredBuckets() {
        return (this.timelineData?.buckets || []).filter((bucket) => {
            const seasonMatch = this.seasonFilter === 'all' || bucket.season === this.seasonFilter;
            if (!seasonMatch) {
                return false;
            }
            if (this.ratingFilter === 'all') {
                return true;
            }
            const index = Number(this.ratingFilter) - 1;
            return index >= 0 && bucket.ratingCounts[index] > 0;
        });
    }

    renderBars() {
        const container = this.template.querySelector('.timeline__bars');
        if (!container) {
            return;
        }
        container.innerHTML = '';
        this.filteredBuckets.forEach((bucket) => {
            const bar = document.createElement('div');
            bar.classList.add('timeline__bar');

            const stack = document.createElement('div');
            stack.classList.add('timeline__bar-stack');

            const total = bucket.ratingCounts.reduce((acc, val) => acc + val, 0);
            const normalized = total === 0 ? bucket.ratingCounts.map(() => 0) : bucket.ratingCounts.map((val) => (val / total) * 100);

            normalized.forEach((percentage, idx) => {
                const segment = document.createElement('div');
                segment.classList.add('timeline__bar-segment');
                segment.style.backgroundColor = this.segmentColor(idx);
                segment.style.height = `${percentage}%`;
                stack.appendChild(segment);
            });

            bar.appendChild(stack);

            const label = document.createElement('div');
            label.classList.add('timeline__bar-label');
            label.textContent = bucket.bucketKey;
            bar.appendChild(label);

            container.appendChild(bar);
        });
    }

    applyAnimation() {
        const bars = this.template.querySelectorAll('.timeline__bar-stack');
        bars.forEach((bar, index) => {
            const segments = bar.querySelectorAll('.timeline__bar-segment');
            const bucket = this.filteredBuckets[index];
            const total = bucket ? bucket.ratingCounts.reduce((acc, val) => acc + val, 0) : 0;
            segments.forEach((segment, segmentIndex) => {
                const count = bucket ? bucket.ratingCounts[segmentIndex] : 0;
                const target = total === 0 ? 0 : (count / total) * 100;
                const phase = (this.progress + segmentIndex * 0.1) % 1;
                const eased = Math.sin(phase * Math.PI);
                segment.style.height = `${target * eased}%`;
            });
        });
    }

    segmentColor(index) {
        const colors = ['#2e8540', '#1b5297', '#FFC300', '#FF7F0E', '#C23934'];
        return colors[index] || '#ccc';
    }
}
