import { execute } from '../config/crate.js';

export async function checkDatabase() {
  await execute('SELECT 1');
  return true;
}
