import { UploadedImage } from "../types";

/**
 * Creates 9:16 Mobile Screenshot 1: Luxury Architecture Editorial
 */
function createMobileEditorialMaison(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1280; // 9:16
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Warm linen background
  ctx.fillStyle = "#F5F3EE";
  ctx.fillRect(0, 0, 720, 1280);

  // Top header
  ctx.fillStyle = "#1C1917";
  ctx.font = 'bold 20px "Playfair Display", Georgia, serif';
  ctx.fillText("ATELIER MAISON", 48, 60);

  // Minimal hamburger
  ctx.fillStyle = "#1C1917";
  ctx.fillRect(630, 48, 42, 3);
  ctx.fillRect(630, 58, 42, 3);

  // Kicker
  ctx.fillStyle = "#78716C";
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.fillText("COLLECTION 2026 · MONOGRAPH", 48, 135);

  // Main title
  ctx.fillStyle = "#1C1917";
  ctx.font = 'bold 46px "Playfair Display", Georgia, serif';
  ctx.fillText("The Art of Living", 48, 195);
  ctx.fillText("in Quiet Form", 48, 248);

  // Large featured interior photograph
  const imgX = 48;
  const imgY = 285;
  const imgW = 624;
  const imgH = 460;

  ctx.fillStyle = "#E8E3D9";
  ctx.beginPath();
  ctx.roundRect(imgX, imgY, imgW, imgH, 12);
  ctx.fill();

  // Architecture interior: Dining table and sunlight
  ctx.fillStyle = "#26221E";
  ctx.beginPath();
  ctx.roundRect(imgX + 80, imgY + 240, 464, 28, 4);
  ctx.fill();
  ctx.fillRect(imgX + 130, imgY + 268, 22, 170);
  ctx.fillRect(imgX + 470, imgY + 268, 22, 170);

  // Sunlight diagonal wash
  const sun = ctx.createLinearGradient(imgX, imgY, imgX + imgW, imgY + imgH);
  sun.addColorStop(0, "rgba(255, 255, 255, 0.4)");
  sun.addColorStop(0.6, "rgba(255, 255, 255, 0.05)");
  sun.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.moveTo(imgX + 40, imgY);
  ctx.lineTo(imgX + 320, imgY);
  ctx.lineTo(imgX + 540, imgY + imgH);
  ctx.lineTo(imgX + 80, imgY + imgH);
  ctx.fill();

  // Pendant lamp
  ctx.strokeStyle = "#1C1917";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(imgX + 312, imgY);
  ctx.lineTo(imgX + 312, imgY + 110);
  ctx.stroke();

  ctx.fillStyle = "#B4905A";
  ctx.beginPath();
  ctx.arc(imgX + 312, imgY + 135, 42, Math.PI, 0);
  ctx.fill();

  // Monograph description
  ctx.fillStyle = "#57534E";
  ctx.font = "400 18px Georgia, serif";
  ctx.fillText(
    "A curated dialogue between natural daylight, raw basalt,",
    48,
    790,
  );
  ctx.fillText("and architectural proportion for modern life.", 48, 820);

  // Table summary
  const rows = [
    { label: "Location", val: "Kyoto, Japan" },
    { label: "Principal", val: "Jonas Lind & Aoi Sato" },
    { label: "Materials", val: "Smoked Oak, Travertine" },
  ];
  rows.forEach((r, idx) => {
    const y = 890 + idx * 65;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
    ctx.beginPath();
    ctx.moveTo(48, y);
    ctx.lineTo(672, y);
    ctx.stroke();

    ctx.fillStyle = "#78716C";
    ctx.font = "400 16px system-ui, sans-serif";
    ctx.fillText(r.label, 48, y - 14);

    ctx.fillStyle = "#1C1917";
    ctx.font = "600 16px system-ui, sans-serif";
    ctx.fillText(r.val, 420, y - 14);
  });

  // Bottom action
  ctx.fillStyle = "#1C1917";
  ctx.beginPath();
  ctx.roundRect(48, 1110, 624, 65, 8);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 17px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Explore Residence Architecture →", 360, 1148);

  return canvas.toDataURL("image/png");
}

