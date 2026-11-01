import { accessSync, constants, statSync } from 'node:fs';
const file = '/app/storage/zahra.db';
try {
  if (!statSync(file).isFile() || statSync(file).size === 0) throw new Error('Missing database');
  accessSync(file, constants.R_OK | constants.W_OK);
  accessSync('/app/storage', constants.W_OK);
  if (!statSync('/app/storage/uploads').isDirectory()) throw new Error('Missing uploads directory');
  accessSync('/app/storage/uploads', constants.R_OK | constants.W_OK);
} catch {
  console.error('Refusing to start: restore and verify existing Zahra database and uploads first.');
  process.exit(1);
}
// No schema migration, seeding, password reset, or empty database creation on startup.
await import('../server.js');
