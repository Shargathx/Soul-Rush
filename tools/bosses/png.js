const fs=require('fs'),zlib=require('zlib');
function decode(file){
  const b=fs.readFileSync(file); let p=8; let ihdr,plte,trns; const idat=[];
  while(p<b.length){const len=b.readUInt32BE(p),type=b.toString('latin1',p+4,p+8),d=b.subarray(p+8,p+8+len);
    if(type==='IHDR')ihdr=d; else if(type==='PLTE')plte=d; else if(type==='tRNS')trns=d; else if(type==='IDAT')idat.push(d); p+=12+len;}
  const w=ihdr.readUInt32BE(0),h=ihdr.readUInt32BE(4),bd=ihdr[8],ct=ihdr[9];
  if(bd!==8) throw new Error('bitdepth '+bd+' in '+file);
  const ch={0:1,2:3,3:1,4:2,6:4}[ct]; const raw=zlib.inflateSync(Buffer.concat(idat)); const bpp=ch, stride=w*ch;
  const out=Buffer.alloc(h*stride); let o=0;
  for(let y=0;y<h;y++){const f=raw[o++]; for(let x=0;x<stride;x++){const v=raw[o++]; const a=x>=bpp?out[y*stride+x-bpp]:0, up=y?out[(y-1)*stride+x]:0, c=(x>=bpp&&y)?out[(y-1)*stride+x-bpp]:0; let r;
    if(f===0)r=v; else if(f===1)r=v+a; else if(f===2)r=v+up; else if(f===3)r=v+((a+up)>>1); else {const pp=a+up-c,pa=Math.abs(pp-a),pb=Math.abs(pp-up),pc=Math.abs(pp-c); r=v+(pa<=pb&&pa<=pc?a:pb<=pc?up:c);} out[y*stride+x]=r&255;}}
  const rgba=Buffer.alloc(w*h*4);
  for(let i=0;i<w*h;i++){ let r,g,bl,a=255;
    if(ct===6){r=out[i*4];g=out[i*4+1];bl=out[i*4+2];a=out[i*4+3];}
    else if(ct===2){r=out[i*3];g=out[i*3+1];bl=out[i*3+2];}
    else if(ct===3){const k=out[i];r=plte[k*3];g=plte[k*3+1];bl=plte[k*3+2];a=trns&&k<trns.length?trns[k]:255;}
    else if(ct===0){r=g=bl=out[i];} else {r=g=bl=out[i*2];a=out[i*2+1];}
    rgba[i*4]=r;rgba[i*4+1]=g;rgba[i*4+2]=bl;rgba[i*4+3]=a;}
  return {w,h,data:rgba};
}
const crcT=Array.from({length:256},(_,n)=>{let k=n;for(let j=0;j<8;j++)k=k&1?0xedb88320^(k>>>1):k>>>1;return k>>>0});
const crc=buf=>{let k=0xffffffff;for(const x of buf)k=crcT[(k^x)&255]^(k>>>8);return(k^0xffffffff)>>>0};
function encode(img,file){
  const {w,h,data}=img; const raw=Buffer.alloc((w*4+1)*h);
  for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;data.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}
  const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;
  const buf=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
  if(file)fs.writeFileSync(file,buf); return buf;
}
function crop(img,x,y,w,h){const o=Buffer.alloc(w*h*4);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const sx=x+i,sy=y+j;if(sx<0||sy<0||sx>=img.w||sy>=img.h)continue;img.data.copy(o,(j*w+i)*4,(sy*img.w+sx)*4,(sy*img.w+sx)*4+4);}return{w,h,data:o}}
function scale(img,k){const w=img.w*k,h=img.h*k,o=Buffer.alloc(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)img.data.copy(o,(y*w+x)*4,((y/k|0)*img.w+(x/k|0))*4,((y/k|0)*img.w+(x/k|0))*4+4);return{w,h,data:o}}
function bbox(img){let x0=img.w,y0=img.h,x1=-1,y1=-1;for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++)if(img.data[(y*img.w+x)*4+3]>0){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}return x1<0?null:{x0,y0,x1,y1}}
module.exports={decode,encode,crop,scale,bbox};