/**
 * Creates 9:16 Mobile Screenshot 2: Minimalist Furniture & Objects
 */
function createMobileFurnitureStore(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1280; // 9:16
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#FAF8F5";
  ctx.fillRect(0, 0, 720, 1280);

  // Nav
  ctx.fillStyle = "#18181B";
  ctx.font = 'bold 20px "Playfair Display", Georgia, serif';
  ctx.fillText("NORDIC CRAFT", 48, 60);

  ctx.font = "500 15px system-ui, sans-serif";
  ctx.fillStyle = "#71717A";
  ctx.fillText("Bag (1)", 610, 58);

  // Subtitle
  ctx.fillStyle = "#A1A1AA";
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.fillText("LIMITED OBJECT NO. 04", 48, 130);

  ctx.fillStyle = "#09090B";
  ctx.font = 'bold 44px "Playfair Display", Georgia, serif';
  ctx.fillText("Scorched Oak", 48, 185);
  ctx.fillText("Lounge Chair", 48, 238);

  ctx.fillStyle = "#27272A";
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillText("$640 USD", 48, 290);

  // Product photo frame
  const px = 48;
  const py = 325;
  const pw = 624;
  const ph = 530;

  ctx.fillStyle = "#ECE8E1";
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 14);
  ctx.fill();

  // Stylized chair silhouette
  ctx.fillStyle = "#1C1917";
  // Backrest curve
  ctx.beginPath();
  ctx.roundRect(px + 160, py + 110, 300, 35, 8);
  ctx.fill();
  // Seat
  ctx.beginPath();
  ctx.roundRect(px + 120, py + 260, 380, 30, 6);
  ctx.fill();
  // Legs
  ctx.fillRect(px + 160, py + 290, 20, 190);
  ctx.fillRect(px + 440, py + 290, 20, 190);
  ctx.fillRect(px + 220, py + 145, 16, 115);
  ctx.fillRect(px + 380, py + 145, 16, 115);

  // Spec points
  const points = [
    "Hand-scorched solid Nordic white oak",
    "Natural beeswax and linseed oil finish",
    "Custom hand-stitched aniline leather cushion",
  ];
  points.forEach((pt, i) => {
    const y = 910 + i * 50;
    ctx.fillStyle = "#18181B";
    ctx.beginPath();
    ctx.arc(58, y - 5, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "400 16px system-ui, sans-serif";
    ctx.fillStyle = "#52525B";
    ctx.fillText(pt, 80, y);
  });

  // Action Button
  ctx.fillStyle = "#18181B";
  ctx.beginPath();
  ctx.roundRect(48, 1100, 624, 65, 8);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 17px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Add to Bag — $640", 360, 1140);

  return canvas.toDataURL("image/png");
}

/**
 * Creates 9:16 Mobile Screenshot 3: Architecture Monograph Specs
 */
