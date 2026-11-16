import React from 'react';
import type { IllustrationPalette, ThemeIllustrationPack } from './types';

export const cloudscapePack: ThemeIllustrationPack = {
  greeting: (p: IllustrationPalette) => (
    <svg viewBox="0 0 112 44" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Pastel sky ambient glow */}
      <ellipse cx="56" cy="23" rx="46" ry="15" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="40" cy="24" r="13" fill={p.gold} fillOpacity="0.14" />
      <circle cx="74" cy="19" r="12" fill={p.rose} fillOpacity="0.12" />

      {/* Layer 2: Breeze lines & back cloud puff */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Soft breeze arc in background */}
        <path
          d="M12 22 C22 18 32 19 40 23"
          stroke={p.brand}
          strokeWidth="0.95"
          strokeOpacity="0.45"
        />
        {/* Dashed flight path entering the cloud from left */}
        <path
          d="M14 33 C22 35 30 32 36 28"
          stroke={p.ink}
          strokeWidth="1.0"
          strokeOpacity="0.5"
          strokeDasharray="2.2 2.8"
        />
      </g>

      {/* Layer 3: Fluffy Cloud Puff, Looping Trail & 3D Paper Airplane */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Fluffy cumulus cloud in center-left (100% opaque p.paper base) */}
        <path
          d="M24 34 C20 34 18 29.5 21.5 27 C20.5 22 25.5 18.5 30 20.5 C33 15 42 15 45 20.5 C49.5 19 54 22.5 53 27 C56.5 29 55 34 50.5 34 Z"
          fill={p.paper}
        />
        {/* Cloud lower soft shading */}
        <path
          d="M22 30.5 C27 32.5 46 32.5 53 29.5 C54.5 31.8 53 34 50.5 34 L24 34 C21.5 34 20.5 32.2 22 30.5 Z"
          fill={p.brandSoft}
          fillOpacity="0.55"
        />
        <path
          d="M24 34 C20 34 18 29.5 21.5 27 C20.5 22 25.5 18.5 30 20.5 C33 15 42 15 45 20.5 C49.5 19 54 22.5 53 27 C56.5 29 55 34 50.5 34 Z"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        {/* Inner cloud contour curl */}
        <path d="M31 24.5 C33.5 22.5 37.5 22.5 39.5 25" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.45" />

        {/* Dashed flight path emerging from cloud and looping up to paper plane */}
        <path
          d="M46 26 C55 24 62 29 58 34 C54 38 47 32 54 26 C60 21 67 21 73 19"
          stroke={p.ink}
          strokeWidth="1.05"
          strokeOpacity="0.6"
          strokeDasharray="2.5 2.8"
        />

        {/* 3D Hand-Folded Paper Airplane soaring up-right (100% opaque p.paper base) */}
        {/* Entire airplane silhouette base */}
        <path
          d="M66 17 L98 9 L84 28 L76 23.5 L73 28.5 L71.5 21 Z"
          fill={p.paper}
        />
        {/* Deep central fold valley (brand blue-teal shade) */}
        <path
          d="M71.5 21 L98 9 L76 23.5 L73 28.5 Z"
          fill={p.brand}
          fillOpacity="0.45"
        />
        {/* Right wing warm highlight & coral airmail stripe */}
        <path
          d="M76 23.5 L98 9 L84 28 Z"
          fill={p.warm}
          fillOpacity="0.32"
        />
        <path
          d="M80 25.2 L86.5 21 L85 26.6 L82.2 26.8 Z"
          fill={p.rose}
          fillOpacity="0.55"
        />
        {/* Airplane crisp outer & inner fold lines */}
        <path
          d="M66 17 L98 9 L84 28 L76 23.5 L71.5 21 Z"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        <path d="M98 9 L71.5 21 L73 28.5 L76 23.5 L98 9" stroke={p.ink} strokeWidth="1.15" />
      </g>

      {/* Layer 4: Sparkles & breeze curls */}
      <path
        d="M60 8 L60.8 10.4 L63.2 11.2 L60.8 12 L60 14.4 L59.2 12 L56.8 11.2 L59.2 10.4 Z"
        fill={p.gold}
        fillOpacity="0.85"
      />
      <path
        d="M88 32 C92 31 96 28 98 25"
        stroke={p.brand}
        strokeWidth="0.95"
        strokeOpacity="0.55"
        strokeLinecap="round"
      />
      <circle cx="28" cy="12" r="1.2" fill={p.gold} fillOpacity="0.65" />
      <circle cx="96" cy="19" r="1.2" fill={p.rose} fillOpacity="0.5" />
    </svg>
  ),

  cornerLeft: (p: IllustrationPalette) => (
    <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Bottom-left pastel sky wash */}
      <path d="M0 96 L0 24 C28 28 56 54 72 96 Z" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="28" cy="68" r="24" fill={p.gold} fillOpacity="0.14" />
      <circle cx="48" cy="80" r="16" fill={p.rose} fillOpacity="0.12" />

      {/* Layer 2: Distant cloud layer & upper breeze lines */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Distant sunlit cloud bank */}
        <path
          d="M0 64 C5 56 16 55 21 61 C26 53 39 54 43 63 C49 61 56 66 55 74 L0 74 Z"
          fill={p.paper}
        />
        <path
          d="M0 64 C5 56 16 55 21 61 C26 53 39 54 43 63 C49 61 56 66 55 74 L0 74 Z"
          fill={p.gold}
          fillOpacity="0.26"
          stroke={p.ink}
          strokeWidth="1.1"
        />

        {/* Sweeping breeze lines above clouds */}
        <path
          d="M6 44 C18 40 32 42 42 36 C47 33 46 28 41 28 C37 28 37 33 42 35"
          stroke={p.ink}
          strokeWidth="1.0"
          strokeOpacity="0.5"
        />
        <path
          d="M14 50 C28 48 44 50 58 44"
          stroke={p.brand}
          strokeWidth="1.05"
          strokeOpacity="0.55"
        />
      </g>

      {/* Layer 3: Foreground Multi-Layered Cumulus Clouds & Tiny Distant Paper Plane */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Mid-ground billowy cloud layer (100% opaque p.paper base) */}
        <path
          d="M0 75 C6 66 19 66 25 73 C31 64 47 65 52 75 C59 73 66 79 64 87 L0 87 Z"
          fill={p.paper}
        />
        <path
          d="M0 75 C6 66 19 66 25 73 C31 64 47 65 52 75 C59 73 66 79 64 87 L0 87 Z"
          fill={p.brand}
          fillOpacity="0.26"
          stroke={p.ink}
          strokeWidth="1.2"
        />

        {/* Foreground main fluffy cumulus cloud anchored at (0, 96) (opaque p.paper base) */}
        <path
          d="M0 84 C5 76 17 75 23 82 C29 72 45 72 51 82 C57 78 67 81 69 89 C75 89 79 92 79 96 L0 96 Z"
          fill={p.paper}
        />
        {/* Warm sunlit top rim & soft blue-grey bottom belly */}
        <path
          d="M0 90 C22 88 52 90 77 93 L79 96 L0 96 Z"
          fill={p.brandSoft}
          fillOpacity="0.6"
        />
        <path
          d="M0 84 C5 76 17 75 23 82 C29 72 45 72 51 82 C57 78 67 81 69 89 C75 89 79 92 79 96"
          stroke={p.ink}
          strokeWidth="1.35"
        />

        {/* Delicate inner cloud puff curves */}
        <path d="M14 85 C17 81 23 81 26 85" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.5" />
        <path d="M35 83 C39 79 46 80 49 85" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.5" />
        <path d="M54 88 C57 85 62 86 64 90" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.45" />

        {/* Foreground sweeping wind ribbon across lower clouds */}
        <path
          d="M8 91 C26 93 46 88 66 82 C72 80 75 75 71 73 C68 71.5 65 75 69 78"
          stroke={p.ink}
          strokeWidth="1.05"
          strokeOpacity="0.55"
        />

        {/* Tiny paper airplane gliding high above the cloud bank */}
        <path
          d="M46 23 L65 17 L57 29 L52 26.5 L50 29.5 L49 25 Z"
          fill={p.paper}
        />
        <path
          d="M49 25 L65 17 L52 26.5 L50 29.5 Z"
          fill={p.brand}
          fillOpacity="0.45"
        />
        <path
          d="M46 23 L65 17 L57 29 L52 26.5 L49 25 Z"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        <path
          d="M32 29 C37 29 42 27.5 46 25.5"
          stroke={p.ink}
          strokeWidth="0.9"
          strokeOpacity="0.45"
          strokeDasharray="2 2.5"
        />
      </g>

      {/* Layer 4: Sparkles & sky motes */}
      <path
        d="M22 22 L22.9 24.5 L25.5 25.4 L22.9 26.3 L22 28.8 L21.1 26.3 L18.5 25.4 L21.1 24.5 Z"
        fill={p.gold}
        fillOpacity="0.82"
      />
      <circle cx="14" cy="34" r="1.3" fill={p.gold} fillOpacity="0.65" />
      <circle cx="58" cy="36" r="1.2" fill={p.rose} fillOpacity="0.5" />
      <circle cx="66" cy="58" r="1.3" fill={p.brand} fillOpacity="0.5" />
    </svg>
  ),

  cornerRight: (p: IllustrationPalette) => (
    <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Bottom-right pastel sky wash */}
      <path d="M96 96 L96 24 C68 28 44 54 24 96 Z" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="68" cy="64" r="24" fill={p.gold} fillOpacity="0.15" />
      <circle cx="52" cy="80" r="16" fill={p.rose} fillOpacity="0.13" />

      {/* Layer 2: Breeze arcs, kite string & corner cloud puff */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Soft cloud puff tucked at bottom-right (100% opaque p.paper base) */}
        <path
          d="M46 96 C46 90 52 86 58 88 C62 80 74 79 80 86 C85 82 93 84 96 90 L96 96 Z"
          fill={p.paper}
        />
        <path
          d="M46 96 C46 90 52 86 58 88 C62 80 74 79 80 86 C85 82 93 84 96 90 L96 96 Z"
          fill={p.brandSoft}
          fillOpacity="0.48"
          stroke={p.ink}
          strokeWidth="1.2"
        />

        {/* Breeze line behind kite */}
        <path
          d="M32 54 C42 46 56 42 74 44"
          stroke={p.brand}
          strokeWidth="0.95"
          strokeOpacity="0.45"
          strokeDasharray="2.5 3"
        />

        {/* Taut kite string anchored toward bottom-left/bottom */}
        <path
          d="M54 45 C46 62 38 78 28 94"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.55"
        />
      </g>

      {/* Layer 3: Diamond Paper Kite & Long Flowing Ribbon Tail */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Long S-curved kite tail ribbon extending toward bottom-right */}
        <path
          d="M62 59 C68 67 60 76 69 82 C77 87 86 78 91 88"
          stroke={p.ink}
          strokeWidth="1.25"
        />

        {/* Ribbon bow 1 on tail (coral rose) */}
        <path
          d="M65 66 L59 64 L61 70 L65 66 L71 68 L69 62 Z"
          fill={p.paper}
        />
        <path
          d="M65 66 L59 64 L61 70 L65 66 L71 68 L69 62 Z"
          fill={p.rose}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="1.0"
        />

        {/* Ribbon bow 2 on tail (warm gold) */}
        <path
          d="M65.5 78 L59.5 77.5 L62 83 L65.5 78 L71.5 78.5 L69 73 Z"
          fill={p.paper}
        />
        <path
          d="M65.5 78 L59.5 77.5 L62 83 L65.5 78 L71.5 78.5 L69 73 Z"
          fill={p.gold}
          fillOpacity="0.68"
          stroke={p.ink}
          strokeWidth="1.0"
        />

        {/* Ribbon bow 3 on tail (sage leaf) */}
        <path
          d="M80 83.5 L75 86.5 L79 90.5 L80 83.5 L85 80.5 L81 76.5 Z"
          fill={p.paper}
        />
        <path
          d="M80 83.5 L75 86.5 L79 90.5 L80 83.5 L85 80.5 L81 76.5 Z"
          fill={p.leaf}
          fillOpacity="0.6"
          stroke={p.ink}
          strokeWidth="1.0"
        />

        {/* Diamond Paper Kite Body (100% opaque p.paper base) */}
        <path
          d="M46 21 L72 34 L62 59 L36 40 Z"
          fill={p.paper}
        />
        {/* Four pastel harlequin quadrants on kite */}
        {/* Top-left quadrant (brand sky blue) */}
        <path
          d="M46 21 L54 40 L36 40 Z"
          fill={p.brand}
          fillOpacity="0.45"
        />
        {/* Top-right quadrant (warm gold) */}
        <path
          d="M46 21 L72 34 L54 40 Z"
          fill={p.gold}
          fillOpacity="0.48"
        />
        {/* Bottom-left quadrant (warm cream) */}
        <path
          d="M36 40 L54 40 L62 59 Z"
          fill={p.warm}
          fillOpacity="0.45"
        />
        {/* Bottom-right quadrant (coral rose) */}
        <path
          d="M54 40 L72 34 L62 59 Z"
          fill={p.rose}
          fillOpacity="0.45"
        />

        {/* Kite bamboo frame spars & outer outline */}
        <path
          d="M46 21 L72 34 L62 59 L36 40 Z"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        {/* Spine spar */}
        <path d="M46 21 L62 59" stroke={p.ink} strokeWidth="1.15" />
        {/* Curved bow spar */}
        <path d="M36 40 C46 35 60 32 72 34" stroke={p.ink} strokeWidth="1.15" />

        {/* Small corner tassels on left and right wingtips of kite */}
        <path d="M36 40 C33 42 31 45 31 48" stroke={p.rose} strokeWidth="1.4" />
        <path d="M72 34 C76 35 79 37 80 40" stroke={p.gold} strokeWidth="1.4" />
        <circle cx="54" cy="36.5" r="1.6" fill={p.paper} stroke={p.ink} strokeWidth="0.95" />
      </g>

      {/* Layer 4: Sparkles & breeze dots */}
      <path
        d="M32 24 L32.9 26.5 L35.5 27.4 L32.9 28.3 L32 30.8 L31.1 28.3 L28.5 27.4 L31.1 26.5 Z"
        fill={p.gold}
        fillOpacity="0.82"
      />
      <path
        d="M82 52 L82.7 54 L84.7 54.7 L82.7 55.4 L82 57.4 L81.3 55.4 L79.3 54.7 L81.3 54 Z"
        fill={p.gold}
        fillOpacity="0.75"
      />
      <circle cx="64" cy="18" r="1.3" fill={p.gold} fillOpacity="0.65" />
      <circle cx="42" cy="68" r="1.2" fill={p.brand} fillOpacity="0.5" />
      <circle cx="86" cy="28" r="1.2" fill={p.rose} fillOpacity="0.5" />
    </svg>
  ),

  celebration: (p: IllustrationPalette) => (
    <svg viewBox="0 0 210 132" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Pastel Sky Glow & Soft Rainbow Shimmer Arc */}
      <ellipse cx="105" cy="70" rx="86" ry="46" fill={p.brandSoft} fillOpacity="0.24" />
      <ellipse cx="70" cy="56" rx="46" ry="32" fill={p.gold} fillOpacity="0.14" />
      <ellipse cx="144" cy="64" rx="48" ry="34" fill={p.rose} fillOpacity="0.12" />

      {/* Translucent 3-band pastel rainbow arc across upper sky */}
      <g strokeLinecap="round">
        <path
          d="M38 68 C48 24 162 24 172 68"
          stroke={p.rose}
          strokeWidth="3.5"
          strokeOpacity="0.2"
        />
        <path
          d="M42 68 C52 28 158 28 168 68"
          stroke={p.gold}
          strokeWidth="3.5"
          strokeOpacity="0.22"
        />
        <path
          d="M46 68 C56 32 154 32 164 68"
          stroke={p.brand}
          strokeWidth="3.5"
          strokeOpacity="0.2"
        />
      </g>

      {/* Layer 2: Distant Cloud Horizon, Striped Hot Air Balloon & Back Trajectory */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Distant sunlit cloud bank spanning lower background */}
        <path
          d="M20 92 C18 82 28 75 37 79 C43 68 59 68 65 78 C73 70 88 71 94 80 C102 68 122 68 130 80 C138 71 154 72 160 81 C169 76 182 81 182 92 Z"
          fill={p.paper}
        />
        <path
          d="M20 92 C18 82 28 75 37 79 C43 68 59 68 65 78 C73 70 88 71 94 80 C102 68 122 68 130 80 C138 71 154 72 160 81 C169 76 182 81 182 92 Z"
          fill={p.warm}
          fillOpacity="0.35"
          stroke={p.ink}
          strokeWidth="1.15"
        />

        {/* Small Striped Hot Air Balloon rising in upper-left sky */}
        {/* Suspension ropes */}
        <path d="M47 50 L49 56" stroke={p.ink} strokeWidth="0.9" />
        <path d="M57 50 L55 56" stroke={p.ink} strokeWidth="0.9" />

        {/* Wicker basket (opaque p.paper base) */}
        <rect x="48" y="56" width="8" height="6.5" rx="1.5" fill={p.paper} />
        <rect
          x="48"
          y="56"
          width="8"
          height="6.5"
          rx="1.5"
          fill={p.gold}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        <path d="M48 59.2 L56 59.2" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.6" />

        {/* Hot Air Balloon Envelope (100% opaque p.paper base) */}
        <path
          d="M52 18 C40 18 34 28 38 38 C41 44 45 48 46.5 50.5 L57.5 50.5 C59 48 63 44 66 38 C70 28 64 18 52 18 Z"
          fill={p.paper}
        />
        {/* Left & right coral stripes */}
        <path
          d="M52 18 C40 18 34 28 38 38 C41 44 45 48 46.5 50.5 L49.2 50.5 C48 46 44 40 44 31 C44 23 47.5 18.5 52 18 Z"
          fill={p.rose}
          fillOpacity="0.52"
        />
        <path
          d="M52 18 C64 18 70 28 66 38 C63 44 59 48 57.5 50.5 L54.8 50.5 C56 46 60 40 60 31 C60 23 56.5 18.5 52 18 Z"
          fill={p.rose}
          fillOpacity="0.52"
        />
        {/* Center golden stripe */}
        <path
          d="M52 18 C49.5 18.5 48 23.5 48 31 C48 40 50 46 50.8 50.5 L53.2 50.5 C54 46 56 40 56 31 C56 23.5 54.5 18.5 52 18 Z"
          fill={p.gold}
          fillOpacity="0.55"
        />
        {/* Balloon gore ribs & scalloped equator band */}
        <path
          d="M52 18 C44 19 42 36 47.5 50.5"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.65"
        />
        <path
          d="M52 18 C60 19 62 36 56.5 50.5"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.65"
        />
        <path
          d="M36.5 31 Q41 34 45.5 31 Q52 34 58.5 31 Q63 34 67.5 31"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.6"
        />
        {/* Balloon outer outline */}
        <path
          d="M52 18 C40 18 34 28 38 38 C41 44 45 48 46.5 50.5 L57.5 50.5 C59 48 63 44 66 38 C70 28 64 18 52 18 Z"
          stroke={p.ink}
          strokeWidth="1.25"
        />

        {/* First segment of dashed trajectory starting from bottom-left */}
        <path
          d="M22 104 C38 102 54 94 68 82"
          stroke={p.ink}
          strokeWidth="1.15"
          strokeOpacity="0.55"
          strokeDasharray="3 3.5"
        />
      </g>

      {/* Layer 3: Foreground Cumulus Cloud Sea, Looping Flight Path & Hero 3D Paper Airplane */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Left foreground billowy cloud cluster (100% opaque p.paper base) */}
        <path
          d="M24 108 C16 108 12 100 18 94 C16 85 25 78 34 82 C40 72 56 72 62 82 C70 79 79 85 77 94 C83 97 81 108 72 108 Z"
          fill={p.paper}
        />
        <path
          d="M18 101 C30 105 62 105 77 100 C79 104 76 108 72 108 L24 108 C19 108 16.5 104.5 18 101 Z"
          fill={p.brandSoft}
          fillOpacity="0.6"
        />
        <path
          d="M24 108 C16 108 12 100 18 94 C16 85 25 78 34 82 C40 72 56 72 62 82 C70 79 79 85 77 94 C83 97 81 108 72 108 Z"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        <path d="M35 89 C39 85 46 85 50 89" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.5" />

        {/* Right foreground billowy cloud cluster (100% opaque p.paper base) */}
        <path
          d="M114 110 C106 110 102 102 108 96 C106 87 116 80 125 84 C132 72 150 72 157 84 C165 79 177 84 176 94 C184 96 184 110 173 110 Z"
          fill={p.paper}
        />
        <path
          d="M108 103 C124 107 160 107 177 102 C180 106 177 110 173 110 L114 110 C109 110 106.5 106.5 108 103 Z"
          fill={p.brandSoft}
          fillOpacity="0.6"
        />
        <path
          d="M114 110 C106 110 102 102 108 96 C106 87 116 80 125 84 C132 72 150 72 157 84 C165 79 177 84 176 94 C184 96 184 110 173 110 Z"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        <path d="M128 91 C133 86 142 86 147 91" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.5" />
        <path d="M152 95 C156 92 162 92 165 96" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.45" />

        {/* Center-front plush cloud puff bridging the sea (opaque p.paper base) */}
        <path
          d="M66 114 C59 114 56 106 62 101 C61 93 70 88 78 91 C84 82 99 82 105 91 C113 88 122 93 120 101 C126 106 123 114 115 114 Z"
          fill={p.paper}
        />
        <path
          d="M61 108 C75 111.5 106 111.5 121 107.5 C123 111 120 114 115 114 L66 114 C61 114 59 111 61 108 Z"
          fill={p.brand}
          fillOpacity="0.24"
        />
        <path
          d="M66 114 C59 114 56 106 62 101 C61 93 70 88 78 91 C84 82 99 82 105 91 C113 88 122 93 120 101 C126 106 123 114 115 114 Z"
          stroke={p.ink}
          strokeWidth="1.35"
        />

        {/* Graceful Looping Dashed Trajectory soaring out of the clouds up to the paper plane */}
        <path
          d="M68 82 C84 68 106 64 110 75 C114 86 92 92 86 78 C80 64 98 48 128 45"
          stroke={p.ink}
          strokeWidth="1.25"
          strokeOpacity="0.68"
          strokeDasharray="3.2 3.5"
        />
        {/* Parallel subtle wind stream accompanying the loop */}
        <path
          d="M78 66 C86 54 104 46 124 42"
          stroke={p.brand}
          strokeWidth="1.0"
          strokeOpacity="0.5"
        />

        {/* Hero 3D Hand-Folded Paper Airplane (100% opaque p.paper base) */}
        {/* Complete paper airplane silhouette base */}
        <path
          d="M116 34 L182 18 L154 58 L138 47 L131 58 L128 42 Z"
          fill={p.paper}
        />
        {/* Upper-left wing warm sunlit tint */}
        <path
          d="M116 34 L182 18 L128 42 Z"
          fill={p.warm}
          fillOpacity="0.28"
        />
        {/* Deep central fold valley & keel (brand sky-blue shading) */}
        <path
          d="M128 42 L182 18 L138 47 L131 58 Z"
          fill={p.brand}
          fillOpacity="0.46"
        />
        {/* Underside keel shadow */}
        <path
          d="M131 58 L138 47 L144 51 Z"
          fill={p.ink}
          fillOpacity="0.18"
        />
        {/* Lower-right wing decorative airmail stripes (coral rose & gold) */}
        <path
          d="M145 51.8 L158.5 42.5 L156 55 L149.5 54.8 Z"
          fill={p.rose}
          fillOpacity="0.58"
        />
        <path
          d="M159 41.5 L164.5 37.5 L162.5 45.8 L157.5 49 Z"
          fill={p.gold}
          fillOpacity="0.65"
        />

        {/* Crisp 3D paper fold outlines */}
        <path
          d="M116 34 L182 18 L154 58 L138 47 L128 42 Z"
          stroke={p.ink}
          strokeWidth="1.4"
        />
        <path
          d="M182 18 L128 42 L131 58 L138 47 L182 18"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        <path d="M131 58 L143.5 50.8" stroke={p.ink} strokeWidth="1.2" />
      </g>

      {/* Layer 4: Breeze Swirls, Twinkling Sunlit Stars & Sky Dust */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Sweeping breeze curl near wingtip */}
        <path
          d="M162 62 C172 60 182 54 188 46 C191 42 188 38 184 40 C181 42 183 46 187 46"
          stroke={p.brand}
          strokeWidth="1.05"
          strokeOpacity="0.6"
        />
        <path
          d="M18 68 C28 65 36 67 44 63"
          stroke={p.brand}
          strokeWidth="1.0"
          strokeOpacity="0.5"
        />

        {/* Twinkling four-point stars */}
        <path
          d="M104 20 L105.2 23.5 L108.8 24.8 L105.2 26 L104 29.5 L102.8 26 L99.2 24.8 L102.8 23.5 Z"
          fill={p.gold}
          fillOpacity="0.88"
        />
        <path
          d="M144 12 L144.9 14.6 L147.5 15.5 L144.9 16.4 L144 19 L143.1 16.4 L140.5 15.5 L143.1 14.6 Z"
          fill={p.gold}
          fillOpacity="0.82"
        />
        <path
          d="M24 44 L24.9 46.6 L27.5 47.5 L24.9 48.4 L24 51 L23.1 48.4 L20.5 47.5 L23.1 46.6 Z"
          fill={p.gold}
          fillOpacity="0.78"
        />
        <path
          d="M188 72 L188.8 74.4 L191.2 75.2 L188.8 76 L188 78.4 L187.2 76 L184.8 75.2 L187.2 74.4 Z"
          fill={p.gold}
          fillOpacity="0.75"
        />

        {/* Floating sky motes */}
        <circle cx="78" cy="24" r="1.4" fill={p.gold} fillOpacity="0.65" />
        <circle cx="122" cy="18" r="1.3" fill={p.brand} fillOpacity="0.55" />
        <circle cx="190" cy="28" r="1.4" fill={p.rose} fillOpacity="0.5" />
        <circle cx="48" cy="116" r="1.3" fill={p.gold} fillOpacity="0.6" />
        <circle cx="142" cy="118" r="1.3" fill={p.brand} fillOpacity="0.5" />
      </g>
    </svg>
  ),

  empty: (p: IllustrationPalette) => (
    <svg viewBox="0 0 136 90" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Calm Sky Aura & Soft Sun Halo */}
      <ellipse cx="68" cy="54" rx="52" ry="26" fill={p.brandSoft} fillOpacity="0.22" />
      <circle cx="52" cy="34" r="18" fill={p.gold} fillOpacity="0.15" />
      <ellipse cx="68" cy="68" rx="42" ry="12" fill={p.warm} fillOpacity="0.22" />

      {/* Layer 2: Gentle Air Ripples & Distant Cloud Wisp */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Calm air ripple lines beneath the cloud boat */}
        <path
          d="M22 72 C46 75 90 75 114 72"
          stroke={p.brand}
          strokeWidth="1.05"
          strokeOpacity="0.45"
        />
        <path
          d="M36 77 C56 79 80 79 100 77"
          stroke={p.ink}
          strokeWidth="0.85"
          strokeOpacity="0.35"
          strokeDasharray="3 3.5"
        />

        {/* Faint landing trail behind the parked paper plane */}
        <path
          d="M24 38 C32 34 42 35 50 38"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.4"
          strokeDasharray="2.2 2.8"
        />
      </g>

      {/* Layer 3: Plump White Sail-Cloud & Resting Folded Paper Airplane */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Back puff of the cloud cradle */}
        <path
          d="M42 52 C44 43 55 40 62 46 C68 39 81 40 86 48 C91 45 98 48 98 54 Z"
          fill={p.paper}
        />
        <path
          d="M42 52 C44 43 55 40 62 46 C68 39 81 40 86 48 C91 45 98 48 98 54 Z"
          fill={p.warm}
          fillOpacity="0.38"
          stroke={p.ink}
          strokeWidth="1.15"
        />

        {/* Folded Paper Airplane resting peacefully on the cloud (100% opaque p.paper base) */}
        <path
          d="M48 41 L92 26 L75 51 L63 44.5 L58 51.5 L56 42 Z"
          fill={p.paper}
        />
        {/* Central fold valley (brand sky blue) */}
        <path
          d="M56 42 L92 26 L63 44.5 L58 51.5 Z"
          fill={p.brand}
          fillOpacity="0.45"
        />
        {/* Wingtip coral & gold airmail stripe */}
        <path
          d="M68 46.8 L77.5 39.5 L75.8 49.2 L71.2 48.8 Z"
          fill={p.rose}
          fillOpacity="0.55"
        />
        {/* Paper airplane crisp outlines */}
        <path
          d="M48 41 L92 26 L75 51 L63 44.5 L56 42 Z"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        <path
          d="M92 26 L56 42 L58 51.5 L63 44.5 L92 26"
          stroke={p.ink}
          strokeWidth="1.2"
        />

        {/* Foreground Plump Sail-Cloud cradling the airplane (100% opaque p.paper base) */}
        <path
          d="M34 68 C26 68 23 60 29 54 C28 46 37 41 45 45 C50 49 58 50 65 47 C72 41 84 42 89 50 C96 47 105 51 104 59 C110 62 107 68 99 68 Z"
          fill={p.paper}
        />
        {/* Soft pastel underside shading on cloud */}
        <path
          d="M27 62 C44 66 88 66 105 61.5 C107 65 104 68 99 68 L34 68 C29 68 25.5 65 27 62 Z"
          fill={p.brandSoft}
          fillOpacity="0.6"
        />
        <path
          d="M34 68 C26 68 23 60 29 54 C28 46 37 41 45 45 C50 49 58 50 65 47 C72 41 84 42 89 50 C96 47 105 51 104 59 C110 62 107 68 99 68 Z"
          stroke={p.ink}
          strokeWidth="1.35"
        />

        {/* Cozy inner cloud dimples */}
        <path d="M40 56 C44 52.5 51 52.5 55 56.5" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.5" />
        <path d="M74 55 C78 51.5 85 52 88 56" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.5" />
      </g>

      {/* Layer 4: Quiet Sparkles & Breeze Motes */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M42 20 L42.8 22.4 L45.2 23.2 L42.8 24 L42 26.4 L41.2 24 L38.8 23.2 L41.2 22.4 Z"
          fill={p.gold}
          fillOpacity="0.82"
        />
        <path
          d="M104 34 L104.7 35.8 L106.5 36.5 L104.7 37.2 L104 39 L103.3 37.2 L101.5 36.5 L103.3 35.8 Z"
          fill={p.gold}
          fillOpacity="0.75"
        />
        <circle cx="66" cy="22" r="1.3" fill={p.gold} fillOpacity="0.65" />
        <circle cx="22" cy="48" r="1.2" fill={p.brand} fillOpacity="0.5" />
        <circle cx="112" cy="52" r="1.2" fill={p.rose} fillOpacity="0.5" />
      </g>
    </svg>
  ),
};
