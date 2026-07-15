/**
 * Storage adapter for InternDesk.
 *
 * Default implementation uses the browser's localStorage. This is fine for
 * demos and single-machine use, but data is NOT shared between devices or
 * users. For real multi-user deployment, replace these four functions with
 * calls to a backend (e.g. Supabase) — the rest of the app only talks to
 * this module. See README.md for the upgrade path.
 */

const PREFIX = "interndesk:";

export const storage = {
  async get(key) {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) throw new Error("Key not found: " + key);
    return { key, value: raw };
  },
  async set(key, value) {
    localStorage.setItem(PREFIX + key, value);
    return { key, value };
  },
  async delete(key) {
    localStorage.removeItem(PREFIX + key);
    return { key, deleted: true };
  },
};
