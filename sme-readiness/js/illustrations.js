/*
 * Kinhold illustrations: soft, filled duotone SVGs, one per area. Colours come from CSS variables
 * (--ill-a soft fill, --ill-b strong, --ill-c highlight, --ill-d sage), so they follow dark mode.
 */
(function (root) {
  'use strict';
  const P = {
    key: '<circle class="a" cx="17" cy="24" r="12"/><circle class="b" cx="17" cy="24" r="7"/><circle class="c" cx="15" cy="22" r="2.6"/><path class="b" d="M26 21.5h17a2 2 0 0 1 2 2V25a2 2 0 0 1-2 2h-2.5v4.5a1.5 1.5 0 0 1-1.5 1.5h-2a1.5 1.5 0 0 1-1.5-1.5V27H26z"/><rect class="d" x="31" y="27" width="4" height="4.5" rx="1.2"/>',
    badge: '<rect class="a" x="8" y="10" width="32" height="32" rx="8"/><rect class="b" x="19" y="5" width="10" height="9" rx="3"/><circle class="b" cx="24" cy="23" r="5.5"/><path class="b" d="M14.5 36c1.4-4.4 5-6.6 9.5-6.6s8.1 2.2 9.5 6.6z"/><circle class="c" cx="22.5" cy="21.5" r="1.6"/>',
    laptop: '<rect class="a" x="8" y="9" width="32" height="22" rx="4"/><rect class="b" x="11.5" y="12.5" width="25" height="15" rx="2"/><path class="d" d="M4 33h40a1 1 0 0 1 1 1.2c-.6 2.7-2.9 4.8-5.8 4.8H8.8c-2.9 0-5.2-2.1-5.8-4.8A1 1 0 0 1 4 33z"/><path class="c" d="M15 16h9v2.5h-9zM15 21h13v2.5H15z"/>',
    cloud: '<path class="a" d="M14 36a9 9 0 0 1-1.2-17.9A12 12 0 0 1 36 16.6 9.5 9.5 0 0 1 35.5 36z"/><path class="b" d="M24 21v11m0-11l-4.5 4.5M24 21l4.5 4.5" stroke="var(--ill-b)" stroke-width="3" stroke-linecap="round" fill="none"/><circle class="c" cx="17" cy="22" r="2.2"/>',
    envelope: '<rect class="a" x="6" y="12" width="36" height="26" rx="5"/><path class="b" d="M6.8 14.2l15 11.6a3.6 3.6 0 0 0 4.4 0l15-11.6A5 5 0 0 0 37 12H11a5 5 0 0 0-4.2 2.2z"/><circle class="d" cx="38" cy="12" r="5.5"/><path class="c" d="M36 12l1.4 1.4L40 10.8" stroke="var(--ill-c)" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    invoice: '<path class="a" d="M12 5h18l8 8v28a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path class="d" d="M30 5v6a2 2 0 0 0 2 2h6z"/><rect class="b" x="15" y="17" width="14" height="3" rx="1.5"/><rect class="b" x="15" y="23" width="18" height="3" rx="1.5" opacity=".55"/><circle class="b" cx="32" cy="35" r="6"/><path class="c" d="M30.6 33.2h3.2M30 35.2h4.4M31.2 33.2c-.4 1.6-.4 3.4.6 4.6" stroke="var(--ill-c)" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
    padlock: '<path class="d" d="M15 21v-5a9 9 0 0 1 18 0v5h-4.5v-5a4.5 4.5 0 0 0-9 0v5z"/><rect class="a" x="10" y="20" width="28" height="22" rx="6"/><circle class="b" cx="24" cy="29.5" r="3.6"/><rect class="b" x="22.5" y="31" width="3" height="6" rx="1.5"/><circle class="c" cx="16" cy="25" r="1.8"/>',
    storefront: '<path class="a" d="M9 20h30v20a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2z"/><path class="b" d="M7 12a3 3 0 0 1 2.6-1.5h28.8A3 3 0 0 1 41 12l2 7a4.6 4.6 0 0 1-9 1.4 4.6 4.6 0 0 1-9 0 4.6 4.6 0 0 1-9 0A4.6 4.6 0 0 1 5 19z"/><rect class="d" x="14" y="27" width="9" height="15" rx="1.5"/><rect class="c" x="27" y="27" width="8" height="7" rx="1.5"/>',
    lifebuoy: '<circle class="a" cx="24" cy="24" r="18"/><circle class="c" cx="24" cy="24" r="8"/><path class="b" d="M24 6a18 18 0 0 1 8.3 2l-4.2 8.1A8.8 8.8 0 0 0 24 15.2zM42 24a18 18 0 0 1-2 8.3l-8.1-4.2a8.8 8.8 0 0 0 .9-4.1zM24 42a18 18 0 0 1-8.3-2l4.2-8.1a8.8 8.8 0 0 0 4.1.9zM6 24a18 18 0 0 1 2-8.3l8.1 4.2a8.8 8.8 0 0 0-.9 4.1z"/>',
    speech: '<path class="a" d="M10 8h28a5 5 0 0 1 5 5v15a5 5 0 0 1-5 5H22l-8 7v-7h-4a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5z"/><circle class="b" cx="16" cy="20.5" r="2.6"/><circle class="b" cx="24" cy="20.5" r="2.6"/><circle class="b" cx="32" cy="20.5" r="2.6"/><path class="d" d="M38 2.5l1.6 3.4 3.4 1.6-3.4 1.6L38 12.5l-1.6-3.4-3.4-1.6 3.4-1.6z"/>',
    'speech-lock': '<path class="a" d="M8 8h26a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H20l-7 6v-6H8a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5z"/><rect class="b" x="11" y="16.5" width="16" height="3" rx="1.5"/><path class="d" d="M33 30v-3a5 5 0 0 1 10 0v3h-2.6v-3a2.4 2.4 0 0 0-4.8 0v3z"/><rect class="b" x="30" y="29.5" width="16" height="13" rx="3.5"/><circle class="c" cx="38" cy="36" r="1.8"/>',
    'speech-check': '<path class="a" d="M8 8h26a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H20l-7 6v-6H8a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5z"/><rect class="b" x="11" y="14" width="18" height="3" rx="1.5"/><rect class="b" x="11" y="20" width="12" height="3" rx="1.5" opacity=".55"/><circle class="d" cx="37" cy="35" r="9"/><path d="M33 35.2l2.8 2.8 5.2-5.6" stroke="var(--ill-c)" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    document: '<path class="a" d="M11 4h18l9 9v29a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path class="d" d="M29 4v7a2 2 0 0 0 2 2h7z"/><rect class="b" x="14" y="18" width="18" height="3" rx="1.5"/><rect class="b" x="14" y="24" width="20" height="3" rx="1.5" opacity=".55"/><rect class="b" x="14" y="30" width="12" height="3" rx="1.5" opacity=".55"/><circle class="c" cx="16" cy="11" r="2"/>',
    shield: '<path class="a" d="M24 4l16 6v11c0 10.4-6.8 18.6-16 22-9.2-3.4-16-11.6-16-22V10z"/><path class="b" d="M24 9l11 4.2V21c0 7.4-4.6 13.4-11 16z"/><path d="M17.5 23.5l4.5 4.5 8.5-9" stroke="var(--ill-c)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    sparkle: '<circle class="a" cx="24" cy="24" r="19"/><path class="b" d="M24 9l3.6 9.4L37 22l-9.4 3.6L24 35l-3.6-9.4L11 22l9.4-3.6z"/><circle class="d" cx="36" cy="34" r="3.5"/><circle class="c" cx="21" cy="19" r="2"/>',
  };
  function ill(name, opts = {}) {
    const body = P[name] || P.shield;
    return '<svg class="ill' + (opts.cls ? ' ' + opts.cls : '') + '" viewBox="0 0 48 48" ' + (opts.label ? 'role="img" aria-label="' + opts.label + '"' : 'aria-hidden="true"') + '>' + body + '</svg>';
  }
  root.KinholdIll = { ill, names: Object.keys(P) };
})(window);
