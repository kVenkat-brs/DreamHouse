import { LightningElement, api } from 'lwc';
import processMedia from '@salesforce/apex/VisualReviewService.processMedia';

export default class VisualReviewUploader extends LightningElement {
    @api propertyId;
    items = [];

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        event.currentTarget.classList.add('uploader__dropzone--active');
    }

    handleDragLeave(event) {
        event.currentTarget.classList.remove('uploader__dropzone--active');
    }

    handleDrop(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('uploader__dropzone--active');
        const files = Array.from(event.dataTransfer.files || []);
        this.processFiles(files);
    }

    handleFileChange(event) {
        const files = Array.from(event.target.files || []);
        this.processFiles(files);
        event.target.value = '';
    }

    handleKeyPress(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const input = this.template.querySelector('.uploader__input');
            if (input) {
                input.click();
            }
        }
    }

    processFiles(files) {
        if (!files.length) {
            return;
        }
        const previews = files.map((file) => this.createItem(file));
        this.items = [...this.items, ...previews];
        this.submitForProcessing(previews);
    }

    createItem(file) {
        const id = `${file.name}-${Date.now()}-${Math.random()}`;
        const item = {
            id,
            file,
            fileName: file.name,
            statusLabel: 'Optimizing…',
            tags: null,
            summary: null,
            downloadUrl: null,
            previewStyle: this.buildPreviewStyle(file)
        };
        return item;
    }

    buildPreviewStyle(file) {
        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            return `background-image:url(${url})`;
        }
        return 'background-image:linear-gradient(135deg,#0176d3,#06b6d4);';
    }

    submitForProcessing(previews) {
        if (!this.propertyId) {
            this.markFailed(previews, 'Missing property context.');
            return;
        }
        const payload = previews.map((item) => ({
            body: null,
            fileName: item.file.name,
            mimeType: item.file.type
        }));

        Promise.all(previews.map((item) => this.readFile(item.file)))
            .then((bodies) => {
                bodies.forEach((body, index) => {
                    payload[index].body = body;
                });
                return processMedia({ propertyId: this.propertyId, mediaItems: payload });
            })
            .then((results) => {
                const resultMap = new Map();
                results.forEach((result) => {
                    resultMap.set(result.title, result);
                });
                this.items = this.items.map((item) => {
                    if (resultMap.has(item.fileName)) {
                        const processed = resultMap.get(item.fileName);
                        return {
                            ...item,
                            statusLabel: 'Ready',
                            tags: processed.tags,
                            summary: processed.summary,
                            downloadUrl: processed.downloadUrl
                        };
                    }
                    return item;
                });
                this.dispatchEvent(new CustomEvent('mediaready', { detail: results }));
            })
            .catch((error) => {
                this.markFailed(previews, error?.body?.message || error?.message || 'Upload failed');
            });
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    markFailed(items, message) {
        this.items = this.items.map((item) => {
            if (items.some((preview) => preview.id === item.id)) {
                return {
                    ...item,
                    statusLabel: message,
                    tags: null,
                    summary: null
                };
            }
            return item;
        });
    }

    handleOpen(event) {
        const id = event.currentTarget.dataset.id;
        const item = this.items.find((row) => row.id === id);
        if (item && item.downloadUrl) {
            window.open(item.downloadUrl, '_blank');
        }
    }
}
