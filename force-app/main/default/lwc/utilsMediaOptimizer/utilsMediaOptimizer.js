/**
 * Utility helpers for adaptive media loading. Determines device/network capabilities and
 * returns the best-fit media source from a provided descriptor list.
 */

const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

const DEVICE_TIERS = Object.freeze({
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
});

function getDeviceTier() {
    const memory = navigator.deviceMemory || 4;
    if (memory >= 8) {
        return DEVICE_TIERS.HIGH;
    }
    if (memory >= 4) {
        return DEVICE_TIERS.MEDIUM;
    }
    return DEVICE_TIERS.LOW;
}

function getNetworkTier() {
    if (!connection || typeof connection.downlink !== 'number') {
        return DEVICE_TIERS.MEDIUM;
    }
    if (connection.downlink >= 5) {
        return DEVICE_TIERS.HIGH;
    }
    if (connection.downlink >= 1.5) {
        return DEVICE_TIERS.MEDIUM;
    }
    return DEVICE_TIERS.LOW;
}

export function shouldDeferHighBandwidth() {
    const net = getNetworkTier();
    return net === DEVICE_TIERS.LOW;
}

export function chooseMediaVariant(descriptor = {}) {
    const { fallback, sources = [] } = descriptor;
    if (!Array.isArray(sources) || sources.length === 0) {
        return fallback || null;
    }
    const deviceTier = getDeviceTier();
    const networkTier = getNetworkTier();

    const normalized = sources.map((source) => {
        return {
            url: source.url,
            bandwidth: source.bandwidth || Infinity,
            width: source.width || 0,
            height: source.height || 0,
            type: source.type || 'image'
        };
    });

    const targetBandwidth = networkTier === DEVICE_TIERS.HIGH ? Infinity : networkTier === DEVICE_TIERS.MEDIUM ? 4000 : 1500;
    const filtered = normalized.filter((src) => src.bandwidth <= targetBandwidth);
    if (filtered.length) {
        const sorted = filtered.sort((a, b) => {
            const areaA = a.width * a.height;
            const areaB = b.width * b.height;
            return areaB - areaA;
        });
        return sorted[0].url;
    }

    const fallbackSorted = normalized.sort((a, b) => {
        const scoreA = a.bandwidth * (a.width + a.height);
        const scoreB = b.bandwidth * (b.width + b.height);
        return scoreA - scoreB;
    });
    return fallbackSorted[0]?.url || fallback || null;
}

export function buildSourceSet(descriptor = {}) {
    const { sources = [] } = descriptor;
    if (!Array.isArray(sources) || !sources.length) {
        return null;
    }
    return sources
        .filter((src) => src.type === 'image' && src.width)
        .map((src) => `${src.url} ${src.width}w`)
        .join(', ');
}
