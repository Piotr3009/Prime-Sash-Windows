import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import ParametricSashWindow from './ParametricSashWindow';
import CasementWindow from './casement/CasementWindow';
import FixFrameWindow from './fix-frame/FixFrameWindow';

// ── Scene definitions ──
const SCENE_COUNT = 4;
const FADE_MS = 600;

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}
function lerpColor(a, b, t) {
  const from = hexToRgb(a), to = hexToRgb(b);
  return rgbToHex(from.r + (to.r - from.r) * t, from.g + (to.g - from.g) * t, from.b + (to.b - from.b) * t);
}

// ── Animated opening for casement ──
function AnimatedCasement({ elapsed }) {
  // Open slowly 0→0.3 over 3s, hold 4s, close 3s
  let opening = 0;
  const t = elapsed / 1000;
  if (t < 3) opening = 0.3 * (t / 3);
  else if (t < 7) opening = 0.3;
  else if (t < 10) opening = 0.3 * (1 - (t - 7) / 3);

  return (
    <CasementWindow
      width={1000}
      height={1400}
      layout="040L"
      opening={opening}
      fanlightRatio={0.28}
      woodColor="#bbbe9f"
      woodColorExt="#bbbe9f"
      woodColorInt="#e8e4d8"
      sameColor={false}
      glassType="double"
      spacerColor="silver"
      hBars={0}
      vBars={0}
      showGuides={false}
      ironmongery="brass"
      sealColour="black"
    />
  );
}

// ── Animated sash ──
function AnimatedSash({ elapsed }) {
  const t = elapsed / 1000;
  let opening = 0, upperOpening = 0;
  let bars = 'none';
  let color = '#F6F6F6';

  // 0-2s: still
  // 2-4s: lower opens
  if (t >= 2 && t < 4) opening = 40 * Math.sin(((t - 2) / 2) * Math.PI);
  // 4-6s: upper opens
  if (t >= 4 && t < 6) upperOpening = 35 * Math.sin(((t - 4) / 2) * Math.PI);
  // 6-9s: bars 4x4
  if (t >= 6 && t < 9) bars = '4x4';
  // 9-12s: color change white → sand
  if (t >= 9 && t < 12) color = lerpColor('#F6F6F6', '#c8b898', (t - 9) / 3);
  if (t >= 12) color = '#c8b898';

  return (
    <ParametricSashWindow
      width={896}
      height={1413}
      opening={opening}
      upperOpening={upperOpening}
      autoRotate={false}
      showGuides={false}
      showHorns={true}
      hornType="A"
      ironmongery="brass"
      upperGlass="clear"
      lowerGlass="clear"
      doubleGlazing={true}
      spacerColor="silver"
      boxDepth={164}
      sashDepth={57}
      boxType="standard"
      upperBars={bars}
      lowerBars={bars}
      upperCustomBars={[]}
      lowerCustomBars={[]}
      woodColor={color}
      woodColorExt={color}
      woodColorInt={color}
    />
  );
}

// ── Scene wrapper with elapsed time ──
function SceneContent({ sceneIndex, isMobile }) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
  }, [sceneIndex]);

  useEffect(() => {
    let raf;
    const tick = () => {
      setElapsed(Date.now() - startRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sceneIndex]);

  // Camera positions per scene
  const camPos = sceneIndex === 3 ? [0, 0.2, 2.0] : [0, 0.5, 2.4]; // circle closer
  const camTarget = sceneIndex === 3 ? [0, 0.1, 0] : [0, 0.3, 0];

  return (
    <>
      <PerspectiveCamera makeDefault position={camPos} fov={42} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableDamping
        autoRotate
        autoRotateSpeed={0.6}
        minPolarAngle={Math.PI / 2.8}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={2.0}
        maxDistance={2.4}
        target={camTarget}
      />
      <ambientLight intensity={isMobile ? 0.7 : 0.5} />
      <directionalLight position={[3, 4, 2]} intensity={1.4} color="#fff5e6" castShadow={!isMobile} shadow-mapSize={isMobile ? [512, 512] : [1024, 1024]} />
      <directionalLight position={[-2, 3, -1]} intensity={0.35} color="#e0e8ff" />
      {!isMobile && <pointLight position={[0, 0.5, 2]} intensity={0.5} color="#fff0d0" distance={5} />}

      <group position={[0, 0.3, 0]} scale={sceneIndex === 3 ? 1.2 : 1.08}>
        {sceneIndex === 0 && <AnimatedSash elapsed={elapsed} />}
        {sceneIndex === 1 && <AnimatedCasement elapsed={elapsed} />}
        {sceneIndex === 2 && (
          <FixFrameWindow
            width={900}
            height={1500}
            fixShape="gothic-arch"
            fixGothicBars="intersecting"
            hBars={0}
            vBars={0}
            woodColor="#722F37"
            woodColorExt="#722F37"
            woodColorInt="#e8e4d8"
            sameColor={false}
            spacerColor="black"
            glassFinish="clear"
            showGuides={false}
          />
        )}
        {sceneIndex === 3 && (
          <FixFrameWindow
            width={800}
            height={800}
            fixShape="circle"
            fixCircleBarPattern="sunburst"
            fixCircleBarOffset={180}
            hBars={0}
            vBars={0}
            woodColor="#c8b898"
            woodColorExt="#c8b898"
            woodColorInt="#a8c4d4"
            sameColor={false}
            spacerColor="silver"
            glassFinish="clear"
            showGuides={false}
          />
        )}
      </group>

      {!isMobile && (
        <ContactShadows position={[0, -0.44, 0]} opacity={0.35} scale={3} blur={2.5} far={2} />
      )}
    </>
  );
}

// ── Main HeroWindow ──
export default function HeroWindow() {
  const isMobile = useMemo(() => {
    return /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) ||
           (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024);
  }, []);

  const [sceneIndex, setSceneIndex] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const timerRef = useRef(null);

  // Scene durations in ms
  const durations = [14000, 12000, 9000, 9000];

  const nextScene = useCallback(() => {
    // Fade out
    setOpacity(0);
    setTimeout(() => {
      setSceneIndex(prev => (prev + 1) % SCENE_COUNT);
      // Fade in
      setOpacity(1);
    }, FADE_MS);
  }, []);

  // Auto-cycle
  useEffect(() => {
    timerRef.current = setTimeout(nextScene, durations[sceneIndex]);
    return () => clearTimeout(timerRef.current);
  }, [sceneIndex, nextScene]);

  // Labels per scene
  const labels = [
    '✦ Timber Sash Window — Georgian Bars',
    '✦ Casement Window with Fanlight',
    '✦ Gothic Arch — Intersecting Tracery',
    '✦ Circle Window — Sunburst Pattern',
  ];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          cursor: 'grab',
          touchAction: 'none',
          opacity: opacity,
          transition: `opacity ${FADE_MS}ms ease-in-out`,
        }}
      >
        <Canvas
          shadows={!isMobile}
          dpr={isMobile ? [1, 1] : [1, 2]}
          gl={{ alpha: true, antialias: !isMobile, powerPreference: isMobile ? 'low-power' : 'high-performance' }}
          style={{ background: 'transparent', touchAction: 'none' }}
        >
          <SceneContent sceneIndex={sceneIndex} isMobile={isMobile} />
        </Canvas>
      </div>
      <p
        className="hero-3d-caption"
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: opacity,
          transition: `opacity ${FADE_MS}ms ease-in-out`,
          whiteSpace: 'nowrap',
        }}
      >
        {labels[sceneIndex]}
      </p>
    </div>
  );
}