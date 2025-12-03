const handlerMap = new WeakMap();

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
