import { LightningElement, api, track } from 'lwc';
import getPropertyInsights from '@salesforce/apex/RealEstateService.getPropertyInsights';

/**
 * propertyComparison
 * - Displays a side-by-side comparison matrix for 3–5 properties.
 * - Highlights best and worst values per attribute row.
 * - Works with numeric and textual attributes; numeric rows get best/worst detection.
 */
export default class PropertyComparison extends LightningElement {
    /**
     * Array of property objects to compare. Expected shape:
     * [
     *   { id, name, subtitle?, price, beds, baths, sqft, lotSize, yearBuilt, hoaMonthly }
     * ]
     */
    @api properties = [];

    /**
     * Optional: custom attribute schema to control rows and display.
     * Example:
     * [
     *   { key: 'price', label: 'Price', type: 'currency', invert: false },
     *   { key: 'beds', label: 'Bedrooms', type: 'number' },
     *   { key: 'walkScore', label: 'Walk Score', type: 'number' }
     * ]
     */
    @api attributes = [
        { key: 'price', label: 'Price', type: 'currency' },
        { key: 'beds', label: 'Bedrooms', type: 'number' },
        { key: 'baths', label: 'Bathrooms', type: 'number' },
        { key: 'sqft', label: 'Square Feet', type: 'number' },
        { key: 'lotSize', label: 'Lot Size (acres)', type: 'number' },
        { key: 'yearBuilt', label: 'Year Built', type: 'number' },
        { key: 'hoaMonthly', label: 'HOA (Monthly)', type: 'currency', invert: true }
    ];

    @track displayProperties = [];
    @track matrixRows = [];
    @track weights = {}; // key -> percentage number
    @track weightTotal = 0;
    @track insights;
    @track insightsMessages = [];
    @track insightsError;
    @track insightsLoading = false;
    activePropertyId;
    currencyCode = 'USD';

    connectedCallback() {
        this.recompute();
    }

    renderedCallback() {
        // No-op for now; hook here if future dynamic sizing needed
    }

    @api
    recompute() {
        const props = Array.isArray(this.properties) ? this.properties.slice(0, 5) : [];
        // Filter to 3–5
        this.displayProperties = props
            .filter((p) => !!p && (p.id || p.name))
            .slice(0, 5)
            .map((p, idx) => ({
                _key: p.id || `prop-${idx}`,
                name: p.name || `Property ${idx + 1}`,
                subtitle: p.subtitle || null,
                ...p
            }));

        this.matrixRows = this.buildRows(this.displayProperties, this.attributes);
        this.initWeightsIfNeeded();
        this.calculateWeightedScores();
        this.validateActiveProperty();
    }

    get hasEnoughProperties() {
        return (this.displayProperties || []).length >= 3;
    }

    get insightsPanelVisible() {
        return this.insightsLoading || !!this.activePropertyId;
    }

    get activePropertyName() {
        const found = (this.displayProperties || []).find((p) => p.id === this.activePropertyId);
        return found ? found.name : null;
    }

    get hasComparables() {
        return !!(this.insights && Array.isArray(this.insights.comparables) && this.insights.comparables.length);
    }

    get hasTrends() {
        return !!(this.insights && Array.isArray(this.insights.trends) && this.insights.trends.length);
    }

    get priceAnalysis() {
        return this.insights?.priceAnalysisDecorated;
    }

    get hasPriceAnalysis() {
        return !!this.priceAnalysis;
    }

    get roiAnalysis() {
        return this.insights?.roiAnalysisDecorated;
    }

    get hasRoiAnalysis() {
        return !!this.roiAnalysis;
    }

    get depreciationAnalysis() {
        return this.insights?.depreciationAnalysisDecorated;
    }

    get hasDepreciationAnalysis() {
        return !!this.depreciationAnalysis;
    }

    get taxAnalysis() {
        return this.insights?.taxAnalysisDecorated;
    }

    get hasTaxAnalysis() {
        return !!this.taxAnalysis;
    }

    get mediaSources() {
        return this.insights?.media;
    }

    get mediaAvailable() {
        const media = this.mediaSources;
        if (!media) return false;
        return Boolean(
            (media.photos?.before && media.photos?.after) ||
            (media.floorPlans?.before && media.floorPlans?.after) ||
            (media.exterior?.before && media.exterior?.after)
        );
    }

    get mapLayers() {
        return this.insights?.mapLayersDecorated;
    }

    get hasMapLayers() {
        return Array.isArray(this.mapLayers) && this.mapLayers.length > 0;
    }

