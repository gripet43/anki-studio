import React from 'react';
import type { IllustrationPalette, ThemeIllustrationPack } from './types';

export const cafePack: ThemeIllustrationPack = {
  greeting: (p: IllustrationPalette) => (
    <svg viewBox="0 0 112 44" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Warm ambient café glow */}
      <ellipse cx="56" cy="24" rx="44" ry="15" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="48" cy="18" r="14" fill={p.gold} fillOpacity="0.15" />
      <circle cx="68" cy="24" r="12" fill={p.rose} fillOpacity="0.12" />

      {/* Layer 2: Wooden coaster line & roasted coffee beans */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M16 37 C40 39 72 39 96 37"
          stroke={p.ink}
          strokeWidth="0.9"
          strokeOpacity="0.35"
          strokeDasharray="2.5 3"
        />

        {/* Roasted coffee bean 1 on left */}
        <ellipse
          cx="25"
          cy="34"
          rx="4.2"
          ry="2.8"
          transform="rotate(-22 25 34)"
          fill={p.paper}
        />
        <ellipse
          cx="25"
          cy="34"
          rx="4.2"
          ry="2.8"
          transform="rotate(-22 25 34)"
          fill={p.brand}
          fillOpacity="0.58"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path d="M21.8 35.2 C24 33.5 26 34.5 28.2 32.8" stroke={p.ink} strokeWidth="0.85" />

        {/* Roasted coffee bean 2 on left */}
        <ellipse
          cx="32.5"
          cy="36.2"
          rx="3.4"
          ry="2.3"
          transform="rotate(15 32.5 36.2)"
          fill={p.paper}
        />
        <ellipse
          cx="32.5"
          cy="36.2"
          rx="3.4"
          ry="2.3"
          transform="rotate(15 32.5 36.2)"
          fill={p.brand}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <path d="M29.8 35.6 C31.8 36.5 33.2 35.8 35.2 36.8" stroke={p.ink} strokeWidth="0.8" />
      </g>

      {/* Layer 3: Foreground Coffee Cup, Vintage Brass Spoon & Heart Steam */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Ceramic saucer (opaque p.paper base) */}
        <ellipse cx="55" cy="36.5" rx="19" ry="4.5" fill={p.paper} stroke={p.ink} strokeWidth="1.2" />
        <ellipse cx="55" cy="36.5" rx="13.5" ry="2.6" fill={p.warm} fillOpacity="0.45" />

        {/* Cup handle on left */}
        <path
          d="M42 24 C36.5 24 36.5 32 43 32.5"
          stroke={p.ink}
          strokeWidth="2.4"
        />
        <path
          d="M42 24 C36.5 24 36.5 32 43 32.5"
          stroke={p.paper}
          strokeWidth="1.0"
        />

        {/* Coffee cup body (opaque p.paper base) */}
        <path
          d="M42 21 L68 21 L66 32.5 C65 35.5 60.5 37 55 37 C49.5 37 45 35.5 44 32.5 Z"
          fill={p.paper}
        />
        {/* Warm amber glaze band on cup */}
        <path
          d="M43 27.5 C51 29.2 59 29.2 67 27.5 L66 32.5 C65 35.5 60.5 37 55 37 C49.5 37 45 35.5 44 32.5 Z"
          fill={p.brand}
          fillOpacity="0.36"
        />
        <path
          d="M42 21 L68 21 L66 32.5 C65 35.5 60.5 37 55 37 C49.5 37 45 35.5 44 32.5 Z"
          stroke={p.ink}
          strokeWidth="1.25"
        />

        {/* Cup rim & rich latte surface */}
        <ellipse cx="55" cy="21" rx="13" ry="3.6" fill={p.paper} stroke={p.ink} strokeWidth="1.2" />
        <ellipse cx="55" cy="21.4" rx="10.8" ry="2.4" fill={p.brand} fillOpacity="0.58" />
        {/* Tiny milk foam heart in latte */}
        <path
          d="M53 21 C53 20 54.5 19.8 55 20.6 C55.5 19.8 57 20 57 21 C57 22 55 22.8 55 23.2 C55 22.8 53 22 53 21 Z"
          fill={p.paper}
          fillOpacity="0.9"
        />

        {/* Vintage brass coffee spoon resting on saucer right */}
        <path
          d="M66 35.5 L87 31.5 C88.5 31.2 89 32.8 87.5 33.3 L67 37.2 Z"
          fill={p.paper}
        />
        <path
          d="M66 35.5 L87 31.5 C88.5 31.2 89 32.8 87.5 33.3 L67 37.2 Z"
          fill={p.gold}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <ellipse
          cx="64.5"
          cy="36.5"
          rx="4.2"
          ry="1.8"
          transform="rotate(-10 64.5 36.5)"
          fill={p.paper}
        />
        <ellipse
          cx="64.5"
          cy="36.5"
          rx="4.2"
          ry="1.8"
          transform="rotate(-10 64.5 36.5)"
          fill={p.gold}
          fillOpacity="0.68"
          stroke={p.ink}
          strokeWidth="1.05"
        />

        {/* Rising heart-shaped steam wisps above cup */}
        <path
          d="M51 11.5 C51 9.2 53.8 8.5 55 10.5 C56.2 8.5 59 9.2 59 11.5 C59 14.2 55 16.2 55 17.5 C55 16.2 51 14.2 51 11.5 Z"
          fill={p.rose}
          fillOpacity="0.32"
        />
        <path
          d="M52 17 C48 14 48.5 8.5 52.5 8.5 C54.2 8.5 55 9.8 55 10.8 C55 9.8 55.8 8.5 57.5 8.5 C61.5 8.5 62 14 57.5 16.8"
          stroke={p.ink}
          strokeWidth="1.1"
          strokeOpacity="0.68"
        />
        <path
          d="M46 16 C44 13.5 45 10.5 46.5 8"
          stroke={p.ink}
          strokeWidth="0.9"
          strokeOpacity="0.45"
        />
        <path
          d="M64 15.5 C66 13 65 10 63.5 7.5"
          stroke={p.ink}
          strokeWidth="0.9"
          strokeOpacity="0.45"
        />
      </g>

      {/* Layer 4: Sparkles & aroma dots */}
      <path
        d="M34 11 L34.8 13.4 L37.2 14.2 L34.8 15 L34 17.4 L33.2 15 L30.8 14.2 L33.2 13.4 Z"
        fill={p.gold}
        fillOpacity="0.82"
      />
      <path
        d="M76 12 L76.6 13.8 L78.4 14.4 L76.6 15 L76 16.8 L75.4 15 L73.6 14.4 L75.4 13.8 Z"
        fill={p.gold}
        fillOpacity="0.75"
      />
      <circle cx="22" cy="21" r="1.2" fill={p.gold} fillOpacity="0.6" />
      <circle cx="88" cy="22" r="1.3" fill={p.brand} fillOpacity="0.5" />
    </svg>
  ),

  cornerLeft: (p: IllustrationPalette) => (
    <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Warm amber corner glow */}
      <path d="M0 96 L0 26 C28 30 54 54 70 96 Z" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="28" cy="68" r="24" fill={p.gold} fillOpacity="0.16" />
      <circle cx="48" cy="82" r="15" fill={p.warm} fillOpacity="0.22" />

      {/* Layer 2: Slatted wooden table corner & small herb sprig */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Wooden café table corner at bottom-left */}
        <path
          d="M0 80 L58 84 L68 96 L0 96 Z"
          fill={p.paper}
        />
        <path
          d="M0 80 L58 84 L68 96 L0 96 Z"
          fill={p.warm}
          fillOpacity="0.42"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        {/* Wood slat lines */}
        <path d="M0 88 L62 92" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.45" />
        <path d="M26 81.8 L34 96" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.4" />

        {/* Small sage sprig behind kettle on left */}
        <path
          d="M10 56 C4 50 2 42 5 35 C11 39 13 47 10 56 Z"
          fill={p.leaf}
          fillOpacity="0.38"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M15 52 C13 44 15 36 20 32 C23 38 20 46 15 52 Z"
          fill={p.leaf}
          fillOpacity="0.3"
          stroke={p.ink}
          strokeWidth="1.0"
        />
      </g>

      {/* Layer 3: Gooseneck Pour-Over Kettle & Scattered Coffee Beans */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Kettle angled handle on left */}
        <path
          d="M10 61 L2 64 L4 79 L12 80"
          stroke={p.ink}
          strokeWidth="3.0"
        />
        <path
          d="M10 61 L2 64 L4 79 L12 80"
          stroke={p.brand}
          strokeWidth="1.4"
        />

        {/* Slender S-curved gooseneck spout extending up-right */}
        <path
          d="M36 78 C46 78 48 64 52 54 C54.5 48 58.5 46 63 46 L61.5 49.5 C58.5 49.5 56.5 51.5 54.5 56.5 C50 68 47 82 35 82 Z"
          fill={p.paper}
        />
        <path
          d="M36 78 C46 78 48 64 52 54 C54.5 48 58.5 46 63 46 L61.5 49.5 C58.5 49.5 56.5 51.5 54.5 56.5 C50 68 47 82 35 82 Z"
          fill={p.gold}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="1.25"
        />

        {/* Pour-over kettle tiered body (100% opaque p.paper base) */}
        <path
          d="M13 58 L33 58 L36 69 L39 85 C30 88 16 88 7 85 L10 69 Z"
          fill={p.paper}
        />
        {/* Copper/amber metallic shading on kettle */}
        <path
          d="M13 58 L33 58 L36 69 L39 85 C30 88 16 88 7 85 L10 69 Z"
          fill={p.gold}
          fillOpacity="0.42"
        />
        <path
          d="M10 69 L36 69 L39 85 C30 88 16 88 7 85 Z"
          fill={p.brand}
          fillOpacity="0.28"
        />
        {/* Metallic vertical highlight band */}
        <path
          d="M16 58.5 L21 58.5 L19 86.5 L13.5 86 Z"
          fill={p.paper}
          fillOpacity="0.48"
        />
        {/* Kettle body outline & ridge */}
        <path
          d="M13 58 L33 58 L36 69 L39 85 C30 88 16 88 7 85 L10 69 Z"
          stroke={p.ink}
          strokeWidth="1.35"
        />
        <path d="M10 69 C18 71 28 71 36 69" stroke={p.ink} strokeWidth="1.1" />

        {/* Kettle lid & wooden knob */}
        <ellipse cx="23" cy="58" rx="10.2" ry="2.6" fill={p.paper} stroke={p.ink} strokeWidth="1.2" />
        <ellipse cx="23" cy="58" rx="10.2" ry="2.6" fill={p.gold} fillOpacity="0.55" />
        <rect x="20" y="52.5" width="6" height="4" rx="1.5" fill={p.paper} />
        <rect x="20" y="52.5" width="6" height="4" rx="1.5" fill={p.brand} fillOpacity="0.65" stroke={p.ink} strokeWidth="1.15" />

        {/* Scattered roasted coffee beans on table */}
        {/* Bean 1 */}
        <ellipse
          cx="47"
          cy="88"
          rx="4.5"
          ry="3.0"
          transform="rotate(-18 47 88)"
          fill={p.paper}
        />
        <ellipse
          cx="47"
          cy="88"
          rx="4.5"
          ry="3.0"
          transform="rotate(-18 47 88)"
          fill={p.brand}
          fillOpacity="0.62"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        <path d="M43.5 89.2 C46 87.5 48 88.5 50.5 86.8" stroke={p.ink} strokeWidth="0.9" />

        {/* Bean 2 */}
        <ellipse
          cx="56"
          cy="91"
          rx="4.0"
          ry="2.6"
          transform="rotate(24 56 91)"
          fill={p.paper}
        />
        <ellipse
          cx="56"
          cy="91"
          rx="4.0"
          ry="2.6"
          transform="rotate(24 56 91)"
          fill={p.brand}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path d="M53 89.8 C55 91.2 57 90.5 59 92" stroke={p.ink} strokeWidth="0.85" />

        {/* Bean 3 */}
        <ellipse
          cx="52"
          cy="82"
          rx="3.6"
          ry="2.4"
          transform="rotate(-35 52 82)"
          fill={p.paper}
        />
        <ellipse
          cx="52"
          cy="82"
          rx="3.6"
          ry="2.4"
          transform="rotate(-35 52 82)"
          fill={p.brand}
          fillOpacity="0.5"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <path d="M49.5 83.8 C51.2 81.8 52.8 82.2 54.5 80.2" stroke={p.ink} strokeWidth="0.8" />
      </g>

      {/* Layer 4: Rising steam curls from spout & golden sparkles */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M64 41 C62 35 68 31 65 25"
          stroke={p.ink}
          strokeWidth="1.05"
          strokeOpacity="0.55"
        />
        <path
          d="M70 44 C69 39 74 36 72 31"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.42"
        />
        <path
          d="M42 26 L43 28.8 L45.8 29.8 L43 30.8 L42 33.6 L41 30.8 L38.2 29.8 L41 28.8 Z"
          fill={p.gold}
          fillOpacity="0.82"
        />
        <circle cx="32" cy="38" r="1.4" fill={p.gold} fillOpacity="0.65" />
        <circle cx="55" cy="22" r="1.2" fill={p.brand} fillOpacity="0.5" />
        <circle cx="67" cy="64" r="1.3" fill={p.gold} fillOpacity="0.6" />
      </g>
    </svg>
  ),

  cornerRight: (p: IllustrationPalette) => (
    <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Bottom-right warm ambient glow */}
      <path d="M96 96 L96 28 C68 32 44 54 26 96 Z" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="68" cy="68" r="24" fill={p.gold} fillOpacity="0.16" />
      <circle cx="50" cy="82" r="15" fill={p.rose} fillOpacity="0.12" />

      {/* Layer 2: Background botanical sprig & napkin corner */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M84 54 C89 46 92 38 89 31 C83 35 81 44 84 54 Z"
          fill={p.leaf}
          fillOpacity="0.36"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M78 52 C79 44 76 37 71 33 C68 39 71 47 78 52 Z"
          fill={p.leaf}
          fillOpacity="0.28"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <circle cx="71" cy="31" r="2.1" fill={p.rose} fillOpacity="0.58" stroke={p.ink} strokeWidth="0.9" />
      </g>

      {/* Layer 3: Stacked Books, Vintage Brass Plate & Flaky Golden Croissant */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Bottom hardcover book (sage/kraft spine) */}
        <rect x="32" y="82" width="62" height="11" rx="3" fill={p.paper} />
        <rect x="32" y="82" width="62" height="11" rx="3" fill={p.leaf} fillOpacity="0.36" stroke={p.ink} strokeWidth="1.25" />
        <path d="M38 84.5 L90 84.5 L90 90.5 L38 90.5 C36 90.5 36 84.5 38 84.5 Z" fill={p.paper} stroke={p.ink} strokeWidth="1.05" />
        <path d="M42 87.5 L86 87.5" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.45" />

        {/* Upper kraft notebook */}
        <path
          d="M40 71 L88 68 L94 76 L43 82 Z"
          fill={p.paper}
        />
        <path
          d="M40 71 L88 68 L94 76 L43 82 Z"
          fill={p.brand}
          fillOpacity="0.42"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        <path
          d="M43 76 L92 71 L92 78.5 L43 82 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <path d="M47 79 L88 75" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.45" />

        {/* Hanging coral ribbon bookmark */}
        <path
          d="M52 80 C53 85 51 89 49 93 L53 91.5 L55.5 93.5 C56.5 89 56 84.5 55 79.5 Z"
          fill={p.rose}
          fillOpacity="0.68"
          stroke={p.ink}
          strokeWidth="1.0"
        />

        {/* Vintage oval brass saucer/plate on top of books */}
        <ellipse cx="68" cy="67" rx="22" ry="6.5" fill={p.paper} />
        <ellipse
          cx="68"
          cy="67"
          rx="22"
          ry="6.5"
          fill={p.gold}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        <ellipse
          cx="68"
          cy="67"
          rx="16.5"
          ry="4.2"
          fill={p.warm}
          fillOpacity="0.4"
          stroke={p.ink}
          strokeWidth="0.85"
          strokeOpacity="0.5"
        />

        {/* Flaky Golden Croissant resting on brass plate (opaque p.paper base) */}
        {/* Left & right crescent tips */}
        <path
          d="M50 63 C46 59 48 53 54 53 C58 53 60 59 56 64 C53.5 65.5 51.5 65 50 63 Z"
          fill={p.paper}
        />
        <path
          d="M50 63 C46 59 48 53 54 53 C58 53 60 59 56 64 C53.5 65.5 51.5 65 50 63 Z"
          fill={p.gold}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.2"
        />

        <path
          d="M84 61 C88 57 86 51 80 51 C76 51 74 57 78 62 C80.5 63.5 82.5 63 84 61 Z"
          fill={p.paper}
        />
        <path
          d="M84 61 C88 57 86 51 80 51 C76 51 74 57 78 62 C80.5 63.5 82.5 63 84 61 Z"
          fill={p.gold}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.2"
        />

        {/* Mid-flank layers of croissant */}
        <path
          d="M53 59 C52 51 57 46 64 46 C71 46 76 50 75 58 C72 63 57 63 53 59 Z"
          fill={p.paper}
        />
        <path
          d="M53 59 C52 51 57 46 64 46 C71 46 76 50 75 58 C72 63 57 63 53 59 Z"
          fill={p.gold}
          fillOpacity="0.58"
          stroke={p.ink}
          strokeWidth="1.25"
        />

        {/* Central golden-brown crown of croissant */}
        <path
          d="M58 56 C58 48 62 43 67.5 43 C73 43 76 48 75 55 C73 60.5 60 60.5 58 56 Z"
          fill={p.paper}
        />
        <path
          d="M58 56 C58 48 62 43 67.5 43 C73 43 76 48 75 55 C73 60.5 60 60.5 58 56 Z"
          fill={p.brand}
          fillOpacity="0.38"
        />
        <path
          d="M58 56 C58 48 62 43 67.5 43 C73 43 76 48 75 55 C73 60.5 60 60.5 58 56 Z"
          fill={p.gold}
          fillOpacity="0.45"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        {/* Flaky crust ridges */}
        <path d="M62 48 C65 46.5 69 46.5 72 48" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.55" />
        <path d="M61 52 C65 50.5 69 50.5 72.5 52" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.55" />
      </g>

      {/* Layer 4: Warm pastry aroma curls, crumbs & sparkles */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M62 37 C60 32 65 29 63 24"
          stroke={p.ink}
          strokeWidth="1.0"
          strokeOpacity="0.48"
        />
        <path
          d="M46 32 L46.9 34.5 L49.5 35.4 L46.9 36.3 L46 38.8 L45.1 36.3 L42.5 35.4 L45.1 34.5 Z"
          fill={p.gold}
          fillOpacity="0.82"
        />
        <circle cx="57" cy="66" r="1.1" fill={p.brand} fillOpacity="0.65" />
        <circle cx="79" cy="65.5" r="0.9" fill={p.brand} fillOpacity="0.65" />
        <circle cx="36" cy="54" r="1.3" fill={p.gold} fillOpacity="0.6" />
        <circle cx="54" cy="20" r="1.2" fill={p.rose} fillOpacity="0.48" />
      </g>
    </svg>
  ),

  celebration: (p: IllustrationPalette) => (
    <svg viewBox="0 0 210 132" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Diagonal Window Sunbeams & Warm Ambient Aura */}
      <ellipse cx="105" cy="74" rx="86" ry="44" fill={p.brandSoft} fillOpacity="0.22" />
      {/* Slanting warm sunbeams from top-left window */}
      <path
        d="M18 10 L76 10 L138 118 L64 118 Z"
        fill={p.gold}
        fillOpacity="0.14"
      />
      <path
        d="M88 10 L126 10 L186 118 L148 118 Z"
        fill={p.gold}
        fillOpacity="0.11"
      />
      <ellipse cx="148" cy="72" rx="44" ry="30" fill={p.warm} fillOpacity="0.2" />

      {/* Subtle window frame corner hint in top-left sky */}
      <g stroke={p.ink} strokeOpacity="0.22" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 14 L22 46 L68 46" strokeWidth="1.1" />
        <path d="M45 14 L45 46" strokeWidth="0.9" />
        <path d="M22 30 L68 30" strokeWidth="0.9" />
      </g>

      {/* Layer 2: Slatted Wooden Café Table, Herb Sprig & Scattered Coffee Beans */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Slatted wooden table surface at bottom (opaque p.paper base + warm wood tone) */}
        <path
          d="M16 104 L38 68 L172 68 L194 104 C140 116 70 116 16 104 Z"
          fill={p.paper}
        />
        <path
          d="M16 104 L38 68 L172 68 L194 104 C140 116 70 116 16 104 Z"
          fill={p.warm}
          fillOpacity="0.42"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        {/* Diagonal sunlit patch across table */}
        <path
          d="M52 68 L112 68 L142 111 C112 114 82 113 62 110 Z"
          fill={p.gold}
          fillOpacity="0.16"
        />
        {/* Wooden table plank slat lines */}
        <path d="M31 79 L179 79" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.35" />
        <path d="M24 91 L186 91" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.35" />
        <path d="M74 68 L60 110" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.3" />
        <path d="M136 68 L150 110" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.3" />

        {/* Small eucalyptus/herb sprig behind croissant */}
        <path d="M78 52 C66 44 56 35 48 24" stroke={p.ink} strokeWidth="1.1" />
        <path
          d="M64 42 C56 43 49 40 46 34 C52 31 60 34 64 42 Z"
          fill={p.leaf}
          fillOpacity="0.4"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <path
          d="M58 34 C57 26 60 19 66 16 C68 22 65 29 58 34 Z"
          fill={p.leaf}
          fillOpacity="0.32"
          stroke={p.ink}
          strokeWidth="1.0"
        />
      </g>

      {/* Layer 3: Foreground Protagonists — Croissant on Plate, Open Kraft Notebook, Ceramic Latte */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* 1. Flaky Golden Croissant on a Small Plate (center-top of table) */}
        <ellipse cx="102" cy="67" rx="25" ry="7.5" fill={p.paper} stroke={p.ink} strokeWidth="1.2" />
        <ellipse cx="102" cy="67" rx="19" ry="5" fill={p.warm} fillOpacity="0.42" />

        {/* Croissant crescent tips */}
        <path
          d="M82 63 C78 58 80 51 86 51 C91 51 93 58 88 64 C85.5 65.5 83.5 65 82 63 Z"
          fill={p.paper}
        />
        <path
          d="M82 63 C78 58 80 51 86 51 C91 51 93 58 88 64 C85.5 65.5 83.5 65 82 63 Z"
          fill={p.gold}
          fillOpacity="0.5"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path
          d="M120 62 C124 57 122 50 116 50 C111 50 109 57 114 63 C116.5 64.5 118.5 64 120 62 Z"
          fill={p.paper}
        />
        <path
          d="M120 62 C124 57 122 50 116 50 C111 50 109 57 114 63 C116.5 64.5 118.5 64 120 62 Z"
          fill={p.gold}
          fillOpacity="0.5"
          stroke={p.ink}
          strokeWidth="1.2"
        />

        {/* Croissant mid-layers */}
        <path
          d="M86 59 C85 50 91 44 101 44 C111 44 117 50 116 59 C112 64.5 90 64.5 86 59 Z"
          fill={p.paper}
        />
        <path
          d="M86 59 C85 50 91 44 101 44 C111 44 117 50 116 59 C112 64.5 90 64.5 86 59 Z"
          fill={p.gold}
          fillOpacity="0.6"
          stroke={p.ink}
          strokeWidth="1.25"
        />

        {/* Croissant golden-brown central crown */}
        <path
          d="M92 56 C92 47 96 41 101.5 41 C107 41 111 47 110 56 C107 61.5 95 61.5 92 56 Z"
          fill={p.paper}
        />
        <path
          d="M92 56 C92 47 96 41 101.5 41 C107 41 111 47 110 56 C107 61.5 95 61.5 92 56 Z"
          fill={p.brand}
          fillOpacity="0.38"
        />
        <path
          d="M92 56 C92 47 96 41 101.5 41 C107 41 111 47 110 56 C107 61.5 95 61.5 92 56 Z"
          fill={p.gold}
          fillOpacity="0.45"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        <path d="M96 46.5 C99.5 45 103.5 45 107 46.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.55" />
        <path d="M95 51 C99.5 49.5 103.5 49.5 108 51" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.55" />

        {/* 2. Open Kraft Paper Study Notebook (left-front of table) */}
        {/* Kraft cover jacket */}
        <path
          d="M28 97 L38 71 C53 68 68 69 82 74 C96 69 111 68 126 71 L134 97 C116 93 98 94 82 100 C66 94 46 93 28 97 Z"
          fill={p.paper}
        />
        <path
          d="M28 97 L38 71 C53 68 68 69 82 74 C96 69 111 68 126 71 L134 97 C116 93 98 94 82 100 C66 94 46 93 28 97 Z"
          fill={p.brand}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        {/* Open cream pages (100% opaque p.paper base) */}
        <path
          d="M32 93 L41 68 C55 65.5 69 66.5 82 71 C95 66.5 109 65.5 123 68 L130 93 C114 89.5 97 90.5 82 96 C67 90.5 48 89.5 32 93 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.25"
        />
        {/* Page block thickness */}
        <path
          d="M32 93 C48 89.5 67 90.5 82 96 C97 90.5 114 89.5 130 93 L131.5 96 C115 92.5 97.5 93.5 82 99 C66.5 93.5 47 92.5 30.5 96 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.15"
        />
        {/* Spine gutter shading */}
        <path
          d="M79 70 L82 71 L85 70 L85 95 L82 96 L79 95 Z"
          fill={p.warm}
          fillOpacity="0.4"
        />
        <path d="M82 71 L82 96" stroke={p.ink} strokeWidth="1.15" />

        {/* Left page: Taped café ticket & study lines */}
        <path
          d="M44 73 L62 72 L60 83 L42 84 Z"
          fill={p.warm}
          fillOpacity="0.45"
          stroke={p.ink}
          strokeWidth="0.95"
        />
        <path
          d="M50 70.5 L57 70.2 L56.8 73.2 L49.8 73.5 Z"
          fill={p.gold}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="0.85"
        />
        <path d="M46 77 L57 76.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />
        <path d="M45 80 L54 79.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />
        <path d="M40 88 L73 89.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.5" />

        {/* Right page: Study notes & brass clip */}
        <rect x="90" y="73" width="15" height="3.2" rx="1.2" fill={p.gold} fillOpacity="0.48" />
        <path d="M90 79.5 L118 78.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.5" />
        <path d="M90 83.5 L120 82.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.5" />
        <path d="M90 87.5 L112 86.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.5" />

        {/* Hanging ribbon bookmark with brass coffee-bean charm */}
        <path
          d="M82 96 C83 103 87 108 91 114 L95 111.5 L98 114.5 C94 107.5 88 102 84 95.5 Z"
          fill={p.rose}
          fillOpacity="0.7"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <circle cx="94" cy="113" r="2.8" fill={p.gold} stroke={p.ink} strokeWidth="0.95" />

        {/* 3. Ceramic Latte Cup with Latte Art & Brass Spoon (right-front of table) */}
        {/* Ceramic saucer (100% opaque p.paper base) */}
        <ellipse cx="152" cy="94" rx="26" ry="8" fill={p.paper} stroke={p.ink} strokeWidth="1.3" />
        <ellipse cx="152" cy="94" rx="18.5" ry="5" fill={p.warm} fillOpacity="0.45" />

        {/* Mug handle on right */}
        <path
          d="M170 71 C178 71 179 84 169 85.5"
          stroke={p.ink}
          strokeWidth="3.0"
        />
        <path
          d="M170 71 C178 71 179 84 169 85.5"
          stroke={p.paper}
          strokeWidth="1.3"
        />

        {/* Wide ceramic latte mug body (100% opaque p.paper base) */}
        <path
          d="M132 66 L172 66 L169 86 C167 91.5 160 94 152 94 C144 94 137 91.5 135 86 Z"
          fill={p.paper}
        />
        {/* Warm amber ceramic lower glaze */}
        <path
          d="M133.5 76 C145 79 159 79 170.5 76 L169 86 C167 91.5 160 94 152 94 C144 94 137 91.5 135 86 Z"
          fill={p.brand}
          fillOpacity="0.38"
        />
        <path
          d="M132 66 L172 66 L169 86 C167 91.5 160 94 152 94 C144 94 137 91.5 135 86 Z"
          stroke={p.ink}
          strokeWidth="1.35"
        />

        {/* Mug rim & rich espresso crema */}
        <ellipse cx="152" cy="66" rx="20" ry="6.2" fill={p.paper} stroke={p.ink} strokeWidth="1.3" />
        <ellipse cx="152" cy="66.5" rx="17.5" ry="4.6" fill={p.brand} fillOpacity="0.62" />

        {/* Tulip / Heart Latte Art in white milk foam */}
        <path
          d="M146 65.8 C146 63.8 149.8 63.2 152 65.2 C154.2 63.2 158 63.8 158 65.8 C158 68.2 152 69.8 152 70.6 C152 69.8 146 68.2 146 65.8 Z"
          fill={p.paper}
          fillOpacity="0.92"
        />
        <path
          d="M149 64.5 C149 63.5 151 63.2 152 64.2 C153 63.2 155 63.5 155 64.5"
          stroke={p.brand}
          strokeWidth="0.9"
          strokeOpacity="0.65"
        />
        <path d="M152 63 L152 70.5" stroke={p.brand} strokeWidth="0.8" strokeOpacity="0.55" />

        {/* Vintage brass coffee spoon resting on saucer front-right */}
        <path
          d="M156 97 L184 92 C186 91.7 186.5 93.8 184.5 94.4 L157 99 Z"
          fill={p.paper}
        />
        <path
          d="M156 97 L184 92 C186 91.7 186.5 93.8 184.5 94.4 L157 99 Z"
          fill={p.gold}
          fillOpacity="0.68"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        <ellipse
          cx="153.5"
          cy="98"
          rx="5.2"
          ry="2.2"
          transform="rotate(-8 153.5 98)"
          fill={p.paper}
        />
        <ellipse
          cx="153.5"
          cy="98"
          rx="5.2"
          ry="2.2"
          transform="rotate(-8 153.5 98)"
          fill={p.gold}
          fillOpacity="0.7"
          stroke={p.ink}
          strokeWidth="1.1"
        />

        {/* Scattered roasted coffee beans on table */}
        <ellipse
          cx="118"
          cy="103"
          rx="4.2"
          ry="2.8"
          transform="rotate(-20 118 103)"
          fill={p.paper}
        />
        <ellipse
          cx="118"
          cy="103"
          rx="4.2"
          ry="2.8"
          transform="rotate(-20 118 103)"
          fill={p.brand}
          fillOpacity="0.6"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path d="M114.8 104 C117 102.5 119 103.5 121.2 102" stroke={p.ink} strokeWidth="0.85" />

        <ellipse
          cx="127"
          cy="106"
          rx="3.6"
          ry="2.4"
          transform="rotate(22 127 106)"
          fill={p.paper}
        />
        <ellipse
          cx="127"
          cy="106"
          rx="3.6"
          ry="2.4"
          transform="rotate(22 127 106)"
          fill={p.brand}
          fillOpacity="0.52"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <path d="M124.2 105 C126 106.2 127.8 105.5 129.8 106.8" stroke={p.ink} strokeWidth="0.8" />
      </g>

      {/* Layer 4: Rising Steam Wisps, Sunbeam Dust Motes & Golden Sparkles */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Soft rising steam wisps above latte */}
        <path
          d="M145 57 C141 49 149 42 145 34 C142 28 147 23 145 18"
          stroke={p.ink}
          strokeWidth="1.1"
          strokeOpacity="0.5"
        />
        <path
          d="M156 55 C153 47 161 40 157 32 C155 27 159 22 157 17"
          stroke={p.ink}
          strokeWidth="1.05"
          strokeOpacity="0.45"
        />
        <path
          d="M101 35 C99 30 104 26 102 21"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.4"
        />

        {/* Four-point sunbeam sparkles */}
        <path
          d="M82 18 L83.2 21.4 L86.6 22.6 L83.2 23.8 L82 27.2 L80.8 23.8 L77.4 22.6 L80.8 21.4 Z"
          fill={p.gold}
          fillOpacity="0.85"
        />
        <path
          d="M126 24 L127 26.8 L129.8 27.8 L127 28.8 L126 31.6 L125 28.8 L122.2 27.8 L125 26.8 Z"
          fill={p.gold}
          fillOpacity="0.8"
        />
        <path
          d="M176 42 L176.8 44.4 L179.2 45.2 L176.8 46 L176 48.4 L175.2 46 L172.8 45.2 L175.2 44.4 Z"
          fill={p.gold}
          fillOpacity="0.75"
        />
        <path
          d="M32 54 L32.8 56.4 L35.2 57.2 L32.8 58 L32 60.4 L31.2 58 L28.8 57.2 L31.2 56.4 Z"
          fill={p.gold}
          fillOpacity="0.75"
        />

        {/* Floating golden dust motes in sunbeam */}
        <circle cx="62" cy="54" r="1.4" fill={p.gold} fillOpacity="0.7" />
        <circle cx="94" cy="28" r="1.3" fill={p.gold} fillOpacity="0.65" />
        <circle cx="116" cy="40" r="1.4" fill={p.gold} fillOpacity="0.65" />
        <circle cx="168" cy="28" r="1.2" fill={p.brand} fillOpacity="0.5" />
        <circle cx="52" cy="108" r="1.3" fill={p.gold} fillOpacity="0.6" />
      </g>
    </svg>
  ),

  empty: (p: IllustrationPalette) => (
    <svg viewBox="0 0 136 90" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Quiet warm sunlit aura */}
      <ellipse cx="68" cy="54" rx="52" ry="26" fill={p.brandSoft} fillOpacity="0.22" />
      {/* Diagonal warm sunbeam patch */}
      <path
        d="M32 14 L74 14 L108 78 L58 78 Z"
        fill={p.gold}
        fillOpacity="0.14"
      />
      <ellipse cx="68" cy="64" rx="42" ry="14" fill={p.warm} fillOpacity="0.25" />

      {/* Layer 2: Wooden table surface, kraft sugar packet & single coffee bean */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Table plank lines */}
        <path d="M18 68 L118 68" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.35" />
        <path
          d="M26 76 C54 78 82 78 110 76"
          stroke={p.ink}
          strokeWidth="0.85"
          strokeOpacity="0.3"
          strokeDasharray="3 3.5"
        />

        {/* Small kraft sugar packet resting on left */}
        <path
          d="M24 62 L42 58 L46 66 L28 70 Z"
          fill={p.paper}
        />
        <path
          d="M24 62 L42 58 L46 66 L28 70 Z"
          fill={p.warm}
          fillOpacity="0.52"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        <path d="M31 64 L39 62.2" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.5" />

        {/* Single roasted coffee bean near saucer */}
        <ellipse
          cx="39"
          cy="72"
          rx="3.8"
          ry="2.5"
          transform="rotate(-18 39 72)"
          fill={p.paper}
        />
        <ellipse
          cx="39"
          cy="72"
          rx="3.8"
          ry="2.5"
          transform="rotate(-18 39 72)"
          fill={p.brand}
          fillOpacity="0.58"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path d="M36 73 C38 71.5 39.8 72.5 41.8 71" stroke={p.ink} strokeWidth="0.85" />
      </g>

      {/* Layer 3: Empty Ceramic Coffee Cup & Diagonally Leaning Brass Spoon */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Ceramic saucer (100% opaque p.paper base) */}
        <ellipse cx="68" cy="66" rx="26" ry="7.5" fill={p.paper} stroke={p.ink} strokeWidth="1.3" />
        <ellipse cx="68" cy="66" rx="18" ry="4.6" fill={p.warm} fillOpacity="0.42" />

        {/* Cup handle on left */}
        <path
          d="M49 45 C41 45 41 57 50 58.5"
          stroke={p.ink}
          strokeWidth="2.8"
        />
        <path
          d="M49 45 C41 45 41 57 50 58.5"
          stroke={p.paper}
          strokeWidth="1.2"
        />

        {/* Empty ceramic coffee cup body (100% opaque p.paper base) */}
        <path
          d="M48 40 L88 40 L85 58.5 C83 63.5 76.5 66 68 66 C59.5 66 53 63.5 51 58.5 Z"
          fill={p.paper}
        />
        {/* Subtle warm ceramic glaze band */}
        <path
          d="M49.5 50 C61 52.8 75 52.8 86.5 50 L85 58.5 C83 63.5 76.5 66 68 66 C59.5 66 53 63.5 51 58.5 Z"
          fill={p.brand}
          fillOpacity="0.34"
        />
        <path
          d="M48 40 L88 40 L85 58.5 C83 63.5 76.5 66 68 66 C59.5 66 53 63.5 51 58.5 Z"
          stroke={p.ink}
          strokeWidth="1.35"
        />

        {/* Open empty cup interior & subtle espresso ring at bottom */}
        <ellipse cx="68" cy="40" rx="20" ry="6" fill={p.paper} stroke={p.ink} strokeWidth="1.3" />
        <ellipse cx="68" cy="40.5" rx="17.5" ry="4.5" fill={p.warm} fillOpacity="0.32" />
        {/* Tiny remaining coffee ring trace at inner bottom */}
        <path
          d="M60 42.8 C64 41.5 72 41.5 76 42.8"
          stroke={p.brand}
          strokeWidth="1.2"
          strokeOpacity="0.55"
        />

        {/* Vintage brass coffee spoon leaning diagonally against the empty cup rim */}
        {/* Spoon bowl resting inside right side of cup rim */}
        <ellipse
          cx="73"
          cy="42"
          rx="5.2"
          ry="2.5"
          transform="rotate(-32 73 42)"
          fill={p.paper}
        />
        <ellipse
          cx="73"
          cy="42"
          rx="5.2"
          ry="2.5"
          transform="rotate(-32 73 42)"
          fill={p.gold}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        {/* Spoon handle extending up-right past the rim */}
        <path
          d="M76 40.5 L98 26.5 C99.8 25.5 101.2 27.5 99.5 28.8 L77.5 42.2 Z"
          fill={p.paper}
        />
        <path
          d="M76 40.5 L98 26.5 C99.8 25.5 101.2 27.5 99.5 28.8 L77.5 42.2 Z"
          fill={p.gold}
          fillOpacity="0.72"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        {/* Front clip of cup rim overlapping the spoon slightly for depth */}
        <path
          d="M68 46 C75 46 81.5 44.8 85.2 43"
          stroke={p.ink}
          strokeWidth="1.3"
        />
      </g>

      {/* Layer 4: Sunbeam dust motes & quiet sparkles */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M52 20 L52.8 22.4 L55.2 23.2 L52.8 24 L52 26.4 L51.2 24 L48.8 23.2 L51.2 22.4 Z"
          fill={p.gold}
          fillOpacity="0.8"
        />
        <path
          d="M104 42 L104.7 43.8 L106.5 44.5 L104.7 45.2 L104 47 L103.3 45.2 L101.5 44.5 L103.3 43.8 Z"
          fill={p.gold}
          fillOpacity="0.75"
        />
        <circle cx="64" cy="27" r="1.3" fill={p.gold} fillOpacity="0.65" />
        <circle cx="84" cy="22" r="1.2" fill={p.brand} fillOpacity="0.5" />
        <circle cx="30" cy="44" r="1.2" fill={p.gold} fillOpacity="0.55" />
        <circle cx="98" cy="68" r="1.3" fill={p.rose} fillOpacity="0.45" />
      </g>
    </svg>
  ),
};
