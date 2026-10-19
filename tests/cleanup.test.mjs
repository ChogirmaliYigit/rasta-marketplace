import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../apps/api/server.mjs';
import { cleanDemoData } from '../scripts/clean-demo-data.mjs';

test('cleanup preserves only selected admin, backs up DB, revokes sessions and requires unique password', async () => {
  const dir=mkdtempSync(join(tmpdir(),'rasta-clean-'));
  const database=join(dir,'test.sqlite'); let app;
  let base;
  const start = async demo => { app=createApp({database,demo});await new Promise(r=>app.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.address().port; };
  const request=async (role,path,body,token,method='POST')=>{
    const r=await fetch(base+'/api'+path,{method:body===undefined?'GET':method,headers:{'Content-Type':'application/json','X-Rasta-App':role,...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};
  };
  try {
    await start(true);
    const login=(await request('admin','/login',{email:'admin@rasta.uz',password:'RastaDemo2026!',native:true})).body;
    const original=(await request('admin','/state',undefined,login.token)).body;
    await new Promise(r=>app.close(r)); app=null;
    assert.throws(()=>cleanDemoData({database,adminId:'unknown',backupDirectory:join(dir,'backups')}));
    const result=cleanDemoData({database,adminId:login.user.id,backupDirectory:join(dir,'backups')});
    assert.equal(statSync(result.backup).mode & 0o777,0o600);
    const backup=new DatabaseSync(result.backup,{readOnly:true});
    assert.equal(JSON.parse(backup.prepare('SELECT data FROM state WHERE id=1').get().data).orders.length,original.orders.length);backup.close();
    const db=new DatabaseSync(database,{readOnly:true});
    const state=JSON.parse(db.prepare('SELECT data FROM state WHERE id=1').get().data);
    assert.equal(state.users.length,1); assert.equal(state.users[0].id,login.user.id);
    assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n,0);
    for(const name of ['orders','products','suppliers','stores','movements','imports','integrations']) assert.deepEqual(state[name],[]);
    assert.deepEqual(state.carts,{});assert.deepEqual(state.notificationReads,{});db.close();
    await start(false);
    assert.equal((await request('admin','/state',undefined,login.token)).status,401);
    assert.equal((await request('supplier','/login',{email:'optom@rasta.uz',password:'RastaDemo2026!'})).status,401);
    const token=(await request('admin','/login',{email:'admin@rasta.uz',password:'RastaDemo2026!',native:true})).body.token;
    assert.equal((await request('admin','/state',undefined,token)).body.user.mustChangePassword,true);
    assert.equal((await request('admin','/settings',{commissionRate:1},token,'PATCH')).status,403);
    assert.equal((await request('admin','/password',{current:'RastaDemo2026!',password:'RastaDemo2026!'},token)).status,400);
    assert.equal((await request('admin','/password',{current:'RastaDemo2026!',password:'UniqueCleanupTest2026!'},token)).status,200);
    assert.equal((await request('admin','/state',undefined,token)).body.user.mustChangePassword,false);
    assert.equal((await request('admin','/settings',{commissionRate:1},token,'PATCH')).status,200);
    await new Promise(r=>app.close(r));app=null;
    await start(false);
    assert.equal((await request('admin','/state',undefined,token)).body.products.length,0);
  } finally { if(app) await new Promise(r=>app.close(r));rmSync(dir,{recursive:true,force:true}); }
});

test('production rejects demo seeding', () => {
  const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';
  try {assert.throws(()=>createApp({database:':memory:',demo:true}),/demo/);}
  finally {if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});
