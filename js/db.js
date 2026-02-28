/* js/db.js — IndexedDB wrapper for GP Prompt Database */

const DB_NAME    = 'gp-prompt-db';
const DB_VERSION = 1;

let _db = null;

export async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;

      // Prompts store
      if (!db.objectStoreNames.contains('prompts')) {
        const store = db.createObjectStore('prompts', { keyPath: 'id' });
        store.createIndex('createdAt',  'createdAt',  { unique: false });
        store.createIndex('copyCount',  'copyCount',  { unique: false });
        store.createIndex('isStarred',  'isStarred',  { unique: false });
      }

      // Tags store
      if (!db.objectStoreNames.contains('tags')) {
        const store = db.createObjectStore('tags', { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: true });
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    };

    req.onsuccess  = e => { _db = e.target.result; resolve(_db); };
    req.onerror    = e => reject(e.target.error);
  });
}

/* ---- Generic helpers ---- */

function tx(storeName, mode = 'readonly') {
  return _db.transaction(storeName, mode).objectStore(storeName);
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

/* ---- Prompts ---- */

export async function getAllPrompts() {
  await openDB();
  return promisify(tx('prompts').getAll());
}

export async function savePrompt(prompt) {
  await openDB();
  return promisify(tx('prompts', 'readwrite').put(prompt));
}

export async function deletePrompt(id) {
  await openDB();
  return promisify(tx('prompts', 'readwrite').delete(id));
}

/* ---- Tags ---- */

export async function getAllTags() {
  await openDB();
  return promisify(tx('tags').getAll());
}

export async function saveTag(tag) {
  await openDB();
  return promisify(tx('tags', 'readwrite').put(tag));
}

export async function deleteTag(id) {
  await openDB();
  return promisify(tx('tags', 'readwrite').delete(id));
}

/* ---- Settings ---- */

export async function getSetting(key) {
  await openDB();
  return promisify(tx('settings').get(key));
}

export async function setSetting(key, value) {
  await openDB();
  return promisify(tx('settings', 'readwrite').put(value, key));
}

/* ---- Bulk import (replace entire DB) ---- */

export async function importData({ prompts, tags }) {
  await openDB();
  const db = _db;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['prompts', 'tags'], 'readwrite');
    transaction.onerror   = e => reject(e.target.error);
    transaction.oncomplete = () => resolve();

    const pStore = transaction.objectStore('prompts');
    const tStore = transaction.objectStore('tags');

    pStore.clear();
    tStore.clear();

    for (const p of prompts) pStore.put(p);
    for (const t of tags)    tStore.put(t);
  });
}
