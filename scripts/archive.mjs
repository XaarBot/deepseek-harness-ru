import {createHash} from 'node:crypto';
export const sha256=data=>createHash('sha256').update(data).digest('hex');
export function parseArchive(buffer) {
 if(buffer.length<16||buffer.readUInt32LE(0)!==4)throw new Error('Invalid ASAR header');
 const base=8+buffer.readUInt32LE(4),length=buffer.readUInt32LE(12);
 if(base>buffer.length||16+length>base)throw new Error('Truncated ASAR header');
 return {header:JSON.parse(buffer.subarray(16,16+length).toString()),payload:buffer.subarray(base)};
}
function entry(header,path) {
 if(path.split('/').some(x=>!x||x==='..'||x==='.'))throw new Error('Invalid archive path');
 let node=header;for(const part of path.split('/'))node=node.files?.[part]??(()=>{throw new Error('Missing archive entry: '+path)})();return node;
}
export function readEntry(buffer,path) {
 const {header,payload}=parseArchive(buffer),e=entry(header,path),offset=Number(e.offset);
 if(e.unpacked||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(e.size)||e.size<0||offset+e.size>payload.length)throw new Error('Invalid or unpacked entry: '+path);
 return payload.subarray(offset,offset+e.size);
}
export function replaceEntries(buffer,replacements) {
 const {header,payload}=parseArchive(buffer),parts=[payload];let offset=payload.length;
 for(const [path,data] of Object.entries(replacements)) {
  readEntry(buffer,path);const e=entry(header,path),bytes=Buffer.from(data),block=e.integrity?.blockSize??4194304;
  if(!Number.isSafeInteger(block)||block<1)throw new Error('Invalid integrity block size');
  const blocks=[];for(let i=0;i<bytes.length;i+=block)blocks.push(sha256(bytes.subarray(i,i+block)));
  Object.assign(e,{offset:String(offset),size:bytes.length,integrity:{algorithm:'SHA256',hash:sha256(bytes),blockSize:block,blocks}});
  offset+=bytes.length;parts.push(bytes);
 }
 const json=Buffer.from(JSON.stringify(header)),padding=(4-((4+json.length)%4))%4,h=Buffer.alloc(16);
 h.writeUInt32LE(4,0);h.writeUInt32LE(8+json.length+padding,4);h.writeUInt32LE(4+json.length+padding,8);h.writeUInt32LE(json.length,12);
 return Buffer.concat([h,json,Buffer.alloc(padding),...parts]);
}
export function setLocale(text,language) {
 if(!['ru','en'].includes(language))throw new Error('Unsupported preference');
 const eol=text.includes('\r\n')?'\r\n':'\n';
 const row=/^- id: ["']?locale["']?\s*\r?$/gm,matches=[...text.matchAll(row)];
 if(matches.length>1)throw new Error('Duplicate locale sections; edit the preference manually');
 if(!matches.length)return text+(text.endsWith('\n')?'':eol)+['- id: locale','  name: "@deepseek-ai/dsh-client-locale"','  config:',`    preference: ${language}`,''].join(eol);
 const start=matches[0].index,tail=text.slice(start),next=tail.indexOf('\n- ',1),end=next<0?text.length:start+next+1,block=text.slice(start,end);
 if(!/^    preference:\s*[^\r\n]+/m.test(block))throw new Error('Unsupported locale section; select the language in Settings');
 return text.slice(0,start)+block.replace(/^    preference:[^\r\n]*/m,`    preference: ${language}`)+text.slice(end);
}
