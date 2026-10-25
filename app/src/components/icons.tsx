// Line icons as inline SVG strokes (design.md 3 / 13: no emoji, no icon font, no illustration). 24 dp, 1.75 stroke.
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

export interface IconProps {
  color: string;
  size?: number;
}

const stroke = { strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

/** Today: a sun above a horizon line. */
export function TodayIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d="M5 15a7 7 0 0 1 14 0" stroke={color} {...stroke} />
      <Line x1="3" y1="19" x2="21" y2="19" stroke={color} {...stroke} />
      <Line x1="12" y1="4" x2="12" y2="6" stroke={color} {...stroke} />
      <Line x1="5.5" y1="7.5" x2="7" y2="9" stroke={color} {...stroke} />
      <Line x1="18.5" y1="7.5" x2="17" y2="9" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Family: two overlapping people outlines. */
export function FamilyIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Circle cx="9" cy="8" r="3" stroke={color} {...stroke} />
      <Path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke={color} {...stroke} />
      <Circle cx="16.5" cy="9" r="2.5" stroke={color} {...stroke} />
      <Path d="M15 19a5 5 0 0 1 5.5-4.9" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Charts: the North-Indian kundli diamond. */
export function ChartsIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Rect x="3" y="3" width="18" height="18" stroke={color} {...stroke} />
      <Line x1="3" y1="3" x2="21" y2="21" stroke={color} {...stroke} />
      <Line x1="21" y1="3" x2="3" y2="21" stroke={color} {...stroke} />
      <Path d="M12 3 21 12 12 21 3 12Z" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Learn: an open book. */
export function LearnIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d="M3 5.5C5.5 4.5 8.5 4.5 12 6.5v13C8.5 17.5 5.5 17.5 3 18.5Z" stroke={color} {...stroke} />
      <Path d="M21 5.5c-2.5-1-5.5-1-9 1v13c3.5-2 6.5-2 9-1Z" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Settings gear (the only Settings entry, design.md 3). */
export function GearIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Circle cx="12" cy="12" r="3" stroke={color} {...stroke} />
      <Path
        d="M12 2.5l1.6 2.3 2.7-.8.7 2.7 2.7.7-.8 2.7 2.3 1.6-2.3 1.6.8 2.7-2.7.7-.7 2.7-2.7-.8L12 21.5l-1.6-2.3-2.7.8-.7-2.7-2.7-.7.8-2.7L2.5 12l2.3-1.6-.8-2.7 2.7-.7.7-2.7 2.7.8Z"
        stroke={color}
        {...stroke}
      />
    </Svg>
  );
}

export function ChevronIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Polyline points="9 6 15 12 9 18" stroke={color} {...stroke} />
    </Svg>
  );
}

export function BackIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Polyline points="14 6 8 12 14 18" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Checkbox glyph: box, with a tick when checked. */
export function CheckboxIcon({ color, size = 24, checked }: IconProps & { checked: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Rect x="4" y="4" width="16" height="16" rx="3" stroke={color} {...stroke} />
      {checked ? <Polyline points="8 12.5 11 15.5 16.5 9" stroke={color} {...stroke} strokeWidth={2.25} /> : null}
    </Svg>
  );
}
