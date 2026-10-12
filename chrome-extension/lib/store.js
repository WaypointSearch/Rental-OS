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
      await SOR.store.removeFromQueue(id);
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
      await local().set({ listing_index: [], _postQueue: [] });
      await local().remove(['_activeMLS', '_scrapeProgress', '_clPostings']);
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

    // ── Posting queue ──────────────────────────────────────────
    async getQueue() {
      const r = await local().get('_postQueue');
      return Array.isArray(r._postQueue) ? r._postQueue : [];
    },

    async setQueue(ids) {
      const q = Array.from(new Set((ids || []).filter(Boolean)));
      await local().set({ _postQueue: q });
      return q;
    },

    async appendToQueue(ids) {
      return SOR.store.setQueue((await SOR.store.getQueue()).concat(ids || []));
    },

    async removeFromQueue(id) {
      const q = await SOR.store.getQueue();
      if (q.includes(id)) await SOR.store.setQueue(q.filter(x => x !== id));
    },

    // Drops deleted listings and, when enabled, re-queues listings whose 48h repost wait is over.
    // Existence is checked straight from storage (never from a cached listing list) and the queue is
    // re-read right before writing, so a listing appended by an import isn't dropped by another tab.
    async syncQueue(settings) {
      const s = settings || await SOR.store.loadSettings();
      const q = await SOR.store.getQueue();
      const have = q.length ? await local().get(q.map(listingKey)) : {};
      const missing = q.filter(id => !have[listingKey(id)]);
      let due = [];
      if (s.requeueAfter48h) {
        due = (await SOR.store.getAllListings())
          .filter(l => l.posted && l.posted.clPublishedAt && !l.needsAttention && !SOR.isRecentlyPosted(l) && !q.includes(l.mlsNumber))
          .sort((a, b) => Date.parse(a.posted.clPublishedAt) - Date.parse(b.posted.clPublishedAt))
          .map(l => l.mlsNumber);
      }
      if (!missing.length && !due.length) return q;
      const fresh = await SOR.store.getQueue();
      const next = fresh.filter(id => !missing.includes(id)).concat(due.filter(id => !fresh.includes(id)));
      return SOR.store.setQueue(next);
    },

    // First queued listing that may be posted now (not posted in the last 48h, not flagged).
    nextPostable(queue, listings) {
      return (queue || []).find(id => SOR.isPostable((listings || []).find(l => l.mlsNumber === id))) || '';
    },

    async markPublished(id) {
      const l = await SOR.store.getListing(id);
      if (!l) return null;
      const prev = l.posted && typeof l.posted === 'object' ? l.posted : {};
      const now = new Date().toISOString();
      l.posted = Object.assign({}, prev, {
        craigslist: true,
        clPublishedAt: now,
        clPublishCount: (prev.clPublishCount || 0) + 1,
        clPublishLog: (prev.clPublishLog || []).concat(now).slice(-30),
      });
      delete l.needsAttention;
      await SOR.store.saveListing(l);
      await SOR.store.removeFromQueue(id);
      return l;
    },

    async markNeedsAttention(id, reason) {
      const l = await SOR.store.getListing(id);
      if (!l) return null;
      l.needsAttention = { reason: String(reason || 'Needs a look'), at: new Date().toISOString() };
      await SOR.store.saveListing(l);
      await SOR.store.removeFromQueue(id);
      return l;
    },

    async clearNeedsAttention(id, requeue) {
      const l = await SOR.store.getListing(id);
      if (!l) return null;
      delete l.needsAttention;
      await SOR.store.saveListing(l);
      if (requeue) await SOR.store.appendToQueue([id]);
      return l;
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
