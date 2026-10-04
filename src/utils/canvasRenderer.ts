import { MockupConfig, UploadedImage, DeviceFrameFinish } from '../types';

interface DrawSceneOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  time: number; // in seconds
  duration: number; // in seconds
  config: MockupConfig;
  images: UploadedImage[];
}

const DEVICE_COLORS: Record<DeviceFrameFinish, {
  outerBorder: string;
  innerBorder: string;
  rimHighlight: string;
  bezel: string;
}> = {
  midnight: {
    outerBorder: '#121214',
    innerBorder: '#1F1F23',
    rimHighlight: '#323238',
    bezel: '#09090B',
  },
  titanium: {
    outerBorder: '#23262B',
    innerBorder: '#393E46',
    rimHighlight: '#5A6270',
    bezel: '#0D0F12',
  },
  silver: {
    outerBorder: '#CBD5E1',
    innerBorder: '#E2E8F0',
    rimHighlight: '#FFFFFF',
    bezel: '#0F172A',
  },
  gold: {
    outerBorder: '#A37C42',
    innerBorder: '#C69C5C',
    rimHighlight: '#EBD2A3',
    bezel: '#1C1917',
  },
};

/**
 * Draws the background with spotlight / gradient
 */
function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: MockupConfig,
  time: number
) {
  const baseColor = config.backgroundColor || '#0A0D14';

  if (config.backgroundStyle === 'solid') {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, width, height);

  if (config.backgroundStyle === 'spotlight') {
    const spotX = width / 2 + Math.sin(time * 0.4) * (width * 0.04);
    const spotY = height / 2 + Math.cos(time * 0.3) * (height * 0.04);
    const radius = Math.max(width, height) * 0.75;

    const grad = ctx.createRadialGradient(spotX, spotY, 30, spotX, spotY, radius);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.02)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else if (config.backgroundStyle === 'gradient') {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
}

/**
 * Draws a rounded screenshot card with sleek dark border
 * (For the Screenshot Rows style, matching Image 1)
 */
function drawScreenshotCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  image: UploadedImage | undefined,
  options: {
    cornerRadius: number;
    showShadows: boolean;
    showGlare: boolean;
    glareProgress?: number;
  }
) {
  const { cornerRadius, showShadows, showGlare, glareProgress = 0 } = options;

  ctx.save();
  ctx.translate(x, y);

  const halfW = width / 2;
  const halfH = height / 2;

  // 1. Drop shadow
  if (showShadows) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 45;
    ctx.shadowOffsetY = 24;
    ctx.fillStyle = '#0F1117';
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, width, height, cornerRadius);
    ctx.fill();
    ctx.restore();
  }

  // 2. Chassis / Border background
  ctx.fillStyle = '#12141C';
  ctx.beginPath();
  ctx.roundRect(-halfW, -halfH, width, height, cornerRadius);
  ctx.fill();

  // Subtle border highlight
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 3. Screen content clipping
  const borderPad = 8;
  const innerW = width - borderPad * 2;
  const innerH = height - borderPad * 2;
  const innerRadius = Math.max(4, cornerRadius - borderPad * 0.7);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(-innerW / 2, -innerH / 2, innerW, innerH, innerRadius);
  ctx.clip();

  // Draw screenshot image
  if (image && image.imageElement && image.imageElement.complete) {
    const img = image.imageElement;
    // Cover the screen area cleanly
    const scale = Math.max(innerW / img.width, innerH / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  } else {
    ctx.fillStyle = '#181A22';
    ctx.fillRect(-innerW / 2, -innerH / 2, innerW, innerH);
    ctx.fillStyle = '#4B5563';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Web Screenshot', 0, 0);
  }

  // 4. Subtle glass glare
  if (showGlare) {
    const glareX = -innerW / 2 + (glareProgress % 1) * innerW * 1.8;
    const glareGrad = ctx.createLinearGradient(glareX, -innerH / 2, glareX + innerW * 0.5, innerH / 2);
    glareGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    glareGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.02)');
    glareGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glareGrad;
    ctx.fillRect(-innerW / 2, -innerH / 2, innerW, innerH);
  }

  ctx.restore();
  ctx.restore();
}

/**
 * Draws a realistic iPhone mockup
 * (For the iPhone Mockups style, matching Image 2)
 */
