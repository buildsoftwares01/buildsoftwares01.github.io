// Hand-painted 2D sheets: two steps, snack, nap, play, and a delighted surprise.
// Crop each pose to its character bounds so neighboring artwork cannot bleed into it.
const regions = {
  lion: [[30,10,220,229],[23,13,233,226],[41,9,185,235],[19,44,237,165],[22,8,224,228],[13,0,225,244]],
  elephant: [[20,25,235,211],[23,28,233,208],[20,24,218,213],[11,39,245,169],[16,5,234,226],[12,0,231,235]],
  giraffe: [[39,5,207,247],[45,4,198,247],[50,3,178,248],[15,59,241,158],[36,0,211,243],[58,0,167,252]],
  monkey: [[32,16,224,222],[25,16,219,225],[26,16,187,226],[23,52,233,157],[33,5,223,222],[29,0,205,237]],
  tiger: [[26,22,223,218],[24,30,232,211],[52,21,187,221],[22,51,234,168],[37,11,219,222],[22,0,219,239]],
};
export async function createHabitat(canvas, kind) {
  const draw = canvas.getContext('2d');
  if (!draw) return null;
  const image = new Image();
  image.src = new URL(`./assets/animals/${kind}.webp`, document.baseURI).href;
  await image.decode();
  const cellWidth = image.naturalWidth / 3, cellHeight = image.naturalHeight / 2;

  function render(state, elapsed, phase, surprise) {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio, 2);
    const pixelsWide = Math.round(width * ratio), pixelsHigh = Math.round(height * ratio);
    if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
      canvas.width = pixelsWide; canvas.height = pixelsHigh;
    }
    draw.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw.clearRect(0, 0, width, height);
    const seconds = elapsed / 1000;
    let frame = 0, x = 0, y = 0, angle = 0, scaleX = 1, scaleY = 1;
    if (state === 'walk') {
      const circle = phase * Math.PI * 4;
      frame = Math.floor(seconds * 4) % 2;
      x = Math.sin(circle) * 12; y = Math.cos(circle) * 3 - Math.abs(Math.sin(seconds * 8)) * 2;
      scaleX = Math.cos(circle) < 0 ? -1 : 1;
      angle = Math.sin(seconds * 8) * .025;
    } else if (state === 'eat') {
      frame = 2; angle = Math.sin(seconds * 5) * .025;
      scaleY = 1 + Math.sin(seconds * 8) * .012;
    } else if (state === 'sleep') {
      frame = 3; scaleY = 1 + Math.sin(seconds * 2) * .025;
    } else if (state === 'play') {
      frame = 4; y = -Math.max(0, Math.sin(seconds * 4)) * 9;
      angle = Math.sin(seconds * 3) * .065;
    }
    if (surprise !== null) {
      frame = 5;
      const leap = Math.max(0, Math.sin(Math.PI * Math.min(1, surprise / .74)));
      const bounce = surprise > .74 ? Math.sin((surprise - .74) / .26 * Math.PI) : 0;
      x = 0; y = -leap * 12 - bounce * 3;
      angle = Math.sin(surprise * 28) * .06;
      scaleX = 1 + leap * .12; scaleY = 1 + leap * .12;
    }
    const size = Math.min(width * .76, height * .78);
    draw.save();
    draw.translate(width / 2 + x, height * .55 + y);
    draw.rotate(angle); draw.scale(scaleX, scaleY);
    draw.imageSmoothingEnabled = true; draw.imageSmoothingQuality = 'high';
    const [left, top, cropWidth, cropHeight] = regions[kind][frame];
    draw.drawImage(image, frame % 3 * cellWidth + left, Math.floor(frame / 3) * cellHeight + top, cropWidth, cropHeight,
      -size / 2 + left / cellWidth * size, -size / 2 + top / cellHeight * size, cropWidth / cellWidth * size, cropHeight / cellHeight * size);
    draw.restore();
  }
  return { render };
}
