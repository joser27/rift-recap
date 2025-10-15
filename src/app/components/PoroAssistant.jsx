'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './poro.module.css';

const ANIMATIONS = {
  blink: { row: 1, frames: 2, duration: 1200 },
  excited: { row: 2, frames: 4, duration: 900 },
  question: { row: 3, frames: 2, duration: 800 },
  talking: { row: 4, frames: 3, duration: 700 },
  laughing: { row: 5, frames: 2, duration: 800 },
};

export default function PoroAssistant({
  state = 'idle',
  onAppear,
  showDialogue,
  onPoroClick,
  frameWidth = 32,
  frameHeight = 32,
  scale = 3,
  className,
}) {
  const [hasBouncedIn, setHasBouncedIn] = useState(false);
  const spriteRef = useRef(null);

  useEffect(() => {
    if (!hasBouncedIn) {
      setHasBouncedIn(true);
      if (onAppear) onAppear();
    }
  }, [hasBouncedIn, onAppear]);

  const handlePoroClick = () => {
    if (onPoroClick) {
      onPoroClick();
    }
  };

  const mode = useMemo(() => {
    switch (state) {
      case 'thinking':
        return 'question';
      case 'ready':
        return 'excited';
      case 'talking':
        return 'talking';
      case 'laughing':
        return 'laughing';
      case 'idle':
      default:
        return 'blink';
    }
  }, [state]);

  const anim = ANIMATIONS[mode];

  const styleVars = {
    '--row': anim.row,
    '--frames': anim.frames,
    '--duration': `${anim.duration}ms`,
    '--fw': `${frameWidth}px`,
    '--fh': `${frameHeight}px`,
    '--scale': scale,
  };

  return (
    <div className={`${styles.poroWrapper} ${hasBouncedIn ? '' : styles.bounceIn} ${className || ''}`}>
      <div
        ref={spriteRef}
        className={`${styles.poroSprite} ${styles.clickable}`}
        style={styleVars}
        aria-label={`Poro ${mode}`}
        onClick={handlePoroClick}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handlePoroClick();
          }
        }}
      />
      {showDialogue && (
        <div className={styles.dialogueContainer}>
          {showDialogue}
        </div>
      )}
    </div>
  );
}


