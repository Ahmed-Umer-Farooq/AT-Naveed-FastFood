const sharp = require('sharp');
const fs = require('fs'), path = require('path');
sharp.cache(false);
const SRC = process.env.SRC || path.join(__dirname, 'in');
const UP  = process.env.OUT || path.join(__dirname, 'out');

(async () => {
  for (const f of fs.readdirSync(SRC).filter(f => /\.jpe?g$/i.test(f))) {
    const src = path.join(SRC, f);
    const m = await sharp(src).metadata();
    const S = Math.max(m.width, m.height);
    const top = Math.round((S - m.height) / 2), left = Math.round((S - m.width) / 2);

    // 1. clamp-to-edge pad: seam colour matches the photo exactly
    const padded = await sharp(src)
      .extend({ top, bottom: S - m.height - top, left, right: S - m.width - left, extendWith: 'copy' })
      .toBuffer();
    // 2. blur it, which only really affects the replicated bands (kills streaks)
    const soft = await sharp(padded).blur(26).toBuffer();
    // 3. drop the sharp original back on top
    const out = await sharp(soft)
      .composite([{ input: await sharp(src).toBuffer(), top, left }])
      .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer();

    fs.writeFileSync(path.join(UP, f), out);
    console.log(f.padEnd(30), S + 'x' + S, (out.length / 1024).toFixed(0) + ' KB');
  }
  console.log('done');
})();
