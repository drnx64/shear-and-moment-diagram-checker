import { useState, useRef, useEffect } from 'react';

interface Props {
  value: number;
  onChange: (v: number) => void;
  onBlurValidate?: (v: number) => number;
  min?: number;
  max?: number;
  className?: string;
  placeholder?: string;
  suffix?: string;
  disabled?: boolean;
}

export default function BlurInput({ value, onChange, onBlurValidate, min, max, className, placeholder, suffix, disabled }: Props) {
  const [local, setLocal] = useState(String(value));
  const committed = useRef(value);

  useEffect(() => {
    if (value !== committed.current) {
      setLocal(String(value));
      committed.current = value;
    }
  }, [value]);

  function commit() {
    const raw = local.trim();
    if (raw === '') return;
    const parsed = parseFloat(raw);
    if (isNaN(parsed)) {
      setLocal(String(committed.current));
      return;
    }
    let v = parsed;
    if (max !== undefined) v = Math.min(v, max);
    if (min !== undefined) v = Math.max(v, min);
    if (onBlurValidate) v = onBlurValidate(v);
    if (v !== committed.current) {
      committed.current = v;
      onChange(v);
    }
    setLocal(String(v));
  }

  return (
    <div className="relative flex items-center">
      <input
        type="text"
        inputMode="decimal"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
          if (e.key === 'Escape') { setLocal(String(committed.current)); (e.target as HTMLInputElement).blur(); }
        }}
        className={className}
        placeholder={placeholder}
        disabled={disabled}
      />
      {suffix && (
        <span className="absolute right-2.5 text-xs text-slate-400 pointer-events-none select-none">{suffix}</span>
      )}
    </div>
  );
}
