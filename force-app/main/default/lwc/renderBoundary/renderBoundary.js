import { LightningElement } from 'lwc';

export default class RenderBoundary extends LightningElement {
    hasError = false;

    errorCallback(error, stack) {
        // eslint-disable-next-line no-console
        console.error('[RenderBoundary] captured error', error, stack);
        this.hasError = true;
        this.dispatchEvent(
            new CustomEvent('sectionerror', {
                detail: {
                    message: error?.message,
                    stack
                }
            })
        );
    }
}
