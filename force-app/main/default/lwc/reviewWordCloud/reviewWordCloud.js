import { LightningElement, api, track, wire } from 'lwc';
import buildWordCloud from '@salesforce/apex/ReviewWordCloudService.buildWordCloud';

const SIZE_SCALE = {
    min: 12,
    max: 46
};

export default class ReviewWordCloud extends LightningElement {
    @api propertyId;

    @track words = [];
    @track selectedWord;
    loading = true;
    error;
    windowValue = '90';

    get windowOptions() {
        return [
            { label: '30 days', value: '30' },
            { label: '90 days', value: '90' },
            { label: '180 days', value: '180' },
            { label: '1 year', value: '365' }
        ];
    }

    @wire(buildWordCloud, { propertyId: '$propertyId', daysWindow: '$windowValueNumber' })
    wiredWordCloud({ error, data }) {
        this.loading = false;
        if (data) {
            this.words = data;
            this.error = undefined;
            this.selectedWord = undefined;
        } else if (error) {
            this.words = [];
            this.error = error;
        }
    }

    get windowValueNumber() {
        const parsed = parseInt(this.windowValue, 10);
        return Number.isNaN(parsed) ? 90 : parsed;
    }

    get hasWords() {
        return (this.words || []).length > 0;
    }

    get wordNodes() {
        if (!this.hasWords) {
            return [];
        }
        const counts = this.words.map((w) => w.totalCount || 0);
        const minCount = Math.min(...counts);
        const maxCount = Math.max(...counts);
        return this.words.map((word) => {
            const size = this.computeSize(word.totalCount, minCount, maxCount);
            const color = this.computeColor(word.sentimentScore);
            const opacity = this.computeOpacity(word.recentShare);
            const highlight = this.computeHighlight(word.trendDelta);
            return {
                term: word.term,
                className: `review-word-cloud__word ${highlight}`,
                styleAttribute: `font-size:${size}px;color:${color};opacity:${opacity};`,
                tooltip: this.buildTooltip(word)
            };
        });
    }

    get noData() {
        return !this.loading && !this.hasWords && !this.error;
    }

    handleWindowChange(event) {
        this.windowValue = event.detail.value;
        this.loading = true;
    }

    handleRefresh() {
        // Re-trigger wire by toggling window value momentarily
        const current = this.windowValue;
        this.windowValue = current === '90' ? '89' : '90';
        // queue microtask to restore original selection
        Promise.resolve().then(() => {
            this.windowValue = current;
        });
        this.loading = true;
    }

    handleWordClick(event) {
        const term = event.currentTarget.dataset.term;
        const match = (this.words || []).find((word) => word.term === term);
        if (match) {
            this.selectedWord = {
                ...match,
                sentimentDisplay: this.formatSentiment(match.sentimentScore),
                trendDisplay: this.formatTrend(match.trendDelta),
                recentShareDisplay: this.formatPercent(match.recentShare)
            };
        }
    }

    computeSize(count, minCount, maxCount) {
        if (maxCount === minCount) {
            return SIZE_SCALE.min;
        }
        const normalized = (count - minCount) / (maxCount - minCount);
        return SIZE_SCALE.min + normalized * (SIZE_SCALE.max - SIZE_SCALE.min);
    }

    computeColor(sentiment) {
        if (sentiment == null) {
            return '#54698d';
        }
        if (sentiment > 0.2) {
            return '#2e844a';
        }
        if (sentiment < -0.2) {
            return '#ba0517';
        }
        return '#54698d';
    }

    computeOpacity(recentShare) {
        if (recentShare == null) {
            return 0.9;
        }
        const clamped = Math.min(1, Math.max(0.2, recentShare));
        return clamped;
    }

    computeHighlight(trend) {
        if (trend == null) {
            return '';
        }
        if (trend > 0.5) {
            return 'is-trending-up';
        }
        if (trend < -0.5) {
            return 'is-trending-down';
        }
        return '';
    }

    buildTooltip(word) {
        const parts = [];
        parts.push(`Mentions: ${word.totalCount}`);
        parts.push(`Pos: ${word.positiveCount} · Neu: ${word.neutralCount} · Neg: ${word.negativeCount}`);
        parts.push(`Sentiment: ${this.formatSentiment(word.sentimentScore)}`);
        parts.push(`Trend: ${this.formatTrend(word.trendDelta)}`);
        parts.push(`Recent share: ${this.formatPercent(word.recentShare)}`);
        if (word.lastMentioned) {
            parts.push(`Last mentioned: ${word.lastMentioned}`);
        }
        return parts.join('\n');
    }

    formatSentiment(score) {
        if (score == null) {
            return 'Neutral';
        }
        if (score > 0.25) {
            return 'Positive';
        }
        if (score < -0.25) {
            return 'Negative';
        }
        return 'Mixed';
    }

    formatTrend(trend) {
        if (trend == null) {
            return 'Stable';
        }
        const pct = (trend * 100).toFixed(1);
        if (trend > 0) {
            return `▲ ${pct}%`;
        }
        if (trend < 0) {
            return `▼ ${Math.abs(pct)}%`;
        }
        return 'Stable';
    }

    formatPercent(value) {
        if (value == null) {
            return '—';
        }
        return `${(value * 100).toFixed(1)}%`;
    }
}
