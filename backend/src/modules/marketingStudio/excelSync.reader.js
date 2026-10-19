
// EXACT PATH: backend/src/modules/marketingStudio/excelSync.reader.js
// ACTION: NEW

// HAMPORIUM Smart Excel Sync V2.
// Extract ONLY requested sheets from the XLSX ZIP. Do not expand 26 Geo State Options
// or unrelated procurement sheets; those can exceed 90MB uncompressed.
import { openSync, readSync, closeSync, fstatSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createInflateRaw } from 'node:zlib';
import { StringDecoder } from 'node:string_decoder';

const MAX_ENTRY_BYTES = 115 * 1024 * 1024;
const MAX_CELL_LENGTH = 4000;
const MAX_ROWS = 100000;
export const normalize = value => String(value ?? '').trim().toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
export const text = (value, max = 1000) => String(value ?? '').trim().slice(0,max);
const decode = v => String(v ?? '').replace(/&#x([\da-f]+);/gi,(_,x)=>String.fromCodePoint(parseInt(x,16)))
  .replace(/&#(\d+);/g,(_,x)=>String.fromCodePoint(Number(x)))
  .replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')
  .replace(/&amp;/g,'&');
const attribute = (html,name) => {
  const match=String(html).match(new RegExp(`(?:^|\\s)${name.replace(':','\\:')}=["']([^"']*)["']`,'i'));
  return match?decode(match[1]):'';
};
const colIndex = cell => {
  const x=/^[A-Z]+/i.exec(cell)?.[0]?.toUpperCase(); if(!x)return -1;
  return [...x].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
};
const extract = (fd, offset, length) => {
  if(length<0||length>MAX_ENTRY_BYTES)throw new Error('XLSX entry exceeds safe size limit');
  const result=Buffer.alloc(length);let done=0;
  while(done<length){const n=readSync(fd,result,done,length-done,offset+done);if(!n)throw new Error('Truncated Excel archive');done+=n}
  return result;
};
function openZip(filePath){
  const fd=openSync(filePath,'r');
  try {
    const fileSize=fstatSync(fd).size,tailSize=Math.min(65557,fileSize);
    const tail=extract(fd,fileSize-tailSize,tailSize);let offset=-1;
    for(let i=tail.length-22;i>=0;i--)if(tail.readUInt32LE(i)===0x06054b50){offset=i;break}
    if(offset<0)throw new Error('Invalid XLSX archive');
    const number=tail.readUInt16LE(offset+10), size=tail.readUInt32LE(offset+12),start=tail.readUInt32LE(offset+16);
    if(number>10000||size>MAX_ENTRY_BYTES)throw new Error('Unsupported ZIP directory size');
    const buf=extract(fd,start,size),entries=new Map();let p=0;
    for(let i=0;i<number;i++){
      if(p+46>buf.length||buf.readUInt32LE(p)!==0x02014b50)throw new Error('Corrupt ZIP central directory');
      const nameLength=buf.readUInt16LE(p+28),extra=buf.readUInt16LE(p+30),comment=buf.readUInt16LE(p+32);
      const name=buf.subarray(p+46,p+46+nameLength).toString('utf8').replace(/^\/+/, '');
      entries.set(name,{method:buf.readUInt16LE(p+10),compressed:buf.readUInt32LE(p+20),uncompressed:buf.readUInt32LE(p+24),position:buf.readUInt32LE(p+42)});
      p+=46+nameLength+extra+comment;
    }
    return { read(name){
      const e=entries.get(name);if(!e)return null;
      if(e.uncompressed>MAX_ENTRY_BYTES||e.compressed>MAX_ENTRY_BYTES)throw new Error(`Worksheet ${name} too large`);
      const header=extract(fd,e.position,30);if(header.readUInt32LE(0)!==0x04034b50)throw new Error('Bad XLSX entry');
      const start=e.position+30+header.readUInt16LE(26)+header.readUInt16LE(28);
      const raw=extract(fd,start,e.compressed),out=e.method===8?inflateRawSync(raw,{maxOutputLength:MAX_ENTRY_BYTES}):e.method===0?raw:null;
      if(!out||out.length!==e.uncompressed)throw new Error(`Unsupported or broken entry: ${name}`);
      return out.toString('utf8');
    },async rows(name, role, strings){
      const e=entries.get(name);if(!e)throw new Error('Missing worksheet '+name);
      if(e.uncompressed>150*1024*1024)throw new Error('Worksheet exceeds 150MB safety limit');
      const header=extract(fd,e.position,30);
      if(header.readUInt32LE(0)!==0x04034b50)throw new Error('Invalid worksheet header');
      const start=e.position+30+header.readUInt16LE(26)+header.readUInt16LE(28);
      const fileStream=createReadStream(filePath,{start,end:start+e.compressed-1,highWaterMark:64*1024});
      const stream=e.method===8?fileStream.pipe(createInflateRaw()):e.method===0?fileStream:null;
      if(!stream)throw new Error('Unsupported Excel compression');
      const consumer=new RowConsumer(role);consumer.strings=strings;const decoder=new StringDecoder('utf8');
      let buffer='',inflated=0;
      for await(const chunk of stream){
        inflated+=chunk.length;
        if(inflated>150*1024*1024)throw new Error('XLSX decompression safety limit exceeded');
        buffer+=decoder.write(chunk);
        let end;
        while((end=buffer.indexOf('</row>'))>=0){
          const startRow=buffer.search(/<row\b/);
          if(startRow<0){buffer=buffer.slice(end+6);continue}
          consumer.accept(buffer.slice(startRow,end+6));
          buffer=buffer.slice(end+6);
        }
        if(buffer.length>3000000)throw new Error('Unexpectedly large Excel row');
      }
      return consumer.result();
    },close(){closeSync(fd)} };
  }catch(e){closeSync(fd);throw e}
}
const sharedStrings = xml => {
  const result=[]; const re=/<si\b[^>]*>([\s\S]*?)<\/si>/g;let m;
  while((m=re.exec(xml||''))){
    const fragments=[];let x;const parts=/<t\b[^>]*>([\s\S]*?)<\/t>/g;
    while((x=parts.exec(m[1])))fragments.push(decode(x[1]));
    result.push(fragments.join('').slice(0,MAX_CELL_LENGTH));
  }return result;
};
const valueOf = (attrs,body,strings) => {
  const type=attribute(attrs,'t').toLowerCase();
  if(type==='inlineStr'.toLowerCase()){
    const pieces=[];let m;const re=/<t\b[^>]*>([\s\S]*?)<\/t>/g;
    while((m=re.exec(body)))pieces.push(decode(m[1]));return text(pieces.join(''),MAX_CELL_LENGTH);
  }
  const x=/<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body);if(!x)return null;
  const v=decode(x[1]);if(type==='s')return strings[Number(v)]??null;
  if(type==='b')return v==='1';if(type==='e')return null;
  if(type==='str')return text(v,MAX_CELL_LENGTH);
  if(v.trim()==='')return null;const n=Number(v);return Number.isFinite(n)?n:text(v,MAX_CELL_LENGTH);
};
class RowConsumer {
  constructor(role){this.role=role;this.header=null;this.headerRow=null;this.rows=[];this.sequential=0}
  accept(xml){
    this.sequential++;
    const match=/^<row\b([^>]*?)>([\s\S]*?)<\/row>$/.exec(xml);
    if(!match)return;
    const rowNum=Number(attribute(match[1],'r'))||this.sequential;
    const vals=[];let cell;const cellRe=/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;let pos=0;
    while((cell=cellRe.exec(match[2]))){
      let ci=colIndex(attribute(cell[1],'r'));if(ci<0)ci=pos;pos=ci+1;
      if(ci>255)continue;vals[ci]=valueOf(cell[1],cell[2]||'',this.strings);
    }
    if(!this.header){
      if(rowNum>45)return;
      const keys=vals.map(normalize).filter(Boolean);
      const anchors={occasions:['occasionid','occasionevent'],hampers:['hampercode','hampername'],
        productMaster:['productsku','productname'],hamperRecipe:['hampercode','productsku'],
        priority:['collection','launchpriority'],navigation:['menugroup','navigationlabel'],
        calendar:['month','campaigntheme'],states:['countryname','name'],cities:['name','country','subcountry']};
      const required=anchors[this.role]||[];
      const count=required.filter(x=>keys.some(y=>y.startsWith(x))).length;
      if(this.role==='countries'?rowNum===1:count>=Math.min(2,required.length)){
        this.header=vals.map(v=>text(v,180));this.headerRow=rowNum;
      }return;
    }
    if(this.rows.length>=MAX_ROWS)throw new Error(`Sheet ${this.role} exceeds ${MAX_ROWS} rows`);
    if(vals.some(v=>v!==null&&v!==undefined&&text(v)!==''))this.rows.push({number:rowNum,values:vals});
  }
  result(){return {header:this.header,headerRow:this.headerRow,rows:this.rows}}
}
const getSheets=(workbook,rels)=>{
  const targets=new Map();let m;const relRe=/<Relationship\b([^>]*?)\/?\s*>/g;
  while((m=relRe.exec(rels||''))){let t=attribute(m[1],'Target').replace(/\\/g,'/').replace(/^\/+/, '');
    while(t.startsWith('../'))t=t.slice(3);if(!t.startsWith('xl/'))t='xl/'+t;
    targets.set(attribute(m[1],'Id'),t);
  }
  const list=[];const re=/<sheet\b([^>]*?)\/?\s*>/g;
  while((m=re.exec(workbook||''))){const name=attribute(m[1],'name'),path=targets.get(attribute(m[1],'r:id'));if(name&&path)list.push({name,path})}
  return list;
};
const roleFor=name=>{
 const s=normalize(String(name).trim().replace(/^\d+[a-z]?\s+/i,''));
 if(s==='occasionmaster')return'occasions';if(s==='hampermaster')return'hampers';
 if(s==='productmaster')return'productMaster';if(s==='hamperrecipe'||s==='hampercomposition')return'hamperRecipe';
 if(s==='occasionpriority')return'priority';if(s==='occasionnavigation')return'navigation';
 if(s==='campaigncalendar')return'calendar';if(s==='geocountries')return'countries';
 if(s==='geostates')return'states';if(s==='geocities')return'cities';return null;
};
export async function workbookDigest(filePath){
 const hash=createHash('sha256');for await(const part of createReadStream(filePath))hash.update(part);return hash.digest('hex');
}
export async function readMarketingWorkbook(filePath){
 const zip=openZip(filePath);
 try{
  const wb=zip.read('xl/workbook.xml'),rels=zip.read('xl/_rels/workbook.xml.rels');
  if(!wb||!rels)throw new Error('Not an XLSX workbook');
  const sheets=getSheets(wb,rels),strings=sharedStrings(zip.read('xl/sharedStrings.xml'));
  const output={},warnings=[];
  for(const sheet of sheets){
    const role=roleFor(sheet.name);if(!role||output[role])continue;
    const data=await zip.rows(sheet.path,role,strings);if(!data.header){warnings.push(`Unrecognized columns in ${sheet.name}`);continue}
    output[role]={name:sheet.name,...data};
  }
  if(!output.occasions&&!output.hampers&&!output.productMaster&&!output.hamperRecipe&&!output.priority&&!output.navigation&&!output.calendar&&!output.countries&&!output.states&&!output.cities)throw new Error('No supported HAMPORIUM master sheets were found');
  return {sheets:output,warnings};
 }finally{zip.close()}
}
export function field(row,...names){
 if(!row?.header)return null;
 const keys=row.header.map(normalize);
 for(const name of names){const pos=keys.indexOf(normalize(name));if(pos>=0&&row.values[pos]!==undefined&&row.values[pos]!==null&&text(row.values[pos])!=='')return row.values[pos]}return null;
}
export function record(sheet,row){return {header:sheet.header,values:row.values};}
export function excelCode(v){const match=/^(\d{5,20})(?:\D|$)/.exec(text(v,150));return match?.[1]||''}
export function columnsOf(sheet,oldFields=[]){
 const oldByName=new Map(oldFields.map(f=>[normalize(f.excelField),f.type]));
 return (sheet?.header||[]).map((name,i)=>name?{column:i+1,excelField:name,type:oldByName.get(normalize(name))||'internal_reference'}:null).filter(Boolean);
}
