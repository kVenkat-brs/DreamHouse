import { LightningElement, api, track } from 'lwc';
import getSession from '@salesforce/apex/SharedReviewSessionService.getSession';
import upsertDraft from '@salesforce/apex/SharedReviewSessionService.upsertDraft';
import addComment from '@salesforce/apex/SharedReviewSessionService.addComment';

export default class SharedReviewComposer extends LightningElement {
    @api sessionId;
    @track session;
    @track participants = [];
    @track comments = [];
    draftHtml = '';
    commentDraft = '';
    sessionLoaded = false;

    connectedCallback() {
        this.loadSession();
        this.channel = new BroadcastChannel('sharedReview');
        this.channel.onmessage = (event) => {
            if (event.data?.type === 'refresh' && event.data.sessionId === this.sessionId) {
                this.loadSession();
            }
        };
    }

    disconnectedCallback() {
        if (this.channel) {
            this.channel.close();
        }
    }

    loadSession() {
        getSession({ sessionId: this.sessionId })
            .then((session) => {
                this.session = session;
                this.draftHtml = session.draftHtml || '';
                this.participants = session.participants || [];
                this.comments = session.comments || [];
                this.sessionLoaded = true;
            })
            .catch((error) => {
                // eslint-disable-next-line no-console
                console.error('Failed to load session', error);
            });
    }

    handleDraftChange(event) {
        this.draftHtml = event.detail.value;
        this.debouncedSave();
    }

    debouncedSave() {
        window.clearTimeout(this.saveTimer);
        this.saveTimer = window.setTimeout(() => this.handleSave(), 2000);
    }

    handleSave() {
        if (!this.sessionId) {
            return;
        }
        upsertDraft({ sessionId: this.sessionId, draftHtml: this.draftHtml })
            .then(() => {
                this.channel?.postMessage({ type: 'refresh', sessionId: this.sessionId });
            })
            .catch((error) => {
                // eslint-disable-next-line no-console
                console.error('Save failed', error);
            });
    }

    handlePublish() {
        this.dispatchEvent(new CustomEvent('publish', { detail: { draftHtml: this.draftHtml } }));
    }

    handleCommentChange(event) {
        this.commentDraft = event.target.value;
    }

    handleCommentPost() {
        if (!this.commentDraft.trim()) {
            return;
        }
        addComment({ sessionId: this.sessionId, body: this.commentDraft })
            .then(() => {
                this.commentDraft = '';
                this.channel?.postMessage({ type: 'refresh', sessionId: this.sessionId });
                this.loadSession();
            })
            .catch((error) => {
                // eslint-disable-next-line no-console
                console.error('Comment failed', error);
            });
    }

    participantClass(participant) {
        const classes = ['shared-review__participant'];
        if (participant.isMe) {
            classes.push('shared-review__participant--me');
        }
        return classes.join(' ');
    }
}