function createMobileMonographSpecs(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1280; // 9:16
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#F5F3EE";
  ctx.fillRect(0, 0, 720, 1280);

  // Header
  ctx.fillStyle = "#1C1917";
  ctx.font = 'bold 20px "Playfair Display", Georgia, serif';
  ctx.fillText("ATELIER MAISON", 48, 60);

  ctx.fillStyle = "#78716C";
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.fillText("SERVICES & PRACTICE", 48, 130);

  ctx.fillStyle = "#1C1917";
  ctx.font = 'bold 40px "Playfair Display", Georgia, serif';
  ctx.fillText("Architectural Scope", 48, 185);

  const services = [
    {
      num: "01",
      title: "Spatial Choreography",
      desc: "Holistic residential masterplanning and volume sequencing.",
    },
    {
      num: "02",
      title: "Material Honesty",
      desc: "Direct quarry selection of hand-dressed basalt and honed oak.",
    },
    {
      num: "03",
      title: "Bespoke Joinery",
      desc: "Site-specific furniture engineered in our Kyoto craft atelier.",
    },
    {
      num: "04",
      title: "Daylight Luminaire",
      desc: "Passive solar orientation paired with hidden evening lights.",
    },
  ];

  services.forEach((s, idx) => {
    const y = 230 + idx * 160;
    ctx.fillStyle = "#EDE8DE";
    ctx.beginPath();
    ctx.roundRect(48, y, 624, 135, 12);
    ctx.fill();

    ctx.fillStyle = "#9C9286";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText(s.num, 75, y + 42);

    ctx.fillStyle = "#1C1917";
    ctx.font = 'bold 22px "Playfair Display", serif';
    ctx.fillText(s.title, 125, y + 42);

    ctx.fillStyle = "#57534E";
    ctx.font = "400 16px Georgia, serif";
    ctx.fillText(s.desc, 75, y + 84);
  });

  // Bottom contact banner
  const by = 910;
  ctx.fillStyle = "#1C1917";
  ctx.beginPath();
  ctx.roundRect(48, by, 624, 280, 14);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = 'bold 30px "Playfair Display", serif';
  ctx.fillText("Commission Dialogue", 85, by + 75);

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "400 16px Georgia, serif";
  ctx.fillText("Now accepting select private residential", 85, by + 120);
  ctx.fillText("commissions for 2026 / 2027.", 85, by + 150);

  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.roundRect(85, by + 185, 260, 52, 6);
  ctx.fill();

  ctx.fillStyle = "#1C1917";
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.fillText("Submit Inquiry →", 125, by + 218);

  return canvas.toDataURL("image/png");
}

/**
 * Creates 9:16 Mobile Screenshot 4: Craft Atelier Portrait
 */
