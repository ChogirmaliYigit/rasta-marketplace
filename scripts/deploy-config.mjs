import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
export function validateDeployment(env) {
  const keys=['SUPPLIER_DOMAIN','ADMIN_DOMAIN','API_DOMAIN'];
  for (const key of keys) {
    const host=env[key] || '';
    if (host.length>253 || !host.includes('.') || !host.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || /change-me|example\.(com|org|net)/i.test(host))
      throw new Error(`${key}: haqiqiy kichik harfdagi domen kiriting (https:// va yo‘lsiz).`);
  }
  if (new Set(keys.map(k=>env[k])).size!==3) throw new Error('Uchala subdomen alohida bo‘lsin.');
  for (const key of ['ADMIN_EMAIL','ACME_EMAIL'])
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env[key] || '') || /change-me|@example\./i.test(env[key])) throw new Error(`${key}: haqiqiy email kiriting.`);
  const password=env.ADMIN_PASSWORD || '';
  if(password.length<12 || password.length>128 || /change-me/i.test(password) || password==='RastaDemo2026!')
    throw new Error('ADMIN_PASSWORD: 12–128 belgili shaxsiy parol kiriting.');
  return {supplier:`https://${env.SUPPLIER_DOMAIN}`,admin:`https://${env.ADMIN_DOMAIN}`,api:`https://${env.API_DOMAIN}`};
}
export function loadDeployment(file='deploy/.env') {
  let env;
  try { env=parseEnv(readFileSync(resolve(file),'utf8')); }
  catch { throw new Error(`${file} topilmadi. deploy/.env.example dan nusxa yarating va qiymatlarni to‘ldiring.`); }
  return {env,urls:validateDeployment(env)};
}
