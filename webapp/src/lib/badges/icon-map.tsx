import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function BootIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M5 18h3l1-8 3-1 2 6h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 18v2M17 18v2" strokeLinecap="round" />
    </svg>
  );
}

function MapIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" strokeLinejoin="round" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

function DistanceIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M4 18h16M7 14l3-8 3 5 4-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PersonIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5" strokeLinecap="round" />
    </svg>
  );
}

function TargetIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function StarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path
        d="m12 3 2.2 5.2 5.6.5-4.2 3.7 1.3 5.5L12 15.8 7.1 18l1.3-5.5-4.2-3.7 5.6-.5L12 3Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AwardIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 14 7 21l5-2.5L17 21l-1.5-7" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" strokeLinecap="round" />
    </svg>
  );
}

function CameraIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M4 8h4l2-2h4l2 2h4v10H4V8Z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function EyeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

const ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  boot: BootIcon,
  map: MapIcon,
  distance: DistanceIcon,
  person: PersonIcon,
  target: TargetIcon,
  star: StarIcon,
  settings: SettingsIcon,
  award: AwardIcon,
  sun: SunIcon,
  camera: CameraIcon,
  eye: EyeIcon,
  calendar: TargetIcon,
  month: StarIcon,
  compass: MapIcon,
  gps: DistanceIcon,
  mountain: DistanceIcon,
  route: MapIcon,
  share: AwardIcon,
};

export function BadgeIcon({
  iconKey,
  className = 'w-5 h-5',
}: {
  iconKey: string;
  className?: string;
}) {
  const Icon = ICONS[iconKey] ?? AwardIcon;
  return <Icon className={className} aria-hidden />;
}
