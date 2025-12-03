import { LightningElement, api, track } from 'lwc';
import getArScene from '@salesforce/apex/ARReviewService.getScene';

export default class ReviewArOverlay extends LightningElement {
    @api propertyId;
    @track overlays = [];
    isSupported = false;
    arSession;
    arCanvas;

    connectedCallback() {
        this.checkSupport();
        this.loadScene();
    }

    disconnectedCallback() {
        if (this.arSession) {
            this.arSession.end();
            this.arSession = null;
        }
    }

    async checkSupport() {
        if (navigator.xr && navigator.xr.isSessionSupported) {
            this.isSupported = await navigator.xr.isSessionSupported('immersive-ar');
        } else {
            this.isSupported = false;
        }
        if (this.isSupported) {
            this.initializeWebXR();
        }
    }

    loadScene() {
        if (!this.propertyId) {
            return;
        }
        getArScene({ propertyId: this.propertyId })
            .then((scene) => {
                this.overlays = (scene && scene.overlays) || [];
                if (this.arSession) {
                    this.createAnchors();
                }
            })
            .catch((error) => {
                // eslint-disable-next-line no-console
                console.error('AR scene load failed', error);
            });
    }

    async initializeWebXR() {
        try {
            this.arSession = await navigator.xr.requestSession('immersive-ar', {
                requiredFeatures: ['hit-test', 'dom-overlay'],
                domOverlay: { root: this.template.querySelector('.ar-overlay__canvas') }
            });
            this.setupRenderer();
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Failed to start AR session', err);
            this.isSupported = false;
        }
    }

    setupRenderer() {
        // Placeholder: integrate with WebXR framework (e.g., three.js, A-Frame)
        // For prototype, we simply show overlays list even when AR session is active.
    }

    createAnchors() {
        // Placeholder: translate overlay anchor data into AR anchors.
        // Would use hit test results + anchor positions when implemented.
    }
}
