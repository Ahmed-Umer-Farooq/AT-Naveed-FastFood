const sharp=require('sharp'), fs=require('fs'), path=require('path');
sharp.cache(false); sharp.concurrency(1);

const FRAMES = process.env.FRAMES || path.join(__dirname,'frames');
const MASKS  = process.env.MASKS  || path.join(__dirname,'masks');
const OUT = process.env.OUT || path.join(__dirname, 'out');
const W=1920,H=1080,G=8;
const STEP=2, N=96;                       // every 2nd source frame -> 96 frames

// original-frame scene cuts; smoothing must not cross them
const CUTS=[{from:0,to:58},{from:59,to:106},{from:107,to:191}];
const sceneOfOrig=i=>CUTS.find(s=>i>=s.from&&i<=s.to);

const cache=new Map();
async function rawMask(i){
  if(cache.has(i))return cache.get(i);
  const b=await sharp(path.join(MASKS,`m_${String(i).padStart(3,'0')}.png`))
    .resize(W,H,{fit:'fill',kernel:'lanczos3'}).toColourspace('b-w').raw().toBuffer();
  cache.set(i,b); if(cache.size>6)cache.delete(cache.keys().next().value);
  return b;
}
async function smooth(orig){
  const sc=sceneOfOrig(orig);
  const a=await rawMask(Math.max(sc.from,orig-1));
  const b=await rawMask(orig);
  const c=await rawMask(Math.min(sc.to,orig+1));
  const o=Buffer.allocUnsafe(b.length);
  for(let p=0;p<b.length;p++){const x=a[p],y=b[p],z=c[p];
    o[p]= x<y?(y<z?y:(x<z?z:x)):(x<z?x:(y<z?z:y));}
  return o;
}
function extrude(src,w,h,pad,ch){
  const ow=w+pad*2,oh=h+pad*2,dst=Buffer.allocUnsafe(ow*oh*ch);
  for(let y=0;y<oh;y++){const sy=Math.min(h-1,Math.max(0,y-pad));
    for(let x=0;x<ow;x++){const sx=Math.min(w-1,Math.max(0,x-pad));
      const s=(sy*w+sx)*ch,d=(y*ow+x)*ch;
      for(let k=0;k<ch;k++)dst[d+k]=src[s+k];}}
  return {buf:dst,w:ow,h:oh};
}

const TIERS=[
  {key:'lg', cellW:640, cols:12, file:'hero-cutout-lg.webp'},
  {key:'sm', cellW:384, cols:12, file:'hero-cutout-sm.webp'},
];

(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  // cache every smoothed alpha once as a downscaled-per-tier cell is cheaper than re-smoothing
  const out={};
  for(const t of TIERS){
    const cellW=t.cellW, cellH=Math.round(cellW*H/W);
    const rows=Math.ceil(N/t.cols), pW=cellW+G*2, pH=cellH+G*2;
    const AW=t.cols*pW, AH=rows*pH;
    const atlas=Buffer.alloc(AW*AH*4);
    for(let i=0;i<N;i++){
      const orig=i*STEP;
      const alpha=await smooth(orig);
      const rgb=await sharp(path.join(FRAMES,`f_${String(orig+1).padStart(4,'0')}.png`)).removeAlpha().raw().toBuffer();
      const rgba=Buffer.allocUnsafe(W*H*4);
      for(let p=0,n=W*H;p<n;p++){rgba[p*4]=rgb[p*3];rgba[p*4+1]=rgb[p*3+1];rgba[p*4+2]=rgb[p*3+2];rgba[p*4+3]=alpha[p];}
      const cell=await sharp(rgba,{raw:{width:W,height:H,channels:4}})
        .resize(cellW,cellH,{fit:'fill',kernel:'lanczos3'}).raw().toBuffer();
      const p2=extrude(cell,cellW,cellH,G,4);
      const ox=(i%t.cols)*pW, oy=Math.floor(i/t.cols)*pH;
      for(let y=0;y<p2.h;y++) p2.buf.copy(atlas,((oy+y)*AW+ox)*4, y*p2.w*4, (y*p2.w+p2.w)*4);
      if((i+1)%24===0)console.log(`${t.key} packed ${i+1}/${N}`);
    }
    const fp=path.join(OUT,t.file);
    await sharp(atlas,{raw:{width:AW,height:AH,channels:4}})
      .webp({quality:80,alphaQuality:92,effort:6}).toFile(fp);
    const mb=(fs.statSync(fp).size/1048576).toFixed(2);
    console.log(`${t.key}: ${AW}x${AH} cell ${cellW}x${cellH} grid ${t.cols}x${rows} -> ${mb} MB`);
    out[t.key]={file:t.file,cellW,cellH,cols:t.cols,rows,AW,AH,frameCount:N,gutter:G,
                pitchW:pW,pitchH:pH,sizeMB:+mb};
  }
  // scene ranges remapped to output indices
  const scenes=[
    {from:0,  to:29, label:'Loaded Fries',  price:'Rs. 380'},
    {from:30, to:53, label:'Zinger Burger', price:'Rs. 380'},
    {from:54, to:95, label:'Chicken Wrap',  price:'Rs. 300'},
  ];
  fs.writeFileSync('cutout-report.json',JSON.stringify({built:out,scenes,frameCount:N,step:STEP},null,2));
  console.log('FINAL BUILD DONE');
})();
