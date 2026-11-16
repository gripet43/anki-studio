import React from 'react';
import type { IllustrationPalette, ThemeIllustrationPack } from './types';

export const nekoPack: ThemeIllustrationPack = {
  greeting: (p: IllustrationPalette) => (
    <svg viewBox="0 0 112 44" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Ambient background glow */}
      <ellipse cx="56" cy="25" rx="44" ry="15" fill={p.brandSoft} fillOpacity="0.22" />
      <circle cx="42" cy="20" r="14" fill={p.gold} fillOpacity="0.14" />
      <circle cx="72" cy="22" r="12" fill={p.rose} fillOpacity="0.12" />

      {/* Layer 2: Mid-ground foliage & book ledge */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Small sage leaves on left */}
        <path
          d="M25 31 C19 29 15 24 14 19 C19 19 24 23 26 29 Z"
          fill={p.leaf}
          fillOpacity="0.38"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M27 32 C22 33 17 31 15 27 C19 25 24 27 27 31 Z"
          fill={p.leaf}
          fillOpacity="0.28"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <path d="M16 21 C20 24 23 27 25 30" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.55" />

        {/* Open book / notebook ledge at bottom */}
        <path
          d="M20 35 C32 32 45 33 56 36 C67 33 80 32 92 35 L94 38 C80 36 67 36 56 39 C45 36 32 36 18 38 Z"
          fill={p.brand}
          fillOpacity="0.38"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <path
          d="M22 31 C33 29 45 30 56 33 C67 30 79 29 90 31 L92 35 C80 32 67 33 56 36 C45 33 32 32 20 35 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path d="M26 33 C36 31.5 45 32 54 34.2" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.5" />
        <path d="M86 33 C76 31.5 67 32 58 34.2" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.5" />

        {/* Hanging paw-ribbon bookmark */}
        <path
          d="M66 34 C67 37 69 39 68 42 L72 40.5 L74 42.5 C74.5 39 73 36.5 71 33.5 Z"
          fill={p.rose}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="1.0"
        />
      </g>

      {/* Layer 3: Foreground peeking orange/calico cat & curling tail */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Curling tail on right */}
        <path
          d="M75 31 C82 30 88 25 89 18 C89.5 14 86.5 12 84 14 C81.5 16 83 20 80 24 C78 26.5 74 28 71 29 Z"
          fill={p.paper}
        />
        <path
          d="M83.5 20 C82 17 82 14.8 84 14 C86.5 12 89.5 14 89 18 C88.6 20.5 87.2 22.8 85.5 24.5 C84.5 23 84 21.5 83.5 20 Z"
          fill={p.gold}
          fillOpacity="0.52"
        />
        <path
          d="M75 31 C82 30 88 25 89 18 C89.5 14 86.5 12 84 14 C81.5 16 83 20 80 24 C78 26.5 74 28 71 29"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        <path d="M84 23.5 C85.5 24 86.5 23.5 87.2 22.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />

        {/* Peeking cat head base (opaque p.paper) */}
        <path
          d="M36 31 C35 25 36.5 20 38 16 L36.5 8.5 C40.5 9 43.5 11.5 45.5 13.5 C48.5 12.8 52.5 12.8 55.5 13.5 C57.5 11.5 60.5 9 64.5 8.5 L63 16 C64.5 20 66 25 65 31 Z"
          fill={p.paper}
        />

        {/* Calico / Orange patches on head */}
        <path
          d="M36.5 8.5 C40.5 9 43.5 11.5 45.5 13.5 C46 16.5 44.5 20 41.5 21.5 C39 22.5 37 21.5 36.2 19.5 L38 16 Z"
          fill={p.gold}
          fillOpacity="0.48"
        />
        <path
          d="M64.5 8.5 L63 16 C64 18.8 64.8 22 64.8 25.5 C61.5 25 59 22.5 58.5 19 C58 16 56.5 14.2 55.5 13.5 C57.5 11.5 60.5 9 64.5 8.5 Z"
          fill={p.brand}
          fillOpacity="0.32"
        />

        {/* Inner ears */}
        <path d="M38.5 11.2 L39.2 15.8 L43.2 14 Z" fill={p.rose} fillOpacity="0.42" />
        <path d="M62.5 11.2 L61.8 15.8 L57.8 14 Z" fill={p.rose} fillOpacity="0.42" />

        {/* Cat head main outline */}
        <path
          d="M36 30.5 C35.2 25 36.5 20 38 16 L36.5 8.5 C40.5 9 43.5 11.5 45.5 13.5 C48.5 12.8 52.5 12.8 55.5 13.5 C57.5 11.5 60.5 9 64.5 8.5 L63 16 C64.5 20 65.8 25 65 30.5"
          stroke={p.ink}
          strokeWidth="1.3"
        />

        {/* Forehead tabby stripes */}
        <path d="M50.5 13.5 L50.5 17" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.55" />
        <path d="M48 14.2 L48.5 16.8" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.5" />
        <path d="M53 14.2 L52.5 16.8" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.5" />

        {/* Blush cheeks */}
        <ellipse cx="41.5" cy="25.5" rx="2.6" ry="1.4" fill={p.rose} fillOpacity="0.45" />
        <ellipse cx="59.5" cy="25.5" rx="2.6" ry="1.4" fill={p.rose} fillOpacity="0.45" />

        {/* Happy squinting eyes & tiny nose */}
        <path d="M42.5 23 C44 21.2 46.2 21.2 47.5 23" stroke={p.ink} strokeWidth="1.2" />
        <path d="M53.5 23 C54.8 21.2 57 21.2 58.5 23" stroke={p.ink} strokeWidth="1.2" />
        <path d="M49.5 25 L50.5 26.2 L51.5 25 Z" fill={p.rose} stroke={p.ink} strokeWidth="0.85" />
        <path d="M48.5 26.8 Q49.5 27.8 50.5 26.4 Q51.5 27.8 52.5 26.8" stroke={p.ink} strokeWidth="0.95" />

        {/* Whiskers */}
        <path d="M37 24.5 L32.5 23.8" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />
        <path d="M37 26.5 L32 26.8" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />
        <path d="M64 24.5 L68.5 23.8" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />
        <path d="M64 26.5 L69 26.8" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />

        {/* Two little paws resting on the book edge */}
        <path
          d="M37 31.5 C37 28.8 43.5 28.8 43.5 31.5 C43.5 33.2 37 33.2 37 31.5 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path d="M39.2 30.8 L39.2 32.3" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.6" />
        <path d="M41.3 30.8 L41.3 32.3" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.6" />

        <path
          d="M57.5 31.5 C57.5 28.8 64 28.8 64 31.5 C64 33.2 57.5 33.2 57.5 31.5 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path d="M59.7 30.8 L59.7 32.3" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.6" />
        <path d="M61.8 30.8 L61.8 32.3" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.6" />
      </g>

      {/* Layer 4: Sparkles, tiny heart & micro dots */}
      <path
        d="M23 11 L24 13.8 L26.8 14.8 L24 15.8 L23 18.6 L22 15.8 L19.2 14.8 L22 13.8 Z"
        fill={p.gold}
        fillOpacity="0.85"
      />
      <path
        d="M73 11.5 C73 10 75 9.5 76 11 C77 9.5 79 10 79 11.5 C79 13.5 76 15 76 15.8 C76 15 73 13.5 73 11.5 Z"
        fill={p.rose}
        fillOpacity="0.55"
        stroke={p.ink}
        strokeWidth="0.9"
      />
      <circle cx="30" cy="10" r="1.2" fill={p.brand} fillOpacity="0.5" />
      <circle cx="94" cy="19" r="1.3" fill={p.gold} fillOpacity="0.65" />
      <circle cx="15" cy="34" r="1.1" fill={p.rose} fillOpacity="0.45" />
    </svg>
  ),

  cornerLeft: (p: IllustrationPalette) => (
    <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Bottom-left ambient glow */}
      <path d="M0 96 L0 30 C26 32 52 54 68 96 Z" fill={p.brandSoft} fillOpacity="0.22" />
      <circle cx="28" cy="70" r="24" fill={p.warm} fillOpacity="0.2" />
      <circle cx="48" cy="82" r="14" fill={p.rose} fillOpacity="0.14" />

      {/* Layer 2: Mid-ground mat, foliage & trailing yarn */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Woven mat corner at bottom-left */}
        <path
          d="M0 84 C24 82 48 86 68 96 L0 96 Z"
          fill={p.warm}
          fillOpacity="0.32"
          stroke={p.ink}
          strokeWidth="1.1"
        />
        <path d="M6 88 C24 87 42 89 56 95" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.4" strokeDasharray="2 3" />

        {/* Sage leaves behind cat on left edge */}
        <path
          d="M12 72 C5 67 2 59 3 51 C9 53 13 61 13 70 Z"
          fill={p.leaf}
          fillOpacity="0.38"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M10 62 C6 55 6 47 9 41 C14 45 15 53 12 61 Z"
          fill={p.leaf}
          fillOpacity="0.28"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <path d="M5 54 C8 60 10 65 11 70" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.5" />

        {/* Trailing yarn thread */}
        <path
          d="M58 88 C65 91 73 86 77 90 C80 92.5 74 95 82 94"
          stroke={p.rose}
          strokeWidth="2.2"
          strokeOpacity="0.45"
        />
        <path
          d="M58 88 C65 91 73 86 77 90 C80 92.5 74 95 82 94"
          stroke={p.ink}
          strokeWidth="1.05"
        />
      </g>

      {/* Layer 3: Foreground sitting cat looking up-right & yarn ball */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Curling tail on left */}
        <path
          d="M16 86 C8 84 3 76 4 67 C5 61 9 59 11 62 C13 65 9 70 11 76 C12.5 80 16 82 19 83 Z"
          fill={p.paper}
        />
        <path
          d="M4 67 C5 61 9 59 11 62 C12.2 63.8 11.2 66.5 10.5 69 C7.5 69.5 5.2 68.5 4 67 Z"
          fill={p.gold}
          fillOpacity="0.5"
        />
        <path
          d="M16 86 C8 84 3 76 4 67 C5 61 9 59 11 62 C13 65 9 70 11 76 C12.5 80 16 82 19 83"
          stroke={p.ink}
          strokeWidth="1.25"
        />

        {/* Cat sitting body & tilted head (opaque p.paper base) */}
        <path
          d="M15 88 C13 78 16 67 22 61 C18 56 18 49 20 44 L18 35 C22 35.5 25.5 38 27.5 40 C30.5 39.2 33.5 39.5 36 40.8 L41 35.5 L40.5 44 C43 48 43 54 39 58.5 C43 65 45 76 42 88 C34 90 23 90 15 88 Z"
          fill={p.paper}
        />

        {/* Orange & calico patches on cat */}
        <path
          d="M18 35 C22 35.5 25.5 38 27.5 40 C28 43.5 26 47.5 22.5 49 C20 50 18.8 48.5 19.2 45.5 L20 44 Z"
          fill={p.gold}
          fillOpacity="0.48"
        />
        <path
          d="M16 78 C15.5 70 18 64 22 61 C26 63 27.5 68 26 74 C24.5 79 20 80.5 16 78 Z"
          fill={p.gold}
          fillOpacity="0.42"
        />
        <path
          d="M41 35.5 L40.5 44 C41.8 46.2 42.5 49 42 52 C39 51 37 48.5 36.8 45 C36.6 42.5 36.2 41.2 36 40.8 Z"
          fill={p.brand}
          fillOpacity="0.32"
        />
        <path
          d="M15.2 84 C14.5 79 16 75 19.5 74.5 C23 74 25 78 24 83.5 C21 85 17.5 85 15.2 84 Z"
          fill={p.brand}
          fillOpacity="0.26"
        />

        {/* Inner ears */}
        <path d="M20 37.8 L21 42.5 L24.8 40.5 Z" fill={p.rose} fillOpacity="0.42" />
        <path d="M39.2 38.2 L38.8 42.8 L35.5 41.2 Z" fill={p.rose} fillOpacity="0.42" />

        {/* Cat main outline */}
        <path
          d="M15 88 C13 78 16 67 22 61 C18 56 18 49 20 44 L18 35 C22 35.5 25.5 38 27.5 40 C30.5 39.2 33.5 39.5 36 40.8 L41 35.5 L40.5 44 C43 48 43 54 39 58.5 C43 65 45 76 42 88"
          stroke={p.ink}
          strokeWidth="1.35"
        />

        {/* Front paws neatly tucked */}
        <path
          d="M25 88.5 C25 82 29.5 75 31.5 75 C33.5 75 34 82 34 88.5"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <path
          d="M15 88 C23 90.5 34 90.5 42 88"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        <path d="M28.5 86.5 L28.5 88.8" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.6" />
        <path d="M36.5 86.5 L36.5 88.8" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.6" />

        {/* Cute ribbon collar & golden bell */}
        <path
          d="M21.5 60.5 C26.5 62.8 34.5 62 39 58.8"
          stroke={p.rose}
          strokeWidth="2.8"
        />
        <path
          d="M21.5 60.5 C26.5 62.8 34.5 62 39 58.8"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <circle cx="32" cy="63" r="2.8" fill={p.gold} stroke={p.ink} strokeWidth="1.1" />
        <path d="M30.8 63.5 L33.2 63.5" stroke={p.ink} strokeWidth="0.8" />

        {/* Face details looking up-right */}
        <ellipse cx="25.5" cy="52" rx="2.4" ry="1.3" fill={p.rose} fillOpacity="0.45" />
        <ellipse cx="38.5" cy="50.5" rx="2.2" ry="1.2" fill={p.rose} fillOpacity="0.45" />
        <path d="M25.5 48.5 C27 46.8 29.2 46.8 30.5 48.5" stroke={p.ink} strokeWidth="1.2" />
        <path d="M34.5 47.5 C35.8 45.8 38 45.8 39.2 47.5" stroke={p.ink} strokeWidth="1.2" />
        <path d="M32.2 49.5 L33.2 50.6 L34.2 49.3 Z" fill={p.rose} stroke={p.ink} strokeWidth="0.85" />
        <path d="M31.2 51.3 Q32.3 52.3 33.2 50.8 Q34.2 52.1 35.2 51" stroke={p.ink} strokeWidth="0.95" />

        {/* Whiskers */}
        <path d="M20.5 51 L15.5 50.2" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />
        <path d="M20.8 53 L16 53.5" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />
        <path d="M41.5 49 L46 47.8" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />
        <path d="M41.8 51 L46.5 50.8" stroke={p.ink} strokeWidth="0.85" strokeOpacity="0.55" />

        {/* Yarn ball beside the cat */}
        <circle cx="53" cy="83" r="8.5" fill={p.paper} />
        <circle cx="53" cy="83" r="8.5" fill={p.rose} fillOpacity="0.42" stroke={p.ink} strokeWidth="1.25" />
        <path d="M46.5 79 C50 77 56 79 59.5 83" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />
        <path d="M45.5 83 C49.5 80.5 55.5 82.5 59 87" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />
        <path d="M49 90 C50.5 84.5 55 79.5 58.5 77.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />
        <path d="M53 91 C54.5 86 58 81.5 61 79.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />
      </g>

      {/* Layer 4: Floating hearts, paw print & sparkles along gaze */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Floating heart */}
        <path
          d="M47 29 C47 26.8 50 26 51.5 28.2 C53 26 56 26.8 56 29 C56 32 51.5 34.2 51.5 35.5 C51.5 34.2 47 32 47 29 Z"
          fill={p.rose}
          fillOpacity="0.52"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        {/* Tiny paw print */}
        <ellipse cx="36" cy="21" rx="2.4" ry="1.9" fill={p.brand} fillOpacity="0.48" />
        <circle cx="33.2" cy="18" r="1.0" fill={p.brand} fillOpacity="0.48" />
        <circle cx="36" cy="17.2" r="1.05" fill={p.brand} fillOpacity="0.48" />
        <circle cx="38.8" cy="18" r="1.0" fill={p.brand} fillOpacity="0.48" />

        {/* Sparkle stars */}
        <path
          d="M24 23 L25 25.8 L27.8 26.8 L25 27.8 L24 30.6 L23 27.8 L20.2 26.8 L23 25.8 Z"
          fill={p.gold}
          fillOpacity="0.85"
        />
        <path
          d="M61 42 L61.8 44.2 L64 45 L61.8 45.8 L61 48 L60.2 45.8 L58 45 L60.2 44.2 Z"
          fill={p.gold}
          fillOpacity="0.75"
        />
        <circle cx="44" cy="16" r="1.3" fill={p.gold} fillOpacity="0.6" />
        <circle cx="57" cy="60" r="1.2" fill={p.brand} fillOpacity="0.45" />
        <circle cx="14" cy="30" r="1.1" fill={p.rose} fillOpacity="0.45" />
      </g>
    </svg>
  ),

  cornerRight: (p: IllustrationPalette) => (
    <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Bottom-right ambient glow */}
      <path d="M96 96 L96 30 C70 34 46 54 28 96 Z" fill={p.brandSoft} fillOpacity="0.22" />
      <circle cx="68" cy="70" r="24" fill={p.gold} fillOpacity="0.14" />
      <circle cx="50" cy="82" r="15" fill={p.rose} fillOpacity="0.12" />

      {/* Layer 2: Peeking curled cat tail & botanical sprig */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Botanical sprig behind top book on right */}
        <path
          d="M84 62 C88 55 91 47 89 39 C83 42 81 51 83 61 Z"
          fill={p.leaf}
          fillOpacity="0.36"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M78 60 C80 52 79 44 75 39 C71 44 73 52 77 59 Z"
          fill={p.leaf}
          fillOpacity="0.28"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <circle cx="75" cy="37" r="2.2" fill={p.rose} fillOpacity="0.55" stroke={p.ink} strokeWidth="0.9" />
        <circle cx="89" cy="37" r="2.0" fill={p.gold} fillOpacity="0.6" stroke={p.ink} strokeWidth="0.9" />

        {/* Fluffy curled cat tail peeking from behind the book stack */}
        <path
          d="M52 72 C42 68 35 58 37 47 C38.5 40 44 39 46.5 43 C48.5 46.5 43.5 51 46 57 C48 61.5 53 64 58 66 Z"
          fill={p.paper}
        />
        {/* Orange tabby tail tip & stripes */}
        <path
          d="M37 47 C38.5 40 44 39 46.5 43 C47.8 45.2 46.2 48 45.2 50.5 C41.5 51 38.5 49.5 37 47 Z"
          fill={p.gold}
          fillOpacity="0.52"
        />
        <path
          d="M39.5 57.5 C41.5 56 44 56 46.2 57.2 C47.2 59.5 48.8 61.2 50.5 62.5 C46.5 63.5 42.2 61 39.5 57.5 Z"
          fill={p.brand}
          fillOpacity="0.3"
        />
        <path
          d="M52 72 C42 68 35 58 37 47 C38.5 40 44 39 46.5 43 C48.5 46.5 43.5 51 46 57 C48 61.5 53 64 58 66"
          stroke={p.ink}
          strokeWidth="1.3"
        />
      </g>

      {/* Layer 3: Stack of hardcover books, paw sticky note & feather quill pen */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Bottom book (sage cover) */}
        <rect x="34" y="81" width="58" height="11" rx="3" fill={p.paper} />
        <rect x="34" y="81" width="58" height="11" rx="3" fill={p.leaf} fillOpacity="0.34" stroke={p.ink} strokeWidth="1.25" />
        <path d="M40 83.5 L88 83.5 L88 89.5 L40 89.5 C38 89.5 38 83.5 40 83.5 Z" fill={p.paper} stroke={p.ink} strokeWidth="1.05" />
        <path d="M43 86.5 L85 86.5" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.45" />

        {/* Middle book (coral brand cover) */}
        <rect x="40" y="70" width="50" height="11" rx="2.8" fill={p.paper} />
        <rect x="40" y="70" width="50" height="11" rx="2.8" fill={p.brand} fillOpacity="0.38" stroke={p.ink} strokeWidth="1.25" />
        <path d="M42 72.5 L78 72.5 L78 78.5 L42 78.5 Z" fill={p.paper} stroke={p.ink} strokeWidth="1.05" />
        <path d="M45 75.5 L75 75.5" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.45" />
        <circle cx="84" cy="75.5" r="1.6" fill={p.gold} fillOpacity="0.8" />

        {/* Top book (warm gold cover) */}
        <path
          d="M46 61 L84 58 L90 65 L49 70 Z"
          fill={p.paper}
        />
        <path
          d="M46 61 L84 58 L90 65 L49 70 Z"
          fill={p.gold}
          fillOpacity="0.34"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        <path
          d="M46 61 L49 70 L49 73.5 L46 64.5 Z"
          fill={p.gold}
          fillOpacity="0.5"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <path
          d="M49 70 L90 65 L90 68.5 L49 73.5 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.15"
        />

        {/* Paw-print sticky note overhanging from top book */}
        <path
          d="M55 64 L69 62.5 L71 77.5 C66 77.8 61 78.5 56 79 Z"
          fill={p.paper}
        />
        <path
          d="M55 64 L69 62.5 L71 77.5 C66 77.8 61 78.5 56 79 Z"
          fill={p.warm}
          fillOpacity="0.38"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        {/* Cute coral paw print on sticky note */}
        <ellipse cx="63.2" cy="72.5" rx="2.5" ry="2.0" fill={p.rose} fillOpacity="0.65" />
        <circle cx="60.2" cy="69.5" r="1.05" fill={p.rose} fillOpacity="0.65" />
        <circle cx="63" cy="68.5" r="1.1" fill={p.rose} fillOpacity="0.65" />
        <circle cx="65.8" cy="69.2" r="1.05" fill={p.rose} fillOpacity="0.65" />

        {/* Feather quill pen resting across the top book */}
        <path
          d="M61 61 C64 49 71 36 82 26 C84 33 80 44 73 52 L70 50.5 L71.5 54 C68 57.5 64.5 59.5 61 61 Z"
          fill={p.paper}
        />
        <path
          d="M72 36 C75.5 32 78.8 28.8 82 26 C83.5 31 81 38.5 76.5 45 C74.5 42 73 39 72 36 Z"
          fill={p.rose}
          fillOpacity="0.36"
        />
        <path
          d="M61 61 C64 49 71 36 82 26 C84 33 80 44 73 52 L70 50.5 L71.5 54 C68 57.5 64.5 59.5 61 61 Z"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path d="M57 65 C63 56 71 42 82 26" stroke={p.ink} strokeWidth="1.15" />
        <path d="M66 47 L70 44" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.55" />
        <path d="M70 40 L75 37" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.55" />
      </g>

      {/* Layer 4: Sparkles & crescent moon */}
      <path
        d="M58 24 C54.5 25.5 53 29.8 54.8 33.2 C56.5 36.5 60.8 37.8 64.2 36 C60.5 35.8 57.8 33 57.5 29.2 C57.2 27 57.5 25.2 58 24 Z"
        fill={p.gold}
        fillOpacity="0.45"
        stroke={p.ink}
        strokeWidth="1.05"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M45 28 L45.8 30.2 L48 31 L45.8 31.8 L45 34 L44.2 31.8 L42 31 L44.2 30.2 Z"
        fill={p.gold}
        fillOpacity="0.8"
      />
      <circle cx="68" cy="22" r="1.3" fill={p.rose} fillOpacity="0.5" />
      <circle cx="29" cy="68" r="1.3" fill={p.gold} fillOpacity="0.6" />
      <circle cx="34" cy="38" r="1.1" fill={p.brand} fillOpacity="0.45" />
    </svg>
  ),

  celebration: (p: IllustrationPalette) => (
    <svg viewBox="0 0 210 132" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Ambient watercolor aura & celestial arc */}
      <ellipse cx="105" cy="72" rx="84" ry="46" fill={p.brandSoft} fillOpacity="0.22" />
      <ellipse cx="76" cy="62" rx="48" ry="34" fill={p.gold} fillOpacity="0.14" />
      <ellipse cx="142" cy="76" rx="44" ry="30" fill={p.rose} fillOpacity="0.13" />

      {/* Dashed celestial orbit in upper sky */}
      <path
        d="M28 58 C62 16 148 16 182 58"
        stroke={p.ink}
        strokeWidth="0.95"
        strokeOpacity="0.24"
        strokeDasharray="2.5 3.5"
        strokeLinecap="round"
      />

      {/* Soft crescent moon in top-left sky */}
      <path
        d="M42 18 C36.5 20 34 26.2 36.5 31.5 C39 36.8 45.2 39 50.5 36.5 C45 36.2 41 32 40.8 26.2 C40.7 23.2 41.2 20.4 42 18 Z"
        fill={p.gold}
        fillOpacity="0.42"
        stroke={p.ink}
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Cozy desk mat / linen runner at bottom */}
      <ellipse cx="105" cy="98" rx="86" ry="22" fill={p.warm} fillOpacity="0.24" />
      <ellipse
        cx="105"
        cy="98"
        rx="80"
        ry="18.5"
        stroke={p.ink}
        strokeWidth="0.85"
        strokeOpacity="0.28"
        strokeDasharray="3 3.5"
      />

      {/* Layer 2: Mid-ground botanical sprigs, yarn ball & stationery */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Left eucalyptus & berry sprig */}
        <path
          d="M48 76 C36 71 26 62 20 50"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <path
          d="M36 69 C28 69 21 65 18 59 C24 57 31 61 36 69 Z"
          fill={p.leaf}
          fillOpacity="0.4"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M29 61 C28 53 31 46 36 42 C39 48 36 55 29 61 Z"
          fill={p.leaf}
          fillOpacity="0.32"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M43 73 C37 77 29 77 23 73 C28 69 36 69 43 73 Z"
          fill={p.leaf}
          fillOpacity="0.3"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <circle cx="20" cy="49" r="2.6" fill={p.rose} fillOpacity="0.6" stroke={p.ink} strokeWidth="0.95" />
        <circle cx="26" cy="46" r="2.1" fill={p.gold} fillOpacity="0.65" stroke={p.ink} strokeWidth="0.95" />

        {/* Right botanical sprig behind teacup */}
        <path
          d="M162 76 C173 70 182 61 188 50"
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <path
          d="M172 69 C180 69 187 65 190 59 C184 57 177 61 172 69 Z"
          fill={p.leaf}
          fillOpacity="0.38"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <path
          d="M179 61 C180 53 177 46 172 42 C169 48 172 55 179 61 Z"
          fill={p.leaf}
          fillOpacity="0.3"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <circle cx="188" cy="49" r="2.5" fill={p.rose} fillOpacity="0.58" stroke={p.ink} strokeWidth="0.95" />

        {/* Cozy yarn ball on bottom-left */}
        <path
          d="M42 97 C48 103 36 106 46 110 C52 112 58 109 62 111"
          stroke={p.rose}
          strokeWidth="2.2"
          strokeOpacity="0.45"
        />
        <path
          d="M42 97 C48 103 36 106 46 110 C52 112 58 109 62 111"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <circle cx="35" cy="91" r="9.5" fill={p.paper} />
        <circle cx="35" cy="91" r="9.5" fill={p.rose} fillOpacity="0.42" stroke={p.ink} strokeWidth="1.25" />
        <path d="M27.5 87 C32 84.5 38.5 86.5 42.5 91.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />
        <path d="M26.5 91.5 C31 89 37.5 91 41.5 96" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />
        <path d="M30.5 99 C32.5 92.5 37.5 87 41.5 85" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />
        <path d="M35 100 C37 94 40.5 89 44 87" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />
      </g>

      {/* Layer 3: Foreground Protagonist — Snuggled Orange/Calico Cat + Open Notebook + Teacup */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Fluffy curling cat tail on right side */}
        <path
          d="M132 76 C145 73 156 62 155 48 C154.5 40 148 38 145 42.5 C142 47 147 52.5 143 60 C140.5 65 134 68 128 70 Z"
          fill={p.paper}
        />
        <path
          d="M155 48 C154.5 40 148 38 145 42.5 C143.5 44.8 145 48 146 51 C150 51.8 153.5 50.5 155 48 Z"
          fill={p.gold}
          fillOpacity="0.52"
        />
        <path
          d="M152 58.5 C149.5 56.8 146.5 57 143.8 58.5 C142.2 61.5 140 63.8 137.5 65.5 C143 66.5 148.8 63 152 58.5 Z"
          fill={p.brand}
          fillOpacity="0.32"
        />
        <path
          d="M132 76 C145 73 156 62 155 48 C154.5 40 148 38 145 42.5 C142 47 147 52.5 143 60 C140.5 65 134 68 128 70"
          stroke={p.ink}
          strokeWidth="1.35"
        />

        {/* Chubby cat body & round head base (100% opaque p.paper) */}
        <path
          d="M66 82 C63 69 68 58 76 53 C72 47 72 39 75 33 L72.5 21 C78.5 22 83.5 25.5 86.5 28.5 C92.5 27 99.5 27 105.5 28.5 C108.5 25.5 113.5 22 119.5 21 L117 33 C120 39 120 47 116 53 C127 57 135 68 134 82 Z"
          fill={p.paper}
        />

        {/* Cream-orange & calico patches on cat */}
        <path
          d="M72.5 21 C78.5 22 83.5 25.5 86.5 28.5 C87.5 33.5 85 39 80 41.5 C76.5 43 73.5 41.5 73.2 38 L75 33 Z"
          fill={p.gold}
          fillOpacity="0.48"
        />
        <path
          d="M119.5 21 L117 33 C119 37 119.8 42 118.8 46.5 C114 45.5 110.5 42 109.5 37 C108.5 32.5 106.8 29.8 105.5 28.5 C108.5 25.5 113.5 22 119.5 21 Z"
          fill={p.brand}
          fillOpacity="0.32"
        />
        <path
          d="M116 53 C127 57 134 66 134 78 C126 78 119 73 116 66 C113.5 60 114 55.5 116 53 Z"
          fill={p.gold}
          fillOpacity="0.44"
        />
        <path
          d="M66.5 76 C66 67 69.5 59 76 54.5 C80.5 57.5 82 63 80 69.5 C78 75 72 77 66.5 76 Z"
          fill={p.brand}
          fillOpacity="0.24"
        />

        {/* Inner ears */}
        <path d="M75.5 25 L76.8 31.8 L82.8 29 Z" fill={p.rose} fillOpacity="0.44" />
        <path d="M116.5 25 L115.2 31.8 L109.2 29 Z" fill={p.rose} fillOpacity="0.44" />

        {/* Cat main outline */}
        <path
          d="M66 82 C63 69 68 58 76 53 C72 47 72 39 75 33 L72.5 21 C78.5 22 83.5 25.5 86.5 28.5 C92.5 27 99.5 27 105.5 28.5 C108.5 25.5 113.5 22 119.5 21 L117 33 C120 39 120 47 116 53 C127 57 135 68 134 82"
          stroke={p.ink}
          strokeWidth="1.4"
        />

        {/* Forehead & back tabby stripes */}
        <path d="M96 28.2 L96 33.5" stroke={p.ink} strokeWidth="1.05" strokeOpacity="0.58" />
        <path d="M92 29 L93 33" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.52" />
        <path d="M100 29 L99 33" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.52" />
        <path d="M124 58 C127 60 129.5 62.5 131 65.5" stroke={p.ink} strokeWidth="1.0" strokeOpacity="0.5" />
        <path d="M127 64 C129.5 65.8 131.5 68 132.5 70.5" stroke={p.ink} strokeWidth="1.0" strokeOpacity="0.5" />

        {/* Cute ribbon bow by left ear */}
        <path
          d="M84 28 C80 24.5 76.5 26.5 78.5 30.5 C80 33 83.5 31.5 84 28 Z"
          fill={p.rose}
          fillOpacity="0.68"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <path
          d="M84 28 C87.5 24 91 26 89.5 30 C88 32.5 84.5 31.5 84 28 Z"
          fill={p.rose}
          fillOpacity="0.68"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <circle cx="84" cy="28.5" r="1.6" fill={p.gold} stroke={p.ink} strokeWidth="0.9" />

        {/* Collar & golden bell */}
        <path
          d="M77.5 54.5 C86 58.8 106 58.8 114.5 54.5"
          stroke={p.rose}
          strokeWidth="3.2"
        />
        <path
          d="M77.5 54.5 C86 58.8 106 58.8 114.5 54.5"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <circle cx="96" cy="59.5" r="3.6" fill={p.gold} stroke={p.ink} strokeWidth="1.2" />
        <path d="M94.2 60.2 L97.8 60.2" stroke={p.ink} strokeWidth="0.9" />
        <circle cx="96" cy="61.5" r="0.7" fill={p.ink} />

        {/* Plump rosy cheeks */}
        <ellipse cx="81.5" cy="46.5" rx="3.8" ry="2.1" fill={p.rose} fillOpacity="0.45" />
        <ellipse cx="110.5" cy="46.5" rx="3.8" ry="2.1" fill={p.rose} fillOpacity="0.45" />

        {/* Contentedly squinting eyes */}
        <path d="M82.5 42.5 C85 39.5 88.8 39.5 91 42.5" stroke={p.ink} strokeWidth="1.35" />
        <path d="M81.5 41.2 L83 42.2" stroke={p.ink} strokeWidth="1.0" />
        <path d="M101 42.5 C103.2 39.5 107 39.5 109.5 42.5" stroke={p.ink} strokeWidth="1.35" />
        <path d="M110.5 41.2 L109 42.2" stroke={p.ink} strokeWidth="1.0" />

        {/* Sweet pink nose & happy :3 mouth */}
        <path d="M94.4 45.2 L96 47 L97.6 45.2 Z" fill={p.rose} stroke={p.ink} strokeWidth="0.95" />
        <path d="M92.5 48 C94 49.8 96 48.5 96 47 C96 48.5 98 49.8 99.5 48" stroke={p.ink} strokeWidth="1.1" />

        {/* Whiskers */}
        <path d="M74 44 L67 42.8" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.6" />
        <path d="M74 46.8 L66.5 46.8" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.6" />
        <path d="M74.5 49.5 L68 50.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.6" />
        <path d="M118 44 L125 42.8" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.6" />
        <path d="M118 46.8 L125.5 46.8" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.6" />
        <path d="M117.5 49.5 L124 50.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.6" />

        {/* Open softcover study notebook in foreground */}
        {/* Softcover jacket */}
        <path
          d="M46 98 L54 77 C68 74 82 75 96 79 C110 75 124 74 138 77 L146 98 C129 94 112 95 96 100 C80 95 63 94 46 98 Z"
          fill={p.brand}
          fillOpacity="0.45"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        {/* Thick page block & open white pages (opaque p.paper) */}
        <path
          d="M49 94 L56 74 C69 71.5 83 72.5 96 76.5 C109 72.5 123 71.5 136 74 L143 94 C127 90.5 111 91.5 96 96.5 C81 91.5 65 90.5 49 94 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.3"
        />
        {/* Lower page thickness edge */}
        <path
          d="M49 94 C65 90.5 81 91.5 96 96.5 C111 91.5 127 90.5 143 94 L144.5 97 C128 93.5 111.5 94.5 96 99.5 C80.5 94.5 64 93.5 47.5 97 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.15"
        />
        {/* Center spine fold & warm gutter shading */}
        <path
          d="M93 75.5 L96 76.5 L99 75.5 L99 95.5 L96 96.5 L93 95.5 Z"
          fill={p.warm}
          fillOpacity="0.38"
        />
        <path d="M96 76.5 L96 96.5" stroke={p.ink} strokeWidth="1.15" />

        {/* Study notes & highlights on left page */}
        <rect x="61" y="79" width="14" height="3.2" rx="1.2" fill={p.gold} fillOpacity="0.45" />
        <path d="M60 85 L87 86.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.5" />
        <path d="M58 89 L85 90.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.5" />
        <circle cx="84" cy="80.8" r="2.2" fill={p.leaf} fillOpacity="0.55" />

        {/* Paw stamp & study lines on right page */}
        <path d="M105 81 L128 79.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.5" />
        <path d="M105 85 L130 83.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.5" />
        <ellipse cx="122" cy="89.5" rx="2.6" ry="2.0" fill={p.rose} fillOpacity="0.6" />
        <circle cx="119" cy="86.8" r="1.0" fill={p.rose} fillOpacity="0.6" />
        <circle cx="122" cy="86" r="1.05" fill={p.rose} fillOpacity="0.6" />
        <circle cx="125" cy="86.8" r="1.0" fill={p.rose} fillOpacity="0.6" />

        {/* Hanging ribbon bookmark with golden paw tag */}
        <path
          d="M96 96.5 C97 103 101 107 104 113 L108 110.5 L111 113.5 C108 106.5 102 102 98 96 Z"
          fill={p.rose}
          fillOpacity="0.7"
          stroke={p.ink}
          strokeWidth="1.05"
        />
        <circle cx="107" cy="112" r="2.8" fill={p.gold} stroke={p.ink} strokeWidth="0.95" />

        {/* Cat's two round white paws resting over top edge of open notebook */}
        <path
          d="M74 75 C74 70.5 85 70.5 85 75 C85 78.2 74 78.2 74 75 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.3"
        />
        <path d="M77.8 73.8 L77.8 76.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />
        <path d="M81.2 73.8 L81.2 76.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />

        <path
          d="M107 75 C107 70.5 118 70.5 118 75 C118 78.2 107 78.2 107 75 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.3"
        />
        <path d="M110.8 73.8 L110.8 76.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />
        <path d="M114.2 73.8 L114.2 76.5" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.65" />

        {/* Steaming teacup on saucer at bottom-right */}
        {/* Saucer */}
        <ellipse cx="163" cy="99" rx="17" ry="5.5" fill={p.paper} stroke={p.ink} strokeWidth="1.25" />
        <ellipse cx="163" cy="99" rx="12" ry="3.2" fill={p.warm} fillOpacity="0.38" />

        {/* Cup handle */}
        <path
          d="M173 84 C178.5 84 179.5 92.5 173 93.5"
          stroke={p.ink}
          strokeWidth="2.4"
        />
        <path
          d="M173 84 C178.5 84 179.5 92.5 173 93.5"
          stroke={p.paper}
          strokeWidth="1.0"
        />

        {/* Cup porcelain body (opaque p.paper) */}
        <path
          d="M151 81 L175 81 L173 94 C172 97.5 168 99 163 99 C158 99 154 97.5 153 94 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.25"
        />
        {/* Decorative coral stripe on cup */}
        <path
          d="M152 88 C159 90 167 90 174 88 L173.4 91.5 C166.5 93.5 159.5 93.5 152.6 91.5 Z"
          fill={p.brand}
          fillOpacity="0.38"
        />
        {/* Cup rim & warm amber tea surface */}
        <ellipse cx="163" cy="81" rx="12" ry="3.5" fill={p.paper} stroke={p.ink} strokeWidth="1.2" />
        <ellipse cx="163" cy="81.5" rx="9.8" ry="2.2" fill={p.gold} fillOpacity="0.58" />

        {/* Fish-shaped cookie on saucer edge */}
        <path
          d="M145 97.5 C148 95 152.5 95.5 154.5 98 L157.5 96.2 L157 100.2 L154.2 99.2 C152 101 148 100.8 145 97.5 Z"
          fill={p.gold}
          fillOpacity="0.68"
          stroke={p.ink}
          strokeWidth="1.0"
        />

        {/* Gentle steam wisps above teacup */}
        <path
          d="M159 75 C157 70 162 67 160 62"
          stroke={p.ink}
          strokeWidth="1.0"
          strokeOpacity="0.45"
        />
        <path
          d="M166 74 C164 69 169 66 167 60"
          stroke={p.ink}
          strokeWidth="1.0"
          strokeOpacity="0.45"
        />
      </g>

      {/* Layer 4: Floating heart, drifting petals, four-point stars & micro dust */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Floating heart above cat */}
        <path
          d="M92 14.5 C92 12 95 11.2 96.5 13.5 C98 11.2 101 12 101 14.5 C101 17.8 96.5 20.2 96.5 21.5 C96.5 20.2 92 17.8 92 14.5 Z"
          fill={p.rose}
          fillOpacity="0.58"
          stroke={p.ink}
          strokeWidth="1.05"
        />

        {/* Drifting blossom petals */}
        <path
          d="M57 29 C54 27 52 29.5 54.5 32.5 C57 35 60.5 33 59 29.8 Z"
          fill={p.rose}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="0.9"
        />
        <path
          d="M136 25 C139 23 141.5 25.5 139 28.5 C136.5 31 133 29 134.5 25.8 Z"
          fill={p.rose}
          fillOpacity="0.55"
          stroke={p.ink}
          strokeWidth="0.9"
        />
        <path
          d="M72 108 C69 106.5 67.5 109 70 111.5 C72.5 113.5 75.5 111.5 74 108.8 Z"
          fill={p.rose}
          fillOpacity="0.5"
          stroke={p.ink}
          strokeWidth="0.85"
        />
        <path
          d="M132 107 C135 105.5 136.8 108 134.5 110.5 C132 112.5 129 110.5 130.5 107.8 Z"
          fill={p.rose}
          fillOpacity="0.5"
          stroke={p.ink}
          strokeWidth="0.85"
        />

        {/* Four-point star sparkles */}
        <path
          d="M66 16 L67.2 19.5 L70.8 20.8 L67.2 22 L66 25.5 L64.8 22 L61.2 20.8 L64.8 19.5 Z"
          fill={p.gold}
          fillOpacity="0.85"
        />
        <path
          d="M150 20 L151.2 23.5 L154.8 24.8 L151.2 26 L150 29.5 L148.8 26 L145.2 24.8 L148.8 23.5 Z"
          fill={p.gold}
          fillOpacity="0.85"
        />
        <path
          d="M24 72 L24.9 74.5 L27.5 75.4 L24.9 76.3 L24 78.8 L23.1 76.3 L20.5 75.4 L23.1 74.5 Z"
          fill={p.gold}
          fillOpacity="0.75"
        />
        <path
          d="M188 74 L188.9 76.5 L191.5 77.4 L188.9 78.3 L188 80.8 L187.1 78.3 L184.5 77.4 L187.1 76.5 Z"
          fill={p.gold}
          fillOpacity="0.75"
        />

        {/* Micro dust dots */}
        <circle cx="48" cy="44" r="1.4" fill={p.gold} fillOpacity="0.65" />
        <circle cx="124" cy="16" r="1.3" fill={p.brand} fillOpacity="0.5" />
        <circle cx="168" cy="36" r="1.4" fill={p.rose} fillOpacity="0.5" />
        <circle cx="84" cy="112" r="1.3" fill={p.gold} fillOpacity="0.6" />
        <circle cx="182" cy="96" r="1.2" fill={p.brand} fillOpacity="0.45" />
      </g>
    </svg>
  ),

  empty: (p: IllustrationPalette) => (
    <svg viewBox="0 0 136 90" className="w-full h-full" fill="none" aria-hidden="true">
      {/* Layer 1: Tranquil ambient aura & crescent moon */}
      <ellipse cx="68" cy="56" rx="52" ry="26" fill={p.brandSoft} fillOpacity="0.2" />
      <ellipse cx="64" cy="60" rx="38" ry="18" fill={p.warm} fillOpacity="0.22" />
      <circle cx="82" cy="44" r="18" fill={p.gold} fillOpacity="0.12" />

      {/* Pale crescent moon in top-left */}
      <path
        d="M28 16 C23.5 17.5 21.5 22.2 23.5 26.5 C25.5 30.8 30.2 32.5 34.5 30.5 C30.2 30.2 27 27 26.8 22.5 C26.7 20.2 27.2 18 28 16 Z"
        fill={p.gold}
        fillOpacity="0.38"
        stroke={p.ink}
        strokeWidth="1.05"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Layer 2: Closed hardcover journal & small sage leaf sprig */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Small sage leaves tucked on left */}
        <path
          d="M29 61 C22 59 17 54 16 48 C22 48 27 53 29 61 Z"
          fill={p.leaf}
          fillOpacity="0.36"
          stroke={p.ink}
          strokeWidth="1.0"
        />
        <path
          d="M31 63 C25 65 19 63 16 59 C21 57 27 59 31 63 Z"
          fill={p.leaf}
          fillOpacity="0.26"
          stroke={p.ink}
          strokeWidth="0.95"
        />

        {/* Closed hardcover notebook lying flat */}
        {/* Bottom cover edge */}
        <path
          d="M24 69 L42 55 L112 58 L98 75 L24 72 Z"
          fill={p.brand}
          fillOpacity="0.38"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        {/* Page block (opaque p.paper) */}
        <path
          d="M25 63 L97 66 L111 52 L111 58 L97 73 L25 70 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.2"
        />
        {/* Top cover of closed notebook */}
        <path
          d="M24 63 L42 49 L112 52 L97 66 Z"
          fill={p.paper}
        />
        <path
          d="M24 63 L42 49 L112 52 L97 66 Z"
          fill={p.brand}
          fillOpacity="0.28"
          stroke={p.ink}
          strokeWidth="1.25"
        />
        {/* Spine curve & page lines */}
        <path
          d="M24 63 C22 65 22 68.5 24 70.5"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        <path d="M30 66.5 L94 69.2" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.45" />
        <path d="M99 67.5 L109 55.5" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.45" />

        {/* Hanging ribbon bookmark */}
        <path
          d="M82 69 C84 74 88 77 91 81 L94 78.5 L97 80.5 C94 76 90 73 86 69 Z"
          fill={p.rose}
          fillOpacity="0.65"
          stroke={p.ink}
          strokeWidth="1.0"
        />
      </g>

      {/* Layer 3: Curled-up sleeping orange/calico cat */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Curled cat body & head base (100% opaque p.paper) */}
        <path
          d="M39 52 C37 42 45 31 61 30 C78 29 92 38 92 50 C92 59 82 64 66 64 C50 64 40 59 39 52 Z"
          fill={p.paper}
        />
        {/* Ears base */}
        <path
          d="M41 44 L38.5 34.5 L47.5 38.5 Z"
          fill={p.paper}
        />
        <path
          d="M55 39.5 L60.5 32 L63 41 Z"
          fill={p.paper}
        />

        {/* Cream-orange & calico patches on sleeping cat */}
        <path
          d="M58 30.2 C72 29.5 85 35 90 44 C84 46.5 75 45 68 40 C62 36 59 32.5 58 30.2 Z"
          fill={p.gold}
          fillOpacity="0.46"
        />
        <path
          d="M41 44 L38.5 34.5 L47.5 38.5 C46.5 41.5 44 43.5 41 44 Z"
          fill={p.gold}
          fillOpacity="0.48"
        />
        <path
          d="M84 40 C90 43.5 92.5 49 91 55 C86 54.5 81.5 51 80.5 46 C80 43 81.5 41 84 40 Z"
          fill={p.brand}
          fillOpacity="0.3"
        />

        {/* Inner ears */}
        <path d="M40.5 37.2 L41.8 42 L45.5 39.8 Z" fill={p.rose} fillOpacity="0.42" />
        <path d="M59.5 34.8 L57 39.5 L61.2 40.2 Z" fill={p.rose} fillOpacity="0.42" />

        {/* Sleeping cat main outer contour & ears */}
        <path
          d="M41 44 L38.5 34.5 L47.5 38.5 C50 37.8 53 38 55.5 39 L60.5 32 L62.8 40.2"
          stroke={p.ink}
          strokeWidth="1.3"
        />
        <path
          d="M41 43 C38.5 46.5 38.2 51 40 55 C43.5 61.5 53 64 66 64 C82 64 92 59 92 50 C92 38 78 29 61 30 C56.5 30.2 52.2 31.2 48.5 33"
          stroke={p.ink}
          strokeWidth="1.35"
        />

        {/* Tabby stripes on curved back */}
        <path d="M68 30.8 C69 34 68.5 37 67 39.5" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.52" />
        <path d="M74 32 C75 35.2 74.5 38.2 73 40.8" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.52" />
        <path d="M80 34.5 C80.8 37.5 80 40.5 78.2 42.8" stroke={p.ink} strokeWidth="0.95" strokeOpacity="0.52" />

        {/* Fluffy tail wrapping snugly around the front */}
        <path
          d="M88 55 C83 61 72 64 61 62.5 C57.5 62 56 59 58 57 C60 55 64.5 56.5 70 56.5 C76 56.5 81 54 84 50.5"
          fill={p.paper}
        />
        <path
          d="M64 62.7 C60 62.5 56.2 60.2 57.5 57.5 C59 55.2 62.5 56 65.5 56.4 C65.5 58.8 65 61 64 62.7 Z"
          fill={p.gold}
          fillOpacity="0.5"
        />
        <path
          d="M88 55 C83 61 72 64 61 62.5 C57.5 62 56 59 58 57 C60 55 64.5 56.5 70 56.5 C76 56.5 81 54 84 50.5"
          stroke={p.ink}
          strokeWidth="1.25"
        />

        {/* Tucked sleeping head contour & little paw */}
        <path
          d="M62.8 40.2 C66 44 66 50.5 61.5 54.5 C57 58.5 48.5 59 43 56"
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <path
          d="M48 57.5 C48 54.8 55 54.8 55 57.5 C55 59.5 48 59.5 48 57.5 Z"
          fill={p.paper}
          stroke={p.ink}
          strokeWidth="1.15"
        />
        <path d="M51.5 56.8 L51.5 58.6" stroke={p.ink} strokeWidth="0.8" strokeOpacity="0.6" />

        {/* Peaceful sleeping closed eyes, blush & tiny nose */}
        <ellipse cx="44" cy="51.5" rx="2.4" ry="1.3" fill={p.rose} fillOpacity="0.42" />
        <ellipse cx="58.5" cy="52.5" rx="2.4" ry="1.3" fill={p.rose} fillOpacity="0.42" />
        <path d="M44.5 48.5 C46 50.5 48.8 50.5 50.2 48.5" stroke={p.ink} strokeWidth="1.2" />
        <path d="M54 49.2 C55.5 51.2 58.2 51.2 59.8 49.2" stroke={p.ink} strokeWidth="1.2" />
        <path d="M51 51.8 L52 52.8 L53 51.8 Z" fill={p.rose} stroke={p.ink} strokeWidth="0.8" />
      </g>

      {/* Layer 4: Hand-drawn vector Zzz floaters, dreamy bubbles & stars */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Hand-drawn vector Zzz paths (no <text> tag) */}
        <path
          d="M72 26 L77 26 L72 31 L77 31"
          stroke={p.ink}
          strokeWidth="1.15"
          strokeOpacity="0.65"
        />
        <path
          d="M82 18 L88.5 18 L82 24.5 L88.5 24.5"
          stroke={p.ink}
          strokeWidth="1.25"
          strokeOpacity="0.75"
        />
        <path
          d="M94 10 L102 10 L94 18 L102 18"
          stroke={p.brand}
          strokeWidth="1.4"
          strokeOpacity="0.85"
        />

        {/* Dreamy bubbles & four-point stars */}
        <circle cx="67" cy="31" r="1.6" fill={p.paper} stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.55" />
        <circle cx="108" cy="22" r="2.2" fill={p.brandSoft} fillOpacity="0.6" stroke={p.ink} strokeWidth="0.9" strokeOpacity="0.5" />

        <path
          d="M44 18 L44.8 20.2 L47 21 L44.8 21.8 L44 24 L43.2 21.8 L41 21 L43.2 20.2 Z"
          fill={p.gold}
          fillOpacity="0.8"
        />
        <path
          d="M112 34 L112.7 35.8 L114.5 36.5 L112.7 37.2 L112 39 L111.3 37.2 L109.5 36.5 L111.3 35.8 Z"
          fill={p.gold}
          fillOpacity="0.75"
        />
        <circle cx="56" cy="15" r="1.2" fill={p.rose} fillOpacity="0.48" />
        <circle cx="118" cy="54" r="1.2" fill={p.gold} fillOpacity="0.6" />
      </g>
    </svg>
  ),
};
