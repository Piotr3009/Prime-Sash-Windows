import * as THREE from 'three'
import React, { useMemo } from 'react'

const DEFAULTS = {
  totalLength: 160,
  frontWidthTop: 17.4,
  frontWidthBody: 17.1,
  frontWidthTip: 15.6,
  projection: 49,
  spindleLength: 40,
  spindleSize: 7,
  baseWidth: 17.4,
  baseHeight: 58,
  baseThickness: 6,
  baseYOffset: 14,
  baseDepthOffset: 3,
  hubHalfDepth: 9.8,
  hubHalfHeight: 14.0,
  hubHalfWidth: 9.2,
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function roundedRectShape(width, height, radius) {
  const w = width / 2
  const h = height / 2
  const r = Math.min(radius, w, h)

  const s = new THREE.Shape()
  s.moveTo(-w + r, -h)
  s.lineTo(w - r, -h)
  s.absarc(w - r, -h + r, r, -Math.PI / 2, 0, false)
  s.lineTo(w, h - r)
  s.absarc(w - r, h - r, r, 0, Math.PI / 2, false)
  s.lineTo(-w + r, h)
  s.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-w, -h + r)
  s.absarc(-w + r, -h + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

function makeRoundedPlateGeometry(width, height, thickness, radius, bevel = 0.65) {
  const shape = roundedRectShape(width, height, radius)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 18,
    steps: 1,
  })

  geo.rotateY(Math.PI / 2)
  geo.translate(-thickness / 2, 0, 0)
  geo.computeVertexNormals()
  return geo
}

function densifySections(keySections, count = 36) {
  const ordered = [...keySections].sort((a, b) => b.y - a.y)
  const topY = ordered[0].y
  const bottomY = ordered[ordered.length - 1].y
  const out = []

  for (let i = 0; i < count; i += 1) {
    const tGlobal = i / (count - 1)
    const y = lerp(topY, bottomY, tGlobal)

    let a = ordered[0]
    let b = ordered[1]
    for (let j = 0; j < ordered.length - 1; j += 1) {
      if (y <= ordered[j].y && y >= ordered[j + 1].y) {
        a = ordered[j]
        b = ordered[j + 1]
        break
      }
    }

    const localT = a.y === b.y ? 0 : (y - a.y) / (b.y - a.y)
    out.push({
      y,
      x: lerp(a.x, b.x, localT),
      halfDepth: lerp(a.halfDepth, b.halfDepth, localT),
      halfWidth: lerp(a.halfWidth, b.halfWidth, localT),
      power: lerp(a.power, b.power, localT),
    })
  }

  return out
}

