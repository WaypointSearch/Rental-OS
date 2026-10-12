/* Sun Ocean Realty — storage helpers (chrome.storage.local).
 * Shared by the background worker, extension pages and the Craigslist content script.
 */
(function (root) {
  'use strict';

  const SOR = root.SOR = root.SOR || {};
  const local = () => chrome.storage.local;
  const MAX_PHOTO_SLOTS = 60;

  const listingKey = (id) => `listing_${id}`;
  const photoKey = (id, i) => `photo_${id}_${String(i).padStart(2, '0')}`;

  async function getIndex() {
    const r = await local().get('listing_index');
    return Array.isArray(r.listing_index) ? r.listing_index : [];
  }

  SOR.store = {
    listingKey,
    photoKey,

    async loadSettings() {
      const r = await local().get(SOR.SETTINGS_KEY);
      return SOR.mergeSettings(r[SOR.SETTINGS_KEY]);
    },

    async saveSettings(settings) {
      const merged = SOR.mergeSettings(settings);
      await local().set({ [SOR.SETTINGS_KEY]: merged });
      return merged;
    },

    async setActiveAgent(agentId) {
      const s = await SOR.store.loadSettings();
      s.activeAgentId = agentId;
      return SOR.store.saveSettings(s);
    },

    async getApiKey() {
      const r = await local().get(SOR.AI_KEY);
      return String(r[SOR.AI_KEY] || '').trim();
    },

    async setApiKey(key) {
      const k = String(key || '').trim();
      if (k) await local().set({ [SOR.AI_KEY]: k });
      else await local().remove(SOR.AI_KEY);
    },

    async getAllListings() {
      const index = await getIndex();
      if (!index.length) return [];
      const data = await local().get(index.map(listingKey));
      return index.map(id => data[listingKey(id)]).filter(Boolean);
    },

    async getListing(id) {
      if (!id) return null;
      const r = await local().get(listingKey(id));
      return r[listingKey(id)] || null;
    },

    // toFront: move to the top of the list (new scrapes). Edits keep their position.
    async saveListing(listing, opts) {
      const id = listing && listing.mlsNumber;
      if (!id) throw new Error('Listing has no ID');
      await local().set({ [listingKey(id)]: listing });
      const index = await getIndex();
      const has = index.includes(id);
      if (!has || (opts && opts.toFront)) {
        const next = index.filter(x => x !== id);
        next.unshift(id);
        await local().set({ listing_index: next });
      }
      return listing;
    },

    async deleteListing(id) {
      const keys = [listingKey(id)];
      for (let i = 1; i <= MAX_PHOTO_SLOTS; i++) keys.push(photoKey(id, i));
      await local().remove(keys);
      const index = (await getIndex()).filter(x => x !== id);
      await local().set({ listing_index: index });
      const r = await local().get('_activeMLS');
      if (r._activeMLS === id) await local().remove('_activeMLS');
    },

    // Removes listings + photos only. Settings, agents and the API key survive.
    async clearListings() {
      const index = await getIndex();
      for (const id of index) await SOR.store.deleteListing(id);
      if (typeof local().getKeys === 'function') {
        const keys = (await local().getKeys()).filter(k => /^(listing_|photo_)/.test(k) && k !== 'listing_index');
        if (keys.length) await local().remove(keys);
      }
      await local().set({ listing_index: [] });
      await local().remove(['_activeMLS', '_scrapeProgress']);
    },

    async getPhotos(id) {
      const l = await SOR.store.getListing(id);
      const count = Math.min((l && l.photoCount) || 0, MAX_PHOTO_SLOTS);
      if (!count) return [];
      const keys = [];
      for (let i = 1; i <= count; i++) keys.push(photoKey(id, i));
      const data = await local().get(keys);
      return keys.map(k => data[k]).filter(Boolean);
    },

    // Replace the whole photo set (used by the editor for add / remove / reorder).
    async setPhotos(id, photos) {
      const list = (photos || []).filter(Boolean).slice(0, MAX_PHOTO_SLOTS);
      const set = {};
      list.forEach((p, i) => { set[photoKey(id, i + 1)] = p; });
      const stale = [];
      for (let i = list.length + 1; i <= MAX_PHOTO_SLOTS; i++) stale.push(photoKey(id, i));
      if (Object.keys(set).length) await local().set(set);
      await local().remove(stale);
      const l = await SOR.store.getListing(id);
      if (l) { l.photoCount = list.length; await SOR.store.saveListing(l); }
      return list.length;
    },

    async markFilled(id, info) {
      const l = await SOR.store.getListing(id);
      if (!l) return null;
      const prev = l.posted && typeof l.posted === 'object' ? l.posted : {};
      l.posted = Object.assign({}, prev, {
        craigslist: true,
        clFilledAt: new Date().toISOString(),
        clAgentId: info && info.agentId,
        clTitle: info && info.title,
        clCount: (prev.clCount || 0) + 1,
      });
      delete l.posted.facebook;
      await SOR.store.saveListing(l);
      return l;
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
