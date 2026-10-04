// Hand-painted poses with continuous, interpolated head and body movement.
// Crop each pose to its character bounds so neighboring artwork cannot bleed into it.
const regions = {
  lion: [[30,10,220,229],[23,13,233,226],[41,9,185,235],[19,44,237,165],[22,8,224,228],[13,0,225,244]],
  elephant: [[20,25,235,211],[23,28,233,208],[20,24,218,213],[11,39,245,169],[16,5,234,226],[12,0,231,235]],
  giraffe: [[39,5,207,247],[45,4,198,247],[50,3,178,248],[15,59,241,158],[36,0,211,243],[58,0,167,252]],
  monkey: [[32,16,224,222],[25,16,219,225],[26,16,187,226],[23,52,233,157],[33,5,223,222],[29,0,205,237]],
  tiger: [[26,22,223,218],[24,30,232,211],[52,21,187,221],[22,51,234,168],[37,11,219,222],[22,0,219,239]],
};
const smooth = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export async function createHabitat(canvas, kind) {
  const draw = canvas.getContext('2d');
  if (!draw) return null;
  const image = new Image();
  image.src = new URL(`./assets/animals/${kind}.webp`, document.baseURI).href;
  const rollImage = kind === 'tiger' ? new Image() : null;
  if (rollImage) rollImage.src = new URL('./assets/animals/tiger-roll.webp', document.baseURI).href;
  await Promise.all([image.decode(), rollImage?.decode()]);
  const cellWidth = image.naturalWidth / 3, cellHeight = image.naturalHeight / 2;
  // Cache clean poses once; every animation frame then deforms the local artwork.
  const poses = regions[kind].map(([left, top, width, height], frame) => {
    const pose = document.createElement('canvas');
    pose.width = cellWidth; pose.height = cellHeight;
    pose.getContext('2d').drawImage(image,
      frame % 3 * cellWidth + left, Math.floor(frame / 3) * cellHeight + top, width, height,
      left, top, width, height);
    return pose;
  });

  const padding = 32;
  const warped = document.createElement('canvas');
  warped.width = cellWidth + padding * 2;
  warped.height = cellHeight + padding * 2;
  const warpDraw = warped.getContext('2d');

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
    const motion = Math.min(width, height) / 130;
    let frame = 0, x = 0, y = 0, angle = 0, scaleX = 1, scaleY = 1;
    let headSway = 0, headBob = 0, bodyBend = 0;
    if (state === 'walk') {
      const circle = phase * Math.PI * 2;
      const step = seconds * Math.PI * 3.6;
      frame = Math.floor(seconds * 3.6) % 2;
      x = Math.sin(circle) * 17 * motion;
      y = (Math.cos(circle) * 3 - Math.abs(Math.sin(step)) * 4) * motion;
      // A brief side-on turn replaces the old instantaneous mirrored jump.
      const facing = Math.tanh(Math.cos(circle) * 9);
      scaleX = facing;
      scaleY = 1 + Math.cos(step * 2) * .025;
      angle = Math.sin(step) * .055;
      headSway = Math.sin(step - .6) * .026;
      headBob = Math.sin(step * 2) * .018;
      bodyBend = Math.sin(step + .6) * .020;
    } else if (state === 'eat') {
      frame = 2;
      const chew = Math.sin(seconds * 9);
      angle = Math.sin(seconds * 3) * .045;
      y = -Math.sin(seconds * 3) * 2 * motion;
      scaleY = 1 + chew * .025;
      headSway = Math.sin(seconds * 4.5) * .05;
      headBob = chew * .035;
      bodyBend = Math.sin(seconds * 3 - .5) * .014;
    } else if (state === 'sleep') {
      frame = 3;
      const breath = Math.sin(seconds * 2.1);
      scaleY = 1 + breath * .065;
      scaleX = 1 - breath * .025;
      y = -breath * 1.5 * motion;
      angle = Math.sin(seconds * 1.05) * .025;
      const twitch = Math.pow(Math.max(0, Math.sin(seconds * 1.4)), 8);
      headSway = Math.sin(seconds * 12) * twitch * .035;
      headBob = breath * .014;
      bodyBend = breath * .02;
    } else if (state === 'play') {
      const hop = Math.max(0, Math.sin(seconds * 4.2));
      frame = hop > .72 ? 5 : 4;
      x = Math.sin(seconds * 2.1) * 8 * motion;
      y = -hop * 15 * motion;
      angle = Math.sin(seconds * 2.1) * .15;
      scaleX = 1 + Math.cos(seconds * 4.2) * .045;
      scaleY = 1 - Math.cos(seconds * 4.2) * .045;
      headSway = Math.sin(seconds * 5) * .035;
      bodyBend = Math.sin(seconds * 6.3) * .03;
    } else if (state === 'roll') {
      // Crouch, roll once, bounce and settle before the next floor roll.
      const rollingPhase = smooth((phase - .12) / .64);
      x = Math.sin(phase * Math.PI * 2) * width * .085;
      angle = rollingPhase * Math.PI * 2;
      y = -Math.abs(Math.sin(phase * Math.PI * 4)) * 3 * motion;
      scaleX = 1 + Math.sin(phase * Math.PI * 4) * .06;
      scaleY = 1 - Math.sin(phase * Math.PI * 4) * .06;
    }
    if (surprise !== null) {
      frame = 5;
      const leap = Math.max(0, Math.sin(Math.PI * Math.min(1, surprise / .74)));
      const bounce = surprise > .74 ? Math.sin((surprise - .74) / .26 * Math.PI) : 0;
      x = 0; y = (-leap * 12 - bounce * 3) * motion;
      angle = Math.sin(surprise * 28) * .08;
      scaleX = 1 + leap * .10; scaleY = 1 + leap * .10;
      headSway = Math.sin(surprise * Math.PI * 4) * .02;
      headBob = 0; bodyBend = 0;
    }
    const rolling = state === 'roll' && surprise === null;
    const size = rolling ? Math.min(width, height) * .66 : Math.min(width * .74, height * .76);
    draw.fillStyle = 'rgba(78, 75, 58, .09)';
    draw.beginPath();
    const ground = state === 'sleep' || rolling ? .81 : .89;
    draw.ellipse(width / 2 + x, height * ground, size * (state === 'play' ? .21 : .28), Math.max(1, height * .014), 0, 0, Math.PI * 2);
    draw.fill();
    draw.save();
    draw.translate(width / 2 + x, height * .55 + y);
    draw.rotate(angle); draw.scale(scaleX, scaleY);
    draw.imageSmoothingEnabled = true; draw.imageSmoothingQuality = 'high';
    if (rolling) draw.drawImage(rollImage, -size / 2, -size / 2, size, size);
    else {
      const pose = poses[frame];
      // 32 connected strips create smooth in-between head, neck and body poses
      // at the display refresh rate, without loading bigger sprite sheets.
      const strips = 32;
      warpDraw.clearRect(0, 0, warped.width, warped.height);
      const offsetY = t => t + headBob * Math.max(0, 1 - t / .65);
      for (let row = 0; row < strips; row++) {
        const top = row / strips, bottom = (row + 1) / strips;
        const headWeight = 1 - smooth((top - .20) / .45);
        const sway = headSway * headWeight + bodyBend * Math.sin(top * Math.PI);
        // Join strips on integer texture pixels before scaling/rotation, so
        // translucent artwork does not develop visible horizontal seams.
        const targetTop = Math.round(offsetY(top) * cellHeight) + padding;
        const targetBottom = Math.round(offsetY(bottom) * cellHeight) + padding;
        warpDraw.drawImage(pose, 0, top * cellHeight, cellWidth, cellHeight / strips,
          padding + Math.round(sway * cellWidth), targetTop, cellWidth, targetBottom - targetTop);
      }
      draw.drawImage(warped, -size / 2 - padding / cellWidth * size, -size / 2 - padding / cellHeight * size,
        warped.width / cellWidth * size, warped.height / cellHeight * size);
    }
    draw.restore();
  }
  return { render };
}
