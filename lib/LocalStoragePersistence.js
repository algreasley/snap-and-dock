/* globals localStorage */

export default class LocalStoragePersistence {
    constructor(idPrefix) {
        this.prefix = idPrefix;
    }

    createRelationship(id1, id2) {
        const partners = this.retrieveRelationshipsFor(id1);
        if (partners.indexOf(id2) !== -1) {
            return;
        }
        partners.push(id2);
        localStorage.setItem(this.getFullStorageKey(id1), JSON.stringify(partners));
    }

    createRelationshipsBetween(id1, id2) {
        this.createRelationship(id1, id2);
        this.createRelationship(id2, id1);
    }

    retrieveRelationshipsFor(id) {
        const storedRelationships = JSON.parse(localStorage.getItem(this.getFullStorageKey(id)));
        return storedRelationships || [];
    }

    removeRelationship(id1, id2) {
        const currentPartners = this.retrieveRelationshipsFor(id1);
        const partnerIndex = currentPartners.indexOf(id2);
        if (partnerIndex === -1) {
            return;
        }

        currentPartners.splice(partnerIndex, 1);

        if (currentPartners.length > 0) {
            localStorage.setItem(this.getFullStorageKey(id1), JSON.stringify(currentPartners));
        } else {
            localStorage.removeItem(this.getFullStorageKey(id1));
        }
    }

    removeAllRelationships(id) {
        // grab existing partner windows before removing all trace of this window's persistence
        const currentPartners = this.retrieveRelationshipsFor(id);
        localStorage.removeItem(this.getFullStorageKey(id));

        // remove all 'reverse' relationships from partners too
        for (let i = 0; i < currentPartners.length; i++) {
            this.removeRelationship(currentPartners[i], id);
        }
    }

    getFullStorageKey(id) {
        return `${this.prefix}.${id}`;
    }
}
