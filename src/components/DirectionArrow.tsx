interface Props {
  angle: number;
  size?: number;
}

export default function DirectionArrow({ angle, size = 28 }: Props) {
  const rad = (angle * Math.PI) / 180;
  const cx = size / 2;
  const cy = size / 2;
  const shaftLen = size / 2 - 6;
  const tipX = cx + shaftLen * Math.sin(rad);
  const tipY = cy + shaftLen * Math.cos(rad);

  const ax = tipX + 4 * Math.sin(rad + 0.4);
  const ay = tipY + 4 * Math.cos(rad + 0.4);
  const bx = tipX + 4 * Math.sin(rad - 0.4);
  const by = tipY + 4 * Math.cos(rad - 0.4);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={cx} cy={cy} r={size / 2 - 2} fill="none" stroke="#3f3f46" strokeWidth="1" />
      <line x1={cx} y1={cy} x2={tipX} y2={tipY} stroke="#f87171" strokeWidth="2" />
      <polygon points={`${tipX},${tipY} ${ax},${ay} ${bx},${by}`} fill="#f87171" />
      <circle cx={cx} cy={cy} r="1.5" fill="#f87171" />
    </svg>
  );
}