function makeSuperellipseLoftGeometry(sections, radialSegments = 28) {
  const positions = []
  const uvs = []
  const indices = []
  const ringCount = sections.length

  for (let i = 0; i < ringCount; i += 1) {
    const s = sections[i]
    for (let j = 0; j < radialSegments; j += 1) {
      const theta = (j / radialSegments) * Math.PI * 2
      const cos = Math.cos(theta)
      const sin = Math.sin(theta)
      const e = 2 / s.power
      const px = Math.sign(cos) * Math.pow(Math.abs(cos), e) * s.halfDepth
      const pz = Math.sign(sin) * Math.pow(Math.abs(sin), e) * s.halfWidth

      positions.push(s.x + px, s.y, pz)
      uvs.push(j / radialSegments, i / (ringCount - 1))
    }
  }

  for (let i = 0; i < ringCount - 1; i += 1) {
    const ringA = i * radialSegments
    const ringB = (i + 1) * radialSegments

    for (let j = 0; j < radialSegments; j += 1) {
      const jNext = (j + 1) % radialSegments
      const a = ringA + j
      const b = ringA + jNext
      const c = ringB + jNext
      const d = ringB + j

      indices.push(a, b, d)
      indices.push(b, c, d)
    }
  }

  const topCenterIndex = positions.length / 3
  positions.push(sections[0].x, sections[0].y, 0)
  uvs.push(0.5, 0)

  const bottomCenterIndex = positions.length / 3
  positions.push(sections[ringCount - 1].x, sections[ringCount - 1].y, 0)
  uvs.push(0.5, 1)

  for (let j = 0; j < radialSegments; j += 1) {
    const jNext = (j + 1) % radialSegments
    indices.push(topCenterIndex, jNext, j)
  }

  const lastRingStart = (ringCount - 1) * radialSegments
  for (let j = 0; j < radialSegments; j += 1) {
    const jNext = (j + 1) % radialSegments
    indices.push(bottomCenterIndex, lastRingStart + j, lastRingStart + jNext)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

function buildHandleStemGeometry(params) {
  const key = [
    { y: 20, x: -5, halfDepth: 6.4, halfWidth: params.frontWidthTop * 0.51, power: 3.2 },
    { y: 10, x: -8, halfDepth: 7.0, halfWidth: params.frontWidthTop * 0.52, power: 3.2 },
    { y: 0, x: -12, halfDepth: 7.8, halfWidth: params.frontWidthTop * 0.51, power: 3.4 },
    { y: -16, x: -18, halfDepth: 6.5, halfWidth: params.frontWidthBody * 0.5, power: 3.7 },
    { y: -34, x: -26, halfDepth: 5.5, halfWidth: params.frontWidthBody * 0.495, power: 4.0 },
    { y: -58, x: -35, halfDepth: 4.5, halfWidth: params.frontWidthBody * 0.485, power: 4.2 },
    { y: -84, x: -41, halfDepth: 3.9, halfWidth: params.frontWidthBody * 0.47, power: 4.4 },
    { y: -108, x: -44, halfDepth: 3.4, halfWidth: params.frontWidthTip * 0.5, power: 4.6 },
    { y: -118, x: -45, halfDepth: 2.9, halfWidth: params.frontWidthTip * 0.44, power: 4.8 },
  ]

  return makeSuperellipseLoftGeometry(densifySections(key, 42), 32)
}

export default function WindowCasementHandle({
  rotationDeg = 0,
  metalColor = '#c8ced4',
  insertColor = '#111111',
  lockColor = '#c9b07a',
  ...props
}) {
  const p = DEFAULTS

  const geometry = useMemo(() => {
    const basePlate = makeRoundedPlateGeometry(p.baseWidth, p.baseHeight, p.baseThickness, 4.2, 0.7)
    const topShoe = makeRoundedPlateGeometry(17.2, 22, 8, 3.6, 0.65)
    const hubInsert = makeRoundedPlateGeometry(11.2, 18.2, 2.2, 5.2, 0.35)
    const stem = buildHandleStemGeometry(p)

    return {
      basePlate,
      topShoe,
      hubInsert,
      stem,
      spindle: new THREE.BoxGeometry(p.spindleLength, p.spindleSize, p.spindleSize),
      spindleCollar: makeRoundedPlateGeometry(17.4, 43, 6, 4.2, 0.6),
      hubBulge: new THREE.SphereGeometry(1, 32, 24),
      hubBridge: new THREE.SphereGeometry(1, 28, 20),
      screwCap: new THREE.SphereGeometry(1, 24, 18),
      keyCylinder: new THREE.CylinderGeometry(2.2, 2.2, 2.6, 28),
    }
  }, [p])

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: metalColor,
        metalness: 1,
        roughness: 0.16,
      }),
    [metalColor]
  )

  const darkMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: insertColor,
        metalness: 0.1,
        roughness: 0.58,
      }),
    [insertColor]
  )

  const lockMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: lockColor,
        metalness: 0.65,
        roughness: 0.28,
      }),
    [lockColor]
  )

  const handleRotation = THREE.MathUtils.degToRad(Math.max(-90, Math.min(90, rotationDeg)))

  return (
    <group {...props}>
      <group name="base-fixed">
        <mesh geometry={geometry.basePlate} material={material} position={[p.baseDepthOffset, p.baseYOffset, 0]} castShadow receiveShadow />

        <mesh geometry={geometry.spindleCollar} material={material} position={[6, 0, 0]} castShadow receiveShadow />

        <mesh geometry={geometry.spindle} material={material} position={[p.spindleLength * 0.5 + 8, 0, 0]} castShadow receiveShadow />

        <mesh geometry={geometry.screwCap} material={material} position={[-0.8, 26, 0]} scale={[2.1, 4.2, 4.2]} castShadow receiveShadow />
      </group>

      <group name="handle-pivot" position={[0, 0, 0]} rotation={[handleRotation, 0, 0]}>
        <mesh geometry={geometry.topShoe} material={material} position={[-1.8, 19, 0]} castShadow receiveShadow />

        <mesh geometry={geometry.hubBulge} material={material} position={[-11.5, -1.5, 0]} scale={[p.hubHalfDepth, p.hubHalfHeight, p.hubHalfWidth]} castShadow receiveShadow />

        <mesh geometry={geometry.hubBridge} material={material} position={[-16.5, -18, 0]} scale={[6.4, 11.2, 8.4]} castShadow receiveShadow />

        <mesh geometry={geometry.stem} material={material} castShadow receiveShadow />

        <mesh geometry={geometry.hubInsert} material={darkMaterial} position={[-20.4, -1.5, 0]} castShadow receiveShadow />

        <mesh geometry={geometry.keyCylinder} material={lockMaterial} position={[-22, -1.1, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow />
      </group>
    </group>
  )
}

/*
Minimal usage in React Three Fiber:

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import WindowCasementHandle from './WindowCasementHandle'

export function HandleScene() {
  return (
    <Canvas camera={{ position: [120, 35, 120], fov: 28 }} shadows>
      <color attach="background" args={['#ececec']} />
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[120, 160, 90]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <Environment preset="warehouse" />

      <group rotation={[0, Math.PI * 0.6, 0]}>
        <WindowCasementHandle rotationDeg={0} />
      </group>

      <OrbitControls makeDefault />
    </Canvas>
  )
}
*/