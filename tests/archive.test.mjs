import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArchive,readEntry,replaceEntries,setLocale} from '../scripts/archive.mjs';

function fixture() {
 const json=Buffer.from(JSON.stringify({files:{'a.txt':{size:3,offset:'0'},lib:{files:{'b.txt':{size:4,offset:'3'}}},'native.node':{size:20,unpacked:true}}}));
 const padding=(4-((json.length+4)%4))%4;
 const h=Buffer.alloc(16);h.writeUInt32LE(4,0);h.writeUInt32LE(json.length+8+padding,4);h.writeUInt32LE(json.length+4+padding,8);h.writeUInt32LE(json.length,12);
 return Buffer.concat([h,json,Buffer.alloc(padding),Buffer.from('abcDEFG')]);
}
test('reads original nested ASAR content',()=>{assert.equal(readEntry(fixture(),'lib/b.txt').toString(),'DEFG');});
test('replaces one UTF-8 file without changing other files or unpacked entries',()=>{
 const input=fixture(),output=replaceEntries(input,{'lib/b.txt':Buffer.from('Привет')});
 assert.equal(readEntry(output,'a.txt').toString(),'abc');assert.equal(readEntry(output,'lib/b.txt').toString(),'Привет');
 assert.deepEqual(parseArchive(output).header.files['native.node'],{size:20,unpacked:true});
 assert.deepEqual(parseArchive(output).payload.subarray(0,7),Buffer.from('abcDEFG'));
 assert.equal(parseArchive(output).header.files.lib.files['b.txt'].integrity.algorithm,'SHA256');
});
test('refuses invalid archives and missing/unpacked entries',()=>{
 assert.throws(()=>parseArchive(Buffer.from('bad')));assert.throws(()=>readEntry(fixture(),'absent'));assert.throws(()=>replaceEntries(fixture(),{'native.node':Buffer.from('x')}));
});
test('adds locale without changing model and permission settings',()=>{
 const config='# keep\n- id: model\n  config:\n    value: custom\n';const output=setLocale(config,'ru');
 assert.ok(output.startsWith(config));assert.match(output,/preference: ru/);assert.equal(setLocale(output,'ru'),output);
});
test('changes only locale preference in existing block and preserves later sections',()=>{
 const config='- id: locale\n  name: "@deepseek-ai/dsh-client-locale"\n  config:\n    preference: en\n- id: other\n  config:\n    preference: dark\n';
 assert.equal(setLocale(config,'ru'),config.replace('preference: en','preference: ru'));
});
