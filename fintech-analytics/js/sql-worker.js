/*
 * Runs SQLite (sql.js) off the main thread, so a slow query never freezes the page.
 * Messages in:  { id, type: 'open', url } | { id, type: 'exec', sql } | { id, type: 'reset' }
 * Messages out: { id, ok: true, ... } | { id, ok: false, error }
 */
/* global initSqlJs */
'use strict';
const SQLJS = 'https://cdn.jsdelivr.net/npm/sql.js@1.15.2/dist/';
importScripts(SQLJS + 'sql-wasm.js');

let SQL = null;
let db = null;
let bytes = null; // the unpacked database, kept so "Reset database" is instant

async function unpack(buffer) {
  const view = new Uint8Array(buffer);
  // Some servers unzip .gz files on the way. Only decompress if it is still gzip.
  if (view[0] !== 0x1f || view[1] !== 0x8b) return view;
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot unpack the database. Please use a recent version of Chrome, Edge, Firefox or Safari.');
  const stream = new Blob([view]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function open(url) {
  const t0 = performance.now();
  const [lib, buffer] = await Promise.all([
    SQL ? SQL : initSqlJs({ locateFile: (f) => SQLJS + f }),
    fetch(url).then((r) => { if (!r.ok) throw new Error('Could not download the database (' + r.status + ').'); return r.arrayBuffer(); }),
  ]);
  SQL = lib;
  const t1 = performance.now();
  bytes = await unpack(buffer);
  db = new SQL.Database(bytes);
  const version = db.exec('SELECT sqlite_version()')[0].values[0][0];
  return { downloadMs: Math.round(t1 - t0), openMs: Math.round(performance.now() - t1), bytes: bytes.length, compressedBytes: buffer.byteLength, sqliteVersion: version };
}

function exec(sql) {
  if (!db) throw new Error('The database is not open yet.');
  const t0 = performance.now();
  const results = db.exec(sql);
  const ms = Math.round((performance.now() - t0) * 10) / 10;
  const last = results[results.length - 1];
  if (!last) return { columns: [], rows: [], ms, changed: db.getRowsModified(), statements: 0 };
  return { columns: last.columns, rows: last.values, ms, statements: results.length };
}

self.onmessage = async (e) => {
  const { id, type } = e.data;
  try {
    let out;
    if (type === 'open') out = await open(e.data.url);
    else if (type === 'exec') out = exec(e.data.sql);
    else if (type === 'reset') { if (db) db.close(); db = new SQL.Database(bytes); out = { reset: true }; }
    else throw new Error('Unknown request: ' + type);
    self.postMessage(Object.assign({ id, ok: true }, out));
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
