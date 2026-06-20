"use client";

interface LogoProps {
  className?: string;
  size?: number;
  strokeColor?: string;
  dotColor?: string;
}

export default function Logo({
  className = "",
  size = 24,
  strokeColor = "currentColor",
  dotColor = "#EAB308", // Gold core matches the light-gold aesthetic
}: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 3L21 7.5L12 12L3 7.5Z"
        stroke={strokeColor}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 7.5V16.5M12 12V21M21 7.5V16.5"
        stroke={strokeColor}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 16.5L12 21L21 16.5"
        stroke={strokeColor}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.5" fill={dotColor} />
    </svg>
  );
}