    buildRows(properties, attributes) {
        if (!properties.length) return [];
        const rows = [];
        for (const attr of attributes) {
            const key = attr.key;
            const label = attr.label || key;
            const type = attr.type || 'text';
            const invert = !!attr.invert; // if true, lower is better (e.g., HOA monthly)

            // Collect numeric values for best/worst detection
            const values = properties.map((p, i) => ({
                key: `${key}-${i}`,
                raw: p[key],
                display: this.formatValue(p[key], type),
                title: this.tooltipValue(p[key], type),
                classList: 'pcell'
            }));

            // Determine best/worst indices only if numeric
            const numeric = values.map((v, i) => ({ i, n: this.toNumber(v.raw) }));
            if (numeric.every((x) => Number.isFinite(x.n))) {
                const ns = numeric.map((x) => x.n);
                const bestVal = invert ? Math.min(...ns) : Math.max(...ns);
                const worstVal = invert ? Math.max(...ns) : Math.min(...ns);
                const bestIdxs = numeric.filter((x) => x.n === bestVal).map((x) => x.i);
                const worstIdxs = numeric.filter((x) => x.n === worstVal).map((x) => x.i);
                for (const bi of bestIdxs) values[bi].classList += ' is-best';
                for (const wi of worstIdxs) values[wi].classList += ' is-worst';
            }

            rows.push({ key, label, values });
        }
        return rows;
    }

    initWeightsIfNeeded() {
        if (this.weights && Object.keys(this.weights).length) {
            this.updateWeightTotal();
            return;
        }
        const numericAttrs = (this.attributes || []).filter((a) => (a.type === 'number' || a.type === 'currency'));
        const defaultPct = numericAttrs.length ? Math.floor(100 / numericAttrs.length) : 0;
        const remainder = numericAttrs.length ? 100 - (defaultPct * numericAttrs.length) : 0;
        const map = {};
        numericAttrs.forEach((a, i) => {
            map[a.key] = defaultPct + (i === 0 ? remainder : 0);
        });
        this.weights = map;
        this.updateWeightTotal();
    }

    handleWeightChange(event) {
        const key = event.target?.dataset?.key;
        const val = parseFloat(event.detail?.value);
        if (!key) return;
        const pct = Number.isFinite(val) && val >= 0 ? val : 0;
        this.weights = { ...this.weights, [key]: pct };
        this.updateWeightTotal();
    }

    updateWeightTotal() {
        this.weightTotal = Object.values(this.weights || {}).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    }

    get normalizedWeights() {
        const total = this.weightTotal || 0;
        if (total <= 0) return {};
        const out = {};
        for (const [k, v] of Object.entries(this.weights)) {
            const pct = Number.isFinite(v) ? v : 0;
            out[k] = pct / total; // 0..1
        }
        return out;
    }

    calculateWeightedScores() {
        const attributes = this.attributes || [];
        const props = this.displayProperties || [];
        if (!props.length || !attributes.length) return;

        // Collect numeric attributes only
        const numericAttrs = attributes.filter((a) => (a.type === 'number' || a.type === 'currency'));
        if (!numericAttrs.length) return;

        // Build normalization maps per attribute
        const stats = {};
        for (const a of numericAttrs) {
            const vals = props.map((p) => this.toNumber(p[a.key]));
            const finite = vals.filter((n) => Number.isFinite(n));
            const min = finite.length ? Math.min(...finite) : 0;
            const max = finite.length ? Math.max(...finite) : 0;
            stats[a.key] = { min, max, invert: !!a.invert };
        }

        // Normalize weights
        const w = this.normalizedWeights;
        // If no weights provided, make them equal among numeric attrs
        const equalW = 1 / numericAttrs.length;

        // Compute scores
        const scored = props.map((p) => ({ ...p }));
        for (let i = 0; i < scored.length; i++) {
            let sum = 0;
            for (const a of numericAttrs) {
                const info = stats[a.key];
                const raw = this.toNumber(scored[i][a.key]);
                let norm;
                if (!Number.isFinite(raw) || info.max === info.min) {
                    norm = 0.5; // neutral when missing or no spread
                } else {
                    const r = (raw - info.min) / (info.max - info.min);
                    norm = info.invert ? (1 - r) : r; // 0..1
                }
                const weight = Number.isFinite(w[a.key]) ? w[a.key] : equalW;
                sum += weight * norm;
            }
            const scorePct = Math.round(sum * 100);
            scored[i]._score = sum; // 0..1
            scored[i]._scoreDisplay = `${scorePct}`;
        }
        // Highlight overall best as well (optional)
        const best = scored.reduce((acc, p, idx) => (p._score > acc.val ? { idx, val: p._score } : acc), { idx: -1, val: -1 });
        this.displayProperties = scored.map((p, idx) => ({ ...p, _overallBest: idx === best.idx }));
    }

