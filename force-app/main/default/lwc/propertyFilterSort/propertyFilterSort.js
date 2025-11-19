import { LightningElement, api, track } from 'lwc';
import { formatCurrency } from 'c/realEstateUiUtils';

const DEFAULT_SORT_OPTIONS = [
    { label: 'Price', value: 'price' },
    { label: 'Beds', value: 'beds' },
    { label: 'Baths', value: 'baths' },
    { label: 'Square Feet', value: 'sqft' },
    { label: 'Year Built', value: 'yearBuilt' }
];

const DIRECTION_OPTIONS = [
    { label: 'Descending', value: 'desc' },
    { label: 'Ascending', value: 'asc' }
];

export default class PropertyFilterSort extends LightningElement {
    @api properties = [];

    @track priceMin = 0;
    @track priceMax = 1000000;
    @track sqftMin = 0;
    @track sqftMax = 5000;
    @track yearMin = 1980;
    @track yearMax = new Date().getFullYear();

    @track sortPrimary = 'price';
    @track sortSecondary = 'beds';
    @track sortTertiary = 'sqft';
    @track sortDirPrimary = 'desc';
    @track sortDirSecondary = 'desc';
    @track sortDirTertiary = 'desc';

    @track preview = [];

    sortOptions = DEFAULT_SORT_OPTIONS;
    directionOptions = DIRECTION_OPTIONS;

    connectedCallback() {
        this.preview = this.applyAll();
    }

    get priceMinDisplay() {
        return formatCurrency(this.priceMin);
    }

    get priceMaxDisplay() {
        return formatCurrency(this.priceMax);
    }

    get sqftMinDisplay() {
        return new Intl.NumberFormat().format(this.sqftMin);
    }

    get sqftMaxDisplay() {
        return new Intl.NumberFormat().format(this.sqftMax);
    }

    handleFilterInput(event) {
        const { name, value } = event.target;
        if (value === undefined) return;
        this[name] = Number(value);
    }

    handleSortChange(event) {
        const key = event.target.dataset.key;
        const value = event.detail.value;
        if (!key) return;
        switch (key) {
            case 'primary':
                this.sortPrimary = value;
                break;
            case 'secondary':
                this.sortSecondary = value;
                break;
            case 'tertiary':
                this.sortTertiary = value;
                break;
            case 'dirPrimary':
                this.sortDirPrimary = value;
                break;
            case 'dirSecondary':
                this.sortDirSecondary = value;
                break;
            case 'dirTertiary':
                this.sortDirTertiary = value;
                break;
            default:
        }
    }

    resetFilters() {
        this.priceMin = 0;
        this.priceMax = 1000000;
        this.sqftMin = 0;
        this.sqftMax = 5000;
        this.yearMin = 1980;
        this.yearMax = new Date().getFullYear();
        this.sortPrimary = 'price';
        this.sortSecondary = 'beds';
        this.sortTertiary = 'sqft';
        this.sortDirPrimary = 'desc';
        this.sortDirSecondary = 'desc';
        this.sortDirTertiary = 'desc';
        this.preview = this.applyAll();
    }

    applyFilters() {
        this.preview = this.applyAll();
        this.dispatchEvent(new CustomEvent('filterchange', {
            detail: {
                items: this.preview,
                criteria: {
                    price: [this.priceMin, this.priceMax],
                    sqft: [this.sqftMin, this.sqftMax],
                    year: [this.yearMin, this.yearMax]
                }
            }
        }));
    }

    applyAll() {
        const filtered = (this.properties || []).filter((item) => {
            const price = Number(item.price) || 0;
            const sqft = Number(item.sqft) || 0;
            const year = Number(item.yearBuilt) || 0;
            return price >= this.priceMin && price <= this.priceMax &&
                sqft >= this.sqftMin && sqft <= this.sqftMax &&
                year >= this.yearMin && year <= this.yearMax;
        });

        const sorted = this.sortItems(filtered.slice()).map((item, index) => ({
            ...item,
            _key: item.id || `filtered-${index}`,
            _priceDisplay: formatCurrency(item.price)
        }));
        return sorted;
    }

    sortItems(items) {
        const sortOrder = [
            { key: this.sortPrimary, dir: this.sortDirPrimary },
            { key: this.sortSecondary, dir: this.sortDirSecondary },
            { key: this.sortTertiary, dir: this.sortDirTertiary }
        ].filter((entry) => entry.key);

        items.sort((a, b) => {
            for (const entry of sortOrder) {
                const aval = Number(a[entry.key]);
                const bval = Number(b[entry.key]);
                if (Number.isNaN(aval) || Number.isNaN(bval)) {
                    continue;
                }
                if (aval === bval) {
                    continue;
                }
                const multiplier = entry.dir === 'asc' ? 1 : -1;
                return aval > bval ? multiplier : -multiplier;
            }
            return 0;
        });

        return items;
    }
}
