// The Flowboard mark in the theme's colours. Same shapes as public/favicon.svg: change them together.
import './Logo.css';

interface LogoProps {
  size?: number;
}

export function Logo({ size = 24 }: LogoProps) {
  return (
    <svg className="logo" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <rect className="logo__stem" x="13" y="8" width="13" height="48" rx="4" />
      <rect className="logo__card" x="30" y="8" width="22" height="13" rx="4" />
      <rect className="logo__card" x="30" y="25" width="17" height="13" rx="4" />
    </svg>
  );
}
