import React from 'react';
import type { IllustrationPalette, ThemeIllustrationPack } from './types';

export const botanicalPack: ThemeIllustrationPack = {
  greeting: (p: IllustrationPalette) => (
    <svg viewBox="0 0 112 44" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Ambient watercolor wash */}
      <ellipse cx="56" cy="23" rx="46" ry="15" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="36" cy="21" r="13" fill={p.leaf} fillOpacity="0.14" />
      <circle cx="76" cy="23" r="12" fill={p.gold} fillOpacity="0.13" />

      {/* Layer 2: Background secondary twigs & berries */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M14 27 C34 17 58 29 96 18"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.45"
          strokeDasharray="2 2.5"
        />
        {/* Small background leaves */}
        <path
          d="M28 21 C24 16 19 15 15 17 C17 21 22 23 28 21 Z"
          fill={p.leaf}
          fillOpacity="0.26"
          stroke={p.ink}
          strokeWidth="0.95"
        />
        <path
          d="M83 25 C87 29 93 29 97 26 C94 22 89 22 83 25 Z"
          fill={p.leaf}
          fillOpacity="0.26"
          stroke={p.ink}
          strokeWidth="0.95"
        />
        {/* Tiny coral berries */}
        <circle cx="45" cy="12" r="2.1" fill={p.rose} fillOpacity="0.6" stroke={p.ink} strokeWidth="0.9" />
        <circle cx="50" cy="14" r="1.7" fill={p.gold} fillOpacity="0.65" stroke={p.ink} strokeWidth="0.85" />
        <path d="M47 19 L45.5 14" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.6" />
        <path d="M48 19 L49.5 15.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.6" />
      </g>

      {/* Layer 3: Foreground eucalyptus vine & botanical washi label */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Main graceful vine stem */}
        <path
          d="M12 29 C30 26 44 18 62 22 C76 25 88 22 100 15"
          stroke={p.ink}
          strokeWidth="1.3"
        />

        {/* Round eucalyptus leaf 1 (left lower) */}
        <path
          d="M21 28 C18 33 21 38 26.5 37.5 C32 37 34 31 29.5 27.5 C26.5 25.5 23 26 21 28 Z"
          fill={p.paper}
        />
        <path
          d="M21 28 C18 33 21 38 26.5 37.5 C32 37 34 31 29.5 27.5 C26.5 25.5 23 26 21 28 Z"
          fill={p.leaf}
          fillOpacity="0.45"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path d="M23 34 C25 32 27 29.5 28 27.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />

        {/* Round eucalyptus leaf 2 (center-left upper) */}
        <path
          d="M33 22 C30 16.5 33.5 11 39 11.5 C44.5 12 46 18 41.5 21.5 C38.5 23.5 35 23.5 33 22 Z"
          fill={p.paper}
        />
        <path
          d="M33 22 C30 16.5 33.5 11 39 11.5 C44.5 12 46 18 41.5 21.5 C38.5 23.5 35 23.5 33 22 Z"
          fill={p.brand}
          fillOpacity="0.38"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path d="M38.5 14.5 C38 17 37 19.5 35.5 21.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />

        {/* Round eucalyptus leaf 3 (center lower) */}
        <path
          d="M44 22.5 C42.5 28 46.5 33 52 31.5 C57 30 57.5 24 52.5 21 C49.5 19.2 45.5 20.2 44 22.5 Z"
          fill={p.paper}
        />
        <path
          d="M44 22.5 C42.5 28 46.5 33 52 31.5 C57 30 57.5 24 52.5 21 C49.5 19.2 45.5 20.2 44 22.5 Z"
          fill={p.leaf}
          fillOpacity="0.5"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path d="M51.5 28 C50 26 48.5 23.8 47.5 21.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />

        {/* Botanical specimen label & washi tape on right */}
        <path
          d="M58 15 L84 12.5 L86 28.5 L60 31 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path
          d="M60.5 17.2 L81.8 15.2 L83.3 26.2 L62 28.2 Z"
          fill={p.warm}
          fillOpacity="0.32"
          stroke={p.ink}
          strokeWidth="0.8"
          strokeOpacity="0.45"
        />
        {/* Washi tape strip holding the label */}
        <path
          d="M54 18 L63 11.5 L66 15 L57 21.5 Z"
          fill={p.gold}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="0.95"
        />
        {/* Pressed mini leaf & lines on specimen label */}
        <path
          d="M65 24.5 C64.5 21 67 18.5 70.5 18.8 C70.8 22 68.5 24.5 65 24.5 Z"
          fill={p.leaf}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="0.9"
        />
        <path d="M73.5 19.5 L80 18.8" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />
        <path d="M74 22.5 L79 22" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />

        {/* Tender terminal leaf bud on far right */}
        <path
          d="M88 19 C89 14 94 11 99 12.5 C97.5 17.5 93 20 88 19 Z"
          fill={p.paper}
        />
        <path
          d="M88 19 C89 14 94 11 99 12.5 C97.5 17.5 93 20 88 19 Z"
          fill={p.leaf}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.15"
        />
      </g>

      {/* Layer 4: Dew drops & sparkles */}
      <path
        d="M72 7 L72.7 9.2 L75 10 L72.7 10.8 L72 13 L71.3 10.8 L69 10 L71.3 9.2 Z"
        fill={p.gold}
        fillOpacity="0.8"
      />
      <circle cx="18" cy="12" r="1.3" fill={p.leaf} fillOpacity="0.55" />
      <circle cx="66" cy="36" r="1.4" fill={p.gold} fillOpacity="0.65" />
      <circle cx="96" cy="31" r="1.2" fill={p.rose} fillOpacity="0.5" />
    </svg>
  ),

  cornerLeft: (p: IllustrationPalette) => (
    <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Bottom-left organic aura */}
      <path d="M0 96 L0 26 C28 30 54 54 70 96 Z" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="26" cy="70" r="24" fill={p.leaf} fillOpacity="0.14" />
      <circle cx="44" cy="82" r="15" fill={p.gold} fillOpacity="0.12" />

      {/* Layer 2: Background fern frond, fiddlehead & berry twig */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Tall slender eucalyptus/willow stem in back */}
        <path d="M8 92 C10 68 16 44 26 22" stroke={p.ink} strokeWidth="1.1" strokeOpacity="0.7" />
        <path
          d="M12 58 C6 54 4 47 7 41 C12 44 14 51 12 58 Z"
          fill={p.leaf}
          fillOpacity="0.3"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <path
          d="M17 44 C12 39 11 32 14 27 C19 30 20 37 17 44 Z"
          fill={p.leaf}
          fillOpacity="0.3"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <path
          d="M22 33 C25 27 25 20 22 15 C18 19 18 27 22 33 Z"
          fill={p.leaf}
          fillOpacity="0.34"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <path
          d="M18 50 C23 46 29 46 33 50 C28 54 22 54 18 50 Z"
          fill={p.leaf}
          fillOpacity="0.28"
          stroke={p.ink}
          strokeWidth="1.0"
        />

        {/* Curled fern fiddlehead */}
        <path
          d="M22 88 C32 76 44 68 54 66 C59 65 62 69 59 73 C56 76 51 73 53 69"
          stroke={p.ink}
          strokeWidth="1.15"
          strokeOpacity="0.75"
        />

        {/* Wild berry sprig extending right */}
        <path d="M28 92 C42 86 54 84 66 86" stroke={p.ink} strokeWidth="1.1" />
        <circle cx="58" cy="81" r="2.4" fill={p.rose} fillOpacity="0.62" stroke={p.ink} strokeWidth="0.95" />
        <circle cx="64" cy="89" r="2.1" fill={p.gold} fillOpacity="0.68" stroke={p.ink} strokeWidth="0.95" />
        <circle cx="69" cy="84" r="2.3" fill={p.rose} fillOpacity="0.58" stroke={p.ink} strokeWidth="0.95" />
      </g>

      {/* Layer 3: Foreground Monstera leaf, silver-dollar eucalyptus & paper tag */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Main Monstera leaf growing from bottom-left */}
        <path d="M4 96 C12 82 20 70 30 58" stroke={p.ink} strokeWidth="1.35" />

        {/* Monstera leaf blade (opaque p.paper base + rich emerald/leaf fill) */}
        <path
          d="M10 82 C4 72 6 58 14 50 C19 55 21 60 18 63 C22 59 26 53 23 45 C30 42 39 43 45 48 C48 54 44 61 37 64 C43 63 49 66 48 73 C46 82 35 89 23 89 C16 89 12 86 10 82 Z"
          fill={p.paper}
        />
        <path
          d="M10 82 C4 72 6 58 14 50 C19 55 21 60 18 63 C22 59 26 53 23 45 C30 42 39 43 45 48 C48 54 44 61 37 64 C43 63 49 66 48 73 C46 82 35 89 23 89 C16 89 12 86 10 82 Z"
          fill={p.brand}
          fillOpacity="0.38"
        />
        {/* Monstera half-side highlight */}
        <path
          d="M16 80 C24 71 32 60 41 49 C45 53 43 60 37 64 C43 63 49 66 48 73 C46 82 35 89 23 89 C19 89 16.5 85 16 80 Z"
          fill={p.leaf}
          fillOpacity="0.32"
        />
        {/* Monstera outer outline */}
        <path
          d="M10 82 C4 72 6 58 14 50 C19 55 21 60 18 63 C22 59 26 53 23 45 C30 42 39 43 45 48 C48 54 44 61 37 64 C43 63 49 66 48 73 C46 82 35 89 23 89 C16 89 12 86 10 82 Z"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        {/* Monstera interior fenestration hole & veins */}
        <ellipse
          cx="32"
          cy="55"
          rx="3.2"
          ry="1.8"
          transform="rotate(-32 32 55)"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="0.95"
        />
        <path d="M16 83 C24 72 32 61 41 49" stroke={p.ink} strokeWidth="1.15" />
        <path d="M22 75 L12 70" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.6" />
        <path d="M28 67 L17 61" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.6" />
        <path d="M24 73 L37 74" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.6" />
        <path d="M31 64 L42 66" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.6" />

        {/* Silver-dollar eucalyptus branch on lower left */}
        <circle cx="14" cy="90" r="7.5" fill={p.paper} />
        <circle cx="14" cy="90" r="7.5" fill={p.leaf} fillOpacity="0.48" stroke={p.ink} strokeWidth="1.2" />
        <path d="M10 93 L17 87" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />

        <circle cx="38" cy="88" r="6.8" fill={p.paper} />
        <circle cx="38" cy="88" r="6.8" fill={p.gold} fillOpacity="0.35" stroke={p.ink} strokeWidth="1.2" />
        <path d="M34 90 L41 86" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />

        {/* Small taped botanical note at bottom corner */}
        <path
          d="M2 84 L19 81 L21 94 L4 96 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.1"
        />
        <path
          d="M15 78 L23 82 L21 85.5 L13 81.5 Z"
          fill={p.gold}
          fillOpacity="0.58"
          stroke={p.ink}
          strokeWidth="0.85"
        />
        <path d="M6 88 L15 86.5" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.5" />
        <path d="M7 91.5 L14 90.5" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.5" />
      </g>

      {/* Layer 4: Floating spores, dew drops & four-point stars */}
      <path
        d="M38 25 L39 27.8 L41.8 28.8 L39 29.8 L38 32.6 L37 29.8 L34.2 28.8 L37 27.8 Z"
        fill={p.gold}
        fillOpacity="0.82"
      />
      <path
        d="M54 50 C54 47.5 56 45 56 45 C56 45 58 47.5 58 50 C58 51.5 57.1 52.5 56 52.5 C54.9 52.5 54 51.5 54 50 Z"
        fill={p.brandSoft}
        fillOpacity="0.85"
        stroke={p.ink}
        strokeWidth="0.95"
      />
      <circle cx="47" cy="37" r="1.4" fill={p.leaf} fillOpacity="0.55" />
      <circle cx="33" cy="16" r="1.2" fill={p.gold} fillOpacity="0.6" />
      <circle cx="66" cy="72" r="1.3" fill={p.rose} fillOpacity="0.48" />
    </svg>
  ),

  cornerRight: (p: IllustrationPalette) => (
    <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Bottom-right ambient aura */}
      <path d="M96 96 L96 28 C68 32 44 54 26 96 Z" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="70" cy="70" r="24" fill={p.gold} fillOpacity="0.15" />
      <circle cx="50" cy="80" r="15" fill={p.leaf} fillOpacity="0.13" />

      {/* Layer 2: Background botanical sprigs & trailing ribbon */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Leaves behind watering can */}
        <path
          d="M84 58 C89 50 91 41 88 34 C82 38 80 48 84 58 Z"
          fill={p.leaf}
          fillOpacity="0.36"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M77 56 C78 47 75 39 70 35 C67 41 70 50 77 56 Z"
          fill={p.leaf}
          fillOpacity="0.28"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <path d="M86 38 C85 44 85 50 84 56" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.55" />

        {/* Small sprig at bottom-left of watering can */}
        <path
          d="M52 88 C43 87 35 82 31 75 C39 74 47 79 52 88 Z"
          fill={p.leaf}
          fillOpacity="0.4"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M48 91 C40 93 32 91 27 86 C34 83 42 85 48 91 Z"
          fill={p.brand}
          fillOpacity="0.32"
          stroke={p.ink}
          strokeWidth="1.0"
        />
      </g>

      {/* Layer 3: Vintage long-spout brass watering can */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Curved handle on top/right */}
        <path
          d="M74 58 C78 47 91 49 91 61 C91 68 86 73 82 74"
          stroke={p.ink}
          strokeWidth="2.8"
        />
        <path
          d="M74 58 C78 47 91 49 91 61 C91 68 86 73 82 74"
          stroke={p.gold}
          strokeWidth="1.3"
        />

        {/* Long slender spout extending from lower body up-left */}
        <path
          d="M57 77 L34 45 L36.5 43 L60 71 Z"
          fill={p.paper}
        />
        <path
          d="M57 77 L34 45 L36.5 43 L60 71 Z"
          fill={p.gold}
          fillOpacity="0.52"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        {/* Cross brace bar between spout and body */}
        <path d="M47 59 L60 63" stroke={p.ink} strokeWidth="1.2" />
        <circle cx="47" cy="59" r="1.4" fill={p.gold} stroke={p.ink} strokeWidth="0.9" />

        {/* Spout rose (sprinkler head) */}
        <path
          d="M34 45 L28 43 L32.5 36.5 L36.5 43 Z"
          fill={p.paper}
        />
        <path
          d="M34 45 L28 43 L32.5 36.5 L36.5 43 Z"
          fill={p.gold}
          fillOpacity="0.68"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <ellipse
          cx="30.2"
          cy="39.8"
          rx="4.2"
          ry="1.8"
          transform="rotate(-54 30.2 39.8)"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <ellipse
          cx="30.2"
          cy="39.8"
          rx="4.2"
          ry="1.8"
          transform="rotate(-54 30.2 39.8)"
          fill={p.warm}
          fillOpacity="0.55"
        />

        {/* Watering can main body (opaque p.paper base + warm brass gold overlay) */}
        <path
          d="M58 60 L82 63 L85 88 C75 92 61 90 52 84 Z"
          fill={p.paper}
        />
        <path
          d="M58 60 L82 63 L85 88 C75 92 61 90 52 84 Z"
          fill={p.gold}
          fillOpacity="0.42"
          stroke={p.ink}
          strokeWidth="1.35"
        />
        {/* Highlight & shadow bands on brass can */}
        <path
          d="M62 61 L68 61.8 L64 88.5 L58 86.8 Z"
          fill={p.paper}
          fillOpacity="0.45"
        />
        <path
          d="M54.5 75 C64 78.5 74 79.5 83.5 78"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.5"
        />
        <path
          d="M53.5 78.5 C63.5 82 74 83 84 81.5"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.5"
        />

        {/* Can top rim & half-hooded brass shield */}
        <ellipse
          cx="70"
          cy="61.5"
          rx="12.2"
          ry="3.8"
          transform="rotate(7 70 61.5)"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.25"
        />
        <path
          d="M58 60 C63 56.5 71 57 74 61.5 C68 63 62 62.5 58 60 Z"
          fill={p.gold}
          fillOpacity="0.62"
          stroke={p.ink}
          strokeWidth="1.15"
        />

        {/* Cute botanical tag tied to handle */}
        <path
          d="M82 64 L92 67 L89 77 L79 74 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.1"
        />
        <circle cx="83" cy="67" r="1.0" fill={p.ink} />
        <path
          d="M84 73 C84 70 86.5 68.5 88.5 69.5 C88 72 86 73.5 84 73 Z"
          fill={p.leaf}
          fillOpacity="0.6"
        />
      </g>

      {/* Layer 4: Water droplets, floating tender buds & sparkles */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Water droplets from spout */}
        <path
          d="M22 35 C22 32.5 24 30 24 30 C24 30 26 32.5 26 35 C26 36.2 25.1 37.2 24 37.2 C22.9 37.2 22 36.2 22 35 Z"
          fill={p.brandSoft}
          fillOpacity="0.9"
          stroke={p.ink}
          strokeWidth="0.95"
        />
        <path
          d="M16 44 C16 42 17.6 40 17.6 40 C17.6 40 19.2 42 19.2 44 C19.2 45 18.5 45.8 17.6 45.8 C16.7 45.8 16 45 16 44 Z"
          fill={p.brandSoft}
          fillOpacity="0.9"
          stroke={p.ink}
          strokeWidth="0.9"
        />

        {/* Floating tender leaf bud */}
        <path
          d="M24 23 C20 21 18 16 20 12 C24.5 13.5 26.5 18.5 24 23 Z"
          fill={p.paper}
        />
        <path
          d="M24 23 C20 21 18 16 20 12 C24.5 13.5 26.5 18.5 24 23 Z"
          fill={p.leaf}
          fillOpacity="0.52"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path d="M21 15 L23.5 21.5" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.55" />

        {/* Sparkle star & micro dots */}
        <path
          d="M44 24 L44.9 26.5 L47.5 27.4 L44.9 28.3 L44 30.8 L43.1 28.3 L40.5 27.4 L43.1 26.5 Z"
          fill={p.gold}
          fillOpacity="0.82"
        />
        <circle cx="34" cy="20" r="1.3" fill={p.gold} fillOpacity="0.65" />
        <circle cx="23" cy="56" r="1.3" fill={p.leaf} fillOpacity="0.55" />
        <circle cx="56" cy="40" r="1.1" fill={p.rose} fillOpacity="0.48" />
      </g>
    </svg>
  ),

  celebration: (p: IllustrationPalette) => (
    <svg viewBox="0 0 210 132" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Ambient watercolor wash & botanical arch */}
      <ellipse cx="105" cy="72" rx="86" ry="46" fill={p.brandSoft} fillOpacity="0.24" />
      <ellipse cx="72" cy="64" rx="48" ry="34" fill={p.leaf} fillOpacity="0.14" />
      <ellipse cx="144" cy="74" rx="44" ry="30" fill={p.gold} fillOpacity="0.13" />

      {/* Delicate dashed botanical dome frame */}
      <path
        d="M32 56 C62 14 148 14 178 56"
        stroke={p.ink}
        strokeWidth="0.95"
        strokeOpacity="0.25"
        strokeDasharray="2.5 3.5"
        strokeLinecap="round"
      />

      {/* Linen desk mat oval at bottom */}
      <ellipse cx="105" cy="96" rx="86" ry="23" fill={p.warm} fillOpacity="0.24" />
      <ellipse
        cx="105"
        cy="96"
        rx="80"
        ry="19"
        stroke={p.ink}
        strokeWidth="0.85"
        strokeOpacity="0.28"
        strokeDasharray="3 3.5"
      />

      {/* Layer 2: Mid-ground botanical branches, berries, fern & vintage magnifying glass */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Upper-left overarching eucalyptus & berry branch */}
        <path d="M54 48 C40 40 28 30 20 18" stroke={p.ink} strokeWidth="1.15" />
        <path
          d="M38 38 C30 40 22 37 18 31 C24 27 32 30 38 38 Z"
          fill={p.leaf}
          fillOpacity="0.4"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M30 29 C28 21 31 14 37 11 C40 17 37 24 30 29 Z"
          fill={p.leaf}
          fillOpacity="0.32"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M47 43 C44 35 46 28 52 24 C55 30 52 38 47 43 Z"
          fill={p.brand}
          fillOpacity="0.3"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <circle cx="20" cy="18" r="2.5" fill={p.rose} fillOpacity="0.6" stroke={p.ink} strokeWidth="0.95" />
        <circle cx="26" cy="14" r="2.0" fill={p.gold} fillOpacity="0.68" stroke={p.ink} strokeWidth="0.95" />

        {/* Upper-right fern & dried flower sprig */}
        <path d="M136 46 C148 36 162 28 176 22" stroke={p.ink} strokeWidth="1.15" />
        <path
          d="M148 37 C146 29 149 22 155 19 C158 25 155 32 148 37 Z"
          fill={p.leaf}
          fillOpacity="0.36"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M158 31 C164 33 171 31 175 26 C170 22 163 24 158 31 Z"
          fill={p.leaf}
          fillOpacity="0.32"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <circle cx="177" cy="21" r="2.6" fill={p.gold} fillOpacity="0.65" stroke={p.ink} strokeWidth="0.95" />
        <circle cx="169" cy="17" r="2.1" fill={p.rose} fillOpacity="0.58" stroke={p.ink} strokeWidth="0.95" />

        {/* Vintage brass magnifying glass on bottom-left */}
        <path
          d="M27 98 L16 108 L19 111 L30 101 Z"
          fill={p.gold}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <circle cx="35" cy="91" r="9.5" fill={p.paper} />
        <circle cx="35" cy="91" r="9.5" fill={p.brandSoft} fillOpacity="0.45" stroke={p.ink} strokeWidth="1.25" />
        <circle cx="35" cy="91" r="7.2" stroke={p.gold} strokeWidth="1.2" />
        <path d="M31 87.5 L35 85.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.5" />
        <path d="M32 90.5 L37 88" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.45" />
      </g>

      {/* Layer 3: Foreground Open Botanical Specimen Journal + Terracotta Potted Plant */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Open Botanical Journal */}
        {/* Emerald hardcover jacket */}
        <path
          d="M36 94 L46 47 C62 43 78 44 94 49 C110 44 126 43 142 47 L152 94 C133 89 113 90 94 96 C75 90 55 89 36 94 Z"
          fill={p.brand}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.35"
        />
        {/* Brass corner protectors on cover */}
        <path d="M46 47 L52 46 L45 53 Z" fill={p.gold} stroke={p.ink} strokeWidth="0.95" />
        <path d="M36 94 L43 92.5 L37.5 87 Z" fill={p.gold} stroke={p.ink} strokeWidth="0.95" />

        {/* Thick paper page block & open white pages (100% opaque p.paper) */}
        <path
          d="M40 90 L49 44 C64 40.5 79 41.5 94 46.5 C109 41.5 124 40.5 139 44 L148 90 C130 85.5 112 86.5 94 92.5 C76 86.5 58 85.5 40 90 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.3"
        />
        {/* Bottom page thickness edge */}
        <path
          d="M40 90 C58 85.5 76 86.5 94 92.5 C112 86.5 130 85.5 148 90 L149.5 93.5 C131 89 112.5 90 94 96 C75.5 90 57 89 38.5 93.5 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.15"
        />

        {/* Center spine shadow & stitch line */}
        <path
          d="M91 45.5 L94 46.5 L97 45.5 L97 91.5 L94 92.5 L91 91.5 Z"
          fill={p.warm}
          fillOpacity="0.38"
        />
        <path d="M94 46.5 L94 92.5" stroke={p.ink} strokeWidth="1.2" />

        {/* LEFT PAGE: Pressed Eucalyptus & Berry Specimen with Washi Tape */}
        {/* Soft specimen backing paper */}
        <path
          d="M50 51 L86 52.5 L81 83 L44 81.5 Z"
          fill={p.warm}
          fillOpacity="0.28"
          stroke={p.ink}
          strokeWidth="0.85"
          strokeOpacity="0.45"
        />
        {/* Pressed stem */}
        <path d="M54 79 C60 70 66 61 74 54" stroke={p.ink} strokeWidth="1.15" />
        {/* Pressed leaves */}
        <path
          d="M60 71 C53 69 50 63 53 58 C59 59 62 65 60 71 Z"
          fill={p.leaf}
          fillOpacity="0.52"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path d="M54.5 60.5 L59 69" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.55" />
        <path
          d="M66 63 C61 59 60 53 64 49 C69 51 70 57 66 63 Z"
          fill={p.brand}
          fillOpacity="0.42"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M62 72 C68 74 75 72 78 67 C73 64 66 66 62 72 Z"
          fill={p.leaf}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <circle cx="75" cy="54" r="2.2" fill={p.rose} fillOpacity="0.65" stroke={p.ink} strokeWidth="0.9" />
        <circle cx="79" cy="58" r="1.8" fill={p.gold} fillOpacity="0.7" stroke={p.ink} strokeWidth="0.9" />

        {/* Two strips of gold/coral washi tape holding the specimen */}
        <path
          d="M52 72 L63 77 L61 80.5 L50 75.5 Z"
          fill={p.gold}
          fillOpacity="0.62"
          stroke={p.ink}
          strokeWidth="0.95"
        />
        <path
          d="M67 49 L77 52 L75.5 55.2 L65.5 52.2 Z"
          fill={p.rose}
          fillOpacity="0.52"
          stroke={p.ink}
          strokeWidth="0.9"
        />

        {/* RIGHT PAGE: Transparent Specimen Pouch Card & Field Notes */}
        {/* Specimen pouch frame */}
        <path
          d="M103 49 L132 48 L134 69 L104 70 Z"
          fill={p.brandSoft}
          fillOpacity="0.36"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        {/* Washi tape on top of specimen pouch */}
        <path
          d="M113 46.5 L123 46.2 L123.2 49.8 L113.2 50.1 Z"
          fill={p.gold}
          fillOpacity="0.6"
          stroke={p.ink}
          strokeWidth="0.9"
        />
        {/* Pressed Monstera leaf inside right page pouch */}
        <path
          d="M112 65 C109 60 111 54 117 52 C123 51 127 56 125 62 C123 66 116 67 112 65 Z"
          fill={p.leaf}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <path d="M114 64 L121 54" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.6" />
        <path d="M117 60 L113 58" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.55" />
        <path d="M118 59 L123 60" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.55" />

        {/* Field study notes lines on lower right page */}
        <rect x="104" y="73.5" width="14" height="3" rx="1" fill={p.gold} fillOpacity="0.45" />
        <path d="M104 79.5 L134 78.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.5" />
        <path d="M104 83.5 L129 82.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.5" />

        {/* Hanging botanical bookmark ribbon with leaf charm */}
        <path
          d="M94 92.5 C95 100 99 105 103 111 L107 108.5 L110 111.5 C106 104.5 100 99 96 92 Z"
          fill={p.leaf}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M105 108 C108 107 111 109.5 110 113 C107 113.5 104.5 111 105 108 Z"
          fill={p.gold}
          stroke={p.ink}
          strokeWidth="0.95"
        />

        {/* Foreground Right: Terracotta Potted Plant / Lush Monstera & Pilea */}
        {/* Potted plant leaves emerging from pot */}
        {/* Left arching leaf */}
        <path
          d="M156 76 C146 71 141 61 144 52 C153 54 159 64 156 76 Z"
          fill={p.paper}
        />
        <path
          d="M156 76 C146 71 141 61 144 52 C153 54 159 64 156 76 Z"
          fill={p.leaf}
          fillOpacity="0.5"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path d="M146 56 C150 62 153 68 155 74" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.6" />

        {/* Center tall Monstera leaf */}
        <path
          d="M163 76 C156 65 157 50 166 43 C175 49 176 64 168 75 Z"
          fill={p.paper}
        />
        <path
          d="M163 76 C156 65 157 50 166 43 C175 49 176 64 168 75 Z"
          fill={p.brand}
          fillOpacity="0.44"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        <path d="M166 46 L165.5 75" stroke={p.ink} strokeWidth="1.0" strokeOpacity="0.65" />
        <path d="M165.8 55 L160 51" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />
        <path d="M165.8 62 L159 58" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />
        <path d="M165.8 58 L172 54" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />
        <path d="M165.8 65 L172 61" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />

        {/* Right round Pilea / Eucalyptus leaf */}
        <path
          d="M170 76 C176 66 186 62 192 67 C191 75 181 80 170 76 Z"
          fill={p.paper}
        />
        <path
          d="M170 76 C176 66 186 62 192 67 C191 75 181 80 170 76 Z"
          fill={p.leaf}
          fillOpacity="0.46"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path d="M172 75 L188 68" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.6" />

        {/* Terracotta pot saucer */}
        <ellipse cx="165" cy="102.5" rx="16.5" ry="4.5" fill={p.paper} stroke={p.ink} strokeWidth="1.2" />
        <ellipse cx="165" cy="102.5" rx="13" ry="2.8" fill={p.rose} fillOpacity="0.35" />

        {/* Terracotta pot body (opaque p.paper + warm rose/gold terracotta tint) */}
        <path
          d="M151 79 L179 79 L175 101 C170 103 160 103 155 101 Z"
          fill={p.paper}
        />
        <path
          d="M151 79 L179 79 L175 101 C170 103 160 103 155 101 Z"
          fill={p.rose}
          fillOpacity="0.38"
        />
        <path
          d="M151 79 L179 79 L175 101 C170 103 160 103 155 101 Z"
          fill={p.gold}
          fillOpacity="0.22"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        {/* Terracotta pot collar rim */}
        <rect x="149" y="74.5" width="32" height="5.5" rx="2" fill={p.paper} />
        <rect
          x="149"
          y="74.5"
          width="32"
          height="5.5"
          rx="2"
          fill={p.rose}
          fillOpacity="0.45"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        {/* Decorative botanical wave on pot */}
        <path
          d="M154 89 Q159.5 86 165 89 Q170.5 92 176 89"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.5"
        />
      </g>

      {/* Layer 4: Drifting tender leaves, morning dew drops & four-point stars */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Drifting tender leaves */}
        <path
          d="M86 22 C82 19 81 14 85 12 C89 14 90 19 86 22 Z"
          fill={p.leaf}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="0.95"
        />
        <path
          d="M122 25 C126 22 130 23 130 27 C127 30 123 29 122 25 Z"
          fill={p.leaf}
          fillOpacity="0.52"
          stroke={p.ink}
          strokeWidth="0.95"
        />
        <path
          d="M58 106 C54 104 52 107 55 110 C58 112 61 109 58 106 Z"
          fill={p.leaf}
          fillOpacity="0.5"
          stroke={p.ink}
          strokeWidth="0.9"
        />

        {/* Dew drops */}
        <path
          d="M104 16 C104 13.5 106 11 106 11 C106 11 108 13.5 108 16 C108 17.2 107.1 18.2 106 18.2 C104.9 18.2 104 17.2 104 16 Z"
          fill={p.brandSoft}
          fillOpacity="0.9"
          stroke={p.ink}
          strokeWidth="0.95"
        />
        <path
          d="M186 48 C186 46 187.6 44 187.6 44 C187.6 44 189.2 46 189.2 48 C189.2 49 188.5 49.8 187.6 49.8 C186.7 49.8 186 49 186 48 Z"
          fill={p.brandSoft}
          fillOpacity="0.85"
          stroke={p.ink}
          strokeWidth="0.9"
        />

        {/* Four-point sparkles */}
        <path
          d="M66 19 L67.1 22.2 L70.4 23.3 L67.1 24.4 L66 27.6 L64.9 24.4 L61.6 23.3 L64.9 22.2 Z"
          fill={p.gold}
          fillOpacity="0.85"
        />
        <path
          d="M140 15 L141.1 18.2 L144.4 19.3 L141.1 20.4 L140 23.6 L138.9 20.4 L135.6 19.3 L138.9 18.2 Z"
          fill={p.gold}
          fillOpacity="0.85"
        />
        <path
          d="M22 66 L22.8 68.5 L25.4 69.3 L22.8 70.1 L22 72.6 L21.2 70.1 L18.6 69.3 L21.2 68.5 Z"
          fill={p.gold}
          fillOpacity="0.75"
        />

        {/* Micro dust dots */}
        <circle cx="96" cy="28" r="1.3" fill={p.gold} fillOpacity="0.65" />
        <circle cx="158" cy="36" r="1.3" fill={p.leaf} fillOpacity="0.55" />
        <circle cx="76" cy="109" r="1.3" fill={p.gold} fillOpacity="0.6" />
        <circle cx="132" cy="107" r="1.2" fill={p.rose} fillOpacity="0.5" />
      </g>
    </svg>
  ),

  empty: (p: IllustrationPalette) => (
    <svg viewBox="0 0 136 90" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Quiet ambient aura */}
      <ellipse cx="68" cy="54" rx="50" ry="26" fill={p.brandSoft} fillOpacity="0.22" />
      <ellipse cx="68" cy="68" rx="40" ry="12" fill={p.warm} fillOpacity="0.26" />
      <circle cx="62" cy="40" r="18" fill={p.leaf} fillOpacity="0.12" />

      {/* Layer 2: Desk coaster, fallen leaf & specimen label card */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Woven coaster line under vase */}
        <ellipse
          cx="66"
          cy="71"
          rx="32"
          ry="7.5"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <ellipse
          cx="66"
          cy="71"
          rx="27"
          ry="5.2"
          fill={p.warm}
          fillOpacity="0.35"
          stroke={p.ink}
          strokeWidth="0.8"
          strokeOpacity="0.4"
          strokeDasharray="2.5 3"
        />

        {/* Small botanical specimen card resting on left */}
        <path
          d="M26 67 L46 64 L49 74 L29 77 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.1"
        />
        <path
          d="M23 69 L30 65.5 L31.5 68.2 L24.5 71.7 Z"
          fill={p.gold}
          fillOpacity="0.58"
          stroke={p.ink}
          strokeWidth="0.85"
        />
        <path d="M33 69.5 L43 68" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.5" />
        <path d="M34 72.5 L41 71.5" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.5" />

        {/* Single fallen leaf on right side of coaster */}
        <path
          d="M84 72 C88 68 95 68 99 72 C94 76 88 76 84 72 Z"
          fill={p.paper}
        />
        <path
          d="M84 72 C88 68 95 68 99 72 C94 76 88 76 84 72 Z"
          fill={p.leaf}
          fillOpacity="0.45"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path d="M82 72.5 L96 72" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />
      </g>

      {/* Layer 3: Glass bud vase with a single tender sprouting branch */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Glass vase body base (100% opaque p.paper so coaster lines don't bleed through) */}
        <path
          d="M59 38 L71 38 L70 46 C78 50 81 58 79 65 C77 69.5 72 71 65 71 C58 71 53 69.5 51 65 C49 58 52 50 60 46 Z"
          fill={p.paper}
        />
        {/* Subtle glass tint */}
        <path
          d="M59 38 L71 38 L70 46 C78 50 81 58 79 65 C77 69.5 72 71 65 71 C58 71 53 69.5 51 65 C49 58 52 50 60 46 Z"
          fill={p.brandSoft}
          fillOpacity="0.28"
        />

        {/* Water fill inside lower half of glass vase */}
        <path
          d="M51.5 56 C58 54.5 72 54.5 78.5 56 C80 60 79.5 63.5 78.5 65.5 C76.5 69.5 71.8 70.8 65 70.8 C58.2 70.8 53.5 69.5 51.5 65.5 C50.5 63.5 50 60 51.5 56 Z"
          fill={p.leaf}
          fillOpacity="0.26"
        />
        {/* Water meniscus ellipse */}
        <ellipse
          cx="65"
          cy="56"
          rx="13.5"
          ry="2.6"
          fill={p.brandSoft}
          fillOpacity="0.45"
          stroke={p.ink}
          strokeWidth="0.9"
          strokeOpacity="0.55"
        />

        {/* Single slender stem extending from inside water up through vase neck */}
        {/* Submerged stem portion (slightly refracted) */}
        <path
          d="M60 67 C62 63 63.5 59.5 64.5 56"
          stroke={p.ink}
          strokeWidth="1.15"
          strokeOpacity="0.55"
        />
        {/* Tiny rootlet in water */}
        <path d="M61.5 64 L58 65.5" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.45" />
        <path d="M62.5 61.5 L65.5 63.5" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.45" />

        {/* Upper stem above water */}
        <path
          d="M64.5 56 C66 44 69 30 76 18"
          stroke={p.ink}
          strokeWidth="1.3"
        />

        {/* Twine string tied around vase neck */}
        <path d="M59.2 42.5 C63 43.5 67 43.5 70.8 42.5" stroke={p.gold} strokeWidth="2.2" />
        <path d="M59.2 42.5 C63 43.5 67 43.5 70.8 42.5" stroke={p.ink} strokeWidth="1.05" />

        {/* Glass vase outer contour, lip & curved reflection highlight */}
        <path
          d="M59 38 L71 38 L70 46 C78 50 81 58 79 65 C77 69.5 72 71 65 71 C58 71 53 69.5 51 65 C49 58 52 50 60 46 Z"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        <ellipse cx="65" cy="38" rx="6.5" ry="1.8" fill={p.paper} stroke={p.ink} strokeWidth="1.2" />
        <path
          d="M54.5 53 C53 57 53.2 61.5 55 65"
          stroke={p.paper}
          strokeWidth="2.0"
          strokeOpacity="0.85"
        />
        <path
          d="M75.5 53 C77 56.5 76.8 60.5 75.5 63.5"
          stroke={p.ink}
          strokeWidth="0.85"
          strokeOpacity="0.4"
        />

        {/* Tender leaf 1 (left side of stem) */}
        <path
          d="M68 33 C60 32 54 26 56 19 C63 19 68 25 68 33 Z"
          fill={p.paper}
        />
        <path
          d="M68 33 C60 32 54 26 56 19 C63 19 68 25 68 33 Z"
          fill={p.leaf}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path d="M58 22 C61.5 25.5 64.5 29 67 32" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.58" />

        {/* Tender leaf 2 (right side of stem) */}
        <path
          d="M71 26 C78 27 85 23 86 16 C79 14 73 19 71 26 Z"
          fill={p.paper}
        />
        <path
          d="M71 26 C78 27 85 23 86 16 C79 14 73 19 71 26 Z"
          fill={p.brand}
          fillOpacity="0.4"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path d="M83 18 C79 20.5 75 23 72 25.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.58" />

        {/* Unfurling terminal floral/leaf bud at the very tip */}
        <path
          d="M76 18 C74 14 75.5 9.5 79.5 8.5 C81.5 11.5 80 16 76 18 Z"
          fill={p.paper}
        />
        <path
          d="M76 18 C74 14 75.5 9.5 79.5 8.5 C81.5 11.5 80 16 76 18 Z"
          fill={p.rose}
          fillOpacity="0.52"
          stroke={p.ink}
          strokeWidth="1.15"
        />
      </g>

      {/* Layer 4: Morning dew drop & quiet sparkles */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Hanging dew drop from right leaf tip */}
        <path
          d="M85 22 C85 20.2 86.4 18.5 86.4 18.5 C86.4 18.5 87.8 20.2 87.8 22 C87.8 22.9 87.2 23.6 86.4 23.6 C85.6 23.6 85 22.9 85 22 Z"
          fill={p.brandSoft}
          fillOpacity="0.9"
          stroke={p.ink}
          strokeWidth="0.9"
        />

        {/* Four-point sparkles & micro dots */}
        <path
          d="M44 25 L44.8 27.2 L47 28 L44.8 28.8 L44 31 L43.2 28.8 L41 28 L43.2 27.2 Z"
          fill={p.gold}
          fillOpacity="0.8"
        />
        <path
          d="M96 34 L96.7 35.8 L98.5 36.5 L96.7 37.2 L96 39 L95.3 37.2 L93.5 36.5 L95.3 35.8 Z"
          fill={p.gold}
          fillOpacity="0.75"
        />
        <circle cx="50" cy="42" r="1.2" fill={p.leaf} fillOpacity="0.55" />
        <circle cx="88" cy="48" r="1.3" fill={p.gold} fillOpacity="0.6" />
        <circle cx="34" cy="54" r="1.1" fill={p.rose} fillOpacity="0.45" />
      </g>
    </svg>
  ),
};
