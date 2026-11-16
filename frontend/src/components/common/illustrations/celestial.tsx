import React from 'react';
import type { IllustrationPalette, ThemeIllustrationPack } from './types';

export const celestialPack: ThemeIllustrationPack = {
  greeting: (p: IllustrationPalette) => (
    <svg viewBox="0 0 112 44" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Ambient nebula glow */}
      <ellipse cx="56" cy="22" rx="44" ry="15" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="48" cy="21" r="14" fill={p.gold} fillOpacity="0.14" />
      <circle cx="66" cy="23" r="12" fill={p.rose} fillOpacity="0.12" />

      {/* Layer 2: Dashed constellation lines & background orbit */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Constellation line on left */}
        <path
          d="M14 28 L24 19 L34 23 L42 14"
          stroke={p.ink}
          strokeWidth="0.9"
          strokeOpacity="0.45"
          strokeDasharray="2 2.5"
        />
        <circle cx="14" cy="28" r="1.4" fill={p.gold} stroke={p.ink} strokeWidth="0.8" />
        <circle cx="24" cy="19" r="1.6" fill={p.paper} stroke={p.ink} strokeWidth="0.9" />
        <circle cx="34" cy="23" r="1.3" fill={p.brand} />

        {/* Constellation line on right */}
        <path
          d="M72 28 L83 31 L91 20 L99 24"
          stroke={p.ink}
          strokeWidth="0.9"
          strokeOpacity="0.45"
          strokeDasharray="2 2.5"
        />
        <circle cx="83" cy="31" r="1.5" fill={p.paper} stroke={p.ink} strokeWidth="0.9" />
        <circle cx="91" cy="20" r="1.6" fill={p.gold} stroke={p.ink} strokeWidth="0.8" />
        <circle cx="99" cy="24" r="1.3" fill={p.rose} />

        {/* Back half of brass astrolabe ring */}
        <path
          d="M35 28 C32 22 42 14 57 12 C72 10 82 14 79 20"
          stroke={p.ink}
          strokeWidth="1.05"
          strokeOpacity="0.5"
        />
      </g>

      {/* Layer 3: Foreground Crescent Moon, Small Planet & Brass Orbit Ring */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Small violet-rose planet cradled near moon */}
        <circle cx="62" cy="19" r="4.8" fill={p.paper} />
        <circle cx="62" cy="19" r="4.8" fill={p.brand} fillOpacity="0.42" stroke={p.ink} strokeWidth="1.15" />
        <path
          d="M58.5 17 C60.5 18.5 63.5 18.5 65.8 17"
          stroke={p.rose}
          strokeWidth="1.1"
          strokeOpacity="0.65"
        />

        {/* Golden Crescent Moon (opaque p.paper base + warm gold overlay) */}
        <path
          d="M55 7 C45.5 8.5 39.5 17.5 41.5 27 C43.5 36.5 53 41.5 62.5 38.5 C53 38 47 31 47.5 21.5 C47.8 15 50.8 9.8 55 7 Z"
          fill={p.paper}
        />
        <path
          d="M55 7 C45.5 8.5 39.5 17.5 41.5 27 C43.5 36.5 53 41.5 62.5 38.5 C53 38 47 31 47.5 21.5 C47.8 15 50.8 9.8 55 7 Z"
          fill={p.gold}
          fillOpacity="0.58"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        {/* Subtle inner highlight on crescent */}
        <path
          d="M46 16 C44 21 44.5 27 47.5 31.5"
          stroke={p.paper}
          strokeWidth="1.2"
          strokeOpacity="0.75"
        />

        {/* Front half of tilted brass astrolabe ring overlapping moon & planet */}
        <path
          d="M79 20 C76 26 63 32 49 33.5 C39 34.5 36 31.5 35 28"
          stroke={p.gold}
          strokeWidth="2.6"
          strokeOpacity="0.75"
        />
        <path
          d="M79 20 C76 26 63 32 49 33.5 C39 34.5 36 31.5 35 28"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        {/* Orbital brass bead on ring */}
        <circle cx="74" cy="24.5" r="2.1" fill={p.paper} />
        <circle cx="74" cy="24.5" r="2.1" fill={p.gold} stroke={p.ink} strokeWidth="1.0" />
      </g>

      {/* Layer 4: Twinkling four-point stars & stardust */}
      <path
        d="M56 8 L56.8 10.4 L59.2 11.2 L56.8 12 L56 14.4 L55.2 12 L52.8 11.2 L55.2 10.4 Z"
        fill={p.gold}
        fillOpacity="0.9"
      />
      <path
        d="M29 9 L29.7 11 L31.7 11.7 L29.7 12.4 L29 14.4 L28.3 12.4 L26.3 11.7 L28.3 11 Z"
        fill={p.gold}
        fillOpacity="0.8"
      />
      <path
        d="M84 9 L84.6 10.8 L86.4 11.4 L84.6 12 L84 13.8 L83.4 12 L81.6 11.4 L83.4 10.8 Z"
        fill={p.gold}
        fillOpacity="0.75"
      />
      <circle cx="40" cy="37" r="1.2" fill={p.gold} fillOpacity="0.65" />
      <circle cx="68" cy="36" r="1.1" fill={p.brand} fillOpacity="0.55" />
    </svg>
  ),

  cornerLeft: (p: IllustrationPalette) => (
    <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Bottom-left nebula watercolor wash */}
      <path d="M0 96 L0 24 C28 28 56 54 72 96 Z" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="28" cy="66" r="24" fill={p.rose} fillOpacity="0.13" />
      <circle cx="46" cy="48" r="18" fill={p.gold} fillOpacity="0.14" />

      {/* Layer 2: Celestial arc, constellation trail & ringed Saturn */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Dashed celestial coordinate arc */}
        <path
          d="M8 36 C28 32 52 44 66 68"
          stroke={p.ink}
          strokeWidth="0.9"
          strokeOpacity="0.35"
          strokeDasharray="2.5 3"
        />

        {/* Constellation line in upper-left sky */}
        <path
          d="M14 26 L26 18 L39 22 L48 13"
          stroke={p.ink}
          strokeWidth="0.9"
          strokeOpacity="0.5"
          strokeDasharray="2 2.5"
        />
        <circle cx="14" cy="26" r="1.5" fill={p.gold} stroke={p.ink} strokeWidth="0.85" />
        <circle cx="26" cy="18" r="1.8" fill={p.paper} stroke={p.ink} strokeWidth="0.95" />
        <circle cx="39" cy="22" r="1.4" fill={p.brand} />
        <circle cx="48" cy="13" r="1.7" fill={p.gold} stroke={p.ink} strokeWidth="0.85" />

        {/* Small Ringed Saturn in upper-right of telescope view */}
        <circle cx="67" cy="30" r="5.5" fill={p.paper} />
        <circle cx="67" cy="30" r="5.5" fill={p.brand} fillOpacity="0.4" stroke={p.ink} strokeWidth="1.15" />
        <path
          d="M57 33.5 C61 35 73 29.5 77 26.5"
          stroke={p.gold}
          strokeWidth="2.2"
          strokeOpacity="0.8"
        />
        <path
          d="M57 33.5 C60 35.5 74 29.5 77 26.5"
          stroke={p.ink}
          strokeWidth="1.05"
        />
      </g>

      {/* Layer 3: Vintage Desktop Brass Monocular Telescope on Tripod */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Tripod legs anchored at bottom-left */}
        {/* Back leg */}
        <path d="M27 70 L29 96" stroke={p.ink} strokeWidth="2.2" />
        {/* Left leg */}
        <path
          d="M24 69 L8 96 L12.5 96 L27 70 Z"
          fill={p.paper}
        />
        <path
          d="M24 69 L8 96 L12.5 96 L27 70 Z"
          fill={p.warm}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        {/* Right leg */}
        <path
          d="M28 69 L45 96 L40.5 96 L25 70 Z"
          fill={p.paper}
        />
        <path
          d="M28 69 L45 96 L40.5 96 L25 70 Z"
          fill={p.warm}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        {/* Tripod spreader bar & brass mount */}
        <path d="M16 84 L37 84" stroke={p.gold} strokeWidth="2.0" />
        <path d="M16 84 L37 84" stroke={p.ink} strokeWidth="1.0" />
        <path d="M26 61 L26 70" stroke={p.ink} strokeWidth="2.4" />
        <circle cx="26" cy="70" r="3.5" fill={p.paper} />
        <circle cx="26" cy="70" r="3.5" fill={p.gold} fillOpacity="0.75" stroke={p.ink} strokeWidth="1.2" />

        {/* Small finder scope on top of main tube */}
        <path d="M21 56 L19 52.5" stroke={p.ink} strokeWidth="1.2" />
        <path d="M31 50 L29 46.5" stroke={p.ink} strokeWidth="1.2" />
        <path
          d="M15 53 L31 43.5 L32.8 46.5 L16.8 56 Z"
          fill={p.paper}
        />
        <path
          d="M15 53 L31 43.5 L32.8 46.5 L16.8 56 Z"
          fill={p.gold}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="1.05"
        />

        {/* Main Telescope Tube (100% opaque p.paper base, angled toward top-right) */}
        {/* Eyepiece at lower-left */}
        <path
          d="M6 68.5 L13 64 L16 69 L9 73.5 Z"
          fill={p.paper}
        />
        <path
          d="M6 68.5 L13 64 L16 69 L9 73.5 Z"
          fill={p.brand}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="1.15"
        />

        {/* Main tapered brass barrel */}
        <path
          d="M12 63 L46 42 L52 51.5 L17 70.5 Z"
          fill={p.paper}
        />
        <path
          d="M12 63 L46 42 L52 51.5 L17 70.5 Z"
          fill={p.gold}
          fillOpacity="0.48"
        />
        {/* Violet leather wrap section in middle of telescope */}
        <path
          d="M21 57.5 L36 48.2 L41.2 57.2 L25.5 65.8 Z"
          fill={p.brand}
          fillOpacity="0.38"
        />
        {/* Metallic highlight stripe along upper barrel */}
        <path
          d="M13.5 64 L47 43.5 L48.5 45.8 L15 66.2 Z"
          fill={p.paper}
          fillOpacity="0.5"
        />
        <path
          d="M12 63 L46 42 L52 51.5 L17 70.5 Z"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        <path d="M21 57.5 L25.5 65.8" stroke={p.ink} strokeWidth="1.1" />
        <path d="M36 48.2 L41.2 57.2" stroke={p.ink} strokeWidth="1.1" />

        {/* Objective lens hood & glass lens at upper-right end */}
        <path
          d="M45 41 L53 36 L60 47.5 L52 52.5 Z"
          fill={p.paper}
        />
        <path
          d="M45 41 L53 36 L60 47.5 L52 52.5 Z"
          fill={p.gold}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        <ellipse
          cx="56.5"
          cy="41.8"
          rx="2.8"
          ry="6.6"
          transform="rotate(-31 56.5 41.8)"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <ellipse
          cx="56.5"
          cy="41.8"
          rx="2.8"
          ry="6.6"
          transform="rotate(-31 56.5 41.8)"
          fill={p.brandSoft}
          fillOpacity="0.65"
        />

        {/* Brass mounting ring clamping the barrel */}
        <circle cx="26" cy="59.5" r="2.8" fill={p.gold} stroke={p.ink} strokeWidth="1.15" />
      </g>

      {/* Layer 4: Twinkling stars & stardust */}
      <path
        d="M56 16 L57 19 L60 20 L57 21 L56 24 L55 21 L52 20 L55 19 Z"
        fill={p.gold}
        fillOpacity="0.88"
      />
      <path
        d="M76 44 L76.8 46.4 L79.2 47.2 L76.8 48 L76 50.4 L75.2 48 L72.8 47.2 L75.2 46.4 Z"
        fill={p.gold}
        fillOpacity="0.78"
      />
      <circle cx="8" cy="46" r="1.3" fill={p.gold} fillOpacity="0.65" />
      <circle cx="60" cy="60" r="1.3" fill={p.rose} fillOpacity="0.5" />
      <circle cx="52" cy="78" r="1.2" fill={p.brand} fillOpacity="0.5" />
    </svg>
  ),

  cornerRight: (p: IllustrationPalette) => (
    <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Bottom-right nebula & warm parchment glow */}
      <path d="M96 96 L96 24 C68 28 44 54 24 96 Z" fill={p.brandSoft} fillOpacity="0.24" />
      <circle cx="68" cy="68" r="24" fill={p.gold} fillOpacity="0.15" />
      <circle cx="48" cy="80" r="16" fill={p.rose} fillOpacity="0.12" />

      {/* Layer 2: Background celestial grid & floating mini crescent */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M36 52 C46 34 66 24 88 26"
          stroke={p.ink}
          strokeWidth="0.9"
          strokeOpacity="0.38"
          strokeDasharray="2.5 3"
        />
        {/* Floating small crescent moon in upper-right */}
        <path
          d="M78 16 C73.5 17.5 71.5 22.2 73.5 26.5 C75.5 30.8 80.2 32.5 84.5 30.5 C80.2 30.2 77 27 76.8 22.5 C76.7 20.2 77.2 18 78 16 Z"
          fill={p.paper}
        />
        <path
          d="M78 16 C73.5 17.5 71.5 22.2 73.5 26.5 C75.5 30.8 80.2 32.5 84.5 30.5 C80.2 30.2 77 27 76.8 22.5 C76.7 20.2 77.2 18 78 16 Z"
          fill={p.gold}
          fillOpacity="0.52"
          stroke={p.ink}
          strokeWidth="1.05"
        />
      </g>

      {/* Layer 3: Star Chart Parchment Scroll & Semi-Circular Brass Astrolabe */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Antique Star Chart Parchment Scroll at bottom-right (100% opaque p.paper base) */}
        <path
          d="M28 78 L46 58 L94 64 L82 92 L28 84 Z"
          fill={p.paper}
        />
        <path
          d="M28 78 L46 58 L94 64 L82 92 L28 84 Z"
          fill={p.warm}
          fillOpacity="0.42"
          stroke={p.ink}
          strokeWidth="1.25"
        />

        {/* Rolled scroll cylinder at front-bottom */}
        <path
          d="M25 78 L81 86 C83.5 86.5 84 92.5 80.5 92 L24.5 84 C22 83.5 22.5 77.5 25 78 Z"
          fill={p.paper}
        />
        <path
          d="M25 78 L81 86 C83.5 86.5 84 92.5 80.5 92 L24.5 84 C22 83.5 22.5 77.5 25 78 Z"
          fill={p.gold}
          fillOpacity="0.34"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        {/* Scroll spiral end cap */}
        <ellipse cx="25" cy="81" rx="2.4" ry="3.1" fill={p.paper} stroke={p.ink} strokeWidth="1.15" />
        <circle cx="25" cy="81" r="0.9" fill={p.ink} />

        {/* Star chart diagrams & constellation lines drawn on scroll */}
        <circle
          cx="54"
          cy="73"
          r="9"
          stroke={p.brand}
          strokeWidth="0.9"
          strokeOpacity="0.55"
          strokeDasharray="2 2"
        />
        <path
          d="M46 74 L53 69 L60 73 L67 68"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.65"
        />
        <circle cx="46" cy="74" r="1.3" fill={p.gold} stroke={p.ink} strokeWidth="0.8" />
        <circle cx="53" cy="69" r="1.3" fill={p.gold} stroke={p.ink} strokeWidth="0.8" />
        <circle cx="60" cy="73" r="1.3" fill={p.gold} stroke={p.ink} strokeWidth="0.8" />
        <circle cx="67" cy="68" r="1.3" fill={p.gold} stroke={p.ink} strokeWidth="0.8" />

        {/* Semi-Circular Brass Protractor Astrolabe resting on top of scroll */}
        {/* Outer & inner semi-circular arc (opaque p.paper base + brass gold fill) */}
        <path
          d="M48 62 C49.5 46.5 63.5 36 79 38 C91 39.5 95 50 93 67.5 L87 66.8 C88.5 53 85 45 77.5 44 C65.5 42.5 55.5 50.5 54 62.8 Z"
          fill={p.paper}
        />
        <path
          d="M48 62 C49.5 46.5 63.5 36 79 38 C91 39.5 95 50 93 67.5 L87 66.8 C88.5 53 85 45 77.5 44 C65.5 42.5 55.5 50.5 54 62.8 Z"
          fill={p.gold}
          fillOpacity="0.58"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        {/* Base ruler bar of protractor */}
        <path
          d="M46 61.5 L94 67.5 L93.3 72 L45.3 66 Z"
          fill={p.paper}
        />
        <path
          d="M46 61.5 L94 67.5 L93.3 72 L45.3 66 Z"
          fill={p.gold}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        {/* Inner brass spokes & alidade pointer needle */}
        <path d="M70 65 L75 43.5" stroke={p.ink} strokeWidth="1.15" />
        <path d="M70 65 L58 51" stroke={p.ink} strokeWidth="1.0" strokeOpacity="0.65" />
        <path d="M70 65 L85 52" stroke={p.ink} strokeWidth="1.0" strokeOpacity="0.65" />
        {/* Rotating brass pointer needle */}
        <path
          d="M68 65 L84 40 L80 43 L70 65 Z"
          fill={p.rose}
          fillOpacity="0.68"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <circle cx="70" cy="65.5" r="2.8" fill={p.gold} stroke={p.ink} strokeWidth="1.15" />

        {/* Degree tick marks along brass arc */}
        <path d="M55 50 L57.5 52" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.65" />
        <path d="M64 42 L65.5 44.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.65" />
        <path d="M75 39.5 L75 42.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.65" />
        <path d="M85 43.5 L83 46" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.65" />
      </g>

      {/* Layer 4: Twinkling four-point stars & stardust */}
      <path
        d="M52 24 L53 27 L56 28 L53 29 L52 32 L51 29 L48 28 L51 27 Z"
        fill={p.gold}
        fillOpacity="0.88"
      />
      <path
        d="M32 42 L32.8 44.4 L35.2 45.2 L32.8 46 L32 48.4 L31.2 46 L28.8 45.2 L31.2 44.4 Z"
        fill={p.gold}
        fillOpacity="0.78"
      />
      <circle cx="64" cy="20" r="1.3" fill={p.gold} fillOpacity="0.65" />
      <circle cx="40" cy="34" r="1.2" fill={p.brand} fillOpacity="0.55" />
      <circle cx="22" cy="64" r="1.3" fill={p.rose} fillOpacity="0.5" />
    </svg>
  ),

  celebration: (p: IllustrationPalette) => (
    <svg viewBox="0 0 210 132" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Deep Nebula Watercolor Wash & Outer Celestial Chart Ring */}
      <ellipse cx="105" cy="68" rx="86" ry="48" fill={p.brandSoft} fillOpacity="0.24" />
      <ellipse cx="78" cy="56" rx="48" ry="34" fill={p.gold} fillOpacity="0.14" />
      <ellipse cx="136" cy="66" rx="46" ry="32" fill={p.rose} fillOpacity="0.13" />

      {/* Outer dashed celestial coordinate dome */}
      <path
        d="M26 74 C26 30 62 12 105 12 C148 12 184 30 184 74"
        stroke={p.ink}
        strokeWidth="0.95"
        strokeOpacity="0.25"
        strokeDasharray="3 3.5"
        strokeLinecap="round"
      />

      {/* Observatory desk mat at bottom */}
      <ellipse cx="105" cy="106" rx="80" ry="16" fill={p.warm} fillOpacity="0.24" />

      {/* Layer 2: Comet Trail, Left & Right Constellation Maps, Unrolled Star Scroll */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Sweeping comet in top-left sky */}
        <path
          d="M24 34 C40 22 60 18 78 21 C60 22 42 28 28 39 Z"
          fill={p.gold}
          fillOpacity="0.28"
        />
        <path
          d="M26 36 C42 25 60 20 78 21"
          stroke={p.gold}
          strokeWidth="1.4"
          strokeOpacity="0.8"
        />
        <circle cx="78" cy="21" r="2.6" fill={p.paper} stroke={p.ink} strokeWidth="1.05" />
        <circle cx="78" cy="21" r="1.4" fill={p.gold} />

        {/* Left Constellation Map (Cassiopeia W-shape) */}
        <path
          d="M20 56 L32 48 L41 55 L52 43 L60 51"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.55"
          strokeDasharray="2.2 2.8"
        />
        <circle cx="20" cy="56" r="1.6" fill={p.gold} stroke={p.ink} strokeWidth="0.85" />
        <circle cx="32" cy="48" r="2.0" fill={p.paper} stroke={p.ink} strokeWidth="0.95" />
        <circle cx="41" cy="55" r="1.5" fill={p.brand} />
        <circle cx="52" cy="43" r="1.9" fill={p.gold} stroke={p.ink} strokeWidth="0.85" />
        <circle cx="60" cy="51" r="1.5" fill={p.rose} />

        {/* Right Constellation Map (Lyra / Cygnus) */}
        <path
          d="M150 42 L164 34 L178 40 L172 54 L156 52 Z"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.5"
          strokeDasharray="2.2 2.8"
        />
        <path
          d="M178 40 L190 32"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.5"
          strokeDasharray="2.2 2.8"
        />
        <circle cx="150" cy="42" r="1.5" fill={p.brand} />
        <circle cx="164" cy="34" r="2.1" fill={p.paper} stroke={p.ink} strokeWidth="0.95" />
        <circle cx="178" cy="40" r="1.7" fill={p.gold} stroke={p.ink} strokeWidth="0.85" />
        <circle cx="172" cy="54" r="1.5" fill={p.rose} />
        <circle cx="190" cy="32" r="1.6" fill={p.gold} stroke={p.ink} strokeWidth="0.85" />

        {/* Unrolled Star Chart Parchment Scroll across bottom desk (opaque p.paper base) */}
        <path
          d="M42 108 L52 94 L158 94 L168 108 C130 112 80 112 42 108 Z"
          fill={p.paper}
        />
        <path
          d="M42 108 L52 94 L158 94 L168 108 C130 112 80 112 42 108 Z"
          fill={p.warm}
          fillOpacity="0.4"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        {/* Rolled parchment scroll ends on left & right */}
        <ellipse
          cx="45"
          cy="101"
          rx="4.5"
          ry="8.5"
          transform="rotate(28 45 101)"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <ellipse
          cx="45"
          cy="101"
          rx="4.5"
          ry="8.5"
          transform="rotate(28 45 101)"
          fill={p.gold}
          fillOpacity="0.32"
        />
        <ellipse
          cx="165"
          cy="101"
          rx="4.5"
          ry="8.5"
          transform="rotate(-28 165 101)"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <ellipse
          cx="165"
          cy="101"
          rx="4.5"
          ry="8.5"
          transform="rotate(-28 165 101)"
          fill={p.gold}
          fillOpacity="0.32"
        />
        {/* Chart markings on scroll */}
        <path d="M58 101 L78 103" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.45" />
        <path d="M132 103 L152 101" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.45" />
      </g>

      {/* Layer 3: Foreground Protagonist — Precision Brass Armillary Sphere / Astrolabe */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Back halves of tilted equatorial & ecliptic rings */}
        <path
          d="M64 68 C60 54 76 38 102 33 C128 28 148 35 146 49"
          stroke={p.ink}
          strokeWidth="1.15"
          strokeOpacity="0.55"
        />
        <path
          d="M68 42 C74 30 96 29 120 38 C144 47 154 63 144 73"
          stroke={p.ink}
          strokeWidth="1.1"
          strokeOpacity="0.5"
        />

        {/* Vertical axis rod through the sphere */}
        <path d="M105 16 L105 94" stroke={p.ink} strokeWidth="1.4" />
        {/* Top finial ring */}
        <circle cx="105" cy="14" r="3.2" fill={p.paper} stroke={p.ink} strokeWidth="1.2" />
        <circle cx="105" cy="14" r="1.5" fill={p.gold} />

        {/* Outer Graduated Brass Meridian Ring (opaque p.paper base + warm brass gold) */}
        <path
          d="M105 19 C84 19 67 36 67 57 C67 78 84 95 105 95 C126 95 143 78 143 57 C143 36 126 19 105 19 Z M105 24 C123.2 24 138 38.8 138 57 C138 75.2 123.2 90 105 90 C86.8 90 72 75.2 72 57 C72 38.8 86.8 24 105 24 Z"
          fill={p.paper}
          fillRule="evenodd"
        />
        <path
          d="M105 19 C84 19 67 36 67 57 C67 78 84 95 105 95 C126 95 143 78 143 57 C143 36 126 19 105 19 Z M105 24 C123.2 24 138 38.8 138 57 C138 75.2 123.2 90 105 90 C86.8 90 72 75.2 72 57 C72 38.8 86.8 24 105 24 Z"
          fill={p.gold}
          fillOpacity="0.58"
          fillRule="evenodd"
          stroke={p.ink}
          strokeWidth="1.3"
        />

        {/* Degree tick marks on meridian ring */}
        <path d="M77 32 L80 35" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />
        <path d="M68 57 L72 57" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />
        <path d="M77 82 L80 79" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />
        <path d="M133 32 L130 35" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />
        <path d="M142 57 L138 57" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />
        <path d="M133 82 L130 79" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />

        {/* Inner Core: Golden Crescent Moon & Ringed Planet */}
        {/* Central Violet-Rose Planet (100% opaque p.paper base) */}
        <circle cx="113" cy="53" r="10.5" fill={p.paper} />
        <circle cx="113" cy="53" r="10.5" fill={p.brand} fillOpacity="0.45" stroke={p.ink} strokeWidth="1.25" />
        {/* Planet atmospheric bands */}
        <path
          d="M103.5 50 C109 52.5 117 52.5 122.5 50"
          stroke={p.rose}
          strokeWidth="1.6"
          strokeOpacity="0.65"
        />
        <path
          d="M104 55.5 C109.5 57.5 116.5 57.5 122 55.5"
          stroke={p.gold}
          strokeWidth="1.2"
          strokeOpacity="0.65"
        />
        {/* Planet's own small Saturn ring */}
        <path
          d="M99 57 C105 60 121 52 127 48"
          stroke={p.gold}
          strokeWidth="2.4"
          strokeOpacity="0.85"
        />
        <path
          d="M99 57 C105 60 121 52 127 48"
          stroke={p.ink}
          strokeWidth="1.05"
        />

        {/* Luminous Golden Crescent Moon embracing the planet (100% opaque p.paper base) */}
        <path
          d="M102 31 C88 33.5 79.5 46.5 82.5 60.5 C85.5 74.5 99 82.5 113 78 C99 77 90.5 66.5 91.2 52.5 C91.6 43 96 35.2 102 31 Z"
          fill={p.paper}
        />
        <path
          d="M102 31 C88 33.5 79.5 46.5 82.5 60.5 C85.5 74.5 99 82.5 113 78 C99 77 90.5 66.5 91.2 52.5 C91.6 43 96 35.2 102 31 Z"
          fill={p.gold}
          fillOpacity="0.62"
          stroke={p.ink}
          strokeWidth="1.35"
        />
        {/* Highlight arc on crescent */}
        <path
          d="M88 45 C85.5 52 86.2 60.5 90.5 67"
          stroke={p.paper}
          strokeWidth="1.4"
          strokeOpacity="0.8"
        />

        {/* Front halves of tilted brass ecliptic & equatorial bands overlapping the core */}
        <path
          d="M146 49 C144 63 125 76 100 80 C78 83.5 66 77.5 64 68"
          stroke={p.gold}
          strokeWidth="3.6"
          strokeOpacity="0.85"
        />
        <path
          d="M146 49 C144 63 125 76 100 80 C78 83.5 66 77.5 64 68"
          stroke={p.ink}
          strokeWidth="1.3"
        />

        <path
          d="M144 73 C135 81 114 80 91 71 C70 62.5 63 50.5 68 42"
          stroke={p.gold}
          strokeWidth="2.6"
          strokeOpacity="0.75"
        />
        <path
          d="M144 73 C135 81 114 80 91 71 C70 62.5 63 50.5 68 42"
          stroke={p.ink}
          strokeWidth="1.15"
        />

        {/* Secondary orbital moons mounted on the brass rings */}
        <circle cx="65" cy="68" r="4.2" fill={p.paper} />
        <circle cx="65" cy="68" r="4.2" fill={p.leaf} fillOpacity="0.52" stroke={p.ink} strokeWidth="1.15" />

        <circle cx="145" cy="51" r="3.6" fill={p.paper} />
        <circle cx="145" cy="51" r="3.6" fill={p.rose} fillOpacity="0.58" stroke={p.ink} strokeWidth="1.15" />

        {/* Ornate Brass Armillary Pedestal Stand (100% opaque p.paper base) */}
        {/* Curling brass support arms at base of sphere */}
        <path
          d="M84 90 C84 97 94 99 105 99 C116 99 126 97 126 90"
          stroke={p.ink}
          strokeWidth="1.4"
        />
        {/* Tiered pedestal column & foot */}
        <path
          d="M97 95 L113 95 L116 104 L126 110 C114 113.5 96 113.5 84 110 L94 104 Z"
          fill={p.paper}
        />
        <path
          d="M97 95 L113 95 L116 104 L126 110 C114 113.5 96 113.5 84 110 L94 104 Z"
          fill={p.gold}
          fillOpacity="0.58"
          stroke={p.ink}
          strokeWidth="1.35"
        />
        <path d="M94 104 C101 106 109 106 116 104" stroke={p.ink} strokeWidth="1.1" />
        {/* Small compass dial set into pedestal center */}
        <circle cx="105" cy="101" r="3.2" fill={p.paper} stroke={p.ink} strokeWidth="1.05" />
        <circle cx="105" cy="101" r="1.2" fill={p.rose} />
      </g>

      {/* Layer 4: Radiant Four-Point Star Sparkles & Stardust */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M104 38 L105 41.2 L108.2 42.2 L105 43.2 L104 46.4 L103 43.2 L99.8 42.2 L103 41.2 Z"
          fill={p.gold}
          fillOpacity="0.95"
        />
        <path
          d="M52 24 L53.2 27.5 L56.8 28.8 L53.2 30 L52 33.5 L50.8 30 L47.2 28.8 L50.8 27.5 Z"
          fill={p.gold}
          fillOpacity="0.88"
        />
        <path
          d="M142 18 L143.2 21.5 L146.8 22.8 L143.2 24 L142 27.5 L140.8 24 L137.2 22.8 L140.8 21.5 Z"
          fill={p.gold}
          fillOpacity="0.88"
        />
        <path
          d="M36 74 L36.9 76.6 L39.5 77.5 L36.9 78.4 L36 81 L35.1 78.4 L32.5 77.5 L35.1 76.6 Z"
          fill={p.gold}
          fillOpacity="0.8"
        />
        <path
          d="M174 70 L174.9 72.6 L177.5 73.5 L174.9 74.4 L174 77 L173.1 74.4 L170.5 73.5 L173.1 72.6 Z"
          fill={p.gold}
          fillOpacity="0.8"
        />

        {/* Stardust micro dots */}
        <circle cx="88" cy="16" r="1.4" fill={p.gold} fillOpacity="0.7" />
        <circle cx="124" cy="15" r="1.3" fill={p.brand} fillOpacity="0.55" />
        <circle cx="48" cy="66" r="1.3" fill={p.rose} fillOpacity="0.55" />
        <circle cx="160" cy="76" r="1.4" fill={p.gold} fillOpacity="0.65" />
        <circle cx="72" cy="104" r="1.3" fill={p.gold} fillOpacity="0.65" />
        <circle cx="138" cy="105" r="1.2" fill={p.brand} fillOpacity="0.55" />
      </g>
    </svg>
  ),

  empty: (p: IllustrationPalette) => (
    <svg viewBox="0 0 136 90" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Quiet Night-Sky Nebula Wash */}
      <ellipse cx="68" cy="48" rx="52" ry="28" fill={p.brandSoft} fillOpacity="0.22" />
      <circle cx="62" cy="42" r="22" fill={p.gold} fillOpacity="0.14" />
      <circle cx="82" cy="52" r="18" fill={p.rose} fillOpacity="0.12" />

      {/* Layer 2: Faint Shooting Star Trail, Quiet Constellation & Night Mist */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Shooting star / meteor arc across upper-right sky */}
        <path
          d="M78 24 C90 17 104 16 116 21 C104 19 91 21 80 28 Z"
          fill={p.gold}
          fillOpacity="0.32"
        />
        <path
          d="M78 25 C91 18 104 17 116 21"
          stroke={p.gold}
          strokeWidth="1.25"
          strokeOpacity="0.8"
        />
        <path
          d="M84 28 C94 23 105 22 114 24.5"
          stroke={p.ink}
          strokeWidth="0.85"
          strokeOpacity="0.4"
          strokeDasharray="2 2.5"
        />

        {/* Small quiet constellation on left */}
        <path
          d="M22 48 L31 39 L40 43 L44 33"
          stroke={p.ink}
          strokeWidth="0.9"
          strokeOpacity="0.45"
          strokeDasharray="2 2.5"
        />
        <circle cx="22" cy="48" r="1.4" fill={p.gold} stroke={p.ink} strokeWidth="0.8" />
        <circle cx="31" cy="39" r="1.7" fill={p.paper} stroke={p.ink} strokeWidth="0.9" />
        <circle cx="40" cy="43" r="1.3" fill={p.brand} />
        <circle cx="44" cy="33" r="1.5" fill={p.gold} stroke={p.ink} strokeWidth="0.8" />

        {/* Delicate meridian suspension line above moon */}
        <path
          d="M66 8 L66 21"
          stroke={p.ink}
          strokeWidth="0.95"
          strokeOpacity="0.45"
          strokeDasharray="2 2"
        />
        <circle cx="66" cy="16" r="1.5" fill={p.gold} stroke={p.ink} strokeWidth="0.85" />
      </g>

      {/* Layer 3: Serene Hanging Crescent Moon, Sleeping Mini-Planet & Soft Night Clouds */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Small companion planet nestled inside crescent curve */}
        <circle cx="75" cy="42" r="5.5" fill={p.paper} />
        <circle cx="75" cy="42" r="5.5" fill={p.brand} fillOpacity="0.4" stroke={p.ink} strokeWidth="1.15" />
        <path
          d="M68 44.5 C72 46 78 42 82 39.5"
          stroke={p.gold}
          strokeWidth="1.8"
          strokeOpacity="0.8"
        />
        <path
          d="M68 44.5 C72 46 78 42 82 39.5"
          stroke={p.ink}
          strokeWidth="0.95"
        />

        {/* Hanging Golden Crescent Moon (100% opaque p.paper base + warm gold overlay) */}
        <path
          d="M68 20 C55 22.5 47 34.5 50 47.5 C53 60.5 65.5 68 78.5 64 C65.5 63 57.5 53 58 40 C58.4 31.2 62.5 24 68 20 Z"
          fill={p.paper}
        />
        <path
          d="M68 20 C55 22.5 47 34.5 50 47.5 C53 60.5 65.5 68 78.5 64 C65.5 63 57.5 53 58 40 C58.4 31.2 62.5 24 68 20 Z"
          fill={p.gold}
          fillOpacity="0.58"
          stroke={p.ink}
          strokeWidth="1.35"
        />
        {/* Inner highlight curve on crescent moon */}
        <path
          d="M55 33 C52.8 39.5 53.5 47.5 57.5 53.5"
          stroke={p.paper}
          strokeWidth="1.3"
          strokeOpacity="0.8"
        />

        {/* Soft tranquil cloud/mist bank at bottom (opaque p.paper base) */}
        <path
          d="M36 72 C36 67.5 41 64.5 46.5 65.5 C49.5 61 57 60.5 61 64.5 C65 61.5 72 62 74.5 66 C79.5 65 84 68 84 72 C84 74.5 36 74.5 36 72 Z"
          fill={p.paper}
        />
        <path
          d="M36 72 C36 67.5 41 64.5 46.5 65.5 C49.5 61 57 60.5 61 64.5 C65 61.5 72 62 74.5 66 C79.5 65 84 68 84 72 C84 74.5 36 74.5 36 72 Z"
          fill={p.brandSoft}
          fillOpacity="0.42"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        {/* Secondary wispy cloud line on right */}
        <path
          d="M78 75 L104 75"
          stroke={p.ink}
          strokeWidth="1.0"
          strokeOpacity="0.45"
        />
        <path
          d="M28 75 L42 75"
          stroke={p.ink}
          strokeWidth="1.0"
          strokeOpacity="0.45"
        />
      </g>

      {/* Layer 4: Twinkling Four-Point Stars & Stardust */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Star at head of shooting star */}
        <path
          d="M77 22 L78 24.8 L80.8 25.8 L78 26.8 L77 29.6 L76 26.8 L73.2 25.8 L76 24.8 Z"
          fill={p.gold}
          fillOpacity="0.92"
        />
        <path
          d="M98 38 L98.9 40.5 L101.5 41.4 L98.9 42.3 L98 44.8 L97.1 42.3 L94.5 41.4 L97.1 40.5 Z"
          fill={p.gold}
          fillOpacity="0.82"
        />
        <path
          d="M34 58 L34.7 59.8 L36.5 60.5 L34.7 61.2 L34 63 L33.3 61.2 L31.5 60.5 L33.3 59.8 Z"
          fill={p.gold}
          fillOpacity="0.75"
        />
        <circle cx="54" cy="18" r="1.3" fill={p.gold} fillOpacity="0.65" />
        <circle cx="88" cy="54" r="1.3" fill={p.rose} fillOpacity="0.55" />
        <circle cx="110" cy="34" r="1.2" fill={p.brand} fillOpacity="0.55" />
        <circle cx="24" cy="28" r="1.2" fill={p.gold} fillOpacity="0.6" />
      </g>
    </svg>
  ),
};
