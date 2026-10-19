import { DatabaseSync } from 'node:sqlite';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Run with the API stopped. Backups contain credentials and are owner-readable only.
export function cleanDemoData({ database, adminId, backupDirectory }) {
  const db = new DatabaseSync(database);
  try {
    const original = JSON.parse(db.prepare('SELECT data FROM state WHERE id=1').get().data);
    const admin = original.users.find(u => u.id === adminId && u.role === 'admin');
    if (!admin) throw new Error('Saqlanadigan admin topilmadi. Baza o‘zgartirilmadi.');
    mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
    chmodSync(backupDirectory, 0o700);
    const backup = resolve(backupDirectory, `before-clean-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
    db.prepare('VACUUM INTO ?').run(backup);
    chmodSync(backup, 0o600);
    const [salt, encoded] = admin.passwordHash.split(':');
    const demoPassword = timingSafeEqual(scryptSync('RastaDemo2026!', salt, 32), Buffer.from(encoded, 'hex'));
    const retainedAdmin = { ...admin, mustChangePassword: !!admin.mustChangePassword || demoPassword };
    const empty = {
      users: [retainedAdmin], suppliers: [], stores: [], products: [], orders: [],
      movements: [], imports: [], integrations: [], carts: {}, notificationReads: {},
      settings: { commissionRate: null }, nextOrder: 10001,
    };
    db.exec('PRAGMA secure_delete=ON; BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE state SET data=? WHERE id=1').run(JSON.stringify(empty));
      db.exec('DELETE FROM sessions; COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    db.exec('PRAGMA wal_checkpoint(TRUNCATE); VACUUM; PRAGMA wal_checkpoint(TRUNCATE)');
    chmodSync(database, 0o600);
    return { backup, admin: { id: admin.id, email: admin.email, mustChangePassword: retainedAdmin.mustChangePassword },
      removed: Object.fromEntries(Object.entries(original).filter(([k,v]) => k !== 'users' && Array.isArray(v)).map(([k,v]) => [k,v.length])),
      removedUsers: original.users.length - 1 };
  } finally { db.close(); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [database, adminId, apply] = process.argv.slice(2);
  if (!database || !adminId || apply !== '--apply') {
    console.error('API serverini to‘xtating. node scripts/clean-demo-data.mjs <database> <admin-id> --apply');
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(cleanDemoData({database:resolve(database),adminId,backupDirectory:resolve(dirname(database),'backups')}),null,2));
  }
}
