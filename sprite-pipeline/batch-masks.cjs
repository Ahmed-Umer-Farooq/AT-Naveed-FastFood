const ort = require('onnxruntime-node');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
sharp.cache(false);
sharp.concurrency(1);

const S = 1024;
const MEAN = [0.485,0.456,0.406], STD = [0.229,0.224,0.225];
const MODEL = process.env.MODEL || path.join(__dirname, 'models', 'birefnet_lite.onnx');
const FRAMES = process.env.FRAMES || path.join(__dirname, 'frames');
const OUT = process.env.MASKS || path.join(__dirname, 'masks');
const files = fs.readdirSync(FRAMES).filter(f => f.endsWith('.png')).sort();

(async () => {
  const session = await ort.InferenceSession.create(MODEL, {
    executionProviders: ['cpu'], graphOptimizationLevel: 'all',
  });
  const plane = S * S;
  const t0 = Date.now();

  for (let i = 0; i < files.length; i++) {
    const dst = path.join(OUT, `m_${String(i).padStart(3,'0')}.png`);
    if (fs.existsSync(dst)) continue;

    const { data } = await sharp(path.join(FRAMES, files[i]))
      .resize(S, S, { fit: 'fill', kernel: 'lanczos3' })
      .removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const chw = new Float32Array(3 * plane);
    for (let p = 0; p < plane; p++)
      for (let c = 0; c < 3; c++) chw[c*plane+p] = (data[p*3+c]/255 - MEAN[c]) / STD[c];

    const res = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', chw, [1,3,S,S]) });
    const d = res[session.outputNames[0]].data;
    const m = Buffer.allocUnsafe(plane);
    for (let p = 0; p < plane; p++) m[p] = Math.round(1/(1+Math.exp(-d[p])) * 255);

    await sharp(m, { raw: { width: S, height: S, channels: 1 } }).png({ compressionLevel: 6 }).toFile(dst);

    const done = i + 1, el = (Date.now()-t0)/1000;
    if (done % 10 === 0 || done === files.length)
      console.log(`${done}/${files.length}  ${el.toFixed(0)}s elapsed  eta ${((el/done)*(files.length-done)).toFixed(0)}s`);
  }
  console.log('ALL MASKS DONE');
})();
