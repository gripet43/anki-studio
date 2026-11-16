import React from 'react';
import type { IllustrationPalette, ThemeIllustrationPack } from './types';

export const kyotoPack: ThemeIllustrationPack = {
  greeting: (p: IllustrationPalette) => (
    <svg viewBox="0 0 112 44" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Ambient watercolor wash & gentle water ripple aura */}
      <ellipse cx="56" cy="24" rx="46" ry="15" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="42" cy="20" r="14" fill={p.gold} fillOpacity="0.14" />
      <circle cx="72" cy="22" r="13" fill={p.leaf} fillOpacity="0.13" />

      {/* Layer 2: Mid-ground bamboo sprig & flowing water ripples */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Flowing water ripple lines at bottom */}
        <path
          d="M12 36 C26 33 40 39 56 36 C72 33 86 39 100 35"
          stroke={p.brand}
          strokeWidth="1.1"
          strokeOpacity="0.45"
        />
        <path
          d="M20 40 C34 38 48 42 64 39 C76 37 86 40 94 39"
          stroke={p.ink}
          strokeWidth="0.85"
          strokeOpacity="0.4"
        />

        {/* Slender bamboo branch extending to the left and right */}
        <path d="M14 25 C28 21 42 20 56 22" stroke={p.ink} strokeWidth="1.15" />
        {/* Bamboo leaves on left */}
        <path
          d="M27 22 C21 18 15 18 10 21 C15 25 22 25 27 22 Z"
          fill={p.paper}
        />
        <path
          d="M27 22 C21 18 15 18 10 21 C15 25 22 25 27 22 Z"
          fill={p.leaf}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M29 23 C24 27 19 31 14 32 C16 27 22 23 29 23 Z"
          fill={p.paper}
        />
        <path
          d="M29 23 C24 27 19 31 14 32 C16 27 22 23 29 23 Z"
          fill={p.brand}
          fillOpacity="0.38"
          stroke={p.ink}
          strokeWidth="1.0"
        />

        {/* Bamboo leaves on right */}
        <path d="M74 24 C84 21 92 17 99 12" stroke={p.ink} strokeWidth="1.1" />
        <path
          d="M84 20 C89 15 95 12 101 12 C97 17 90 20 84 20 Z"
          fill={p.paper}
        />
        <path
          d="M84 20 C89 15 95 12 101 12 C97 17 90 20 84 20 Z"
          fill={p.leaf}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M82 22 C88 23 95 22 100 19 C95 17 88 18 82 22 Z"
          fill={p.paper}
        />
        <path
          d="M82 22 C88 23 95 22 100 19 C95 17 88 18 82 22 Z"
          fill={p.leaf}
          fillOpacity="0.34"
          stroke={p.ink}
          strokeWidth="1.0"
        />
      </g>

      {/* Layer 3: Foreground Half-Open Washi Folding Fan (Sensu) */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Bamboo ribs at base of fan (opaque p.paper base) */}
        <path
          d="M44 26 L56 36 L68 26 C61 22 51 22 44 26 Z"
          fill={p.paper}
        />
        <path
          d="M44 26 L56 36 L68 26 C61 22 51 22 44 26 Z"
          fill={p.warm}
          fillOpacity="0.5"
          stroke={p.ink}
          strokeWidth="1.15"
        />

        {/* Washi fan main sector (opaque p.paper base) */}
        <path
          d="M32 18 C43 6 69 6 80 18 L68 27 C61 21 51 21 44 27 Z"
          fill={p.paper}
        />
        {/* Decorative teal & gold upper border on fan paper */}
        <path
          d="M32 18 C43 6 69 6 80 18 L76.5 20.6 C66.5 10.2 45.5 10.2 35.5 20.6 Z"
          fill={p.brand}
          fillOpacity="0.38"
        />
        {/* Warm gold cloud/wave band inside fan */}
        <path
          d="M38 22.5 C47 14.5 65 14.5 74 22.5 L68 27 C61 21 51 21 44 27 Z"
          fill={p.gold}
          fillOpacity="0.28"
        />

        {/* Seigaiha wave arcs painted on fan face */}
        <path d="M47 16.5 Q51.5 13.5 56 16.5 Q60.5 13.5 65 16.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.5" />
        <path d="M51.5 19 Q56 16 60.5 19" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.5" />

        {/* Fan radial fold lines & bamboo ribs */}
        <path d="M56 36 L41 11.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.48" />
        <path d="M56 36 L48.5 9.2" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.48" />
        <path d="M56 36 L56 8.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.48" />
        <path d="M56 36 L63.5 9.2" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.48" />
        <path d="M56 36 L71 11.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.48" />

        {/* Fan main outer contour */}
        <path
          d="M32 18 C43 6 69 6 80 18 L68 27 C61 21 51 21 44 27 Z"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        <path d="M32 18 L56 36 L80 18" stroke={p.ink} strokeWidth="1.25" />

        {/* Pivot pin & silk tassel */}
        <circle cx="56" cy="36" r="2.0" fill={p.gold} stroke={p.ink} strokeWidth="1.0" />
        <path
          d="M56 38 C58 40 62 41 66 39.5"
          stroke={p.rose}
          strokeWidth="1.8"
        />
        <path
          d="M56 38 C58 40 62 41 66 39.5"
          stroke={p.ink}
          strokeWidth="0.9"
        />
      </g>

      {/* Layer 4: Floating ginkgo leaf & gold leaf flakes (no crosses) */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Small floating ginkgo leaf */}
        <path
          d="M27 12 C28 7.5 32.5 5.5 35.5 7.5 C34.2 9.2 33.2 9.5 34.8 11 C36.5 12.5 34 15.5 29.5 14.5 L27 12 Z"
          fill={p.gold}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="0.95"
        />
        <path d="M24.5 13.5 L28 12.5" stroke={p.ink} strokeWidth="0.9" />

        {/* Gold leaf circles & lozenge */}
        <path d="M84 29 L86 26.5 L88 29 L86 31.5 Z" fill={p.gold} fillOpacity="0.75" />
        <circle cx="21" cy="12" r="1.3" fill={p.gold} fillOpacity="0.65" />
        <circle cx="78" cy="9" r="1.2" fill={p.rose} fillOpacity="0.5" />
        <circle cx="92" cy="27" r="1.2" fill={p.brand} fillOpacity="0.5" />
      </g>
    </svg>
  ),

  cornerLeft: (p: IllustrationPalette) => (
    <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Bottom-left ambient mist & wave wash */}
      <path d="M0 96 L0 24 C28 28 54 54 70 96 Z" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="24" cy="68" r="22" fill={p.leaf} fillOpacity="0.14" />
      <circle cx="44" cy="80" r="15" fill={p.gold} fillOpacity="0.14" />

      {/* Layer 2: Low bamboo garden fence & Seigaiha wave arcs */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Subtle Seigaiha wave arcs in lower corner */}
        <path d="M36 92 Q44 86 52 92 Q60 86 68 92" stroke={p.brand} strokeWidth="0.95" strokeOpacity="0.4" />
        <path d="M40 95 Q44 92 48 95" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.35" />

        {/* Low bamboo lattice fence posts at bottom-left */}
        <path
          d="M4 96 L4 74 C4 72.5 8 72.5 8 74 L8 96 Z"
          fill={p.paper}
        />
        <path
          d="M4 96 L4 74 C4 72.5 8 72.5 8 74 L8 96 Z"
          fill={p.warm}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        <path
          d="M28 96 L28 77 C28 75.5 32 75.5 32 77 L32 96 Z"
          fill={p.paper}
        />
        <path
          d="M28 96 L28 77 C28 75.5 32 75.5 32 77 L32 96 Z"
          fill={p.warm}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        {/* Horizontal bamboo rail with parallel cord wraps (no crosses) */}
        <path
          d="M0 82 L38 85 L38 88.5 L0 85.5 Z"
          fill={p.paper}
        />
        <path
          d="M0 82 L38 85 L38 88.5 L0 85.5 Z"
          fill={p.gold}
          fillOpacity="0.38"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        <path d="M4.5 82 L7.5 86.2" stroke={p.ink} strokeWidth="1.15" />
        <path d="M28.5 84 L31.5 88.2" stroke={p.ink} strokeWidth="1.15" />
      </g>

      {/* Layer 3: Two graceful bamboo stalks, bamboo leaves & drifting ginkgo leaves */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Tall left bamboo stalk (opaque p.paper base + emerald/sage fill) */}
        <path
          d="M8 96 C9 72 14 46 22 18 L26.5 19.2 C18.5 47 13.5 72 12.5 96 Z"
          fill={p.paper}
        />
        <path
          d="M8 96 C9 72 14 46 22 18 L26.5 19.2 C18.5 47 13.5 72 12.5 96 Z"
          fill={p.brand}
          fillOpacity="0.38"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        {/* Bamboo nodes on tall stalk */}
        <path d="M10.5 70 L16.5 71" stroke={p.ink} strokeWidth="1.35" />
        <path d="M14.2 46 L20 47.2" stroke={p.ink} strokeWidth="1.35" />
        <path d="M18.8 25 L24.5 26.5" stroke={p.ink} strokeWidth="1.35" />

        {/* Second slender bamboo stalk arching right */}
        <path
          d="M17 96 C20 76 27 56 38 36 L41.5 37.8 C31 57 24 76 21 96 Z"
          fill={p.paper}
        />
        <path
          d="M17 96 C20 76 27 56 38 36 L41.5 37.8 C31 57 24 76 21 96 Z"
          fill={p.leaf}
          fillOpacity="0.45"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        {/* Bamboo nodes on second stalk */}
        <path d="M21 75 L26.2 76.5" stroke={p.ink} strokeWidth="1.3" />
        <path d="M27.8 55 L32.8 56.8" stroke={p.ink} strokeWidth="1.3" />

        {/* Bamboo leaf cluster 1 (upper top) */}
        <path d="M23 26 C30 22 36 18 42 14" stroke={p.ink} strokeWidth="1.05" />
        <path
          d="M30 22 C35 16 42 12 49 12 C44 18 37 22 30 22 Z"
          fill={p.paper}
        />
        <path
          d="M30 22 C35 16 42 12 49 12 C44 18 37 22 30 22 Z"
          fill={p.leaf}
          fillOpacity="0.52"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <path
          d="M28 23 C35 24 42 27 47 32 C39 31 32 28 28 23 Z"
          fill={p.paper}
        />
        <path
          d="M28 23 C35 24 42 27 47 32 C39 31 32 28 28 23 Z"
          fill={p.brand}
          fillOpacity="0.4"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        <path
          d="M20 24 C14 20 8 19 3 22 C8 26 15 26 20 24 Z"
          fill={p.paper}
        />
        <path
          d="M20 24 C14 20 8 19 3 22 C8 26 15 26 20 24 Z"
          fill={p.leaf}
          fillOpacity="0.42"
          stroke={p.ink}
          strokeWidth="1.05"
        />

        {/* Bamboo leaf cluster 2 (mid-right) */}
        <path
          d="M39 40 C46 37 54 37 61 41 C53 44 45 43 39 40 Z"
          fill={p.paper}
        />
        <path
          d="M39 40 C46 37 54 37 61 41 C53 44 45 43 39 40 Z"
          fill={p.leaf}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        <path
          d="M37 42 C42 46 47 52 49 58 C42 54 38 48 37 42 Z"
          fill={p.paper}
        />
        <path
          d="M37 42 C42 46 47 52 49 58 C42 54 38 48 37 42 Z"
          fill={p.brand}
          fillOpacity="0.36"
          stroke={p.ink}
          strokeWidth="1.05"
        />

        {/* Drifting Golden Ginkgo Leaf 1 (mid-air) */}
        <path
          d="M36 66 C37 58 43 52 50 54 C48 57 46.5 58 49 59.5 C51.5 61 52 67 44 68.5 C40 69 37.5 67.5 36 66 Z"
          fill={p.paper}
        />
        <path
          d="M36 66 C37 58 43 52 50 54 C48 57 46.5 58 49 59.5 C51.5 61 52 67 44 68.5 C40 69 37.5 67.5 36 66 Z"
          fill={p.gold}
          fillOpacity="0.58"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <path d="M31 70 C33 68.5 34.8 67 36.5 65.5" stroke={p.ink} strokeWidth="1.1" />
        <path d="M39 64 L45 57.5" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.5" />
        <path d="M40 65.5 L47 63" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.5" />

        {/* Drifting Golden Ginkgo Leaf 2 (lower right) */}
        <path
          d="M52 79 C55 73 62 70 67 74 C64.5 75.5 63.5 76.2 65 78 C66.8 80 64 85 57 83.5 C54.5 83 53 81 52 79 Z"
          fill={p.paper}
        />
        <path
          d="M52 79 C55 73 62 70 67 74 C64.5 75.5 63.5 76.2 65 78 C66.8 80 64 85 57 83.5 C54.5 83 53 81 52 79 Z"
          fill={p.gold}
          fillOpacity="0.52"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        <path d="M47.5 81 L52.5 79" stroke={p.ink} strokeWidth="1.05" />
        <path d="M55 78.5 L61.5 75" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.5" />
      </g>

      {/* Layer 4: Gold leaf dots & lozenge gems (no crosses) */}
      <path d="M58 24 L60.2 21 L62.4 24 L60.2 27 Z" fill={p.gold} fillOpacity="0.78" />
      <path d="M70 60 L71.8 57.6 L73.6 60 L71.8 62.4 Z" fill={p.gold} fillOpacity="0.7" />
      <circle cx="34" cy="12" r="1.4" fill={p.gold} fillOpacity="0.65" />
      <circle cx="56" cy="49" r="1.3" fill={p.rose} fillOpacity="0.5" />
      <circle cx="76" cy="82" r="1.3" fill={p.brand} fillOpacity="0.5" />
    </svg>
  ),

  cornerRight: (p: IllustrationPalette) => (
    <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Bottom-right ambient lantern glow */}
      <path d="M96 96 L96 24 C68 28 44 54 26 96 Z" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="64" cy="58" r="24" fill={p.gold} fillOpacity="0.18" />
      <circle cx="54" cy="80" r="16" fill={p.rose} fillOpacity="0.13" />

      {/* Layer 2: Wooden eave hook & camellia/plum branch */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Rustic wooden lantern beam extending from right edge */}
        <path
          d="M96 29 L58 29 C56 29 56 32.5 58 32.5 L96 32.5 Z"
          fill={p.paper}
        />
        <path
          d="M96 29 L58 29 C56 29 56 32.5 58 32.5 L96 32.5 Z"
          fill={p.warm}
          fillOpacity="0.6"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        {/* Diagonal wooden brace */}
        <path d="M96 42 L80 32.5" stroke={p.ink} strokeWidth="1.35" />
        {/* Hanging ring & cord */}
        <path d="M64 32.5 L64 38" stroke={p.ink} strokeWidth="1.25" />

        {/* Camellia / Plum branch arching from bottom-right */}
        <path
          d="M96 86 C80 83 62 82 36 88"
          stroke={p.ink}
          strokeWidth="1.4"
        />
        <path
          d="M74 83 C66 79 58 78 48 80"
          stroke={p.ink}
          strokeWidth="1.15"
        />

        {/* Glossy camellia leaves */}
        <path
          d="M84 84 C86 76 92 71 96 71 L96 81 C92 84 88 85 84 84 Z"
          fill={p.leaf}
          fillOpacity="0.45"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M54 80 C48 75 40 75 35 79 C41 84 48 84 54 80 Z"
          fill={p.paper}
        />
        <path
          d="M54 80 C48 75 40 75 35 79 C41 84 48 84 54 80 Z"
          fill={p.leaf}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        <path d="M38 79 L51 80" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />
      </g>

      {/* Layer 3: Vintage Kyoto Washi Paper Lantern & Blooming Camellia */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Lantern top cap */}
        <rect x="57" y="38" width="14" height="3.5" rx="1.5" fill={p.paper} />
        <rect x="57" y="38" width="14" height="3.5" rx="1.5" fill={p.brand} fillOpacity="0.55" stroke={p.ink} strokeWidth="1.15" />

        {/* Washi Lantern Body (100% opaque p.paper base) */}
        <path
          d="M55 41.5 L73 41.5 C82 47 82 62 73 67.5 L55 67.5 C46 62 46 47 55 41.5 Z"
          fill={p.paper}
        />
        {/* Warm candle glow inside washi lantern */}
        <path
          d="M55 41.5 L73 41.5 C82 47 82 62 73 67.5 L55 67.5 C46 62 46 47 55 41.5 Z"
          fill={p.warm}
          fillOpacity="0.38"
        />
        <ellipse cx="64" cy="54.5" rx="11" ry="9" fill={p.gold} fillOpacity="0.34" />
        <circle cx="64" cy="54.5" r="4.5" fill={p.rose} fillOpacity="0.28" />

        {/* Horizontal bamboo ribbing on lantern */}
        <path d="M49.5 48 C58 46.2 70 46.2 78.5 48" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.5" />
        <path d="M48.2 54.5 C58 53 70 53 79.8 54.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.5" />
        <path d="M49.5 61 C58 62.8 70 62.8 78.5 61" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.5" />

        {/* Lantern outer contour */}
        <path
          d="M55 41.5 L73 41.5 C82 47 82 62 73 67.5 L55 67.5 C46 62 46 47 55 41.5 Z"
          stroke={p.ink}
          strokeWidth="1.3"
        />

        {/* Lantern bottom cap & hanging silk tassel */}
        <rect x="57" y="67.5" width="14" height="3.5" rx="1.5" fill={p.paper} />
        <rect x="57" y="67.5" width="14" height="3.5" rx="1.5" fill={p.brand} fillOpacity="0.55" stroke={p.ink} strokeWidth="1.15" />
        <circle cx="64" cy="72.8" r="1.6" fill={p.gold} stroke={p.ink} strokeWidth="0.95" />
        <path
          d="M64 74.4 C63 77.5 61.5 80 60 82.5 L64 81.5 L66.5 83 C66.5 80 65.5 77 64 74.4 Z"
          fill={p.rose}
          fillOpacity="0.68"
          stroke={p.ink}
          strokeWidth="0.95"
        />

        {/* Blooming Camellia / Plum Blossom at bottom */}
        {/* Flower petals (opaque p.paper base + coral rose fill) */}
        <path
          d="M73 84 C69 79 72 73 77 75 C80 71 86 74 84 79 C89 81 87 88 81 87 C79 92 72 90 73 84 Z"
          fill={p.paper}
        />
        <path
          d="M73 84 C69 79 72 73 77 75 C80 71 86 74 84 79 C89 81 87 88 81 87 C79 92 72 90 73 84 Z"
          fill={p.rose}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        {/* Golden stamen center */}
        <circle cx="79" cy="81.5" r="2.6" fill={p.gold} stroke={p.ink} strokeWidth="0.95" />

        {/* Unopened round Camellia bud on left of branch */}
        <path
          d="M45 86 C41 83 41 78 45 76 C49 75 52 79 50 83 C49 85 47 86.5 45 86 Z"
          fill={p.paper}
        />
        <path
          d="M45 86 C41 83 41 78 45 76 C49 75 52 79 50 83 C49 85 47 86.5 45 86 Z"
          fill={p.rose}
          fillOpacity="0.6"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        <path
          d="M47 86.2 C49.5 86 51 84 50.8 81.5 C48.5 82 47 84 47 86.2 Z"
          fill={p.leaf}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="0.95"
        />
      </g>

      {/* Layer 4: Floating lantern light orbs, drifting petals & lozenges (no crosses) */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Drifting plum petal */}
        <path
          d="M37 60 C34 58 33 61 35.5 63.5 C38 65.5 41 63 39 60.5 Z"
          fill={p.rose}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="0.9"
        />
        {/* Diamond lozenge sparkles */}
        <path d="M40 38 L42.2 35 L44.4 38 L42.2 41 Z" fill={p.gold} fillOpacity="0.8" />
        <path d="M28 72 L29.8 69.5 L31.6 72 L29.8 74.5 Z" fill={p.gold} fillOpacity="0.72" />

        {/* Warm glowing firefly/light circles */}
        <circle cx="43" cy="50" r="2.2" fill={p.gold} fillOpacity="0.45" />
        <circle cx="43" cy="50" r="1.1" fill={p.gold} fillOpacity="0.9" />
        <circle cx="50" cy="24" r="1.4" fill={p.gold} fillOpacity="0.65" />
        <circle cx="88" cy="60" r="1.3" fill={p.rose} fillOpacity="0.5" />
      </g>
    </svg>
  ),

  celebration: (p: IllustrationPalette) => (
    <svg viewBox="0 0 210 132" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Ambient Kyoto matcha & gold wash + Seigaiha wave background */}
      <ellipse cx="105" cy="72" rx="86" ry="46" fill={p.brandSoft} fillOpacity="0.24" />
      <ellipse cx="82" cy="62" rx="48" ry="34" fill={p.leaf} fillOpacity="0.14" />
      <ellipse cx="136" cy="70" rx="46" ry="32" fill={p.gold} fillOpacity="0.14" />

      {/* Enso-inspired serene circular arc in upper sky */}
      <path
        d="M52 46 C64 16 146 16 158 46"
        stroke={p.ink}
        strokeWidth="1.0"
        strokeOpacity="0.22"
        strokeDasharray="3 3.5"
        strokeLinecap="round"
      />

      {/* Seigaiha wave arcs in background left & right */}
      <g strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.32">
        <path d="M18 68 Q26 61 34 68 Q42 61 50 68" stroke={p.brand} strokeWidth="1.05" />
        <path d="M22 71 Q26 67 30 71" stroke={p.ink} strokeWidth="0.85" />
        <path d="M164 66 Q172 59 180 66 Q188 59 196 66" stroke={p.brand} strokeWidth="1.05" />
        <path d="M168 69 Q172 65 176 69" stroke={p.ink} strokeWidth="0.85" />
      </g>

      {/* Layer 2: Mid-ground bamboo sprigs & handcrafted wooden tea tray */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Bamboo sprig peeking from top-left */}
        <path d="M62 52 C46 43 32 33 22 20" stroke={p.ink} strokeWidth="1.15" />
        <path
          d="M42 40 C34 42 25 39 20 33 C27 29 36 32 42 40 Z"
          fill={p.paper}
        />
        <path
          d="M42 40 C34 42 25 39 20 33 C27 29 36 32 42 40 Z"
          fill={p.leaf}
          fillOpacity="0.45"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M36 33 C34 25 37 17 43 13 C46 20 43 28 36 33 Z"
          fill={p.paper}
        />
        <path
          d="M36 33 C34 25 37 17 43 13 C46 20 43 28 36 33 Z"
          fill={p.brand}
          fillOpacity="0.36"
          stroke={p.ink}
          strokeWidth="1.05"
        />

        {/* Slender bamboo leaves peeking from right */}
        <path d="M154 54 C166 46 176 38 186 27" stroke={p.ink} strokeWidth="1.15" />
        <path
          d="M166 45 C174 47 183 44 188 38 C181 34 172 37 166 45 Z"
          fill={p.paper}
        />
        <path
          d="M166 45 C174 47 183 44 188 38 C181 34 172 37 166 45 Z"
          fill={p.leaf}
          fillOpacity="0.44"
          stroke={p.ink}
          strokeWidth="1.05"
        />

        {/* Handcrafted Wooden Tea Tray (木质茶盘, 100% opaque p.paper base) */}
        {/* Tray wooden feet */}
        <path
          d="M40 103 L44 110 L56 110 L58 103 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path
          d="M40 103 L44 110 L56 110 L58 103 Z"
          fill={p.warm}
          fillOpacity="0.65"
        />
        <path
          d="M152 103 L154 110 L166 110 L170 103 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path
          d="M152 103 L154 110 L166 110 L170 103 Z"
          fill={p.warm}
          fillOpacity="0.65"
        />

        {/* Tray outer rim & body */}
        <path
          d="M24 96 L42 72 L168 72 L186 96 L183 104 L27 104 Z"
          fill={p.paper}
        />
        <path
          d="M24 96 L42 72 L168 72 L186 96 L183 104 L27 104 Z"
          fill={p.warm}
          fillOpacity="0.45"
          stroke={p.ink}
          strokeWidth="1.35"
        />
        {/* Tray recessed inner surface */}
        <path
          d="M31 93 L45 75 L165 75 L179 93 Z"
          fill={p.paper}
        />
        <path
          d="M31 93 L45 75 L165 75 L179 93 Z"
          fill={p.warm}
          fillOpacity="0.28"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        {/* Tray front thickness bevel */}
        <path
          d="M24 96 L186 96 L183 104 L27 104 Z"
          fill={p.gold}
          fillOpacity="0.22"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        {/* Subtle wood grain lines on tray */}
        <path d="M46 88 L74 88" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.35" />
        <path d="M128 84 L162 84" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.35" />
      </g>

      {/* Layer 3: Foreground Protagonists — Matcha Bowl, Bamboo Whisk, Wagashi, Folded Washi Fan */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Small Wagashi Sweet on wooden coaster at left of tray */}
        <ellipse cx="53" cy="84" rx="12" ry="4.2" fill={p.paper} stroke={p.ink} strokeWidth="1.15" />
        <ellipse cx="53" cy="84" rx="10" ry="3.2" fill={p.brand} fillOpacity="0.35" />
        {/* Sakura/Camellia-shaped Nerikiri Wagashi */}
        <path
          d="M46 79 C45 75 49 72 53 74 C57 72 61 75 60 79 C62 82 58 85 53 84 C48 85 44 82 46 79 Z"
          fill={p.paper}
        />
        <path
          d="M46 79 C45 75 49 72 53 74 C57 72 61 75 60 79 C62 82 58 85 53 84 C48 85 44 82 46 79 Z"
          fill={p.rose}
          fillOpacity="0.58"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <circle cx="53" cy="78.5" r="2.0" fill={p.gold} stroke={p.ink} strokeWidth="0.9" />

        {/* Rustic Stoneware Matcha Bowl (粗陶茶碗 Chawan) */}
        {/* Bowl unglazed clay foot (高台) */}
        <path
          d="M84 89 L114 89 L112 94.5 C104 96.5 94 96.5 86 94.5 Z"
          fill={p.paper}
        />
        <path
          d="M84 89 L114 89 L112 94.5 C104 96.5 94 96.5 86 94.5 Z"
          fill={p.warm}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="1.25"
        />

        {/* Bowl main body (100% opaque p.paper base) */}
        <path
          d="M68 56 C67 74 75 88 85 90 C94 92 104 92 113 90 C123 88 131 74 130 56 Z"
          fill={p.paper}
        />
        {/* Lower stoneware clay texture */}
        <path
          d="M68 56 C67 74 75 88 85 90 C94 92 104 92 113 90 C123 88 131 74 130 56 Z"
          fill={p.warm}
          fillOpacity="0.36"
        />
        {/* Upper celadon/teal ceramic glaze with organic wabi-sabi drip wave */}
        <path
          d="M68 56 L130 56 C130 66 128 74 124 80 C117 77 112 83 104 81 C96 79 90 85 82 81 C76 78 72 82 70 74 C68.5 68 68 62 68 56 Z"
          fill={p.brand}
          fillOpacity="0.42"
        />
        {/* Subtle kintsugi gold repair vein on bowl front */}
        <path
          d="M108 64 C106 70 109 75 105 82"
          stroke={p.gold}
          strokeWidth="1.5"
        />
        {/* Bowl outer outline & glaze line */}
        <path
          d="M70 74 C72 82 76 78 82 81 C90 85 96 79 104 81 C112 83 117 77 124 80"
          stroke={p.ink}
          strokeWidth="1.0"
          strokeOpacity="0.6"
        />
        <path
          d="M68 56 C67 74 75 88 85 90 C94 92 104 92 113 90 C123 88 131 74 130 56"
          stroke={p.ink}
          strokeWidth="1.4"
        />

        {/* Bowl top rim & rich frothy Matcha surface */}
        <ellipse cx="99" cy="56" rx="31" ry="9.5" fill={p.paper} stroke={p.ink} strokeWidth="1.35" />
        <ellipse cx="99" cy="56.8" rx="28" ry="7.6" fill={p.leaf} fillOpacity="0.68" />
        <ellipse cx="99" cy="56.8" rx="24" ry="6.2" fill={p.brand} fillOpacity="0.28" />

        {/* Delicate creamy matcha foam swirls & micro bubbles */}
        <path
          d="M81 56.5 C88 53.5 98 54 106 56.5 C112 58.5 117 57.5 120 55.5"
          stroke={p.paper}
          strokeWidth="1.8"
          strokeOpacity="0.8"
        />
        <path
          d="M86 59 C93 57 103 57.5 111 59.5"
          stroke={p.paper}
          strokeWidth="1.3"
          strokeOpacity="0.75"
        />
        <circle cx="84" cy="55" r="1.3" fill={p.paper} fillOpacity="0.85" />
        <circle cx="88" cy="57.5" r="1.0" fill={p.paper} fillOpacity="0.85" />
        <circle cx="112" cy="54.8" r="1.2" fill={p.paper} fillOpacity="0.85" />
        <circle cx="105" cy="59.2" r="0.9" fill={p.paper} fillOpacity="0.85" />

        {/* Gentle fragrant steam rising from matcha bowl */}
        <path d="M92 44 C89 37 95 32 92 25" stroke={p.ink} strokeWidth="1.05" strokeOpacity="0.45" />
        <path d="M105 42 C102 35 108 30 105 23" stroke={p.ink} strokeWidth="1.05" strokeOpacity="0.45" />

        {/* Bamboo Matcha Whisk (竹制茶筅 Chasen) standing on right */}
        {/* Whisk bamboo base handle (opaque p.paper) */}
        <path
          d="M145 73 L157 73 L156 90 C153 92 149 92 146 90 Z"
          fill={p.paper}
        />
        <path
          d="M145 73 L157 73 L156 90 C153 92 149 92 146 90 Z"
          fill={p.gold}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        {/* Bamboo node on whisk handle */}
        <path d="M145.5 83.5 C149 84.5 153 84.5 156.5 83.5" stroke={p.ink} strokeWidth="1.2" />

        {/* Whisk upper tine crown (opaque p.paper base + warm bamboo tint) */}
        <path
          d="M145 73 C140 65 139 55 144 49 C148 46.5 154 46.5 158 49 C163 55 162 65 157 73 Z"
          fill={p.paper}
        />
        <path
          d="M145 73 C140 65 139 55 144 49 C148 46.5 154 46.5 158 49 C163 55 162 65 157 73 Z"
          fill={p.warm}
          fillOpacity="0.42"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        {/* Fine curved bamboo tines inside crown */}
        <path d="M147 73 C144 64 144 55 147 48.2" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.65" />
        <path d="M149.5 73 C148 64 148 55 149.5 47.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.65" />
        <path d="M152.5 73 C154 64 154 55 152.5 47.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.65" />
        <path d="M155 73 C158 64 158 55 155 48.2" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.65" />
        {/* Dark thread binding band (編み糸) */}
        <rect x="144.2" y="71.5" width="13.6" height="2.8" rx="1" fill={p.ink} />

        {/* Folded / Semi-folded Handmade Washi Fan resting across front-left */}
        <path
          d="M42 108 L88 92 L92 98 L45 113 Z"
          fill={p.paper}
        />
        <path
          d="M42 108 L88 92 L92 98 L45 113 Z"
          fill={p.brand}
          fillOpacity="0.42"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path
          d="M45 113 L92 98 L93.5 101.5 L46.5 116.5 Z"
          fill={p.paper}
        />
        <path
          d="M45 113 L92 98 L93.5 101.5 L46.5 116.5 Z"
          fill={p.gold}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        {/* Fan fold pleats */}
        <path d="M56 105 L89.5 94.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />
        {/* Silk tassel hanging from fan pivot */}
        <circle cx="44.5" cy="112" r="1.8" fill={p.gold} stroke={p.ink} strokeWidth="0.95" />
        <path
          d="M43 113 C38 116 33 117 28 115"
          stroke={p.rose}
          strokeWidth="2.2"
        />
        <path
          d="M43 113 C38 116 33 117 28 115"
          stroke={p.ink}
          strokeWidth="0.95"
        />

        {/* Velvet Moss Spheres (青苔) & Ginkgo Leaf on Right Front */}
        {/* Moss sphere 1 */}
        <path
          d="M116 104 C115 99 120 95 126 95 C132 95 136 99 135 104 C134 106.5 117 106.5 116 104 Z"
          fill={p.paper}
        />
        <path
          d="M116 104 C115 99 120 95 126 95 C132 95 136 99 135 104 C134 106.5 117 106.5 116 104 Z"
          fill={p.leaf}
          fillOpacity="0.58"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        {/* Small companion moss sphere */}
        <path
          d="M132 106 C131.5 102.5 135 100 139 100 C143 100 146 102.5 145.5 106 C145 108 132.5 108 132 106 Z"
          fill={p.paper}
        />
        <path
          d="M132 106 C131.5 102.5 135 100 139 100 C143 100 146 102.5 145.5 106 C145 108 132.5 108 132 106 Z"
          fill={p.brand}
          fillOpacity="0.45"
          stroke={p.ink}
          strokeWidth="1.15"
        />
      </g>

      {/* Layer 4: Drifting Golden Ginkgo Leaves & Gold Leaf Flakes (zero crosses) */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Drifting Ginkgo Leaf 1 (upper left) */}
        <path
          d="M52 33 C53 25 60 19 67 21.5 C64.8 24.5 63.2 25.5 65.8 27 C68.5 28.5 69 34.5 60.5 36 C56.5 36.5 53.5 35 52 33 Z"
          fill={p.paper}
        />
        <path
          d="M52 33 C53 25 60 19 67 21.5 C64.8 24.5 63.2 25.5 65.8 27 C68.5 28.5 69 34.5 60.5 36 C56.5 36.5 53.5 35 52 33 Z"
          fill={p.gold}
          fillOpacity="0.62"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <path d="M47 36.5 L52.5 33" stroke={p.ink} strokeWidth="1.1" />
        <path d="M55.5 31.5 L62 25" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.55" />
        <path d="M56.5 33 L64 30.5" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.55" />

        {/* Drifting Ginkgo Leaf 2 (upper right) */}
        <path
          d="M140 31 C138 23.5 131 19 124 22 C126.5 24.8 128 25.5 125.5 27.2 C123 29 123 35 131.5 35.5 C135.5 35.8 138.5 33.5 140 31 Z"
          fill={p.paper}
        />
        <path
          d="M140 31 C138 23.5 131 19 124 22 C126.5 24.8 128 25.5 125.5 27.2 C123 29 123 35 131.5 35.5 C135.5 35.8 138.5 33.5 140 31 Z"
          fill={p.gold}
          fillOpacity="0.6"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <path d="M145 34 L139.5 31" stroke={p.ink} strokeWidth="1.1" />
        <path d="M136.5 29.8 L129.5 24.5" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.55" />
        <path d="M135.5 31.5 L128 29.8" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.55" />

        {/* Drifting Ginkgo Leaf 3 (bottom right) */}
        <path
          d="M154 114 C157 108 164 106 168 109.5 C165.8 111 164.8 111.5 166.2 113 C167.8 114.8 165 119 158.5 117.5 C156 117 154.8 115.5 154 114 Z"
          fill={p.paper}
        />
        <path
          d="M154 114 C157 108 164 106 168 109.5 C165.8 111 164.8 111.5 166.2 113 C167.8 114.8 165 119 158.5 117.5 C156 117 154.8 115.5 154 114 Z"
          fill={p.gold}
          fillOpacity="0.58"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path d="M149.5 115.5 L154.5 114" stroke={p.ink} strokeWidth="1.0" />

        {/* Diamond lozenges & gold leaf flakes */}
        <path d="M78 16 L80.5 12.5 L83 16 L80.5 19.5 Z" fill={p.gold} fillOpacity="0.82" />
        <path d="M168 20 L170.2 17 L172.4 20 L170.2 23 Z" fill={p.gold} fillOpacity="0.78" />
        <path d="M18 48 L19.8 45.5 L21.6 48 L19.8 50.5 Z" fill={p.gold} fillOpacity="0.72" />

        <circle cx="114" cy="14" r="1.5" fill={p.gold} fillOpacity="0.7" />
        <circle cx="52" cy="52" r="1.3" fill={p.leaf} fillOpacity="0.55" />
        <circle cx="190" cy="54" r="1.4" fill={p.gold} fillOpacity="0.65" />
        <circle cx="96" cy="112" r="1.3" fill={p.rose} fillOpacity="0.5" />
      </g>
    </svg>
  ),

  empty: (p: IllustrationPalette) => (
    <svg viewBox="0 0 136 90" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Tranquil ambient aura */}
      <ellipse cx="68" cy="54" rx="52" ry="26" fill={p.brandSoft} fillOpacity="0.22" />
      <ellipse cx="68" cy="60" rx="42" ry="18" fill={p.warm} fillOpacity="0.24" />
      <circle cx="80" cy="40" r="18" fill={p.gold} fillOpacity="0.12" />

      {/* Serene mist arc in upper sky */}
      <path
        d="M36 26 C54 16 82 16 100 26"
        stroke={p.ink}
        strokeWidth="0.9"
        strokeOpacity="0.24"
        strokeDasharray="2.5 3.5"
        strokeLinecap="round"
      />

      {/* Layer 2: Shallow Karesansui Zen Sand Tray & Small Wooden Rake */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Tray outer base & dark ceramic rim (100% opaque p.paper base) */}
        <ellipse cx="68" cy="57" rx="48" ry="18.5" fill={p.paper} />
        <ellipse
          cx="68"
          cy="57"
          rx="48"
          ry="18.5"
          fill={p.brand}
          fillOpacity="0.36"
          stroke={p.ink}
          strokeWidth="1.35"
        />

        {/* Inner white sand bed (opaque p.paper + warm sand tint) */}
        <ellipse cx="68" cy="55.5" rx="44" ry="15.5" fill={p.paper} stroke={p.ink} strokeWidth="1.15" />
        <ellipse cx="68" cy="55.5" rx="44" ry="15.5" fill={p.warm} fillOpacity="0.25" />

        {/* Small wooden zen rake (小木耙) resting quietly in front-left */}
        <path d="M18 68 L52 78" stroke={p.ink} strokeWidth="1.4" />
        <path
          d="M48 73 L55 75 L53 81 L46 79 Z"
          fill={p.paper}
        />
        <path
          d="M48 73 L55 75 L53 81 L46 79 Z"
          fill={p.gold}
          fillOpacity="0.52"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        <path d="M47 79.5 L45.5 82.5" stroke={p.ink} strokeWidth="1.0" />
        <path d="M49.5 80.2 L48 83.2" stroke={p.ink} strokeWidth="1.0" />
        <path d="M52 80.8 L50.5 83.8" stroke={p.ink} strokeWidth="1.0" />
      </g>

      {/* Layer 3: Concentric Karesansui Sand Ripples, Zen Stone, Moss & Fallen Ginkgo Leaf */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Peaceful concentric sand ripples (枯山水细波纹) */}
        <ellipse
          cx="74"
          cy="53.5"
          rx="18"
          ry="6.5"
          stroke={p.brand}
          strokeWidth="1.0"
          strokeOpacity="0.55"
        />
        <ellipse
          cx="74"
          cy="53.5"
          rx="25"
          ry="9.2"
          stroke={p.ink}
          strokeWidth="0.9"
          strokeOpacity="0.42"
        />
        <path
          d="M39 54 C42 46 56 41 74 41 C92 41 105 46 107 54 C105 62 92 66.5 74 66.5 C56 66.5 42 62 39 54 Z"
          stroke={p.brand}
          strokeWidth="0.95"
          strokeOpacity="0.45"
        />
        <path
          d="M28 55.5 C34 49 48 45 64 44"
          stroke={p.ink}
          strokeWidth="0.85"
          strokeOpacity="0.38"
        />
        <path
          d="M31 59.5 C38 64 52 67.5 68 68"
          stroke={p.ink}
          strokeWidth="0.85"
          strokeOpacity="0.38"
        />

        {/* Velvet moss bed under the stones */}
        <path
          d="M59 54 C58 50 64 48 75 48 C86 48 91 50.5 90 54.5 C89 57.5 60 57.5 59 54 Z"
          fill={p.paper}
        />
        <path
          d="M59 54 C58 50 64 48 75 48 C86 48 91 50.5 90 54.5 C89 57.5 60 57.5 59 54 Z"
          fill={p.leaf}
          fillOpacity="0.58"
          stroke={p.ink}
          strokeWidth="1.15"
        />

        {/* Main Serene Zen River Stone (静谧石子, opaque p.paper base) */}
        <path
          d="M65 52 C64 43 71 35 79 36 C86 37 90 44 88 52 C86 55 66 55 65 52 Z"
          fill={p.paper}
        />
        <path
          d="M65 52 C64 43 71 35 79 36 C86 37 90 44 88 52 C86 55 66 55 65 52 Z"
          fill={p.brand}
          fillOpacity="0.3"
        />
        {/* Stone shaded facet */}
        <path
          d="M75 36.2 C82 36.5 89 43 88 52 C84 54.2 76 54.5 72 53.5 C74 47 75 41 75 36.2 Z"
          fill={p.soft}
          fillOpacity="0.55"
        />
        <path
          d="M65 52 C64 43 71 35 79 36 C86 37 90 44 88 52 C86 55 66 55 65 52 Z"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        {/* Subtle stone texture line */}
        <path d="M70 46 C72 42 75 39 78 38.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.45" />

        {/* Smaller companion pebble */}
        <path
          d="M58 54.5 C57.5 50 61 47 65.5 47.5 C69.5 48 71.5 51 70.5 54.5 C69.5 56.5 58.5 56.5 58 54.5 Z"
          fill={p.paper}
        />
        <path
          d="M58 54.5 C57.5 50 61 47 65.5 47.5 C69.5 48 71.5 51 70.5 54.5 C69.5 56.5 58.5 56.5 58 54.5 Z"
          fill={p.warm}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="1.2"
        />

        {/* Single fallen golden Ginkgo leaf resting on the raked sand */}
        <path
          d="M39 54 C40 49 45 46 49.5 48 C48 49.8 47 50.2 48.5 51.2 C50.2 52.5 49.5 56.5 44 56.8 C41.5 57 39.8 55.8 39 54 Z"
          fill={p.paper}
        />
        <path
          d="M39 54 C40 49 45 46 49.5 48 C48 49.8 47 50.2 48.5 51.2 C50.2 52.5 49.5 56.5 44 56.8 C41.5 57 39.8 55.8 39 54 Z"
          fill={p.gold}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path d="M35.5 56 L39.2 54" stroke={p.ink} strokeWidth="1.0" />
      </g>

      {/* Layer 4: Floating gold leaf flakes & lozenge gems (no crosses) */}
      <path d="M48 25 L50 22.2 L52 25 L50 27.8 Z" fill={p.gold} fillOpacity="0.78" />
      <path d="M98 30 L99.8 27.5 L101.6 30 L99.8 32.5 Z" fill={p.gold} fillOpacity="0.72" />
      <circle cx="66" cy="20" r="1.3" fill={p.gold} fillOpacity="0.65" />
      <circle cx="28" cy="38" r="1.2" fill={p.brand} fillOpacity="0.5" />
      <circle cx="110" cy="44" r="1.3" fill={p.rose} fillOpacity="0.48" />
    </svg>
  ),
};
