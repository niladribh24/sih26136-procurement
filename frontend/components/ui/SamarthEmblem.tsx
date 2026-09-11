"use client";

import React from "react";

export interface SamarthEmblemProps {
  size?: number;
  className?: string;
}

export const SamarthEmblem: React.FC<SamarthEmblemProps> = ({
  size = 36,
  className = "",
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-label="SAMARTH Sovereign Public Procurement Emblem"
    >
      <defs>
        <radialGradient id="compEmblemBg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#244574" />
          <stop offset="85%" stop-color="#1B365D" />
          <stop offset="100%" stop-color="#122542" />
        </radialGradient>
        
        <linearGradient id="compGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#D48B47" />
          <stop offset="50%" stop-color="#A25722" />
          <stop offset="100%" stop-color="#73380F" />
        </linearGradient>

        <path id="compTextArcTop" d="M 18,60 A 42,42 0 0,1 102,60" fill="none" />
        <path id="compTextArcBottom" d="M 102,60 A 42,42 0 0,1 18,60" fill="none" />
      </defs>

      {/* Outer Solid Edge */}
      <circle cx="60" cy="60" r="58" fill="url(#compEmblemBg)" stroke="#A25722" stroke-width="2.5" />
      
      {/* Fine Guilloche / Dashed Ring */}
      <circle cx="60" cy="60" r="53" fill="none" stroke="#FAF8F3" stroke-width="1" stroke-dasharray="2 1.5" opacity="0.6" />
      <circle cx="60" cy="60" r="49" fill="none" stroke="#A25722" stroke-width="1" />

      {/* Circular Administrative Typography */}
      <text font-family="'IBM Plex Sans', -apple-system, sans-serif" font-size="6.8" font-weight="700" fill="#FAF8F3" letter-spacing="1.2">
        <textPath href="#compTextArcTop" startOffset="50%" text-anchor="middle">
          SAMARTH · PUBLIC PROCUREMENT
        </textPath>
      </text>
      <text font-family="'IBM Plex Sans', -apple-system, sans-serif" font-size="6.2" font-weight="600" fill="#D9D6CB" letter-spacing="1.5">
        <textPath href="#compTextArcBottom" startOffset="50%" text-anchor="middle">
          ★ GOVERNMENT OF INDIA ★
        </textPath>
      </text>

      {/* Inner Center Ring */}
      <circle cx="60" cy="60" r="37" fill="#10223B" stroke="#A25722" stroke-width="1.8" />
      <circle cx="60" cy="60" r="34" fill="none" stroke="#FAF8F3" stroke-width="0.75" opacity="0.3" />

      {/* 16-Spoke Ashoka / Dharma Chakra */}
      <g stroke="#A25722" stroke-width="0.9" opacity="0.75">
        <line x1="60" y1="27" x2="60" y2="93" />
        <line x1="27" y1="60" x2="93" y2="60" />
        <line x1="36.67" y1="36.67" x2="83.33" y2="83.33" />
        <line x1="36.67" y1="83.33" x2="83.33" y2="36.67" />
        <line x1="48.13" y1="28.56" x2="71.87" y2="91.44" />
        <line x1="28.56" y1="48.13" x2="91.44" y2="71.87" />
        <line x1="71.87" y1="28.56" x2="48.13" y2="91.44" />
        <line x1="91.44" y1="48.13" x2="28.56" y2="71.87" />
      </g>

      {/* Central Civic Shield */}
      <path
        d="M 60,38 L 76,46 L 73,69 C 73,79 66,85 60,88 C 54,85 47,79 47,69 L 44,46 Z"
        fill="#1B365D"
        stroke="#FAF8F3"
        stroke-width="1.5"
        stroke-linejoin="round"
      />

      {/* Upward Dynamic Chevron (Startup Innovation) */}
      <polygon points="60,43 71,55 60,51 49,55" fill="url(#compGoldGradient)" stroke="#FAF8F3" stroke-width="0.6" />
      <polygon points="60,53 69,63 60,60 51,63" fill="#265C42" stroke="#FAF8F3" stroke-width="0.5" />

      {/* Central Star */}
      <circle cx="60" cy="70" r="3" fill="#FAF8F3" />
      <circle cx="60" cy="70" r="1.5" fill="#1B365D" />

      {/* Base Inscription Tag */}
      <rect x="50" y="78" width="20" height="4.5" rx="1.5" fill="#A25722" />
      <text
        x="60"
        y="81.5"
        font-family="'IBM Plex Mono', monospace"
        font-size="3.2"
        font-weight="700"
        fill="#FAF8F3"
        text-anchor="middle"
        letter-spacing="0.5"
      >
        SIH26136
      </text>
    </svg>
  );
};
