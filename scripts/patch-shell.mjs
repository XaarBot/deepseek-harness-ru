import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readEntry,replaceEntries,sha256,setLocale} from './archive.mjs';
// Electron's regular fs treats .asar as a directory. original-fs reads its bytes.
const require=createRequire(import.meta.url);
const fs=process.versions.electron?require('original-fs'):require('node:fs');
export const SUPPORTED_VERSION='0.2.0-rc.2';
export const ORIGINAL_SHA256='983ca71114e6dfd353fc79af5a1f9481a250ee64c2a3c757673029b811b23bc2';
const root=new URL('../',import.meta.url);
function replaceOnce(source,needle,replacement) {
 if(source.split(needle).length!==2)throw new Error('Unexpected source layout: '+needle.slice(0,60));
 return source.replace(needle,replacement);
}
export function createPatches(original,shell) {
 const patches={};
 for(const name of ['lib/main.js','lib/preload-app.cjs','lib/preload-welcome.cjs']) {
  let source=readEntry(original,name).toString('utf8');
  const needle='function resolveDesktopLocale(locale) {\n';
  source=replaceOnce(source,needle,'const ruLocal = '+JSON.stringify(shell)+';\n'+needle+'\tif (locale.toLowerCase().startsWith("ru")) return {id: "ru", messages: ruLocal};\n');
  if(name==='lib/main.js') {
   source=replaceOnce(source,'selected === "zh" || selected === "en"','selected === "zh" || selected === "en" || selected === "ru"');
   source=replaceOnce(source,'primary === "zh" || primary === "en"','primary === "zh" || primary === "en" || primary === "ru"');
  }
  patches[name]=Buffer.from(source);
 }
 const name='dsh/node_modules/@deepseek-ai/dsh-client-ui-model-selection/lib/client.js';
 let source=readEntry(original,name).toString('utf8');
 source=replaceOnce(source,'factory: (require) => {',`factory: (require) => {
 function localizedEffort(t, id, original) {
  const key = 'effort.level.' + id, translated = t(key);
  return translated === key ? original : translated;
 }
`);
 source=replaceOnce(source,'reasoning.efforts.find((level) => level.id === effectiveEffort)?.name ?? effectiveEffort','localizedEffort(t, effectiveEffort, reasoning.efforts.find((level) => level.id === effectiveEffort)?.name ?? effectiveEffort)');
 source=replaceOnce(source,'label: effort.name','label: localizedEffort(t, effort.id, effort.name)');
 patches[name]=Buffer.from(source);return patches;
}
function writeAtomic(filename,data) {const tmp=filename+'.ru-new';fs.writeFileSync(tmp,data,{flag:'wx'});try{fs.renameSync(tmp,filename);}catch(error){fs.unlinkSync(tmp);throw error;}}
export function run(mode,appDir,stateDir,profileDir) {
 if(mode==='locale-ru'||mode==='locale-en') {
  const target=path.join(profileDir,'cordis.patch.yml'),current=fs.readFileSync(target,'utf8');
  writeAtomic(target,setLocale(current,mode==='locale-ru'?'ru':'en'));return;
 }
 const archive=path.join(appDir,'resources','app.asar'),originalBackup=path.join(stateDir,'backup-'+SUPPORTED_VERSION,'app.asar'),stateFile=path.join(stateDir,'shell-state.json');
 const current=fs.readFileSync(archive),hash=sha256(current),pkg=JSON.parse(readEntry(current,'package.json'));
 if(pkg.name!=='@deepseek-ai/dsh-desktop'||pkg.version!==SUPPORTED_VERSION)throw new Error('Only the official Windows '+SUPPORTED_VERSION+' build is supported; no files changed');
 const state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):null;
 if(hash!==ORIGINAL_SHA256&&hash!==state?.patchedSha256)throw new Error('Unknown or modified application archive; no files changed');
 if(mode==='check'){console.log('Compatible official desktop build:',pkg.version);return;}
 if(mode==='restore') {
  if(hash===ORIGINAL_SHA256){console.log('Shell already original');return;}
  const backup=fs.readFileSync(originalBackup);if(sha256(backup)!==ORIGINAL_SHA256)throw new Error('Backup hash mismatch');
  writeAtomic(archive,backup);console.log('Original shell restored');return;
 }
 if(mode!=='apply')throw new Error('Expected check, apply, restore, locale-ru or locale-en');
 if(hash===state?.patchedSha256){console.log('Shell already localized');return;}
 const shell=JSON.parse(fs.readFileSync(new URL('shell.ru.json',root),'utf8')),patches=createPatches(current,shell),patched=replaceEntries(current,patches);
 for(const [name,bytes] of Object.entries(patches))if(!readEntry(patched,name).equals(bytes))throw new Error('ASAR validation failed');
 fs.mkdirSync(path.dirname(originalBackup),{recursive:true});
 if(fs.existsSync(originalBackup)){if(sha256(fs.readFileSync(originalBackup))!==ORIGINAL_SHA256)throw new Error('Existing backup differs; refusing to overwrite');}
 else fs.writeFileSync(originalBackup,current,{flag:'wx'});
 // Record recovery hashes before replacing the archive, so interruption remains recoverable.
 writeAtomic(stateFile,JSON.stringify({version:SUPPORTED_VERSION,originalSha256:ORIGINAL_SHA256,patchedSha256:sha256(patched),modifiedEntries:Object.keys(patches)},null,2)+'\n');
 writeAtomic(archive,patched);console.log('Localized shell installed; verified original backup retained');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try{run(...process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}
}
