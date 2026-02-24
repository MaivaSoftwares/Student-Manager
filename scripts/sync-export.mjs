#!/usr/bin/env node
import fs from 'fs/promises';

const filePath = process.argv[2] || './export.json';
const syncUrl = process.env.SYNC_URL || 'http://localhost:3000/api/sync';
const syncKey = process.env.SYNC_KEY || '';
const maxAttempts = 3;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function loadExport(path) {
  const raw = await fs.readFile(path, 'utf8');
  // Validate JSON
  JSON.parse(raw);
  return raw;
}

async function postData(body) {
  const headers = { 'Content-Type': 'application/json' };
  if (syncKey) headers['x-sync-key'] = syncKey;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(syncUrl, { method: 'POST', headers, body });
      const text = await res.text();
      let out;
      try { out = JSON.parse(text); } catch { out = text; }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(out)}`);
      console.log('Sync successful:', out);
      return out;
    } catch (err) {
      console.error(`Attempt ${attempt} failed:`, err.message || err);
      if (attempt < maxAttempts) await sleep(500 * attempt);
      else throw err;
    }
  }
}

async function main() {
  try {
    console.log('Loading export file:', filePath);
    const body = await loadExport(filePath);
    console.log('Posting to', syncUrl);
    await postData(body);
  } catch (err) {
    console.error('Sync failed:', err);
    process.exitCode = 1;
  }
}

main();
