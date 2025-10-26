'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './DialogueBox.module.css';
import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function DialogueBox({
  text = '',
  options = [],
  onOption,
  typing = true,
  typingSpeed = 18,
  disabled = false,
  loadingPhase = null,
  showFreeInput = false,
  onFreeSubmit,
}) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(!typing);
  const [showHint, setShowHint] = useState(true);
  const indexRef = useRef(0);
  const timerRef = useRef(null);
  
  // Auto-hide hint after 6 seconds or when user starts typing
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const safeText = typeof text === 'string' ? text : (text?.toString?.() ?? '');
    setDisplayed('');
    setDone(!typing ? false : false);
    indexRef.current = 0;
    if (!typing) {
      // While not typing (e.g., loading), do not render the full text yet
      // Keep displayed empty and mark not done so options remain disabled
      return () => timerRef.current && clearTimeout(timerRef.current);
    }

    const run = () => {
      if (indexRef.current >= safeText.length) {
        setDone(true);
        return;
      }
      const nextChar = safeText.charAt(indexRef.current);
      if (!nextChar) {
        setDone(true);
        return;
      }
      setDisplayed((d) => d + nextChar);
      indexRef.current += 1;
      timerRef.current = setTimeout(run, typingSpeed);
    };

    run();
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, [text, typing, typingSpeed]);

  const canClick = done && !disabled;

  return (
    <div className={styles.bubble}>
      {/* Minimize Hint - Auto-hides after 6 seconds */}
      {showHint && (
        <div className="absolute top-2 right-2 flex items-center gap-1 text-gray-500 text-xs animate-pulse bg-white/90 px-2 py-1 rounded-md shadow-sm border border-gray-300 z-50">
          <ChevronDown size={14} />
          <span className="hidden sm:inline">Click Poro to minimize</span>
          <span className="sm:hidden">Click Poro</span>
        </div>
      )}
      
      <div className={styles.text}>{displayed}</div>
      {loadingPhase && (
        <div className={styles.loading}>
          <div className={styles.dot} />
          <div className={styles.dot} />
          <div className={styles.dot} />
          <span>{loadingPhase}</span>
        </div>
      )}
      <div className={styles.options}>
        {options.map((opt) => (
          <button
            key={opt.key}
            className={`${styles.btn} ${canClick ? '' : styles.muted}`}
            onClick={() => canClick && onOption && onOption(opt.key)}
            disabled={!canClick}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {opt.icon ? opt.icon : null}
              <span>{opt.label}</span>
            </span>
          </button>
        ))}
      </div>
      {showFreeInput && (
        <FreeAsk disabled={!canClick || disabled} onSubmit={onFreeSubmit} />
      )}
      <div className={styles.tail} />
    </div>
  );
}

function FreeAsk({ disabled, onSubmit }) {
  const [val, setVal] = useState('');
  const submit = () => {
    const q = val.trim();
    if (!q) return;
    onSubmit && onSubmit(q);
    setVal('');
  };
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <input
        type="text"
        placeholder="✍️ Ask me anything..."
        value={val}
        onChange={(e) => setVal(e.target.value)}
        disabled={disabled}
        style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #e4d5ba', background: '#fffdfa' }}
      />
      <button
        onClick={submit}
        disabled={disabled}
        className={`${styles.btn}`}
      >Ask</button>
    </div>
  );
}