function createMobileCraftStudio(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1280; // 9:16
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#F5F3EE";
  ctx.fillRect(0, 0, 720, 1280);

  // Header
  ctx.fillStyle = "#1C1917";
  ctx.font = 'bold 20px "Playfair Display", Georgia, serif';
  ctx.fillText("ATELIER MAISON", 48, 60);

  // Large photo top
  ctx.fillStyle = "#292524";
  ctx.beginPath();
  ctx.roundRect(48, 110, 624, 620, 14);
  ctx.fill();

  // Two studio craftspeople silhouettes
  ctx.fillStyle = "#EDE8DE";
  ctx.beginPath();
  ctx.arc(260, 310, 55, 0, Math.PI * 2);
  ctx.arc(460, 330, 48, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillRect(180, 370, 160, 280);
  ctx.fillRect(390, 390, 140, 260);

  // Heading
  ctx.fillStyle = "#1C1917";
  ctx.font = 'bold 42px "Playfair Display", serif';
  ctx.fillText("Reduction & Rigor", 48, 800);

  ctx.fillStyle = "#57534E";
  ctx.font = "400 19px Georgia, serif";
  ctx.fillText("Rooted in the principle that true luxury lies in", 48, 855);
  ctx.fillText("unadorned material truth, silence, and permanence.", 48, 890);

  // Atelier details
  const details = [
    { label: "Workshops", val: "Kyoto · Copenhagen" },
    { label: "Founded", val: "2018" },
    { label: "Recognition", val: "Mies Crown Hall 2026" },
  ];
  details.forEach((d, idx) => {
    const y = 970 + idx * 65;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
    ctx.beginPath();
    ctx.moveTo(48, y);
    ctx.lineTo(672, y);
    ctx.stroke();

    ctx.fillStyle = "#78716C";
    ctx.font = "400 16px system-ui, sans-serif";
    ctx.fillText(d.label, 48, y - 14);

    ctx.fillStyle = "#1C1917";
    ctx.font = "600 16px system-ui, sans-serif";
    ctx.fillText(d.val, 400, y - 14);
  });

  return canvas.toDataURL("image/png");
}

/**
 * Creates 16:9 Desktop Screenshot 1: Atelier Maison Desktop
 */
function createEditorialDesktopScreenshot(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 900;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#F5F3EE";
  ctx.fillRect(0, 0, 1600, 900);

  // Nav
  ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(70, 75);
  ctx.lineTo(1530, 75);
  ctx.stroke();

  ctx.fillStyle = "#1C1917";
  ctx.font = 'bold 22px "Playfair Display", Georgia, serif';
  ctx.fillText("ATELIER MAISON", 70, 48);

  ctx.font = "400 15px system-ui, sans-serif";
  ctx.fillStyle = "#78716C";
  ctx.fillText("Architecture", 680, 47);
  ctx.fillText("Interiors", 820, 47);
  ctx.fillText("Selected Works", 950, 47);
  ctx.fillText("Contact", 1470, 47);

  // Left copy
  ctx.fillStyle = "#1C1917";
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.fillText("MONOGRAPH — 2026", 90, 190);

  ctx.font = 'bold 58px "Playfair Display", Georgia, serif';
  ctx.fillText("The Art of Living", 90, 265);
  ctx.fillText("in Quiet Form", 90, 335);

  ctx.fillStyle = "#57534E";
  ctx.font = "400 19px Georgia, serif";
  ctx.fillText(
    "A curated dialogue between natural daylight, raw basalt,",
    90,
    410,
  );
  ctx.fillText(
    "and architectural proportion designed for modern life.",
    90,
    442,
  );

  // Right photo
  const imgX = 720;
  const imgY = 120;
  const imgW = 810;
  const imgH = 700;

  ctx.fillStyle = "#E7E2D8";
  ctx.beginPath();
  ctx.roundRect(imgX, imgY, imgW, imgH, 12);
  ctx.fill();

  ctx.fillStyle = "#26221E";
  ctx.beginPath();
  ctx.roundRect(imgX + 100, imgY + 360, 610, 40, 6);
  ctx.fill();
  ctx.fillRect(imgX + 160, imgY + 400, 30, 240);
  ctx.fillRect(imgX + 610, imgY + 400, 30, 240);

  return canvas.toDataURL("image/png");
}

/**
 * Creates 16:9 Desktop Screenshot 2: Nexus Cloud Platform
 */
function createSaaSDesktopScreenshot(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 900;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const bgGrad = ctx.createLinearGradient(0, 0, 0, 900);
  bgGrad.addColorStop(0, "#090D16");
  bgGrad.addColorStop(1, "#05070B");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1600, 900);

  // Nav
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  ctx.fillRect(0, 0, 1600, 75);

  ctx.fillStyle = "#38BDF8";
  ctx.beginPath();
  ctx.arc(100, 38, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.fillText("NEXUS ARCHITECTURE", 125, 45);

  // Headline
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 56px system-ui, sans-serif";
  ctx.fillText("Next-Gen Cloud Orchestration", 800, 210);
  ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
  ctx.font = "400 20px system-ui, sans-serif";
  ctx.fillText(
    "Autonomous infrastructure scaling designed for high-concurrency workloads.",
    800,
    270,
  );

  // Card
  ctx.textAlign = "left";
  const cardX = 180;
  const cardY = 340;
  const cardW = 1240;
  const cardH = 480;

  ctx.fillStyle = "#0F172A";
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.stroke();

  return canvas.toDataURL("image/png");
}

/**
 * Creates 16:9 Desktop Screenshot 3: Scandinavian Minimalist Gallery
 */
function createGalleryDesktopScreenshot(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 900;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#FAF9F6";
  ctx.fillRect(0, 0, 1600, 900);

  // Minimal clean typography
  ctx.fillStyle = "#18181B";
  ctx.font = 'bold 24px "Playfair Display", Georgia, serif';
  ctx.fillText("ATELIER MINIMAL — SELECTED ARCHITECTURE", 80, 70);

  // 3 gallery cards
  const cardW = 440;
  const cardH = 680;
  const gap = 60;
  const startX = 80;
  const startY = 130;

  for (let i = 0; i < 3; i++) {
    const x = startX + i * (cardW + gap);
    ctx.fillStyle = "#ECE9E1";
    ctx.beginPath();
    ctx.roundRect(x, startY, cardW, cardH, 8);
    ctx.fill();

    ctx.fillStyle = "#27272A";
    ctx.fillRect(x + 40, startY + 280, cardW - 80, 30);
    ctx.fillRect(x + 90, startY + 310, 20, 260);
    ctx.fillRect(x + cardW - 110, startY + 310, 20, 260);

    ctx.fillStyle = "#18181B";
    ctx.font = 'bold 22px "Playfair Display", serif';
    ctx.fillText(`Pavilion 0${i + 1}`, x + 40, startY + 60);
    ctx.font = "400 15px system-ui, sans-serif";
    ctx.fillStyle = "#71717A";
    ctx.fillText("Copenhagen, 2026", x + 40, startY + 95);
  }

  return canvas.toDataURL("image/png");
}

export function loadDefaultDesktopImages(): Promise<UploadedImage[]> {
  const samples: UploadedImage[] = [
    {
      id: "sample-desktop-1",
      name: "Atelier-Maison-Desktop.png",
      url: createEditorialDesktopScreenshot(),
      width: 1600,
      height: 900,
      aspectRatio: 1600 / 900,
      category: "desktop",
    },
    {
      id: "sample-desktop-2",
      name: "Nexus-Cloud-Platform.png",
      url: createSaaSDesktopScreenshot(),
      width: 1600,
      height: 900,
      aspectRatio: 1600 / 900,
      category: "desktop",
    },
    {
      id: "sample-desktop-3",
      name: "Minimal-Pavilion-Gallery.png",
      url: createGalleryDesktopScreenshot(),
      width: 1600,
      height: 900,
      aspectRatio: 1600 / 900,
      category: "desktop",
    },
  ];

  return Promise.all(
    samples.map(
      (s) =>
        new Promise<UploadedImage>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            s.imageElement = img;
            resolve(s);
          };
          img.onerror = () => resolve(s);
          img.src = s.url;
        }),
    ),
  );
}