    validateActiveProperty() {
        if (!this.activePropertyId) {
            return;
        }
        const stillPresent = (this.displayProperties || []).some((p) => p.id === this.activePropertyId);
        if (!stillPresent) {
            this.activePropertyId = null;
            this.insights = null;
            this.insightsMessages = [];
            this.insightsError = null;
        }
    }

    toNumber(v) {
        if (v == null || v === '') return NaN;
        if (typeof v === 'number') return v;
        const s = String(v).replace(/[^0-9.\-]/g, '');
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : NaN;
    }

    formatValue(v, type) {
        if (v == null || v === '') return '—';
        switch (type) {
            case 'currency':
                return new Intl.NumberFormat(undefined, { style: 'currency', currency: this.currencyCode }).format(this.toNumber(v));
            case 'number':
                return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(this.toNumber(v));
            default:
                return String(v);
        }
    }

    tooltipValue(v, type) {
        if (v == null || v === '') return 'No data';
        return `${this.formatValue(v, type)}`;
    }

    async handleViewInsights(event) {
        const propertyId = event?.currentTarget?.dataset?.propertyId;
        if (!propertyId) {
            this.insightsError = 'Unable to load insights: property identifier missing.';
            return;
        }
        this.activePropertyId = propertyId;
        this.insightsLoading = true;
        this.insights = null;
        this.insightsMessages = [];
        this.insightsError = null;

        try {
            const result = await getPropertyInsights({ propertyId });
            this.insights = this.decorateInsights(result);
            this.insightsMessages = Array.isArray(result?.messages) ? result.messages : [];
        } catch (error) {
            this.insightsError = this.parseError(error);
        } finally {
            this.insightsLoading = false;
        }
    }

    decorateInsights(result) {
        if (!result) {
            return null;
        }
        const out = { ...result };
        if (Array.isArray(result.comparables)) {
            out.comparables = result.comparables.map((comp, idx) => ({
                ...comp,
                _key: `${comp.address || 'comp'}-${idx}`
            }));
        }
        if (Array.isArray(result.trends)) {
            out.trends = result.trends.map((trend, idx) => ({
                ...trend,
                _key: `trend-${idx}`
            }));
        }
        if (result.priceAnalysis) {
            out.priceAnalysisDecorated = this.decoratePriceAnalysis(result.priceAnalysis);
        }
        if (result.roiAnalysis) {
            out.roiAnalysisDecorated = this.decorateRoiAnalysis(result.roiAnalysis);
        }
        if (result.depreciationAnalysis) {
            out.depreciationAnalysisDecorated = this.decorateDepreciationAnalysis(result.depreciationAnalysis);
        }
        if (result.taxAnalysis) {
            out.taxAnalysisDecorated = this.decorateTaxAnalysis(result.taxAnalysis);
        }
        if (result.mapLayers) {
            out.mapLayersDecorated = this.decorateMapLayers(result.mapLayers);
        }
        return out;
    }