function drawIPhoneMockup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  image: UploadedImage | undefined,
  scrollY: number, // scroll offset in pixels
  options: {
    finish: DeviceFrameFinish;
    showShadows: boolean;
    showGlare: boolean;
    glareOffset?: number;
    rotation?: number;
    scale?: number;
  }
) {
  const {
    finish,
    showShadows,
    showGlare,
    glareOffset = 0,
    rotation = 0,
    scale = 1,
  } = options;
  const colors = DEVICE_COLORS[finish];

  ctx.save();
  ctx.translate(x, y);
  if (rotation !== 0) ctx.rotate(rotation);
  if (scale !== 1) ctx.scale(scale, scale);

  const halfW = width / 2;
  const halfH = height / 2;
  const cornerRadius = width * 0.14;

  // 1. Deep drop shadow
  if (showShadows) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 55;
    ctx.shadowOffsetY = 28;
    ctx.fillStyle = colors.outerBorder;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, width, height, cornerRadius);
    ctx.fill();
    ctx.restore();
  }

  // 2. Outer phone body
  ctx.fillStyle = colors.outerBorder;
  ctx.beginPath();
  ctx.roundRect(-halfW, -halfH, width, height, cornerRadius);
  ctx.fill();

  // Subtle metallic rim highlight
  ctx.strokeStyle = colors.rimHighlight;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // 3. Bezel & Screen
  const bezel = width * 0.038;
  const screenW = width - bezel * 2;
  const screenH = height - bezel * 2;
  const screenRadius = cornerRadius - bezel * 0.7;

  ctx.fillStyle = colors.bezel;
  ctx.beginPath();
  ctx.roundRect(-screenW / 2, -screenH / 2, screenW, screenH, screenRadius);
  ctx.fill();

  // 4. Screen clipping
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(-screenW / 2, -screenH / 2, screenW, screenH, screenRadius);
  ctx.clip();

  // Draw image inside screen
  if (image && image.imageElement && image.imageElement.complete) {
    const img = image.imageElement;
    const targetW = screenW;
    const targetH = (img.height / img.width) * screenW;
    const drawY = -screenH / 2 - scrollY;
    ctx.drawImage(img, -screenW / 2, drawY, targetW, targetH);
  } else {
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-screenW / 2, -screenH / 2, screenW, screenH);
    ctx.fillStyle = '#64748B';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Mobile Screenshot', 0, 0);
  }

  // Screen glare
  if (showGlare) {
    const glareX = -screenW / 2 + (glareOffset % 1) * screenW * 1.5;
    const glareGrad = ctx.createLinearGradient(glareX, -screenH / 2, glareX + screenW * 0.7, screenH / 2);
    glareGrad.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    glareGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.03)');
    glareGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glareGrad;
    ctx.fillRect(-screenW / 2, -screenH / 2, screenW, screenH);
  }

  ctx.restore();

  // 5. Dynamic Island Cutout (iPhone 16 / 15 Pro pill)
  const islandW = screenW * 0.32;
  const islandH = width * 0.075;
  const islandY = -screenH / 2 + width * 0.038;

  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.roundRect(-islandW / 2, islandY, islandW, islandH, islandH / 2);
  ctx.fill();

  // Subtle camera lens
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(-islandW / 4, islandY + islandH / 2, islandH * 0.28, 0, Math.PI * 2);
  ctx.fill();

  // Status Bar Time
  ctx.fillStyle = '#1C1917';
  ctx.font = `600 ${Math.round(width * 0.034)}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('9:41', -screenW / 2 + width * 0.06, islandY + islandH * 0.75);

  // Home Indicator Bar
  const barW = screenW * 0.36;
  const barH = 4;
  const barY = screenH / 2 - width * 0.035;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.beginPath();
  ctx.roundRect(-barW / 2, barY, barW, barH, barH / 2);
  ctx.fill();

  ctx.restore();
}

/**
 * STYLE 1: "Screenshot Rows"
 * Multiple horizontal rows of desktop/tablet screenshots smoothly gliding in alternating directions
 * (Straight, level rows with zero rotation or wobble)
 */
function renderScreenshotRows(options: DrawSceneOptions) {
  const { ctx, width, height, time, duration, config, images } = options;

  // Progress and motion easing
  const rawP = (time % duration) / duration;
  let loopP = rawP;
  if (config.easing === 'smooth') {
    // Smooth sinusoidal easing: soft ease at keyframe cycle boundaries, fluid glide through center
    loopP = rawP - (0.55 / (2 * Math.PI)) * Math.sin(2 * Math.PI * rawP);
  }
  const cycleCount = Math.floor(time / duration);
  const effectiveTime = (cycleCount + loopP) * duration;

  // Calibrated speeds with much slower options
  const speedMult =
    config.scrollSpeed === 'very-slow'
      ? 0.15
      : config.scrollSpeed === 'slow'
      ? 0.32
      : config.scrollSpeed === 'fast'
      ? 1.10
      : 0.65;

  // Card geometry
  const isVertical = width < height;
  const isSquare = Math.abs(width - height) < 50;

  let cardW: number;
  let cardH: number;

  if (isVertical) {
    cardW = width * 0.88;
    cardH = cardW * 0.64;
  } else if (isSquare) {
    cardW = width * 0.68;
    cardH = cardW * 0.64;
  } else {
    // 16:9 Landscape
    cardW = width * 0.44;
    cardH = cardW * 0.65;
  }

  const gapX = cardW * 0.08;
  const gapY = cardH * 0.14;
  const rowStrideX = cardW + gapX;
  const rowStrideY = cardH + gapY;

  ctx.save();
  ctx.translate(width / 2, height / 2);

  // 3 straight, perfectly horizontal rows
  const rows = [-1, 0, 1];
  const cardsPerRow = 5;

  rows.forEach((rowIndex) => {
    const rowY = rowIndex * rowStrideY;
    const direction = rowIndex % 2 === 0 ? -1 : 1;
    const speed = rowStrideX * speedMult * 0.4;
    const totalRowShift = effectiveTime * speed * direction;

    for (let c = -2; c <= 2; c++) {
      let cardX = c * rowStrideX + totalRowShift;

      // Wrap around seamlessly
      const span = cardsPerRow * rowStrideX;
      cardX = ((((cardX + span / 2) % span) + span) % span) - span / 2;

      // Pick image deterministically
      const imgIdx = Math.abs((c + rowIndex * 3 + 100) % images.length);
      const img = images[imgIdx];

      drawScreenshotCard(
        ctx,
        cardX,
        rowY,
        cardW,
        cardH,
        img,
        {
          cornerRadius: cardW * 0.035,
          showShadows: config.showShadows,
          showGlare: config.showGlare,
          glareProgress: loopP * 2 + c * 0.2,
        }
      );
    }
  });

  ctx.restore();
}

/**
 * STYLE 2: "iPhone Mockups"
 * Exactly 2 straight, aligned columns of sleek iPhone mockups gliding vertically with static screenshots
 * (Zero rotation, zero tilt, perfectly vertical aligned tracks)
 */
function renderIPhoneMockups(options: DrawSceneOptions) {
  const { ctx, width, height, time, duration, config, images } = options;

  // Progress and motion easing
  const rawP = (time % duration) / duration;
  let loopP = rawP;
  if (config.easing === 'smooth') {
    // Smooth sinusoidal easing: soft ease at keyframe cycle boundaries, fluid glide through center
    loopP = rawP - (0.55 / (2 * Math.PI)) * Math.sin(2 * Math.PI * rawP);
  }
  const cycleCount = Math.floor(time / duration);
  const effectiveTime = (cycleCount + loopP) * duration;

  // Calibrated speeds with much slower options
  const speedMult =
    config.scrollSpeed === 'very-slow'
      ? 0.15
      : config.scrollSpeed === 'slow'
      ? 0.32
      : config.scrollSpeed === 'fast'
      ? 1.10
      : 0.65;

  const isVertical = width < height;
  const isSquare = Math.abs(width - height) < 50;

  // Phone dimensions tailored for a clean 2-column layout
  let phoneW: number;
  if (isVertical) {
    phoneW = width * 0.44;
  } else if (isSquare) {
    phoneW = width * 0.32;
  } else {
    // 16:9 Landscape
    phoneW = width * 0.23;
  }
  const phoneH = phoneW * 2.12;

  // Gap between the two columns and between phones vertically
  const colGapX = phoneW * 1.18;
  const rowGapY = phoneH * 1.10;

  ctx.save();
  ctx.translate(width / 2, height / 2);

  // Exactly two straight vertical columns: Left (-0.5) and Right (+0.5), centered
  const twoColumns = [-0.5, 0.5];

  twoColumns.forEach((colFactor, colIdx) => {
    // Perfectly straight vertical column line
    const colX = colFactor * colGapX;

    // Left column glides down, right column glides up
    const direction = colIdx === 0 ? 1 : -1;
    const speed = rowGapY * 0.35 * speedMult;
    const totalShift = effectiveTime * speed * direction;

    // Stacked iPhones along the column with seamless wrap-around
    const phonesPerCol = 5;
    const span = phonesPerCol * rowGapY;

    for (let r = -2; r <= 2; r++) {
      let phoneY = r * rowGapY + totalShift;

      // Wrap around seamlessly
      phoneY = ((((phoneY + span / 2) % span) + span) % span) - span / 2;

      // Pick image deterministically across phones and columns
      const imgIdx = Math.abs((colIdx + r * 2 + 10) % images.length);
      const img = images[imgIdx];

      // Static screenshot: scrollY = 0 (no internal scroll-through)
      const staticScrollY = 0;

      // Perfectly aligned: rotation is 0, no wobble or tilt
      drawIPhoneMockup(
        ctx,
        colX,
        phoneY,
        phoneW,
        phoneH,
        img,
        staticScrollY,
        {
          finish: config.deviceFinish,
          showShadows: config.showShadows,
          showGlare: config.showGlare,
          glareOffset: loopP + colIdx * 0.3 + r * 0.2,
          rotation: 0,
          scale: 1.0,
        }
      );
    }
  });

  ctx.restore();
}

/**
 * Main export & preview scene renderer
 */
export function renderMockupScene(options: DrawSceneOptions) {
  const { ctx, width, height, time, config } = options;

  ctx.clearRect(0, 0, width, height);

  // 1. Background
  drawBackground(ctx, width, height, config, time);

  // 2. Render chosen animation style
  if (config.style === 'screenshot-rows') {
    renderScreenshotRows(options);
  } else {
    renderIPhoneMockups(options);
  }
}