export function loadDefaultMobileImages(): Promise<UploadedImage[]> {
  const samples: UploadedImage[] = [
    {
      id: "sample-mobile-1",
      name: "Maison-Mobile-Residence.png",
      url: createMobileEditorialMaison(),
      width: 720,
      height: 1280,
      aspectRatio: 720 / 1280,
      category: "mobile",
    },
    {
      id: "sample-mobile-2",
      name: "Nordic-Chair-Store.png",
      url: createMobileFurnitureStore(),
      width: 720,
      height: 1280,
      aspectRatio: 720 / 1280,
      category: "mobile",
    },
    {
      id: "sample-mobile-3",
      name: "Monograph-Specs-Mobile.png",
      url: createMobileMonographSpecs(),
      width: 720,
      height: 1280,
      aspectRatio: 720 / 1280,
      category: "mobile",
    },
    {
      id: "sample-mobile-4",
      name: "Craft-Studio-Mobile.png",
      url: createMobileCraftStudio(),
      width: 720,
      height: 1280,
      aspectRatio: 720 / 1280,
      category: "mobile",
    },
  ];

  return Promise.all(
    samples.map(
      (s) =>
        new Promise<UploadedImage>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            s.imageElement = img;
            resolve(s);
          };
          img.onerror = () => resolve(s);
          img.src = s.url;
        }),
    ),
  );
}

export function loadImageFromFile(
  file: File,
  category: "desktop" | "mobile",
): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        resolve({
          id: `upload-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          url: dataUrl,
          imageElement: img,
          width: img.width,
          height: img.height,
          aspectRatio: img.width / img.height,
          category,
        });
      };
      img.onerror = reject;
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
