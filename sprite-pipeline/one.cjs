const ort=require('onnxruntime-node'), sharp=require('sharp'), fs=require('fs'), path=require('path');
sharp.cache(false); sharp.concurrency(1);
const S=1024, MEAN=[0.485,0.456,0.406], STD=[0.229,0.224,0.225];
const i=+process.argv[2];
const files=fs.readdirSync(path.join(__dirname,'frames')).filter(f=>f.endsWith('.png')).sort();
(async()=>{
  const dst=path.join(__dirname,'masks',`m_${String(i).padStart(3,'0')}.png`);
  if(fs.existsSync(dst)){console.log('skip',i);return;}
  const s=await ort.InferenceSession.create((process.env.MODEL || require('path').join(__dirname,'models','birefnet_lite.onnx')),{executionProviders:['cpu'],intraOpNumThreads:6});
  const {data}=await sharp(path.join(__dirname,'frames',files[i])).resize(S,S,{fit:'fill',kernel:'lanczos3'})
    .removeAlpha().raw().toBuffer({resolveWithObject:true});
  const plane=S*S, chw=new Float32Array(3*plane);
  for(let p=0;p<plane;p++)for(let c=0;c<3;c++)chw[c*plane+p]=(data[p*3+c]/255-MEAN[c])/STD[c];
  const r=await s.run({[s.inputNames[0]]:new ort.Tensor('float32',chw,[1,3,S,S])});
  const d=r[s.outputNames[0]].data, m=Buffer.allocUnsafe(plane);
  for(let p=0;p<plane;p++)m[p]=Math.round(1/(1+Math.exp(-d[p]))*255);
  await sharp(m,{raw:{width:S,height:S,channels:1}}).png({compressionLevel:6}).toFile(dst);
  console.log('ok',i);
})();
