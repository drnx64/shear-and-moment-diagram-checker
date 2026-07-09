interface Props {
  className?: string;
}

export default function ShearMomentIcon({ className = '' }: Props) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Shear icon — positive shear: left pushes up, right pushes down */}
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-orange-600" aria-label="Positive shear">
        <rect x="3" y="6" width="16" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
        {/* Left face arrow up */}
        <line x1="3" y1="14" x2="3" y2="8" stroke="currentColor" strokeWidth="1.5" />
        <polygon points="3,7 1,10 5,10" fill="currentColor" />
        {/* Right face arrow down */}
        <line x1="19" y1="8" x2="19" y2="14" stroke="currentColor" strokeWidth="1.5" />
        <polygon points="19,15 17,12 21,12" fill="currentColor" />
        <text x="11" y="5" textAnchor="middle" fontSize="6" fill="currentColor" fontWeight="700">V</text>
      </svg>

      {/* Moment icon — positive moment (sagging): CCW left, CW right, sagging curve */}
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-blue-600" aria-label="Positive moment">
        <rect x="3" y="6" width="16" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
        {/* Sagging deformation — semi-circle curve below */}
        <path d="M 3 16 Q 11 12 19 16" stroke="currentColor" strokeWidth="1.2" fill="none" />
        {/* Left face CCW arrow */}
        <path d="M 5 8 A 3 3 0 0 0 3 11" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <polygon points="5,8 4,6 7,7" fill="currentColor" />
        {/* Right face CW arrow */}
        <path d="M 17 8 A 3 3 0 0 1 19 11" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <polygon points="17,8 18,6 15,7" fill="currentColor" />
        <text x="11" y="5" textAnchor="middle" fontSize="6" fill="currentColor" fontWeight="700">M</text>
      </svg>
    </div>
  );
}
