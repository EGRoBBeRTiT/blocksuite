import initSqlJs, { Database } from 'sql.js';
import sqliteUrl from '../../../assets/sql-wasm.wasm?url';

export async function initEmptyDb() {
  const SQL = await initSqlJs({
    locateFile: () => sqliteUrl,
  });

  const db = new SQL.Database();
  const sqlstrs = [
    `
    CREATE TABLE IF NOT EXISTS docs (
      doc_id TEXT PRIMARY KEY,
      root_doc_id TEXT,
      FOREIGN KEY (root_doc_id) REFERENCES docs(doc_id)
    );`,
    `
    CREATE TABLE IF NOT EXISTS updates (
      update_id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id TEXT,
      update_data BLOB,
      FOREIGN KEY (doc_id) REFERENCES docs(doc_id)
    );

    CREATE TABLE IF NOT EXISTS blobs (
      blob_id TEXT PRIMARY KEY,
      blob_data BLOB
    );
    `,
  ];
  sqlstrs.forEach(sqlstr => db.run(sqlstr));
  return db;
}

export async function loadDb(data: Uint8Array) {
  const SQL = await initSqlJs({
    locateFile: () => sqliteUrl,
  });
  return new SQL.Database(data);
}

export function insertDocToDb(
  db: Database,
  docId: string,
  rootDocId: string | null
) {
  db.run('INSERT INTO docs (doc_id, root_doc_id) VALUES (?, ?)', [
    docId,
    rootDocId,
  ]);
}

export function insertUpdateToDb(
  db: Database,
  docId: string,
  update: Uint8Array
) {
  db.run('INSERT INTO updates (doc_id, update_data) VALUES (?, ?)', [
    docId,
    update,
  ]);
}

export async function insertBlobToDb(
  db: Database,
  blobId: string,
  blobData: Blob
) {
  return new Promise<void>(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      db.run('INSERT INTO blobs (blob_id, blob_data) VALUES (?, ?)', [
        blobId,
        new Uint8Array(arrayBuffer),
      ]);
      resolve();
    };
    reader.readAsArrayBuffer(blobData);
  });
}

export function getBlobFromDb(db: Database, blobId: string) {
  const results = db.exec('SELECT blob_data FROM blobs WHERE blob_id = ?', [
    blobId,
  ]);
  const blob = results[0].values[0][0] as Uint8Array;
  if (!blob) return null;
  return new Blob([blob]);
}

export function deleteBlobFromDb(db: Database, blobId: string) {
  db.run('DELETE FROM blobs WHERE blob_id = ?', [blobId]);
}

export function getAllBlobIds(db: Database) {
  const sql = `SELECT blob_id FROM blobs`;
  const stmt = db.prepare(sql);
  const blobIds: string[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    blobIds.push(row.blob_id as string);
  }
  stmt.free();
  return blobIds;
}

export function getUpdatesFromDoc(db: Database, docId: string) {
  const sqlStr = 'SELECT update_data FROM updates WHERE doc_id = ?';
  const stmt = db.prepare(sqlStr);
  stmt.bind([docId]);

  const updates = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const updateData = new Uint8Array(row.update_data as ArrayBufferLike);
    updates.push(updateData);
  }
  stmt.free();

  return updates;
}

export function getRootDocId(db: Database) {
  const results = db.exec('SELECT * FROM docs WHERE root_doc_id IS NULL;');
  let id = '';
  results[0].columns.forEach((column: string, index) => {
    if (column === 'doc_id') {
      id = results[0].values[0][index] as string;
    }
  });
  return id;
}

export function isTableEmpty(tableName: string, db: Database) {
  const sqlStr = `SELECT COUNT(*) AS count FROM ${tableName}`;
  const stmt = db.prepare(sqlStr);
  stmt.step();

  const result = stmt.getAsObject();
  stmt.free();

  return result.count === 0;
}
