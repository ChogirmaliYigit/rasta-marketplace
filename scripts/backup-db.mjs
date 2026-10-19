import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const database = resolve(process.env.DATABASE_PATH || 'data/rasta.sqlite');
const directory = resolve(dirname(database), 'backups');
mkdirSync(directory, { recursive:true, mode:0o700 });
const path = resolve(directory, `rasta-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);
const db = new DatabaseSync(database, {readOnly:true});
try { db.prepare('VACUUM INTO ?').run(path); chmodSync(path,0o600); console.log(path); }
finally { db.close(); }
