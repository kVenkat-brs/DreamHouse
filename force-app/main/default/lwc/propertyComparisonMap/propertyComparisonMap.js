import { LightningElement, api } from 'lwc';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import LEAFLET from '@salesforce/resourceUrl/leafletjs';

export default class PropertyComparisonMap extends LightningElement {
    @api layers = [];
    mapInitialized = false;
    map;
    leaflet;
    heatLayer;
    markers = [];
    activeType = 'properties';

    renderedCallback() {
        if (this.mapInitialized) return;
        Promise.all([loadScript(this, LEAFLET + '/leaflet.js'), loadStyle(this, LEAFLET + '/leaflet.css')])
            .then(() => {
                this.leaflet = window.L;
                this.initMap();
            })
            .catch((error) => {
                console.error('Leaflet failed to load', error);
            });
    }

    @api
    setLayers(layers) {
        this.layers = Array.isArray(layers) ? layers : [];
        if (this.mapInitialized) {
            this.renderLayers();
        }
    }

    get layerButtons() {
        return (this.layers || []).map((layer) => ({
            value: layer.type,
            label: layer.label || layer.type,
            variant: layer.type === this.activeType ? 'brand' : 'neutral'
        }));
    }

    initMap() {
        const container = this.template.querySelector('.pcm__map');
        if (!container || !this.leaflet) return;
        this.map = this.leaflet.map(container, { zoomControl: true, attributionControl: false }).setView([37.7749, -122.4194], 12);
        this.leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        this.mapInitialized = true;
        this.renderLayers();
    }

    renderLayers() {
        if (!this.map) return;
        this.clearLayers();
        const activeLayer = (this.layers || []).find((layer) => layer.type === this.activeType) || this.layers[0];
        if (!activeLayer) {
            return;
        }
        if (activeLayer.points && activeLayer.points.length) {
            activeLayer.points.forEach((point) => {
                const marker = this.leaflet.marker([point.lat, point.lng]).addTo(this.map);
                marker.bindPopup(`<strong>${point.label || ''}</strong><br/>${point.detail || ''}`);
                this.markers.push(marker);
            });
            const latLngs = activeLayer.points.map((p) => [p.lat, p.lng]);
            this.leaflet.featureGroup(this.markers).addTo(this.map);
            this.map.fitBounds(latLngs, { padding: [20, 20] });
        }
        if (activeLayer.heat && activeLayer.heat.length && this.leaflet.heatLayer) {
            const heatPoints = activeLayer.heat.map((p) => [p.lat, p.lng, p.intensity || 0.5]);
            this.heatLayer = this.leaflet.heatLayer(heatPoints, { radius: 25, blur: 15, maxZoom: 17 }).addTo(this.map);
        }
    }

    clearLayers() {
        if (this.heatLayer) {
            this.map.removeLayer(this.heatLayer);
            this.heatLayer = null;
        }
        if (this.markers.length) {
            this.markers.forEach((marker) => {
                this.map.removeLayer(marker);
            });
            this.markers = [];
        }
    }

    handleToggle(event) {
        const layerType = event.target.dataset.layer;
        this.activeType = layerType;
        this.renderLayers();
    }
}
