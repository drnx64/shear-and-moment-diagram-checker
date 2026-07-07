import { useState, useRef, useEffect } from 'react';

interface Props {
  value: number;
  onChange: (v: number) => void;
  onBlurValidate?: (v: number) => number;
  min?: number;
  max?: number;
  className?: string;
  placeholder?: string;
}

export default function BlurInput({ value, onChange, onBlurValidate, min, max, className, placeholder }: Props) {
  const [local, setLocal] = useState(String(value));
  const ref = useRef(value);
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
    <input
      type="text"
      inputMode="decimal"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
      className={className}
      placeholder={placeholder}
    />
  );
}
