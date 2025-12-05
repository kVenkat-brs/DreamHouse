const handlerMap = new WeakMap();
const memoStore = new WeakMap();
const objectTokenStore = new WeakMap();
let objectTokenCounter = 0;

function getHandler(instance, fn) {
    if (!handlerMap.has(instance)) {
        handlerMap.set(instance, new Map());
    }
    const map = handlerMap.get(instance);
    if (!map.has(fn)) {
        map.set(fn, fn.bind(instance));
    }
    return map.get(fn);
}

export function eventHandler(target, propertyKey, descriptor) {
    const original = descriptor.value;
    return {
        configurable: true,
        enumerable: false,
        get() {
            return getHandler(this, original);
        }
    };
}

export function createDebounce(delay = 300) {
    return function debounce(fn) {
        let timeoutId;
        return function debouncedFunction(...args) {
            window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(() => {
                fn.apply(this, args);
            }, delay);
        };
    };
}

function getMemoMeta(instance, fn) {
    let instanceStore = memoStore.get(instance);
    if (!instanceStore) {
        instanceStore = new Map();
        memoStore.set(instance, instanceStore);
    }
    let meta = instanceStore.get(fn);
    if (!meta) {
        meta = { cache: new Map(), wrapper: null };
        instanceStore.set(fn, meta);
    }
    return meta;
}

function defaultKeyResolver(...args) {
    if (!args.length) {
        return '__no_args__';
    }
    return args
        .map((value) => {
            if (value === null) {
                return 'null';
            }
            if (value === undefined) {
                return 'undefined';
            }
            if (typeof value === 'object') {
                let token = objectTokenStore.get(value);
                if (!token) {
                    token = `obj#${++objectTokenCounter}`;
                    objectTokenStore.set(value, token);
                }
                return token;
            }
            return `${typeof value}:${String(value)}`;
        })
        .join('|');
}

export function memoize(resolver) {
    const keyResolver = typeof resolver === 'function' ? resolver : defaultKeyResolver;
    return function memoizeDecorator(target, propertyKey, descriptor) {
        const original = descriptor.value;
        if (typeof original !== 'function') {
            throw new TypeError('memoize decorator can only be applied to methods');
        }
        return {
            configurable: true,
            enumerable: descriptor.enumerable ?? false,
            get() {
                const meta = getMemoMeta(this, original);
                if (!meta.wrapper) {
                    meta.wrapper = (...args) => {
                        const key = keyResolver.apply(this, args);
                        if (meta.cache.has(key)) {
                            return meta.cache.get(key);
                        }
                        const result = original.apply(this, args);
                        meta.cache.set(key, result);
                        return result;
                    };
                }
                return meta.wrapper;
            }
        };
    };
}

export function clearMemoization(instance, fn) {
    const instanceStore = memoStore.get(instance);
    if (!instanceStore) {
        return;
    }
    const meta = instanceStore.get(fn);
    if (meta) {
        meta.cache.clear();
    }
}
