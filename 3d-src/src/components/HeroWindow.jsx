import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import ParametricSashWindow from './ParametricSashWindow';

function HeroScene({ config }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.7, 2.3]} fov={42} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableDamping
        autoRotate
        autoRotateSpeed={0.6}
        minPolarAngle={Math.PI / 2.8}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={2.3}
        maxDistance={2.3}
        target={[0, 0.7, 0]}
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
  const [woodColor, setWoodColor] = useState('#F6F6F6');
  const [woodColorExt, setWoodColorExt] = useState('#F6F6F6');
  const [woodColorInt, setWoodColorInt] = useState('#F6F6F6');
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
    woodColor,
    woodColorExt,
    woodColorInt,
  };

  // Smooth sash animation
  const animateSash = useCallback((setter, maxVal, duration = 1800) => {
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now) => {
        const t = Math.min((now - start) / duration, 1);
        setter(Math.max(0, maxVal * Math.sin(t * Math.PI)));
        if (t < 1) requestAnimationFrame(step);
        else { setter(0); resolve(); }
      };
      requestAnimationFrame(step);
    });
  }, []);

  // Smooth color transition
  const animateColor = useCallback((fromHex, toHex, duration = 1200) => {
    return new Promise((resolve) => {
      const from = hexToRgb(fromHex);
      const to = hexToRgb(toHex);
      const start = performance.now();
      const step = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const r = Math.round(from.r + (to.r - from.r) * ease);
        const g = Math.round(from.g + (to.g - from.g) * ease);
        const b = Math.round(from.b + (to.b - from.b) * ease);
        const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
        setWoodColor(hex); setWoodColorExt(hex); setWoodColorInt(hex);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
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
    setWoodColor('#F6F6F6'); setWoodColorExt('#F6F6F6'); setWoodColorInt('#F6F6F6');

    // 1. Lower sash opens
    await wait(500);
    await animateSash(setOpening, 40, 1800);

    // 2. Upper sash opens
    await wait(600);
    await animateSash(setUpperOpening, 35, 1800);

    // 3. Bars appear 4x4
    await wait(800);
    setUpperBars('4x4'); setLowerBars('4x4');
    await wait(2500);

    // 4. Switch to custom bars - sequential appearance
    setUpperBars('custom'); setLowerBars('custom');

    // Keep track of final positions for building arrays
    const bar1 = { type: 'v', mm: 100 };
    const bar2 = { type: 'v', mm: 100 };
    const bar3 = { type: 'h', mm: 100 };
    const bar4 = { type: 'h', mm: 100 };

    // 4a. Left vertical slides in (from 50 to 100mm)
    const slideSteps = 15;
    const slideDur = 50;
    for (let i = 0; i <= slideSteps; i++) {
      bar1.mm = 50 + (100 - 50) * (i / slideSteps);
      setUpperCustomBars([{ ...bar1 }]);
      setLowerCustomBars([{ ...bar1 }]);
      await wait(slideDur);
    }
    await wait(400);

    // 4b. Right vertical slides in
    for (let i = 0; i <= slideSteps; i++) {
      bar2.mm = 50 + (100 - 50) * (i / slideSteps);
      setUpperCustomBars([{ ...bar1 }, { ...bar2 }]);
      setLowerCustomBars([{ ...bar1 }, { ...bar2 }]);
      await wait(slideDur);
    }
    await wait(400);

    // 4c. Top horizontal slides in
    for (let i = 0; i <= slideSteps; i++) {
      bar3.mm = 50 + (100 - 50) * (i / slideSteps);
      setUpperCustomBars([{ ...bar1 }, { ...bar2 }, { ...bar3 }]);
      setLowerCustomBars([{ ...bar1 }, { ...bar2 }, { ...bar3 }]);
      await wait(slideDur);
    }
    await wait(400);

    // 4d. Bottom horizontal slides in
    for (let i = 0; i <= slideSteps; i++) {
      bar4.mm = 50 + (100 - 50) * (i / slideSteps);
      setUpperCustomBars([{ ...bar1 }, { ...bar2 }, { ...bar3 }, { ...bar4 }]);
      setLowerCustomBars([{ ...bar1 }, { ...bar2 }, { ...bar3 }, { ...bar4 }]);
      await wait(slideDur);
    }
    await wait(1500);

    // 5. Clear bars
    setUpperBars('none'); setLowerBars('none');
    setUpperCustomBars([]); setLowerCustomBars([]);
    await wait(800);

    // 6. Color transitions
    // White -> Stony Ground (sand - F&B)
    await animateColor('#F6F6F6', '#c8b898', 1500);
    await wait(1200);

    // Sand -> Terra Brown
    await animateColor('#c8b898', '#4E3B31', 1500);
    await wait(1200);

    // Terra -> Vert de Terre (F&B)
    await animateColor('#4E3B31', '#bbbe9f', 1500);
    await wait(1200);

    // Vert de Terre -> back to White
    await animateColor('#bbbe9f', '#F6F6F6', 1500);
    await wait(500);

    animRunning.current = false;
    setSequenceDone(true);
  }, [animateSash, animateColor]);

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

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}