(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.XLSBIFF8 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const FREESECT = 0xFFFFFFFF, ENDOFCHAIN = 0xFFFFFFFE;
  const tdLatin = new TextDecoder('windows-1252');
  const tdUtf16 = new TextDecoder('utf-16le');

  function u16(v, o) { return v.getUint16(o, true); }
  function u32(v, o) { return v.getUint32(o, true); }
  function f64(v, o) { return v.getFloat64(o, true); }

  class OLE {
    constructor(buffer) {
      this.bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      this.dv = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
      const sig = [0xD0,0xCF,0x11,0xE0,0xA1,0xB1,0x1A,0xE1];
      if (!sig.every((b,i)=>this.bytes[i]===b)) throw new Error('Not a legacy Excel .xls (OLE/BIFF8) file.');
      this.sectorSize = 1 << u16(this.dv, 0x1e);
      this.miniSectorSize = 1 << u16(this.dv, 0x20);
      this.numFat = u32(this.dv, 0x2c);
      this.firstDir = u32(this.dv, 0x30);
      this.miniCutoff = u32(this.dv, 0x38);
      this.firstMiniFat = u32(this.dv, 0x3c);
      this.numMiniFat = u32(this.dv, 0x40);
      this.firstDifat = u32(this.dv, 0x44);
      this.numDifat = u32(this.dv, 0x48);
      const difat = [];
      for (let i=0;i<109;i++) {
        const x = u32(this.dv, 0x4c + i*4);
        if (x !== FREESECT && x !== ENDOFCHAIN) difat.push(x);
      }
      let sid = this.firstDifat;
      for (let d=0; d<this.numDifat && sid!==ENDOFCHAIN && sid!==FREESECT; d++) {
        const sec = this.sector(sid), view = new DataView(sec.buffer, sec.byteOffset, sec.byteLength);
        const n = this.sectorSize/4;
        for (let i=0;i<n-1;i++) {
          const x = u32(view,i*4); if (x!==FREESECT && x!==ENDOFCHAIN) difat.push(x);
        }
        sid = u32(view,(n-1)*4);
      }
      this.fat = [];
      for (const fsid of difat.slice(0,this.numFat)) {
        const sec=this.sector(fsid), view=new DataView(sec.buffer,sec.byteOffset,sec.byteLength);
        for (let i=0;i<this.sectorSize/4;i++) this.fat.push(u32(view,i*4));
      }
      const dir=this.readChain(this.firstDir);
      this.entries=[];
      for (let off=0; off+128<=dir.length; off+=128) {
        const v=new DataView(dir.buffer,dir.byteOffset+off,128);
        const nameLen=u16(v,64);
        let name='';
        if (nameLen>=2) name=tdUtf16.decode(dir.slice(off, off+nameLen-2));
        this.entries.push({ name, type: dir[off+66], start: u32(v,116), size: u32(v,120) });
      }
      this.root=this.entries.find(e=>e.type===5);
      this.miniFat=[];
      if (this.numMiniFat && this.firstMiniFat!==ENDOFCHAIN && this.firstMiniFat!==FREESECT) {
        const b=this.readChain(this.firstMiniFat), v=new DataView(b.buffer,b.byteOffset,b.byteLength);
        for (let i=0;i+4<=b.length;i+=4) this.miniFat.push(u32(v,i));
      }
      this.miniStream = this.root && this.root.size ? this.readChain(this.root.start).slice(0,this.root.size) : new Uint8Array();
    }
    sector(sid) {
      const off=512 + sid*this.sectorSize;
      return this.bytes.slice(off, off+this.sectorSize);
    }
    readChain(start) {
      const chunks=[]; let sid=start; const seen=new Set();
      while (sid!==ENDOFCHAIN && sid!==FREESECT && sid<this.fat.length && !seen.has(sid)) {
        seen.add(sid); chunks.push(this.sector(sid)); sid=this.fat[sid];
      }
      return concat(chunks);
    }
    readStream(names) {
      if (!Array.isArray(names)) names=[names];
      const e=this.entries.find(x=>names.includes(x.name));
      if (!e) throw new Error(`Workbook stream not found (${names.join(', ')}).`);
      if (e.size < this.miniCutoff && this.miniFat.length && this.miniStream.length) {
        const chunks=[]; let sid=e.start; const seen=new Set();
        while (sid!==ENDOFCHAIN && sid!==FREESECT && sid<this.miniFat.length && !seen.has(sid)) {
          seen.add(sid); const off=sid*this.miniSectorSize;
          chunks.push(this.miniStream.slice(off,off+this.miniSectorSize)); sid=this.miniFat[sid];
        }
        return concat(chunks).slice(0,e.size);
      }
      return this.readChain(e.start).slice(0,e.size);
    }
  }

  function concat(chunks) {
    const len=chunks.reduce((s,c)=>s+c.length,0), out=new Uint8Array(len); let off=0;
    for (const c of chunks) { out.set(c,off); off+=c.length; }
    return out;
  }

  function readRecords(bytes, start=0) {
    const out=[]; let pos=start; const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    while (pos+4<=bytes.length) {
      const id=u16(dv,pos), len=u16(dv,pos+2); pos+=4;
      out.push({id, payload: bytes.slice(pos,pos+len), pos:pos-4}); pos+=len;
    }
    return out;
  }

  class SegReader {
    constructor(segs){ this.segs=segs; this.si=0; this.off=0; }
    read(n){
      const out=new Uint8Array(n); let w=0;
      while (w<n) {
        if (this.si>=this.segs.length) throw new Error('Unexpected end of SST.');
        const seg=this.segs[this.si], avail=seg.length-this.off;
        if (!avail){ this.si++; this.off=0; continue; }
        const take=Math.min(n-w,avail); out.set(seg.slice(this.off,this.off+take),w); this.off+=take; w+=take;
      }
      return out;
    }
    readU8(){ return this.read(1)[0]; }
    readU16(){ const b=this.read(2); return b[0] | (b[1]<<8); }
    readU32(){ const b=this.read(4); return (b[0] | (b[1]<<8) | (b[2]<<16) | (b[3]<<24)) >>> 0; }
  }

  function parseSST(segs) {
    const r=new SegReader(segs); r.readU32(); const unique=r.readU32(); const strings=[];
    for (let s=0;s<unique;s++) {
      let cch=r.readU16(), flags=r.readU8(), high=!!(flags&1);
      const rich=!!(flags&8), ext=!!(flags&4);
      const runs=rich?r.readU16():0, extLen=ext?r.readU32():0;
      let text='', remaining=cch;
      while (remaining>0) {
        if (r.si>=r.segs.length) break;
        if (r.off===r.segs[r.si].length) {
          r.si++; r.off=0; if (r.si>=r.segs.length) break;
          high=!!(r.readU8()&1);
        }
        const width=high?2:1, avail=r.segs[r.si].length-r.off, maxChars=Math.floor(avail/width);
        if (maxChars<=0) { r.si++; r.off=0; if (r.si<r.segs.length) high=!!(r.readU8()&1); continue; }
        const take=Math.min(remaining,maxChars), b=r.read(take*width);
        text += high ? tdUtf16.decode(b) : tdLatin.decode(b);
        remaining-=take;
      }
      const skip=runs*4+extLen; if (skip) r.read(skip);
      strings.push(text);
    }
    return strings;
  }

  function decodeBoundSheet(payload) {
    const dv=new DataView(payload.buffer,payload.byteOffset,payload.byteLength);
    const offset=u32(dv,0), cch=payload[6], high=!!(payload[7]&1);
    const bytes=payload.slice(8,8+cch*(high?2:1));
    return { name: high?tdUtf16.decode(bytes):tdLatin.decode(bytes), offset };
  }

  function decodeRK(rk) {
    const mult100=!!(rk&1), isInt=!!(rk&2); let v;
    if (isInt) v=(rk|0)>>2;
    else {
      const buf=new ArrayBuffer(8), dv=new DataView(buf);
      const raw=BigInt(rk & 0xFFFFFFFC) << 32n;
      dv.setBigUint64(0,raw,true); v=dv.getFloat64(0,true);
    }
    return mult100?v/100:v;
  }

  function excelDate(serial) {
    if (!Number.isFinite(serial)) return '';
    const ms = Date.UTC(1899,11,30) + Math.floor(serial)*86400000;
    return new Date(ms).toISOString().slice(0,10);
  }

  function parseCell(rec, sst) {
    const p=rec.payload, dv=new DataView(p.buffer,p.byteOffset,p.byteLength);
    if (rec.id===0x0203 && p.length>=14) return {row:u16(dv,0),col:u16(dv,2),value:f64(dv,6)};
    if (rec.id===0x027E && p.length>=10) return {row:u16(dv,0),col:u16(dv,2),value:decodeRK(u32(dv,6))};
    if (rec.id===0x00FD && p.length>=10) { const idx=u32(dv,6); return {row:u16(dv,0),col:u16(dv,2),value:sst[idx]??''}; }
    if (rec.id===0x0205 && p.length>=8) return {row:u16(dv,0),col:u16(dv,2),value:p[6]};
    if (rec.id===0x0006 && p.length>=14) {
      const row=u16(dv,0), col=u16(dv,2);
      if (p[12]===0xFF && p[13]===0xFF) return {row,col,value:null};
      return {row,col,value:f64(dv,6)};
    }
    return null;
  }

  function parseCells(rec, sst) {
    const one=parseCell(rec,sst); if(one) return [one];
    const p=rec.payload;
    if(rec.id===0x00BD && p.length>=6) {
      const dv=new DataView(p.buffer,p.byteOffset,p.byteLength), row=u16(dv,0), first=u16(dv,2), last=u16(dv,p.length-2), out=[];
      let off=4, col=first;
      while(off+6<=p.length-2 && col<=last) { out.push({row,col,value:decodeRK(u32(dv,off+2))}); off+=6; col++; }
      return out;
    }
    if(rec.id===0x0204 && p.length>=8) {
      const dv=new DataView(p.buffer,p.byteOffset,p.byteLength), row=u16(dv,0), col=u16(dv,2), len=u16(dv,6);
      const b=p.slice(8,8+len); return [{row,col,value:tdLatin.decode(b)}];
    }
    return [];
  }

  function parseWorkbookContext(arrayBuffer) {
    const ole=new OLE(arrayBuffer), wb=ole.readStream(['Workbook','Book']), recs=readRecords(wb);
    let sst=[], sheets=[];
    for (let i=0;i<recs.length;i++) {
      const r=recs[i];
      if (r.id===0x0085) sheets.push(decodeBoundSheet(r.payload));
      if (r.id===0x00FC) {
        const segs=[r.payload]; let j=i+1;
        while (j<recs.length && recs[j].id===0x003C) { segs.push(recs[j].payload); j++; }
        sst=parseSST(segs); i=j-1;
      }
    }
    return {wb,sst,sheets};
  }

  function parseSheetRows(arrayBuffer, sheetName) {
    const {wb,sst,sheets}=parseWorkbookContext(arrayBuffer);
    const sheet=sheets.find(s=>s.name===sheetName) || sheets.find(s=>s.name.toLowerCase()===String(sheetName).toLowerCase());
    if(!sheet) throw new Error(`Sheet “${sheetName}” not found.`);
    const rows=new Map(); let maxCol=-1;
    for (const r of readRecords(wb,sheet.offset)) {
      if (r.id===0x000A) break;
      for(const c of parseCells(r,sst)) {
        if(!rows.has(c.row)) rows.set(c.row,{});
        rows.get(c.row)[c.col]=c.value; if(c.col>maxCol) maxCol=c.col;
      }
    }
    const maxRow=rows.size?Math.max(...rows.keys()):-1, out=[];
    for(let ri=0;ri<=maxRow;ri++) {
      const obj=rows.get(ri)||{}, arr=new Array(maxCol+1).fill('');
      for(const [k,v] of Object.entries(obj)) arr[Number(k)]=v==null?'':v;
      out.push(arr);
    }
    return {sheet:sheet.name,rows:out,sheetNames:sheets.map(s=>s.name)};
  }

  function parseSalesJournal(arrayBuffer, preferredSheet='Sales & Gross margin Journal') {
    const ole=new OLE(arrayBuffer), wb=ole.readStream(['Workbook','Book']), recs=readRecords(wb);
    let sst=[], sheets=[];
    for (let i=0;i<recs.length;i++) {
      const r=recs[i];
      if (r.id===0x0085) sheets.push(decodeBoundSheet(r.payload));
      if (r.id===0x00FC) {
        const segs=[r.payload]; let j=i+1;
        while (j<recs.length && recs[j].id===0x003C) { segs.push(recs[j].payload); j++; }
        sst=parseSST(segs); i=j-1;
      }
    }
    const sheet=sheets.find(s=>s.name===preferredSheet) || sheets.find(s=>/gross margin journal/i.test(s.name));
    if (!sheet) throw new Error(`Sheet “${preferredSheet}” not found.`);
    const headers=new Map(); let headerRow=null, currentRow=-1, rowObj={}, rows=[];
    const wanted = new Set(['Sales Office','Sales Manager','Country','Customer','Inv-Ord','Transaction Date','ProdHierDescr','Part no','Description','Qty','Total Sales €','GM','GM%','Brand','docnumber','IDcustomer']);
    const flush=()=>{
      if (currentRow<0 || headerRow==null || currentRow<=headerRow) { rowObj={}; return; }
      if (Object.keys(rowObj).length) {
        const get=(h)=>rowObj[headers.get(h)];
        const rec={
          salesOffice:get('Sales Office')||'', salesManager:get('Sales Manager')||'', country:get('Country')||'', customer:get('Customer')||'',
          type:get('Inv-Ord')||'', date:excelDate(Number(get('Transaction Date'))), productCategory:get('ProdHierDescr')||'', partNo:get('Part no')||'',
          description:get('Description')||'', qty:Number(get('Qty'))||0, sales:Number(get('Total Sales €'))||0, gm:Number(get('GM'))||0,
          gmPct:Number(get('GM%'))||0, brand:get('Brand')||'', docNumber:get('docnumber')||'', customerId:get('IDcustomer')||''
        };
        if (rec.salesOffice || rec.salesManager || rec.country || rec.customer) rows.push(rec);
      }
      rowObj={};
    };
    for (const r of readRecords(wb,sheet.offset)) {
      if (r.id===0x000A) { flush(); break; }
      const c=parseCell(r,sst); if (!c) continue;
      if (currentRow!==c.row) { flush(); currentRow=c.row; rowObj={}; }
      rowObj[c.col]=c.value;
      if (typeof c.value==='string') {
        if (c.value==='Sales Chan') headerRow=c.row;
        if (headerRow===c.row && wanted.has(c.value)) headers.set(c.value,c.col);
      }
    }
    if (!headers.has('Total Sales €') || !headers.has('GM') || !headers.has('Sales Manager')) throw new Error('Expected sales columns were not found in the journal.');
    return { rows, sheet:sheet.name, salesOffices:[...new Set(rows.map(r=>r.salesOffice).filter(Boolean))].sort() };
  }

  function parseCsv(text) {
    const lines=[]; let row=[], cur='', q=false;
    for (let i=0;i<text.length;i++) {
      const ch=text[i], nx=text[i+1];
      if (ch==='"') { if (q && nx==='"'){cur+='"'; i++;} else q=!q; }
      else if (ch===',' && !q) { row.push(cur); cur=''; }
      else if ((ch==='\n' || ch==='\r') && !q) { if (ch==='\r'&&nx==='\n') i++; row.push(cur); lines.push(row); row=[]; cur=''; }
      else cur+=ch;
    }
    if (cur || row.length) { row.push(cur); lines.push(row); }
    if (!lines.length) return {rows:[]};
    const h=lines[0].map(x=>x.trim()), idx=(name)=>h.indexOf(name);
    const rows=lines.slice(1).filter(r=>r.some(Boolean)).map(r=>({
      salesOffice:r[idx('Sales Office')]||'', salesManager:r[idx('Sales Manager')]||'', country:r[idx('Country')]||'', customer:r[idx('Customer')]||'',
      type:r[idx('Inv-Ord')]||'', date:r[idx('Transaction Date')]||'', productCategory:r[idx('ProdHierDescr')]||'', partNo:r[idx('Part no')]||'',
      description:r[idx('Description')]||'', qty:Number(r[idx('Qty')])||0, sales:Number(r[idx('Total Sales €')])||0, gm:Number(r[idx('GM')])||0,
      gmPct:Number(r[idx('GM%')])||0, brand:r[idx('Brand')]||'', docNumber:r[idx('docnumber')]||'', customerId:r[idx('IDcustomer')]||''
    }));
    return {rows};
  }

  return { parseSalesJournal, parseSheetRows, parseCsv };
});