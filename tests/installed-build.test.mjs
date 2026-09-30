import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {run,ORIGINAL_SHA256} from '../scripts/patch-shell.mjs';
import {sha256,readEntry} from '../scripts/archive.mjs';

test('real supported archive: apply, repeat, restore, unknown-hash refusal', {skip: !process.env.DSH_TEST_ARCHIVE},()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-ru-test-')),app=path.join(temp,'app'),state=path.join(temp,'state'),target=path.join(app,'resources','app.asar');
 try {
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(process.env.DSH_TEST_ARCHIVE,target);
  assert.equal(sha256(fs.readFileSync(target)),ORIGINAL_SHA256);
  run('check',app,state);run('apply',app,state);
  const first=fs.readFileSync(target),hash=sha256(first);assert.notEqual(hash,ORIGINAL_SHA256);
  assert.match(readEntry(first,'lib/preload-app.cjs').toString(),/Приложение/);
  assert.match(readEntry(first,'lib/main.js').toString(),/selected === "ru"/);
  run('apply',app,state);assert.equal(sha256(fs.readFileSync(target)),hash);
  run('restore',app,state);assert.equal(sha256(fs.readFileSync(target)),ORIGINAL_SHA256);
  fs.appendFileSync(target,'unknown-change');assert.throws(()=>run('apply',app,state),/Unknown or modified/);
  assert.equal(fs.readFileSync(target).subarray(-14).toString(),'unknown-change');
 } finally { fs.rmSync(temp,{recursive:true,force:true}); }
});
