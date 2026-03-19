import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import ParametricSashWindow from './ParametricSashWindow';

function HeroScene({ config }) {
  const lightRef = useRef();

  return (
    <>
      <PerspectiveCamera makeDefault position={[1.6, 0.9, 1.1]} fov={48} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={0.6}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2.2}
      />
      <ambientLight intensity={0.4} />
      <directionalLight
        ref={lightRef}
        position={[3, 4, 2]}
        intensity={1.2}
        color="#fff5e6"
        castShadow
      />
      <directionalLight position={[-2, 3, -1]} intensity={0.3} color="#e0e8ff" />
      <pointLight position={[0, 0, 2]} intensity={0.4} color="#fff0d0" distance={5} />
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
  const [hasAnimated, setHasAnimated] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const animRef = useRef(null);

  const config = {
    width: 1000 - 104,
    height: 1500 - 87,
    opening: opening,
    upperOpening: 0,
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
    upperBars: 'none',
    lowerBars: 'none',
    upperCustomBars: [],
    lowerCustomBars: [],
    woodColor: '#F6F6F6',
    woodColorExt: '#F6F6F6',
    woodColorInt: '#F6F6F6',
  };

  // Micro-interaction: sash opens after 3s, returns
  const animateSash = () => {
    if (animRef.current) return;
    const duration = 1800;
    const maxOpen = 40;
    const start = performance.now();

    animRef.current = true;
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      // ease in-out: open then close
      let val;
      if (t < 0.5) {
        val = maxOpen * Math.sin(t * Math.PI);
      } else {
        val = maxOpen * Math.sin(t * Math.PI);
      }
      setOpening(Math.max(0, val));
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        setOpening(0);
        animRef.current = null;
      }
    };
    requestAnimationFrame(step);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      animateSash();
      setHasAnimated(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{ width: '100%', height: '100%', cursor: 'grab' }}
      onMouseEnter={() => {
        if (hasAnimated && !animRef.current) animateSash();
      }}
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <HeroScene config={config} />
      </Canvas>
    </div>
  );
}
