export function extractErrorMessage(error, fallback = 'An unexpected error occurred.') {
    if (!error) {
        return fallback;
    }

    const body = error.body;

    if (Array.isArray(body) && body.length) {
        return body[0]?.message || fallback;
    }

    if (body && typeof body.message === 'string') {
        return body.message;
    }

    if (typeof error.message === 'string') {
        return error.message;
    }

    return fallback;
}
