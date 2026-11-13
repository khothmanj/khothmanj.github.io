/*
 * Fine-line sector illustrations. Strokes use currentColor so they follow the theme.
 * TenorArt.scene(name) -> large SVG string (decorative, aria-hidden). TenorArt.icon(name) -> small SVG string.
 */
(function (root) {
  'use strict';
  const S = (body, vb = '0 0 400 260') => '<svg viewBox="' + vb + '" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  const tree = (x, y, s = 1) => '<path d="M' + x + ' ' + y + 'v' + (-14 * s) + '"/><path d="M' + (x - 11 * s) + ' ' + (y - 16 * s) + 'c0-8 6-13 11-13s11 5 11 13c0 5-5 7-11 7s-11-2-11-7z"/><path d="M' + (x - 6 * s) + ' ' + (y - 19 * s) + 'c3 2 8 2 12 0"/>';
  const plant = (x, y, h = 26, lean = 1) => '<path d="M' + x + ' ' + y + 'c0-' + h * 0.5 + ' ' + 2 * lean + '-' + h * 0.8 + ' ' + 6 * lean + '-' + h + '"/><path d="M' + (x + 6 * lean) + ' ' + (y - h) + 'c3 2 5 6 5 11"/><path d="M' + (x + 1) + ' ' + (y - h * 0.4) + 'c-4-4-7-9-7-15"/>' +
    [0, 1, 2, 3].map((i) => '<path d="M' + (x + 6 * lean + 1 + i * 1.2) + ' ' + (y - h + 2 + i * 3) + 'l3 1"/>').join('');
  const hills = '<path d="M10 120c40-22 70-30 110-18s60 10 90-6 70-20 110-6 50 12 70 6"/><path d="M60 132c30-10 60-12 90-4"/>';
  const terraces = (y0 = 150) => [0, 1, 2, 3, 4, 5].map((i) => '<path d="M' + (20 + i * 4) + ' ' + (y0 + i * 16) + 'c70-' + (18 - i * 2) + ' 150-' + (20 - i * 2) + ' 240-4s90 10 110 0"/>').join('') +
    [0, 1, 2, 3, 4].map((i) => [0, 1, 2, 3, 4, 5, 6, 7, 8].map((j) => '<path d="M' + (60 + j * 32 + (i % 2) * 14) + ' ' + (y0 + 10 + i * 16) + 'v-5"/>').join('')).join('');

  const SCENES = {
    fields: S(hills + tree(300, 104) + tree(332, 110, 0.8) + tree(120, 100, 0.9) + terraces(146) + plant(26, 250, 70, 1) + plant(44, 252, 60, 1) + plant(60, 250, 52, -1) + plant(18, 252, 48, -1) + plant(76, 252, 40, 1)),
    irrigation: S(hills + tree(320, 104) + tree(90, 100, 0.8) + terraces(150) +
      '<path d="M262 196h66v-30h-66z"/><path d="M256 168l39-22 39 22"/><path d="M276 196v-18h14v18"/><path d="M302 176h18v10h-18z"/><path d="M304 181h14"/>' +
      '<path d="M262 186h-20v8h-10"/><path d="M232 190c-4 6-6 14-6 22"/><path d="M228 196c-2 6-3 12-2 18"/><path d="M236 196c0 6 1 12-1 18"/><path d="M210 230c20-6 50-8 80-2s60 4 90-4"/>' +
      plant(24, 250, 66, 1) + plant(42, 252, 58, 1) + plant(58, 250, 48, -1)),
    livestock: S(hills + tree(330, 106) + '<path d="M40 210v-70l45-30 45 30v70z"/><path d="M60 210v-40h50v40"/><path d="M60 170l50 40M110 170l-50 40"/><path d="M75 128h20v14h-20z"/>' +
      '<path d="M150 210v-86c0-10 30-10 30 0v86"/><path d="M150 140h30M150 160h30M150 180h30"/><path d="M190 214h200M190 196h200"/>' + [0, 1, 2, 3, 4, 5, 6].map((i) => '<path d="M' + (200 + i * 30) + ' 190v28"/>').join('') +
      [0, 1, 2].map((i) => { const x = 230 + i * 50, y = 244; return '<path d="M' + x + ' ' + y + 'c-14 0-20-8-18-16 3-10 16-12 24-6l6-6c4-2 7 2 5 5l-4 3c2 6 0 20-13 20z"/><path d="M' + (x + 16) + ' ' + (y - 21) + 'l5-1"/><path d="M' + (x - 2) + ' ' + y + 'v6M' + (x + 4) + ' ' + y + 'v6"/>'; }).join('') + '<path d="M10 250h380"/>'),
    factory: S('<path d="M20 240h360"/><path d="M40 240v-90l50 30v-30l50 30v-30l50 30v-30l50 30v90"/><path d="M270 240v-150h22v150"/><path d="M276 80c-6-10 4-16 0-26M286 76c6-8-2-16 4-24"/>' +
      [0, 1, 2, 3].map((i) => '<path d="M' + (56 + i * 50) + ' 196h24v20h-24z"/>').join('') + '<path d="M300 220h80M300 230h80"/>' + [0, 1, 2].map((i) => '<circle cx="' + (306 + i * 34) + '" cy="225" r="5"/>').join('') +
      '<path d="M312 220v-14h18v14M344 220v-12h22v12"/><path d="M60 150v-30h14v20"/>' + tree(360, 140, 0.8)),
    solar: S('<circle cx="320" cy="56" r="20"/>' + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i * Math.PI) / 4; return '<path d="M' + (320 + Math.cos(a) * 28).toFixed(1) + ' ' + (56 + Math.sin(a) * 28).toFixed(1) + 'L' + (320 + Math.cos(a) * 38).toFixed(1) + ' ' + (56 + Math.sin(a) * 38).toFixed(1) + '"/>'; }).join('') +
      [0, 1, 2].map((r) => [0, 1, 2].map((c) => { const x = 30 + c * 90 + r * 18, y = 150 + r * 34; return '<path d="M' + x + ' ' + y + 'h76l10 22h-76z"/><path d="M' + (x + 25) + ' ' + y + 'l10 22M' + (x + 50) + ' ' + y + 'l10 22M' + (x + 5) + ' ' + (y + 11) + 'h76"/><path d="M' + (x + 40) + ' ' + (y + 22) + 'v8"/>'; }).join('')).join('') +
      '<path d="M320 240v-60l30-20 30 20v60z"/><path d="M340 240v-26h20v26"/><path d="M330 190h10v10h-10z"/><path d="M290 120v120M286 124h8"/><path d="M290 124c20 6 40 30 44 56"/><path d="M10 250h380"/>'),
    refinery: S('<path d="M10 240h380"/><path d="M60 240v-150h24v150M60 120h24M60 150h24M60 180h24M60 210h24"/><path d="M100 240v-110h20v110M100 160h20M100 200h20"/><path d="M72 90v-20"/>' +
      '<circle cx="200" cy="200" r="30"/><path d="M180 222l-8 18M220 222l8 18"/><path d="M250 240v-50c0-12 60-12 60 0v50"/><path d="M250 200c0 8 60 8 60 0"/>' +
      '<path d="M350 240v-170"/><path d="M346 70c-4-10 2-18 4-26 4 8 10 14 6 26"/><path d="M84 200h16M120 220h50M310 220h40"/><path d="M130 130h40v-30h30"/>' + tree(372, 170, 0.6)),
    laptop: S('<path d="M110 70h180v118h-180z"/><path d="M80 200h240l-14 16h-212z"/><path d="M128 166l30-26 26 14 38-40 30 18 26-30"/><circle cx="278" cy="102" r="3"/><path d="M128 90h60M128 100h36"/>' +
      '<path d="M320 120h40v80h-40z"/><path d="M332 190h16"/><path d="M328 176v-10M336 176v-18M344 176v-14M352 176v-26"/><path d="M10 230h380"/>' + tree(50, 220, 0.9)),
    phone: S('<path d="M150 50h90c6 0 10 4 10 10v170c0 6-4 10-10 10h-90c-6 0-10-4-10-10v-170c0-6 4-10 10-10z"/><path d="M182 62h26"/><path d="M160 90h70v40h-70z"/><path d="M168 118h24M168 104h10"/><path d="M160 150h70M160 166h50M160 182h60"/><circle cx="195" cy="214" r="6"/>' +
      '<path d="M268 110c10 10 10 30 0 40M282 98c18 18 18 46 0 64M296 86c26 26 26 62 0 88"/><ellipse cx="96" cy="196" rx="26" ry="8"/><path d="M70 196v10c0 4 12 8 26 8s26-4 26-8v-10"/><path d="M70 206v10c0 4 12 8 26 8s26-4 26-8v-10"/><path d="M86 192h20"/><path d="M10 240h380"/>'),
    truck: S('<path d="M10 236h380"/><path d="M220 236v-110l70-30 70 30v110"/><path d="M246 236v-56h88v56"/><path d="M246 196h88M246 214h88"/><path d="M290 140l-6 0 6-10 6 10z"/><path d="M290 112v12M284 118h12M285 113l10 10M295 113l-10 10"/>' +
      '<path d="M30 220v-70h110v70z"/><path d="M140 220v-50h34l20 26v24z"/><path d="M150 176h18l12 16h-30z"/><circle cx="62" cy="224" r="12"/><circle cx="168" cy="224" r="12"/><path d="M48 168h60M48 182h40"/>'),
    clinic: S('<path d="M10 240h380"/><path d="M90 240v-120h220v120"/><path d="M80 120h240l-20-26h-200z"/><path d="M186 240v-46h28v46"/><path d="M200 100v-6"/><path d="M188 150h24M200 138v24"/><circle cx="200" cy="150" r="18"/>' +
      [0, 1].map((i) => '<path d="M' + (110 + i * 40) + ' 180h26v22h-26zM' + (238 + i * 40) + ' 180h26v22h-26z"/>').join('') + tree(350, 236, 1) + tree(40, 236, 0.8)),
  };
  // sectors that share a drawing
  const SECTOR_SCENE = { crops: 'fields', irrigation: 'irrigation', livestock: 'livestock', agro_processing: 'factory', manufacturing: 'factory', energy: 'solar', petroleum: 'refinery', tech: 'laptop', fintech: 'phone', logistics: 'truck', health: 'clinic' };

  const I = (body) => '<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  const ICONS = {
    crops: I('<path d="M4 28h40"/><path d="M14 28c0-8 2-14 6-18M20 10c2 2 3 5 3 8M15 18c-3-2-5-5-5-9"/><path d="M30 28c0-6 1-11 4-14M34 14c2 1 3 4 3 7"/>'),
    irrigation: I('<path d="M4 28h40"/><path d="M26 20h14v-8h-14z"/><path d="M24 13l9-6 9 6"/><path d="M26 16h-8v4"/><path d="M18 22c-1 2-1 4 0 6M14 22c-1 2-1 4 0 6"/>'),
    livestock: I('<path d="M4 28h40"/><path d="M6 28v-14l8-6 8 6v14"/><path d="M11 28v-8h6v8"/><path d="M28 26c-6 0-8-4-7-7 1-4 6-5 9-2l3-3c2-1 3 1 2 2l-2 2c1 3 0 8-5 8z"/>'),
    agro_processing: I('<path d="M4 28h40"/><path d="M6 28v-14l8 5v-5l8 5v-5l8 5v9"/><path d="M34 28v-20h5v20"/><path d="M36 6c-1-2 1-3 0-5"/>'),
    manufacturing: I('<path d="M4 28h40"/><path d="M8 28v-12h32v12"/><path d="M12 22h6v6h-6zM22 22h6v6h-6zM32 22h4v6h-4z"/><path d="M14 16v-6h6v6"/>'),
    energy: I('<circle cx="37" cy="8" r="4"/><path d="M37 1v1M44 8h-1M42 3l-1 1"/><path d="M4 26h20l4-8h-20z"/><path d="M11 18l-4 8M18 18l-4 8M6 22h20"/><path d="M14 26v4"/>'),
    petroleum: I('<path d="M4 28h40"/><path d="M8 28v-20h5v20M8 14h5M8 20h5"/><circle cx="25" cy="22" r="5"/><path d="M38 28v-20M37 8c-1-3 1-5 1-7 1 2 3 4 1 7"/>'),
    tech: I('<path d="M10 6h28v17h-28z"/><path d="M6 25h36l-2 3h-32z"/><path d="M14 19l5-5 4 3 6-7 5 4"/>'),
    fintech: I('<path d="M17 3h14c1 0 2 1 2 2v22c0 1-1 2-2 2h-14c-1 0-2-1-2-2v-22c0-1 1-2 2-2z"/><path d="M18 9h12v7h-12z"/><path d="M37 12c2 2 2 6 0 8M41 9c4 4 4 10 0 14"/>'),
    logistics: I('<path d="M4 26h40"/><path d="M6 22v-12h18v12z"/><path d="M24 22v-8h6l4 5v3"/><circle cx="11" cy="24" r="2.5"/><circle cx="30" cy="24" r="2.5"/>'),
    health: I('<path d="M4 28h40"/><path d="M10 28v-16h28v16"/><path d="M8 12h32l-3-4h-26z"/><path d="M21 20h6M24 17v6"/>'),
  };
  root.TenorArt = {
    scene: (sector) => SCENES[SECTOR_SCENE[sector] || sector] || SCENES.fields,
    icon: (sector) => ICONS[sector] || ICONS.crops,
    sceneName: (sector) => SECTOR_SCENE[sector] || 'fields',
  };
})(typeof self !== 'undefined' ? self : this);