    decoratePriceAnalysis(analysis) {
        if (!analysis) {
            return null;
        }
        const formatCurrency = (value) => {
            if (value === null || value === undefined || Number.isNaN(Number(value))) {
                return '—';
            }
            return new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: this.currencyCode,
                maximumFractionDigits: 0
            }).format(Number(value));
        };
        const formatNumber = (value, fraction = 2) => {
            if (value === null || value === undefined || Number.isNaN(Number(value))) {
                return '—';
            }
            return Number(value).toFixed(fraction);
        };
        const formatPercent = (value) => {
            if (value === null || value === undefined || Number.isNaN(Number(value))) {
                return '—';
            }
            return `${Number(value).toFixed(1)}%`;
        };
        return {
            ...analysis,
            subjectPpsfDisplay: formatCurrency(analysis.subjectPricePerSqft),
            averagePpsfDisplay: formatCurrency(analysis.comparableAveragePpsf),
            medianPpsfDisplay: formatCurrency(analysis.comparableMedianPpsf),
            stddevPpsfDisplay: formatCurrency(analysis.comparableStdDevPpsf),
            deltaPctDisplay: formatPercent(analysis.deltaToAveragePct),
            valueScoreDisplay: formatNumber(analysis.valueScore, 0),
            zScoreDisplay: analysis.zScore == null ? '—' : formatNumber(analysis.zScore, 2)
        };
    }

    decorateRoiAnalysis(analysis) {
        if (!analysis) {
            return null;
        }
        const formatCurrency = (value) => {
            if (value === null || value === undefined || Number.isNaN(Number(value))) {
                return '—';
            }
            return new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: this.currencyCode,
                maximumFractionDigits: 0
            }).format(Number(value));
        };
        const formatPercent = (value) => {
            if (value === null || value === undefined || Number.isNaN(Number(value))) {
                return '—';
            }
            return `${Number(value).toFixed(2)}%`;
        };
        return {
            ...analysis,
            subjectRentDisplay: formatCurrency(analysis.subjectRentEstimate),
            subjectYieldDisplay: formatPercent(analysis.subjectRentalYieldPct),
            subjectAppreciationDisplay: formatPercent(analysis.subjectAppreciationPct),
            subjectTotalReturnDisplay: formatPercent(analysis.subjectTotalReturn5yPct),
            compsRentDisplay: formatCurrency(analysis.comparablesAverageRentEstimate),
            compsYieldDisplay: formatPercent(analysis.comparablesAverageRentalYieldPct),
            compsAppreciationDisplay: formatPercent(analysis.comparablesAverageAppreciationPct),
            compsTotalReturnDisplay: formatPercent(analysis.comparablesTotalReturn5yPct)
        };
    }

    decorateDepreciationAnalysis(analysis) {
        if (!analysis) {
            return null;
        }
        const formatInteger = (value) => {
            if (value === null || value === undefined || Number.isNaN(Number(value))) {
                return '—';
            }
            return Number(value).toFixed(0);
        };
        const formatPercent = (value) => {
            if (value === null || value === undefined || Number.isNaN(Number(value))) {
                return '—';
            }
            return `${Number(value).toFixed(2)}%`;
        };
        const formatCurrency = (value) => {
            if (value === null || value === undefined || Number.isNaN(Number(value))) {
                return '—';
            }
            return new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: this.currencyCode,
                maximumFractionDigits: 0
            }).format(Number(value));
        };
        return {
            ...analysis,
            effectiveYearDisplay: formatInteger(analysis.effectiveYear),
            observedAgeDisplay: formatInteger(analysis.observedAge),
            adjustedAgeDisplay: formatInteger(analysis.adjustedAge),
            yearsSinceRenovationDisplay: formatInteger(analysis.yearsSinceRenovation),
            assumedUsefulLifeDisplay: formatInteger(analysis.assumedUsefulLife),
            remainingUsefulLifeDisplay: formatInteger(analysis.remainingUsefulLife),
            marketRemainingUsefulLifeDisplay: formatInteger(analysis.marketRemainingUsefulLife),
            depreciationPercentDisplay: formatPercent(analysis.depreciationPercent),
            depreciatedValueDisplay: formatCurrency(analysis.depreciatedValue)
        };
    }

    decorateTaxAnalysis(analysis) {
        if (!analysis) {
            return null;
        }
        const formatCurrency = (value) => {
            if (value === null || value === undefined || Number.isNaN(Number(value))) {
                return '—';
            }
            return new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: this.currencyCode,
                maximumFractionDigits: 0
            }).format(Number(value));
        };
        const formatPercent = (value) => {
            if (value === null || value === undefined || Number.isNaN(Number(value))) {
                return '—';
            }
            return `${Number(value).toFixed(2)}%`;
        };
        return {
            ...analysis,
            assessedValueDisplay: formatCurrency(analysis.assessedValue),
            municipalRateDisplay: formatPercent(analysis.municipalRate),
            educationRateDisplay: formatPercent(analysis.educationRate),
            propertyTaxAnnualDisplay: formatCurrency(analysis.propertyTaxAnnual),
            insuranceEstimateDisplay: formatCurrency(analysis.insuranceEstimate),
            hoaAnnualDisplay: formatCurrency(analysis.hoaAnnual),
            totalCarryingAnnualDisplay: formatCurrency(analysis.totalCarryingCostAnnual),
            totalCarryingMonthlyDisplay: formatCurrency(analysis.totalCarryingCostMonthly)
        };
    }

    decorateMapLayers(layers) {
        if (!Array.isArray(layers)) {
            return [];
        }
        return layers.map((layer) => ({
            ...layer,
            description: layer.description || '',
            label: layer.label || layer.type
        }));
    }

    parseError(error) {
        if (!error) {
            return 'Unknown error';
        }
        if (typeof error === 'string') {
            return error;
        }
        if (error.body && error.body.message) {
            return error.body.message;
        }
        if (error.message) {
            return error.message;
        }
        return JSON.stringify(error);
    }
}
