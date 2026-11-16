import React from 'react';
import type { IllustrationPalette, ThemeIllustrationPack } from './types';

export const libraryPack: ThemeIllustrationPack = {
  greeting: (p: IllustrationPalette) => (
    <svg viewBox="0 0 112 44" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Classical parchment & slate ambient wash */}
      <ellipse cx="56" cy="23" rx="46" ry="15" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="44" cy="22" r="13" fill={p.gold} fillOpacity="0.14" />
      <circle cx="70" cy="22" r="12" fill={p.rose} fillOpacity="0.12" />

      {/* Layer 2: Delicate acanthus scrollwork filigree border lines */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Left filigree scroll */}
        <path
          d="M12 24 C16 17 24 17 26 23 C27 26 24 29 21 27 C19 25.5 20 22.5 22.5 22.5"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.5"
        />
        <path
          d="M16 20 C19 14 27 13 33 17"
          stroke={p.gold}
          strokeWidth="1.0"
          strokeOpacity="0.65"
        />

        {/* Right filigree scroll */}
        <path
          d="M100 22 C96 29 88 29 86 23 C85 20 88 17 91 19 C93 20.5 92 23.5 89.5 23.5"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.5"
        />
        <path
          d="M96 26 C93 32 85 33 79 29"
          stroke={p.gold}
          strokeWidth="1.0"
          strokeOpacity="0.65"
        />
      </g>

      {/* Layer 3: Antique Bronze Silk Ribbon Bookmark, Wax Seal & Feather Quill Pen */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Flowing silk ribbon bookmark banner (100% opaque p.paper base) */}
        <path
          d="M24 29 L31 25.5 L27 21 C38 19 48 25 58 25 C68 25 76 20 86 21 L82 25 L88 28.5 C77 27.5 68 32 58 32 C47 32 37 26.5 24 29 Z"
          fill={p.paper}
        />
        <path
          d="M24 29 L31 25.5 L27 21 C38 19 48 25 58 25 C68 25 76 20 86 21 L82 25 L88 28.5 C77 27.5 68 32 58 32 C47 32 37 26.5 24 29 Z"
          fill={p.gold}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        {/* Inner stitched gold trim along ribbon */}
        <path
          d="M32 24.5 C42 23.5 50 28.5 58 28.5 C66 28.5 73 24.5 81 24.5"
          stroke={p.ink}
          strokeWidth="0.8"
          strokeOpacity="0.5"
          strokeDasharray="2 2"
        />

        {/* Small round crimson wax seal on left-center of ribbon (opaque p.paper base) */}
        <circle cx="43" cy="26.5" r="5.5" fill={p.paper} />
        <circle
          cx="43"
          cy="26.5"
          r="5.5"
          fill={p.rose}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <circle cx="43" cy="26.5" r="3.4" stroke={p.gold} strokeWidth="0.9" />

        {/* Vintage Feather Quill Fountain Pen sweeping diagonally (opaque p.paper base) */}
        {/* Feather vane */}
        <path
          d="M49 24 C56 14 69 7 84 8 C83 16 74 24 63 26 L60 23.5 L60.5 26.5 C56.5 26.8 52.5 26 49 24 Z"
          fill={p.paper}
        />
        {/* Warm antique shading on upper feather vane */}
        <path
          d="M49 24 C56 14 69 7 84 8 C76 12 64 18 52 25 Z"
          fill={p.warm}
          fillOpacity="0.52"
        />
        <path
          d="M68 12 C73 9.5 78.5 8.2 84 8 C83.2 13 78.5 18.5 72 22 C70.5 18.5 69 15 68 12 Z"
          fill={p.brand}
          fillOpacity="0.34"
        />
        <path
          d="M49 24 C56 14 69 7 84 8 C83 16 74 24 63 26 L60 23.5 L60.5 26.5 C56.5 26.8 52.5 26 49 24 Z"
          stroke={p.ink}
          strokeWidth="1.2"
        />

        {/* Brass fountain nib & quill shaft */}
        <path
          d="M35 32 L48 23.5 L50 26.2 L39 32.5 Z"
          fill={p.paper}
        />
        <path
          d="M35 32 L48 23.5 L50 26.2 L39 32.5 Z"
          fill={p.gold}
          fillOpacity="0.72"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        {/* Central rachis stem */}
        <path d="M35 32 C50 24 66 14 84 8" stroke={p.ink} strokeWidth="1.15" />
        {/* Feather barb texture lines */}
        <path d="M58 16 L63 14.5" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.55" />
        <path d="M65 12.5 L71 11" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.55" />
      </g>

      {/* Layer 4: Gold foil sparkles & micro dots */}
      <path
        d="M50 8 L50.7 10.2 L53 11 L50.7 11.8 L50 14 L49.3 11.8 L47 11 L49.3 10.2 Z"
        fill={p.gold}
        fillOpacity="0.85"
      />
      <circle cx="36" cy="14" r="1.2" fill={p.gold} fillOpacity="0.65" />
      <circle cx="72" cy="34" r="1.2" fill={p.brand} fillOpacity="0.55" />
      <circle cx="90" cy="13" r="1.1" fill={p.rose} fillOpacity="0.5" />
    </svg>
  ),

  cornerLeft: (p: IllustrationPalette) => (
    <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Bottom-left classical library aura */}
      <path d="M0 96 L0 22 C28 26 56 54 74 96 Z" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="28" cy="66" r="24" fill={p.warm} fillOpacity="0.22" />
      <circle cx="48" cy="80" r="16" fill={p.gold} fillOpacity="0.14" />

      {/* Layer 2: Wooden bookshelf ledge & brass scroll bookend */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Classical filigree arch behind books */}
        <path
          d="M8 28 C24 26 42 36 52 54"
          stroke={p.ink}
          strokeWidth="0.9"
          strokeOpacity="0.35"
          strokeDasharray="2.5 3"
        />

        {/* Brass scroll bookend supporting the leaning tome on right */}
        <path
          d="M54 88 L68 88 C70 88 70 85 68 85 L57 85 L59 71 C59.5 67 64 67 64 70.5 C64 73 61 73.5 61 71.5"
          stroke={p.gold}
          strokeWidth="2.6"
        />
        <path
          d="M54 88 L68 88 C70 88 70 85 68 85 L57 85 L59 71 C59.5 67 64 67 64 70.5 C64 73 61 73.5 61 71.5"
          stroke={p.ink}
          strokeWidth="1.15"
        />

        {/* Wooden bookshelf ledge at bottom-left (opaque p.paper base) */}
        <path
          d="M0 88 L72 88 L76 96 L0 96 Z"
          fill={p.paper}
        />
        <path
          d="M0 88 L72 88 L76 96 L0 96 Z"
          fill={p.warm}
          fillOpacity="0.52"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        <path d="M0 91.5 L73 91.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.45" />
      </g>

      {/* Layer 3: Leaning Leather-Bound Antique Tomes with Gold Spine Tooling */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Tome 1: Tall vertical slate-leather folio at far left (100% opaque p.paper base) */}
        <path
          d="M3 32 C6 30.5 13 30.5 16 32 L16 88 L3 88 Z"
          fill={p.paper}
        />
        <path
          d="M3 32 C6 30.5 13 30.5 16 32 L16 88 L3 88 Z"
          fill={p.brand}
          fillOpacity="0.52"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        {/* Raised spine hubs & gold foil bands on Tome 1 */}
        <path d="M2.5 40 L16.5 40" stroke={p.gold} strokeWidth="2.0" />
        <path d="M2.5 40 L16.5 40" stroke={p.ink} strokeWidth="1.0" />
        <path d="M2.5 52 L16.5 52" stroke={p.gold} strokeWidth="1.8" />
        <path d="M2.5 52 L16.5 52" stroke={p.ink} strokeWidth="0.95" />
        <path d="M2.5 76 L16.5 76" stroke={p.gold} strokeWidth="2.0" />
        <path d="M2.5 76 L16.5 76" stroke={p.ink} strokeWidth="1.0" />
        {/* Gold spine label & diamond emblem */}
        <rect x="5.5" y="43" width="8" height="6" rx="1" fill={p.gold} fillOpacity="0.65" stroke={p.ink} strokeWidth="0.85" />
        <path d="M9.5 60 L12 64 L9.5 68 L7 64 Z" fill={p.gold} fillOpacity="0.7" />

        {/* Tome 2: Crimson-leather antique volume standing next to Tome 1 (opaque p.paper base) */}
        <path
          d="M16 38 C19 36.5 26 36.5 29 38 L29 88 L16 88 Z"
          fill={p.paper}
        />
        <path
          d="M16 38 C19 36.5 26 36.5 29 38 L29 88 L16 88 Z"
          fill={p.rose}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        {/* Gold spine tooling on Tome 2 */}
        <path d="M16 45 L29 45" stroke={p.gold} strokeWidth="1.8" />
        <path d="M16 45 L29 45" stroke={p.ink} strokeWidth="0.95" />
        <path d="M16 58 L29 58" stroke={p.gold} strokeWidth="1.6" />
        <path d="M16 58 L29 58" stroke={p.ink} strokeWidth="0.9" />
        <path d="M16 79 L29 79" stroke={p.gold} strokeWidth="1.8" />
        <path d="M16 79 L29 79" stroke={p.ink} strokeWidth="0.95" />
        <circle cx="22.5" cy="51.5" r="2.4" fill={p.gold} fillOpacity="0.75" stroke={p.ink} strokeWidth="0.85" />
        <circle cx="22.5" cy="68.5" r="2.2" fill={p.gold} fillOpacity="0.7" />

        {/* Tome 3: Leaning emerald-leather volume showing both spine & front cover (opaque p.paper base) */}
        {/* Front cover perspective panel */}
        <path
          d="M41 42 L53 45 L62 85 L50 88 Z"
          fill={p.paper}
        />
        <path
          d="M41 42 L53 45 L62 85 L50 88 Z"
          fill={p.warm}
          fillOpacity="0.45"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        {/* Leaning spine panel */}
        <path
          d="M29 44 C32 42 38 41 41 42 L50 88 L38 88 Z"
          fill={p.paper}
        />
        <path
          d="M29 44 C32 42 38 41 41 42 L50 88 L38 88 Z"
          fill={p.leaf}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        {/* Gold spine ridges on leaning Tome 3 */}
        <path d="M30.5 51 L42.5 49" stroke={p.gold} strokeWidth="1.8" />
        <path d="M30.5 51 L42.5 49" stroke={p.ink} strokeWidth="0.95" />
        <path d="M33 64 L45 62" stroke={p.gold} strokeWidth="1.8" />
        <path d="M33 64 L45 62" stroke={p.ink} strokeWidth="0.95" />
        <path d="M36 79 L48 77" stroke={p.gold} strokeWidth="1.8" />
        <path d="M36 79 L48 77" stroke={p.ink} strokeWidth="0.95" />
        <path d="M37.5 56 L39.5 54 L41 56.5 L39 58.5 Z" fill={p.gold} fillOpacity="0.75" />

        {/* Hanging silk bookmark ribbon draping over the shelf edge */}
        <path
          d="M44 88 C45 91.5 47 94 49 95.5 L52 93.5 L54.5 95.5 C53 93 50.5 90.5 48 88 Z"
          fill={p.rose}
          fillOpacity="0.68"
          stroke={p.ink}
          strokeWidth="1.0"
        />

        {/* Brass-rimmed pince-nez reading glasses resting on shelf front */}
        <circle cx="22" cy="86.5" r="4.2" fill={p.paper} fillOpacity="0.75" stroke={p.gold} strokeWidth="1.6" />
        <circle cx="22" cy="86.5" r="4.2" stroke={p.ink} strokeWidth="1.05" />
        <circle cx="33" cy="86.5" r="4.2" fill={p.paper} fillOpacity="0.75" stroke={p.gold} strokeWidth="1.6" />
        <circle cx="33" cy="86.5" r="4.2" stroke={p.ink} strokeWidth="1.05" />
        <path d="M26.2 85.5 Q27.5 83.5 28.8 85.5" stroke={p.ink} strokeWidth="1.1" />
      </g>

      {/* Layer 4: Gold foil sparkles & dust motes */}
      <path
        d="M36 20 L37 22.8 L39.8 23.8 L37 24.8 L36 27.6 L35 24.8 L32.2 23.8 L35 22.8 Z"
        fill={p.gold}
        fillOpacity="0.85"
      />
      <path
        d="M62 46 L62.7 48 L64.7 48.7 L62.7 49.4 L62 51.4 L61.3 49.4 L59.3 48.7 L61.3 48 Z"
        fill={p.gold}
        fillOpacity="0.75"
      />
      <circle cx="20" cy="18" r="1.3" fill={p.gold} fillOpacity="0.65" />
      <circle cx="52" cy="34" r="1.2" fill={p.brand} fillOpacity="0.55" />
      <circle cx="72" cy="64" r="1.3" fill={p.rose} fillOpacity="0.5" />
    </svg>
  ),

  cornerRight: (p: IllustrationPalette) => (
    <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Bottom-right warm parchment & crimson wax aura */}
      <path d="M96 96 L96 24 C68 28 44 54 24 96 Z" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="68" cy="68" r="24" fill={p.warm} fillOpacity="0.24" />
      <circle cx="48" cy="80" r="16" fill={p.rose} fillOpacity="0.14" />

      {/* Layer 2: Parchment letter corner & silk ribbon tails */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Parchment letter sheet at bottom-right (100% opaque p.paper base) */}
        <path
          d="M26 82 L50 64 L96 70 L96 96 L32 96 Z"
          fill={p.paper}
        />
        <path
          d="M26 82 L50 64 L96 70 L96 96 L32 96 Z"
          fill={p.warm}
          fillOpacity="0.38"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        {/* Handwritten calligraphic lines on letter */}
        <path d="M48 71 L64 73" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.45" />
        <path d="M44 75 L62 77" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.45" />

        {/* Gold silk ribbon tails emerging from under the wax seal */}
        <path
          d="M42 82 L28 89 L33 91 L34 95 L46 86 Z"
          fill={p.gold}
          fillOpacity="0.62"
          stroke={p.ink}
          strokeWidth="1.0"
        />
      </g>

      {/* Layer 3: Faceted Glass Inkwell, Feather Fountain Pen & Embossed Wax Seal */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* 1. Faceted Vintage Glass Inkwell at bottom-right (100% opaque p.paper base) */}
        <path
          d="M69 57 L83 57 L84 63 L91 69 L89 86 C82 89 70 89 63 86 L61 69 L68 63 Z"
          fill={p.paper}
        />
        {/* Glass tint */}
        <path
          d="M69 57 L83 57 L84 63 L91 69 L89 86 C82 89 70 89 63 86 L61 69 L68 63 Z"
          fill={p.brandSoft}
          fillOpacity="0.35"
        />
        {/* Dark slate-indigo ink reservoir inside lower half of bottle */}
        <path
          d="M62.2 74 C70 72.5 82 72.5 89.8 74 L88.6 85.5 C81.5 88.2 70.5 88.2 63.4 85.5 Z"
          fill={p.brand}
          fillOpacity="0.65"
        />
        <ellipse cx="76" cy="74" rx="13.5" ry="2.2" fill={p.ink} fillOpacity="0.35" />

        {/* Glass bottle facets & outer outline */}
        <path
          d="M68 63 L84 63 L91 69 L89 86 C82 89 70 89 63 86 L61 69 Z"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        <path d="M61 69 C70 71.5 82 71.5 91 69" stroke={p.ink} strokeWidth="1.05" />
        <path d="M70 69.5 L69 87" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.55" />
        <path d="M82 69.5 L83 87" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.55" />

        {/* Brass inkwell neck collar & rim */}
        <rect x="67.5" y="56.5" width="17" height="6.5" rx="1.5" fill={p.paper} />
        <rect
          x="67.5"
          y="56.5"
          width="17"
          height="6.5"
          rx="1.5"
          fill={p.gold}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <ellipse cx="76" cy="56.5" rx="8.5" ry="2.2" fill={p.paper} stroke={p.ink} strokeWidth="1.15" />

        {/* 2. Feather Fountain Quill Pen poised above inkwell (100% opaque p.paper base) */}
        {/* Feather plume */}
        <path
          d="M72 44 C66 32 68 18 79 12 C86 19 86 33 79 44 L76.5 41 L75.5 44.5 Z"
          fill={p.paper}
        />
        <path
          d="M72 44 C66 32 68 18 79 12 C76 22 74 33 73.5 44 Z"
          fill={p.warm}
          fillOpacity="0.5"
        />
        <path
          d="M75 21 C76.5 17 77.8 14 79 12 C83.5 16.5 84.5 25 81.5 33 C79 29 76.5 25 75 21 Z"
          fill={p.brand}
          fillOpacity="0.34"
        />
        <path
          d="M72 44 C66 32 68 18 79 12 C86 19 86 33 79 44 L76.5 41 L75.5 44.5 Z"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        {/* Brass fountain nib & breather hole */}
        <path
          d="M73.5 44 L77.5 44 L79 51 L76 56.5 L73 51 Z"
          fill={p.paper}
        />
        <path
          d="M73.5 44 L77.5 44 L79 51 L76 56.5 L73 51 Z"
          fill={p.gold}
          fillOpacity="0.75"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <path d="M76 56.5 L76 49.5" stroke={p.ink} strokeWidth="0.95" />
        <circle cx="76" cy="49" r="1.0" fill={p.ink} />
        {/* Quill central shaft & barb lines */}
        <path d="M75.5 44 C75 33 76 22 79 12" stroke={p.ink} strokeWidth="1.15" />
        <path d="M75.5 31 L71 28" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.55" />
        <path d="M76 24 L81.5 21.5" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.55" />

        {/* 3. Organically Melted Crimson Wax Seal with Embossed Relief (100% opaque p.paper base) */}
        <path
          d="M48 69 C53 68 57 71 59 75 C61.5 79 59.5 85 55 87.5 C50 90 43.5 89 40 85 C36.5 81 38 75 41.5 72 C43.5 70 45.5 69.5 48 69 Z"
          fill={p.paper}
        />
        <path
          d="M48 69 C53 68 57 71 59 75 C61.5 79 59.5 85 55 87.5 C50 90 43.5 89 40 85 C36.5 81 38 75 41.5 72 C43.5 70 45.5 69.5 48 69 Z"
          fill={p.rose}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        {/* Inner stamped recessed ring */}
        <circle
          cx="49"
          cy="78.5"
          r="6.8"
          fill={p.rose}
          fillOpacity="0.35"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <circle cx="49" cy="78.5" r="5.6" stroke={p.gold} strokeWidth="0.95" />
        {/* Embossed relief motif inside wax seal (four-point star / fleur) */}
        <path
          d="M49 74.5 L50 77.3 L52.8 78.5 L50 79.7 L49 82.5 L48 79.7 L45.2 78.5 L48 77.3 Z"
          fill={p.gold}
          fillOpacity="0.9"
        />
      </g>

      {/* Layer 4: Sparkles & ink/gold micro dots */}
      <path
        d="M52 30 L53 32.8 L55.8 33.8 L53 34.8 L52 37.6 L51 34.8 L48.2 33.8 L51 32.8 Z"
        fill={p.gold}
        fillOpacity="0.85"
      />
      <path
        d="M34 54 L34.8 56.2 L37 57 L34.8 57.8 L34 60 L33.2 57.8 L31 57 L33.2 56.2 Z"
        fill={p.gold}
        fillOpacity="0.78"
      />
      <circle cx="60" cy="20" r="1.3" fill={p.gold} fillOpacity="0.65" />
      <circle cx="44" cy="46" r="1.2" fill={p.brand} fillOpacity="0.55" />
      <circle cx="24" cy="72" r="1.2" fill={p.rose} fillOpacity="0.5" />
    </svg>
  ),

  celebration: (p: IllustrationPalette) => (
    <svg viewBox="0 0 210 132" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Symmetrical Ex-Libris Bookplate Aura & Heraldic Arch Frame */}
      <ellipse cx="105" cy="70" rx="86" ry="48" fill={p.brandSoft} fillOpacity="0.24" />
      <ellipse cx="105" cy="52" rx="54" ry="34" fill={p.gold} fillOpacity="0.14" />
      <ellipse cx="105" cy="84" rx="64" ry="26" fill={p.warm} fillOpacity="0.22" />

      {/* Classical Ex-Libris outer filigree arch & corner flourishes */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M46 68 L46 38 C46 18 72 10 105 10 C138 10 164 18 164 38 L164 68"
          stroke={p.ink}
          strokeWidth="1.05"
          strokeOpacity="0.32"
        />
        <path
          d="M50 66 L50 39 C50 22 74 14 105 14 C136 14 160 22 160 39 L160 66"
          stroke={p.gold}
          strokeWidth="1.0"
          strokeOpacity="0.5"
          strokeDasharray="3 3"
        />
        {/* Symmetrical acanthus scroll flourishes flanking the arch */}
        <path
          d="M46 44 C36 42 30 34 34 27 C37 22 44 24 42 30 C41 33 37 33 37 30"
          stroke={p.ink}
          strokeWidth="1.0"
          strokeOpacity="0.45"
        />
        <path
          d="M164 44 C174 42 180 34 176 27 C173 22 166 24 168 30 C169 33 173 33 173 30"
          stroke={p.ink}
          strokeWidth="1.0"
          strokeOpacity="0.45"
        />
      </g>

      {/* Layer 2: Olive/Laurel Sprigs, Heraldic Crest, Reading Glasses, Inkwell & Quill */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Left olive/laurel branch */}
        <path d="M68 50 C52 44 38 36 28 24" stroke={p.ink} strokeWidth="1.15" />
        <path
          d="M48 41 C40 43 32 40 28 34 C35 31 43 34 48 41 Z"
          fill={p.leaf}
          fillOpacity="0.42"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <path
          d="M42 34 C41 26 44 19 50 16 C52 22 49 29 42 34 Z"
          fill={p.leaf}
          fillOpacity="0.34"
          stroke={p.ink}
          strokeWidth="1.0"
        />

        {/* Right olive/laurel branch */}
        <path d="M142 50 C158 44 172 36 182 24" stroke={p.ink} strokeWidth="1.15" />
        <path
          d="M162 41 C170 43 178 40 182 34 C175 31 167 34 162 41 Z"
          fill={p.leaf}
          fillOpacity="0.42"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <path
          d="M168 34 C169 26 166 19 160 16 C158 22 161 29 168 34 Z"
          fill={p.leaf}
          fillOpacity="0.34"
          stroke={p.ink}
          strokeWidth="1.0"
        />

        {/* Central Ex-Libris Heraldic Medallion Shield above the open tome (100% opaque p.paper base) */}
        <path
          d="M88 22 C96 19 114 19 122 22 L122 36 C122 45 105 51 105 51 C105 51 88 45 88 36 Z"
          fill={p.paper}
        />
        <path
          d="M88 22 C96 19 114 19 122 22 L122 36 C122 45 105 51 105 51 C105 51 88 45 88 36 Z"
          fill={p.gold}
          fillOpacity="0.38"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        <path
          d="M91.5 24.5 C98 22.2 112 22.2 118.5 24.5 L118.5 35 C118.5 42 105 47 105 47 C105 47 91.5 42 91.5 35 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="0.95"
        />
        {/* Star & key/crest motif inside shield */}
        <path
          d="M105 26 L106.5 30.8 L111.5 32.2 L106.5 33.6 L105 38.5 L103.5 33.6 L98.5 32.2 L103.5 30.8 Z"
          fill={p.gold}
          fillOpacity="0.9"
          stroke={p.ink}
          strokeWidth="0.8"
        />

        {/* Left Desk Prop: Brass-rimmed reading glasses */}
        <circle cx="26" cy="88" r="6.5" fill={p.paper} fillOpacity="0.8" stroke={p.gold} strokeWidth="2.0" />
        <circle cx="26" cy="88" r="6.5" stroke={p.ink} strokeWidth="1.15" />
        <circle cx="43" cy="86" r="6.5" fill={p.paper} fillOpacity="0.8" stroke={p.gold} strokeWidth="2.0" />
        <circle cx="43" cy="86" r="6.5" stroke={p.ink} strokeWidth="1.15" />
        <path d="M32.2 86.5 Q34.5 83.5 36.8 85.8" stroke={p.ink} strokeWidth="1.2" />
        <path d="M19.5 87 L14 81" stroke={p.ink} strokeWidth="1.15" />

        {/* Right Desk Prop: Glass Inkwell & Standing Feather Quill Pen */}
        {/* Inkwell bottle (opaque p.paper base) */}
        <path
          d="M165 73 L177 73 L178 78 L184 83 L182 97 C176 100 166 100 160 97 L158 83 L164 78 Z"
          fill={p.paper}
        />
        <path
          d="M159 87 C166 85.8 176 85.8 183 87 L182 97 C176 100 166 100 160 97 Z"
          fill={p.brand}
          fillOpacity="0.62"
        />
        <path
          d="M164 78 L178 78 L184 83 L182 97 C176 100 166 100 160 97 L158 83 Z"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        <rect x="164" y="72.5" width="14" height="5.5" rx="1.2" fill={p.gold} fillOpacity="0.68" stroke={p.ink} strokeWidth="1.15" />

        {/* Feather quill standing in inkwell (opaque p.paper base) */}
        <path
          d="M172 72.5 C169 57 174 39 188 29 C193 38 190 55 180 68 L177 65.5 L176 70 Z"
          fill={p.paper}
        />
        <path
          d="M172 72.5 C169 57 174 39 188 29 C183 41 178 56 175 72 Z"
          fill={p.warm}
          fillOpacity="0.52"
        />
        <path
          d="M172 72.5 C169 57 174 39 188 29 C193 38 190 55 180 68 L177 65.5 L176 70 Z"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path d="M171 75 C174 59 179 42 188 29" stroke={p.ink} strokeWidth="1.15" />
      </g>

      {/* Layer 3: Foreground Protagonist — Heavy Open Leather-Bound Tome with Wax Seal & Silk Ribbons */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Heavy Leather-Bound Cover & Brass Corner Mounts (100% opaque p.paper base) */}
        <path
          d="M36 96 L48 52 C66 47 86 49 102 55 C118 49 138 47 156 52 L168 96 C146 90 124 92 102 100 C80 92 58 90 36 96 Z"
          fill={p.paper}
        />
        <path
          d="M36 96 L48 52 C66 47 86 49 102 55 C118 49 138 47 156 52 L168 96 C146 90 124 92 102 100 C80 92 58 90 36 96 Z"
          fill={p.brand}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="1.4"
        />
        {/* Ornate brass corner protectors on leather cover */}
        <path d="M48 52 L55 50.5 L46 60 Z" fill={p.gold} stroke={p.ink} strokeWidth="1.0" />
        <path d="M156 52 L149 50.5 L158 60 Z" fill={p.gold} stroke={p.ink} strokeWidth="1.0" />
        <path d="M36 96 L44 94.5 L38 88 Z" fill={p.gold} stroke={p.ink} strokeWidth="1.0" />
        <path d="M168 96 L160 94.5 L166 88 Z" fill={p.gold} stroke={p.ink} strokeWidth="1.0" />

        {/* Multi-layered gilded page block & open parchment pages (100% opaque p.paper base) */}
        <path
          d="M41 91 L52 48 C68 44 86 46 102 52 C118 46 136 44 152 48 L163 91 C143 86 122 88 102 95 C82 88 61 86 41 91 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.35"
        />
        {/* Gilded lower page thickness edge */}
        <path
          d="M41 91 C61 86 82 88 102 95 C122 88 143 86 163 91 L165 95 C144 90 123 92 102 99 C81 92 60 90 39 95 Z"
          fill={p.paper}
        />
        <path
          d="M41 91 C61 86 82 88 102 95 C122 88 143 86 163 91 L165 95 C144 90 123 92 102 99 C81 92 60 90 39 95 Z"
          fill={p.gold}
          fillOpacity="0.38"
          stroke={p.ink}
          strokeWidth="1.2"
        />

        {/* Center spine gutter & raised binding hub */}
        <path
          d="M98.5 51 L102 52 L105.5 51 L105.5 94 L102 95 L98.5 94 Z"
          fill={p.warm}
          fillOpacity="0.45"
        />
        <path d="M102 52 L102 95" stroke={p.ink} strokeWidth="1.25" />
        <rect x="97" y="95" width="10" height="5" rx="1.5" fill={p.brand} stroke={p.ink} strokeWidth="1.2" />

        {/* LEFT PAGE: Illuminated Drop-Cap & Classical Manuscript Lines */}
        <rect
          x="56"
          y="55"
          width="12"
          height="12"
          rx="1.5"
          fill={p.gold}
          fillOpacity="0.45"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <path d="M62 57.5 L62 64.5 M59 61 L65 61" stroke={p.rose} strokeWidth="1.3" />
        <path d="M72 57 L91 58.5" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.55" />
        <path d="M72 61.5 L92 63" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.55" />
        <path d="M71 66 L91 67.5" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.55" />
        <path d="M54 71.5 L91 73.5" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.55" />
        <path d="M52 76.5 L90 78.5" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.55" />
        <path d="M50 81.5 L88 83.5" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.55" />

        {/* RIGHT PAGE: Ex-Libris Border & Manuscript Text */}
        <path
          d="M111 54 L145 52 L151 81 L113 84 Z"
          fill={p.warm}
          fillOpacity="0.26"
          stroke={p.ink}
          strokeWidth="0.85"
          strokeOpacity="0.45"
        />
        <path d="M116 59 L141 57.5" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.55" />
        <path d="M116 63.5 L143 62" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.55" />
        <path d="M117 68 L139 66.5" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.55" />

        {/* Twin Silk Ribbon Bookmarks draping from spine across right page & front edge */}
        {/* Gold ribbon */}
        <path
          d="M102 95 C106 103 114 109 122 115 L126 111 L130 114 C121 107 112 101 106 94 Z"
          fill={p.paper}
        />
        <path
          d="M102 95 C106 103 114 109 122 115 L126 111 L130 114 C121 107 112 101 106 94 Z"
          fill={p.gold}
          fillOpacity="0.62"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        {/* Crimson ribbon */}
        <path
          d="M102 82 C104 94 103 106 99 117 L104 115 L108 118 C110 107 110 95 108 82 Z"
          fill={p.paper}
        />
        <path
          d="M102 82 C104 94 103 106 99 117 L104 115 L108 118 C110 107 110 95 108 82 Z"
          fill={p.rose}
          fillOpacity="0.68"
          stroke={p.ink}
          strokeWidth="1.1"
        />

        {/* Organically Melted Crimson Wax Seal pressed over the ribbon & page (100% opaque p.paper base) */}
        <path
          d="M105 70 C110 69 115 72 117 76.5 C119.5 81 117 87 112 89.5 C107 92 100 91 96.5 86.5 C93 82 95 76 99 73 C101 71 103 70.5 105 70 Z"
          fill={p.paper}
        />
        <path
          d="M105 70 C110 69 115 72 117 76.5 C119.5 81 117 87 112 89.5 C107 92 100 91 96.5 86.5 C93 82 95 76 99 73 C101 71 103 70.5 105 70 Z"
          fill={p.rose}
          fillOpacity="0.68"
          stroke={p.ink}
          strokeWidth="1.35"
        />
        {/* Recessed stamp circle & embossed gold relief */}
        <circle
          cx="106.5"
          cy="80"
          r="7.2"
          fill={p.rose}
          fillOpacity="0.38"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <circle cx="106.5" cy="80" r="5.8" stroke={p.gold} strokeWidth="1.0" />
        <path
          d="M106.5 75.8 L107.6 78.8 L110.6 80 L107.6 81.2 L106.5 84.2 L105.4 81.2 L102.4 80 L105.4 78.8 Z"
          fill={p.gold}
          fillOpacity="0.92"
        />
      </g>

      {/* Layer 4: Gold Foil Sparkles & Classical Filigree Dots */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M68 20 L69.1 23.2 L72.4 24.3 L69.1 25.4 L68 28.6 L66.9 25.4 L63.6 24.3 L66.9 23.2 Z"
          fill={p.gold}
          fillOpacity="0.88"
        />
        <path
          d="M142 20 L143.1 23.2 L146.4 24.3 L143.1 25.4 L142 28.6 L140.9 25.4 L137.6 24.3 L140.9 23.2 Z"
          fill={p.gold}
          fillOpacity="0.88"
        />
        <path
          d="M22 56 L22.9 58.6 L25.5 59.5 L22.9 60.4 L22 63 L21.1 60.4 L18.5 59.5 L21.1 58.6 Z"
          fill={p.gold}
          fillOpacity="0.78"
        />
        <path
          d="M192 58 L192.9 60.6 L195.5 61.5 L192.9 62.4 L192 65 L191.1 62.4 L188.5 61.5 L191.1 60.6 Z"
          fill={p.gold}
          fillOpacity="0.78"
        />

        <circle cx="80" cy="36" r="1.3" fill={p.gold} fillOpacity="0.7" />
        <circle cx="130" cy="36" r="1.3" fill={p.gold} fillOpacity="0.7" />
        <circle cx="58" cy="108" r="1.3" fill={p.brand} fillOpacity="0.55" />
        <circle cx="146" cy="108" r="1.3" fill={p.rose} fillOpacity="0.55" />
      </g>
    </svg>
  ),

  empty: (p: IllustrationPalette) => (
    <svg viewBox="0 0 136 90" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Quiet Classical Library Aura */}
      <ellipse cx="68" cy="52" rx="52" ry="26" fill={p.brandSoft} fillOpacity="0.22" />
      <ellipse cx="68" cy="62" rx="44" ry="15" fill={p.warm} fillOpacity="0.24" />
      <circle cx="68" cy="40" r="20" fill={p.gold} fillOpacity="0.13" />

      {/* Layer 2: Delicate Filigree Corner Flourishes & Desk Line */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M20 70 C50 73 86 73 116 70"
          stroke={p.ink}
          strokeWidth="0.9"
          strokeOpacity="0.32"
          strokeDasharray="3 3.5"
        />
        {/* Subtle scroll flourish above tome */}
        <path
          d="M52 20 C60 16 76 16 84 20"
          stroke={p.ink}
          strokeWidth="0.9"
          strokeOpacity="0.38"
        />
        <circle cx="68" cy="17.5" r="1.4" fill={p.gold} />
      </g>

      {/* Layer 3: Closed Heavy Leather-Bound Tome with Central Ex-Libris Bookplate Medallion */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Hanging silk bookmark ribbon & small wax/brass seal peeking from bottom */}
        <path
          d="M66 66 C68 72 72 76 76 80 L79.5 77.5 L83 79.5 C79 75 74 71 71 66 Z"
          fill={p.paper}
        />
        <path
          d="M66 66 C68 72 72 76 76 80 L79.5 77.5 L83 79.5 C79 75 74 71 71 66 Z"
          fill={p.rose}
          fillOpacity="0.68"
          stroke={p.ink}
          strokeWidth="1.05"
        />

        {/* Closed Tome Bottom Cover Edge */}
        <path
          d="M26 61 L48 45 L112 50 L94 70 L26 64 Z"
          fill={p.paper}
        />
        <path
          d="M26 61 L48 45 L112 50 L94 70 L26 64 Z"
          fill={p.brand}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="1.25"
        />

        {/* Thick Gilded Page Block on Front & Right (100% opaque p.paper base) */}
        <path
          d="M28 53 L93 59 L110 41 L110 49 L93 68 L28 62 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.25"
        />
        <path
          d="M28 53 L93 59 L110 41 L110 49 L93 68 L28 62 Z"
          fill={p.gold}
          fillOpacity="0.26"
        />
        {/* Fine gilded page lines */}
        <path d="M32 56.5 L91 62" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.48" />
        <path d="M32 59.5 L91 65" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.48" />
        <path d="M95 60.5 L108 46.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.48" />

        {/* Closed Tome Top Leather Cover (100% opaque p.paper base) */}
        <path
          d="M26 53 L46 34 L112 39 L93 59 Z"
          fill={p.paper}
        />
        <path
          d="M26 53 L46 34 L112 39 L93 59 Z"
          fill={p.brand}
          fillOpacity="0.46"
          stroke={p.ink}
          strokeWidth="1.35"
        />

        {/* Rounded Leather Spine on Left with Raised Binding Ridges */}
        <path
          d="M26 53 C23 55.5 23 61 26 64 L46 44 L46 34 Z"
          fill={p.paper}
        />
        <path
          d="M26 53 C23 55.5 23 61 26 64 L46 44 L46 34 Z"
          fill={p.brand}
          fillOpacity="0.62"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        {/* Spine gold bands */}
        <path d="M30 49 C28 51.5 28 56.5 30 59.5" stroke={p.gold} strokeWidth="1.6" />
        <path d="M37 42.5 C35 45 35 50 37 52.5" stroke={p.gold} strokeWidth="1.6" />

        {/* Ornate Brass Corner Mounts & Fore-Edge Clasp */}
        <path d="M112 39 L104 38.4 L107.5 43.8 Z" fill={p.gold} stroke={p.ink} strokeWidth="1.0" />
        <path d="M93 59 L85 58.2 L97.5 54.2 Z" fill={p.gold} stroke={p.ink} strokeWidth="1.0" />
        {/* Brass fore-edge lock clasp */}
        <path
          d="M101 48 L105 49 L105 56 L101 55 Z"
          fill={p.gold}
          fillOpacity="0.8"
          stroke={p.ink}
          strokeWidth="1.05"
        />

        {/* Central Rounded-Corner Ex-Libris Bookplate Badge on Top Cover (100% opaque p.paper base) */}
        <path
          d="M52 47 L62 38 L86 40 L76 50 Z"
          fill={p.paper}
        />
        <path
          d="M52 47 L62 38 L86 40 L76 50 Z"
          fill={p.warm}
          fillOpacity="0.45"
          stroke={p.gold}
          strokeWidth="2.0"
        />
        <path
          d="M52 47 L62 38 L86 40 L76 50 Z"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        {/* Embossed four-point star / emblem at center of bookplate */}
        <path
          d="M69 41.5 L70 43.6 L72.5 44.2 L69.8 45 L68.8 47 L68 44.8 L65.5 44.2 L68.2 43.5 Z"
          fill={p.gold}
          fillOpacity="0.9"
          stroke={p.ink}
          strokeWidth="0.75"
        />
      </g>

      {/* Layer 4: Quiet Gold Foil Sparkles & Dust Motes */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M36 24 L36.8 26.4 L39.2 27.2 L36.8 28 L36 30.4 L35.2 28 L32.8 27.2 L35.2 26.4 Z"
          fill={p.gold}
          fillOpacity="0.82"
        />
        <path
          d="M106 26 L106.7 27.8 L108.5 28.5 L106.7 29.2 L106 31 L105.3 29.2 L103.5 28.5 L105.3 27.8 Z"
          fill={p.gold}
          fillOpacity="0.75"
        />
        <circle cx="22" cy="42" r="1.2" fill={p.gold} fillOpacity="0.65" />
        <circle cx="94" cy="24" r="1.2" fill={p.brand} fillOpacity="0.55" />
        <circle cx="116" cy="56" r="1.3" fill={p.rose} fillOpacity="0.5" />
      </g>
    </svg>
  ),
};
