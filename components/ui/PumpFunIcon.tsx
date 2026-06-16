import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {}

// pump.fun mark — a tilted two-tone capsule in their signature green/white.
const PumpFunIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
    className={className}
    {...props}
  >
    <g transform="rotate(45 16 16)">
      {/* capsule body */}
      <rect x="8" y="3" width="16" height="26" rx="8" fill="#54D195" />
      {/* lighter top half */}
      <path d="M8 11 a8 8 0 0 1 16 0 v0 H8 Z" fill="#9BE7C4" />
      <rect x="8" y="11" width="16" height="5" fill="#9BE7C4" />
    </g>
  </svg>
);

export default PumpFunIcon;
