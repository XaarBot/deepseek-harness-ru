import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const load=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const tokens=s=>[...s.matchAll(/\{[\w.]+\}/g)].map(m=>m[0]).sort();
test('every upstream UI string has a translation with unchanged placeholders',()=>{
 const en=load('reference/en.json'),ru=load('plugin/ru.json');
 for(const [ns,d] of Object.entries(en))for(const [key,value] of Object.entries(d)) {
  assert.equal(typeof ru[ns]?.[key],'string',ns+'.'+key);assert.deepEqual(tokens(ru[ns][key]),tokens(value),ns+'.'+key);
  if(/[a-zA-Z]/.test(value))assert.ok(ru[ns][key].trim(),ns+'.'+key);
 }
 assert.equal(ru['settings.account'].onboardingArtworkLocale,'en');
});
test('shell dictionary has all original keys and placeholders',()=>{
 const en=load('reference/shell.en.json'),ru=load('shell.ru.json');assert.deepEqual(Object.keys(ru).sort(),Object.keys(en).sort());
 for(const key of Object.keys(en))assert.deepEqual(tokens(ru[key]),tokens(en[key]),key);
 assert.equal(ru.aboutProduct,'DeepSeek Harness');assert.equal(ru.application,'Приложение');
});
test('generated bundle is executable and exposes the required plugin contract',()=>{
 let result;vm.runInNewContext(fs.readFileSync(new URL('../plugin/lib/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load(m){assert.equal(m.id,'dsh-locale-ru-local');result=m.factory();}}}});
 assert.equal(typeof result.apply,'function');assert.deepEqual(Array.from(result.inject),['locale']);
});
