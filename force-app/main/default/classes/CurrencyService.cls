public with sharing class CurrencyService {
    // Cached fallback rates relative to USD
    private static Map<String, Decimal> USD_RATES = new Map<String, Decimal>{
        'USD' => 1.0,
        'EUR' => 0.92,
        'GBP' => 0.79,
        'INR' => 83.0,
        'JPY' => 151.0,
        'AUD' => 1.55,
        'CAD' => 1.37
    };

    // Cache container
    private static Datetime lastUpdated;
    private static Map<String, Map<String, Decimal>> cacheByBase = new Map<String, Map<String, Decimal>>();

    /**
     * Returns a map of currency code → rate for the requested base.
     * The values represent how many target currency units equal 1 base currency unit.
     * Example: getRates('USD').get('EUR') = 0.92 means 1 USD = 0.92 EUR.
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Decimal> getRates(String base) {
        if (String.isBlank(base)) base = 'USD';
        base = base.toUpperCase();
        if (cacheByBase.containsKey(base) && lastUpdated != null && Datetime.now().getTime() - lastUpdated.getTime() < 1000L * 60L * 60L) {
            return cacheByBase.get(base);
        }
        Map<String, Decimal> rates = computeRatesForBase(base);
        cacheByBase.put(base, rates);
        lastUpdated = Datetime.now();
        return rates;
    }

    /**
     * Converts the given amount from one currency to another using cached rates.
     */
    @AuraEnabled(cacheable=true)
    public static Decimal convert(Decimal amount, String fromCode, String toCode) {
        if (amount == null) return null;
        if (String.isBlank(fromCode) || String.isBlank(toCode) || fromCode.equalsIgnoreCase(toCode)) return amount;
        Map<String, Decimal> rates = getRates(fromCode);
        Decimal rate = rates.get(toCode?.toUpperCase());
        if (rate == null) return amount;
        return amount * rate;
    }

    // Builds rates for any base using USD pivot
    private static Map<String, Decimal> computeRatesForBase(String base) {
        Map<String, Decimal> out = new Map<String, Decimal>();
        if (!USD_RATES.containsKey(base)) {
            // Unknown base → derive approximate rate from USD via 1 / USD_RATES[base]
            // If still unknown, fallback to USD
            Decimal baseToUSD = 1;
            if (USD_RATES.containsKey(base)) {
                baseToUSD = 1 / USD_RATES.get(base);
            }
        }
        Decimal usdPerBase;
        if (base == 'USD') {
            usdPerBase = 1;
        } else if (USD_RATES.containsKey(base)) {
            // If 1 USD = x BASE? Our USD_RATES is USD→TARGET, so 1 USD = r(base). Thus 1 BASE = 1 / r(base) USD.
            Decimal r = USD_RATES.get(base);
            usdPerBase = (r == 0) ? 1 : (1 / r);
        } else {
            usdPerBase = 1; // fallback silently
        }

        for (String code : USD_RATES.keySet()) {
            Decimal usdToTarget = USD_RATES.get(code);
            // 1 BASE = usdPerBase USD; 1 USD = usdToTarget TARGET → 1 BASE = usdPerBase * usdToTarget TARGET
            Decimal baseToTarget = usdPerBase * usdToTarget;
            out.put(code, baseToTarget);
        }
        // Ensure base currency rate = 1
        out.put(base, 1);
        return out;
    }
}

