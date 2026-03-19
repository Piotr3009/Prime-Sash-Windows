import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import ParametricSashWindow from './ParametricSashWindow';

function HeroScene({ config }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.5, 2.4]} fov={42} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableDamping
        autoRotate
        autoRotateSpeed={0.6}
        minPolarAngle={Math.PI / 2.8}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={2.4}
        maxDistance={2.4}
        target={[0, 0.5, 0]}
      />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[3, 4, 2]}
        intensity={1.4}
        color="#fff5e6"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-2, 3, -1]} intensity={0.35} color="#e0e8ff" />
      <pointLight position={[0, 0.5, 2]} intensity={0.5} color="#fff0d0" distance={5} />
      <ParametricSashWindow {...config} />
      <ContactShadows
        position={[0, -config.height / 2000 - 0.01, 0]}
        opacity={0.35}
        scale={3}
        blur={2.5}
        far={2}
      />
    </>
  );
}

export default function HeroWindow() {
  const [opening, setOpening] = useState(0);
  const [upperOpening, setUpperOpening] = useState(0);
  const [upperBars, setUpperBars] = useState('none');
  const [lowerBars, setLowerBars] = useState('none');
  const [upperCustomBars, setUpperCustomBars] = useState([]);
  const [lowerCustomBars, setLowerCustomBars] = useState([]);
  const animRunning = useRef(false);
  const [sequenceDone, setSequenceDone] = useState(false);

  const config = {
    width: 1000 - 104,
    height: 1500 - 87,
    opening,
    upperOpening,
    autoRotate: true,
    showGuides: false,
    showHorns: true,
    hornType: 'A',
    ironmongery: 'brass',
    upperGlass: 'clear',
    lowerGlass: 'clear',
    doubleGlazing: true,
    spacerColor: 'silver',
    boxDepth: 164,
    sashDepth: 57,
    boxType: 'standard',
    upperBars,
    lowerBars,
    upperCustomBars,
    lowerCustomBars,
    woodColor: '#F6F6F6',
    woodColorExt: '#F6F6F6',
    woodColorInt: '#F6F6F6',
  };

  // Smooth sash animation helper
  const animateProp = useCallback((setter, maxVal, duration = 1600) => {
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const val = maxVal * Math.sin(t * Math.PI);
        setter(Math.max(0, val));
        if (t < 1) requestAnimationFrame(step);
        else { setter(0); resolve(); }
      };
      requestAnimationFrame(step);
    });
  }, []);

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  // Full animation sequence
  const runSequence = useCallback(async () => {
    if (animRunning.current) return;
    animRunning.current = true;

    // Reset
    setUpperBars('none'); setLowerBars('none');
    setUpperCustomBars([]); setLowerCustomBars([]);

    // 1. Lower sash opens
    await wait(500);
    await animateProp(setOpening, 40, 1800);

    // 2. Upper sash opens
    await wait(800);
    await animateProp(setUpperOpening, 40, 1800);

    // 3. Bars appear 2x2
    await wait(1000);
    setUpperBars('2x2'); setLowerBars('2x2');

    // 4. Hold bars
    await wait(2500);

    // 5. Switch to custom bars with sliding animation
    setUpperBars('custom'); setLowerBars('custom');
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const pos = 100 + (350 - 100) * (i / steps);
      setUpperCustomBars([{ type: 'v', mm: pos }]);
      setLowerCustomBars([{ type: 'v', mm: pos }]);
      await wait(60);
    }

    // 6. Hold custom bars
    await wait(2000);

    // 7. Clear all
    setUpperBars('none'); setLowerBars('none');
    setUpperCustomBars([]); setLowerCustomBars([]);

    animRunning.current = false;
    setSequenceDone(true);
  }, [animateProp]);

  // Start sequence after 3s
  useEffect(() => {
    const timer = setTimeout(runSequence, 3000);
    return () => clearTimeout(timer);
  }, [runSequence]);

  return (
    <div
      style={{ width: '100%', height: '100%', cursor: 'grab' }}
      onMouseEnter={() => {
        if (sequenceDone && !animRunning.current) {
          setSequenceDone(false);
          runSequence();
        }
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
      >
        <HeroScene config={config} />
      </Canvas>
    </div>
  );
}