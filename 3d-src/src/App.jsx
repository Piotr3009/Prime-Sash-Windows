import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, ContactShadows, Html, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import ParametricSashWindow from './components/ParametricSashWindow';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function Slider({ label, value, min, max, step, suffix = ' mm', onChange }) {
  return (
    <label className="control">
      <div className="control__row">
        <span>{label}</span>
        <strong>{Math.round(value)}{suffix}</strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <button type="button" className={checked ? 'switch switch--on' : 'switch'} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </label>
  );
}

const RAL_COLORS = {
  '1000': '#BEBD7F', '1001': '#C2B078', '1002': '#C6A664', '1003': '#E5BE01',
  '1004': '#CDA434', '1005': '#A98307', '1006': '#E4A010', '1007': '#DC9D00',
  '1011': '#8A6642', '1012': '#C7B446', '1013': '#EAE6CA', '1014': '#E1CC4F',
  '1015': '#E6D690', '1016': '#EDFF21', '1017': '#F5D033', '1018': '#F8F32B',
  '1019': '#9E9764', '1020': '#999950', '1021': '#F3DA0B', '1023': '#FAD201',
  '1024': '#AEA04B', '1026': '#FFFF00', '1027': '#9D9101', '1028': '#F4A900',
  '1032': '#D6AE01', '1033': '#F3A505', '1034': '#EFA94A', '1035': '#6A5D4D',
  '1036': '#705335', '1037': '#F39F18', '2000': '#ED760E', '2001': '#C93C20',
  '2002': '#CB2821', '2003': '#FF7514', '2004': '#F44611', '2005': '#FF2301',
  '2007': '#FFA420', '2008': '#F75E25', '2009': '#F54021', '2010': '#D84B20',
  '2011': '#EC7C26', '2012': '#E55137', '2013': '#C35831', '3000': '#AF2B1E',
  '3001': '#A52019', '3002': '#A2231D', '3003': '#9B111E', '3004': '#75151E',
  '3005': '#5E2129', '3007': '#412227', '3009': '#642424', '3011': '#781F19',
  '3012': '#C1876B', '3013': '#A12312', '3014': '#D36E70', '3015': '#EA899A',
  '3016': '#B32821', '3017': '#E63244', '3018': '#D53032', '3020': '#CC0605',
  '3022': '#D95030', '3024': '#F80000', '3026': '#FE0000', '3027': '#C51D34',
  '3028': '#CB3234', '3031': '#B32428', '3032': '#721422', '3033': '#B44C43',
  '4001': '#6D3F5B', '4002': '#922B3E', '4003': '#DE4C8A', '4004': '#641C34',
  '4005': '#6C4675', '4006': '#A03472', '4007': '#4A192C', '4008': '#924E7D',
  '4009': '#A18594', '4010': '#CF3476', '4011': '#8673A1', '4012': '#6C6874',
  '5000': '#354D73', '5001': '#1F3438', '5002': '#20214F', '5003': '#1D1E33',
  '5004': '#18171C', '5005': '#1E2460', '5007': '#3E5F8A', '5008': '#26252D',
  '5009': '#025669', '5010': '#0E4243', '5011': '#1B2A4A', '5012': '#3B83BD',
  '5013': '#1E213D', '5014': '#606E8C', '5015': '#2271B3', '5017': '#063971',
  '5018': '#3F888F', '5019': '#1B5583', '5020': '#1D334A', '5021': '#256D7B',
  '5022': '#252850', '5023': '#49678D', '5024': '#5D9B9B', '5025': '#2A6478',
  '5026': '#102C54', '6000': '#316650', '6001': '#287233', '6002': '#2D572C',
  '6003': '#424632', '6004': '#1F3A3D', '6005': '#2F4538', '6006': '#3E3B32',
  '6007': '#343B29', '6008': '#39352A', '6009': '#31372B', '6010': '#35682D',
  '6011': '#587246', '6012': '#343E40', '6013': '#6C7156', '6014': '#47402E',
  '6015': '#3B3C36', '6016': '#1E5945', '6017': '#4C9141', '6018': '#57A639',
  '6019': '#BDECB6', '6020': '#2E3A23', '6021': '#89AC76', '6022': '#25221B',
  '6024': '#308446', '6025': '#3D6B35', '6026': '#1C542D', '6027': '#83C491',
  '6028': '#2B5B34', '6029': '#20603D', '6032': '#317F43', '6033': '#497E76',
  '6034': '#7FB5B5', '6035': '#1C542D', '6036': '#193737', '6037': '#008F39',
  '6038': '#00BB2D', '7000': '#78858B', '7001': '#8A9597', '7002': '#817F68',
  '7003': '#7D7F7D', '7004': '#9EA0A1', '7005': '#6C7059', '7006': '#756F61',
  '7008': '#6A5F31', '7009': '#4D5645', '7010': '#4C514A', '7011': '#434B4D',
  '7012': '#4E5754', '7013': '#464531', '7015': '#434750', '7016': '#293133',
  '7021': '#23282B', '7022': '#332F2C', '7023': '#8B8C7A', '7024': '#474A51',
  '7026': '#2F353B', '7030': '#8B8B7A', '7031': '#474B4E', '7032': '#B8B799',
  '7033': '#7D8471', '7034': '#8F8B66', '7035': '#D7D7D7', '7036': '#7F7679',
  '7037': '#7D7F7D', '7038': '#B5B8B1', '7039': '#6C6960', '7040': '#9DA1AA',
  '7042': '#8D948D', '7043': '#4E5452', '7044': '#CAC4B0', '7045': '#909090',
  '7046': '#82898F', '7047': '#D0D0D0', '7048': '#898176', '8000': '#826C34',
  '8001': '#955F20', '8002': '#6C3B2A', '8003': '#734222', '8004': '#8E402A',
  '8007': '#59351F', '8008': '#6F4F28', '8009': '#5B3A29', '8010': '#592321',
  '8011': '#6F3B2A', '8012': '#6D3525', '8014': '#382C1E', '8015': '#633A34',
  '8016': '#4C2F27', '8017': '#45322E', '8019': '#403A3A', '8022': '#212121',
  '8023': '#A65E2E', '8024': '#79553D', '8025': '#755C48', '8028': '#4E3B31',
  '8029': '#763C28', '9001': '#FDF4E3', '9002': '#E7EBDA', '9003': '#F4F4F4',
  '9004': '#282828', '9005': '#0A0A0A', '9006': '#A5A5A5', '9007': '#8F8F8F',
  '9010': '#FFFFFF', '9011': '#1C2023', '9016': '#F6F6F6', '9017': '#1E1E1E',
  '9018': '#D7D7D7', '9022': '#9E9E9E', '9023': '#828282',
};

function RalInput({ onColor }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');

  const apply = () => {
    const key = val.trim().replace(/^ral\s*/i, '');
    const hex = RAL_COLORS[key];
    if (hex) {
      onColor(hex);
      setErr('');
    } else {
      setErr('Unknown RAL');
    }
  };

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <input
        type="text"
        placeholder="e.g. 7016"
        value={val}
        onChange={(e) => { setVal(e.target.value); setErr(''); }}
        onKeyDown={(e) => e.key === 'Enter' && apply()}
        style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.2)' }}
      />
      <button onClick={apply} style={{ padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}>Apply</button>
      {err && <span style={{ color: 'red', fontSize: '11px' }}>{err}</span>}
    </div>
  );
}

const SWATCHES = [
  { name: 'Pure White', hex: '#F4F4F2' },
  { name: 'Jet Black', hex: '#1C1C1C' },
  { name: 'Anthracite', hex: '#2E3A3F' },
  { name: 'Olive Green', hex: '#4A4F3B' },
  { name: 'Off-White', hex: '#F0EEE8' },
  { name: 'Cream', hex: '#EDE8D8' },
  { name: 'Burgundy', hex: '#6B1A2A' },
  { name: 'Royal Blue', hex: '#1A3060' },
  { name: 'Oak', hex: '#C8853A' },
];

function ColorPicker({ label, value, onChange, inputId }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: value, border: '2px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{value.toUpperCase()}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '8px' }}>
        {SWATCHES.map(({ name, hex }) => (
          <div key={hex} onClick={() => onChange(hex)} title={name}
            style={{ backgroundColor: hex, borderRadius: '6px', aspectRatio: '1', cursor: 'pointer',
              border: value === hex ? '3px solid #1A3060' : '2px solid rgba(0,0,0,0.12)', boxSizing: 'border-box' }}
          />
        ))}
        <div onClick={() => document.getElementById(inputId).click()} title="Custom"
          style={{ borderRadius: '6px', aspectRatio: '1', cursor: 'pointer',
            border: '2px dashed rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '18px', color: 'rgba(0,0,0,0.4)', boxSizing: 'border-box' }}>+</div>
        <input id={inputId} type="color" value={value} onChange={(e) => onChange(e.target.value)}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
      </div>
      <label className="select-wrap">
        <span>RAL</span>
        <select value="" onChange={(e) => e.target.value && onChange(e.target.value)}>
          <option value="">— RAL —</option>
          <optgroup label="Whites &amp; Creams">
            <option value="#FFFFFF">9010 Pure White</option><option value="#F6F6F6">9016 Traffic White</option>
            <option value="#F4F4F4">9003 Signal White</option><option value="#FDF4E3">9001 Cream White</option>
            <option value="#E7EBDA">9002 Grey White</option><option value="#E6D690">1015 Light Ivory</option>
            <option value="#C2B078">1001 Beige</option><option value="#C6A664">1002 Sand Yellow</option>
          </optgroup>
          <optgroup label="Greys">
            <option value="#D7D7D7">7035 Light Grey</option><option value="#B5B8B1">7038 Agate Grey</option>
            <option value="#8D948D">7042 Traffic Grey A</option><option value="#7D7F7D">7037 Dusty Grey</option>
            <option value="#78858B">7000 Squirrel Grey</option><option value="#9EA0A1">7004 Signal Grey</option>
            <option value="#6C7059">7005 Mouse Grey</option><option value="#474A51">7024 Graphite Grey</option>
            <option value="#293133">7016 Anthracite Grey</option><option value="#23282B">7021 Black Grey</option>
            <option value="#434750">7015 Slate Grey</option><option value="#4E5754">7012 Basalt Grey</option>
          </optgroup>
          <optgroup label="Blacks">
            <option value="#0A0A0A">9005 Jet Black</option><option value="#1C2023">9011 Graphite Black</option>
            <option value="#1E1E1E">9017 Traffic Black</option><option value="#282828">9004 Signal Black</option>
          </optgroup>
          <optgroup label="Greens">
            <option value="#31372B">6009 Fir Green</option><option value="#2F4538">6005 Moss Green</option>
            <option value="#343B29">6007 Bottle Green</option><option value="#1F3A3D">6004 Blue Green</option>
            <option value="#4A4F3B">6003 Olive Green</option><option value="#587246">6011 Reseda Green</option>
            <option value="#35682D">6010 Grass Green</option><option value="#1E5945">6016 Turquoise Green</option>
          </optgroup>
          <optgroup label="Blues">
            <option value="#1E2460">5002 Ultramarine Blue</option><option value="#1D1E33">5004 Black Blue</option>
            <option value="#1B2A4A">5011 Steel Blue</option><option value="#2271B3">5015 Sky Blue</option>
            <option value="#063971">5017 Traffic Blue</option><option value="#3B83BD">5012 Light Blue</option>
            <option value="#354D73">5000 Violet Blue</option><option value="#49678D">5023 Distant Blue</option>
          </optgroup>
          <optgroup label="Reds">
            <option value="#AF2B1E">3000 Flame Red</option><option value="#9B111E">3003 Ruby Red</option>
            <option value="#75151E">3004 Purple Red</option><option value="#5E2129">3005 Wine Red</option>
            <option value="#D53032">3018 Strawberry Red</option><option value="#CC0605">3020 Traffic Red</option>
          </optgroup>
          <optgroup label="Browns">
            <option value="#955F20">8001 Ochre Brown</option><option value="#6F4F28">8008 Olive Brown</option>
            <option value="#6F3B2A">8011 Nut Brown</option><option value="#4E3B31">8028 Terra Brown</option>
            <option value="#45322E">8017 Chocolate Brown</option><option value="#382C1E">8014 Sepia Brown</option>
          </optgroup>
          <optgroup label="Yellows &amp; Oranges">
            <option value="#E5BE01">1003 Signal Yellow</option><option value="#F4A900">1028 Melon Yellow</option>
            <option value="#ED760E">2000 Yellow Orange</option><option value="#FF7514">2003 Pastel Orange</option>
          </optgroup>
        </select>
      </label>
      <label className="select-wrap">
        <span>Farrow &amp; Ball</span>
        <select value="" onChange={(e) => e.target.value && onChange(e.target.value)}>
          <option value="">— F&amp;B —</option>
          <optgroup label="Whites">
            <option value="#fdfbfc">All White 2005</option>
            <option value="#f2f0e8">Strong White 2001</option>
            <option value="#ede8dc">Great White 2006</option>
            <option value="#f0ece0">Wimborne White 239</option>
            <option value="#fdfeec">Pointing 2003</option>
            <option value="#f3f0e1">James White 2010</option>
            <option value="#ede6d5">White Tie 2002</option>
            <option value="#ede3ce">Slipper Satin 2004</option>
            <option value="#e8e2d0">Skimming Stone 241</option>
            <option value="#eee8d8">New White 59</option>
            <option value="#e8e0cc">String 8</option>
            <option value="#eae0d0">Dimity 2008</option>
          </optgroup>
          <optgroup label="Neutrals &amp; Stones">
            <option value="#ccbfb3">Elephant's Breath 229</option>
            <option value="#d0ccc4">Ammonite 274</option>
            <option value="#c8c4b8">Cornforth White 228</option>
            <option value="#c0b8a8">Purbeck Stone 275</option>
            <option value="#9d9088">Mole's Breath 276</option>
            <option value="#b8b0a0">Joa's White 226</option>
            <option value="#b0a898">Drop Cloth 283</option>
            <option value="#c4977a">Dead Salmon 28</option>
            <option value="#b8a890">Oxford Stone 264</option>
            <option value="#a89880">Savage Ground 213</option>
            <option value="#8c7c68">Mouse's Back 40</option>
            <option value="#c8b898">Stony Ground 211</option>
            <option value="#d8c8b0">Matchstick 2013</option>
          </optgroup>
          <optgroup label="Greys">
            <option value="#b9beaa">Pigeon 25</option>
            <option value="#c8c8c0">Ammonite 274</option>
            <option value="#a8a8a0">Pavilion Gray 242</option>
            <option value="#9c9c98">Lamp Room Gray 88</option>
            <option value="#b0b0a8">Mizzle 266</option>
            <option value="#8c8880">Worsted 284</option>
            <option value="#949088">Manor House Gray 265</option>
            <option value="#787470">Plummett 272</option>
            <option value="#3c3d42">Down Pipe 26</option>
            <option value="#45484b">Railings 31</option>
            <option value="#313639">Off-Black 57</option>
            <option value="#292820">Pitch Black 256</option>
          </optgroup>
          <optgroup label="Blues">
            <option value="#2c3437">Hague Blue 30</option>
            <option value="#2c3a48">Stiffkey Blue 281</option>
            <option value="#586768">Inchyra Blue 289</option>
            <option value="#759194">Stone Blue 86</option>
            <option value="#6888a0">Lulworth Blue 89</option>
            <option value="#8898a8">Parma Gray 27</option>
            <option value="#aac0b3">Dix Blue 82</option>
            <option value="#c8d4d8">Borrowed Light 235</option>
            <option value="#cfd7cc">Light Blue 22</option>
          </optgroup>
          <optgroup label="Greens">
            <option value="#5a6850">Calke Green 34</option>
            <option value="#485840">Viridian 214</option>
            <option value="#636f65">Green Smoke 47</option>
            <option value="#73806e">Card Room Green 79</option>
            <option value="#7a8868">Saxon Green 80</option>
            <option value="#5a7048">Pea Green 33</option>
            <option value="#bbbe9f">Vert de Terre 234</option>
            <option value="#a0a88c">Lichen 19</option>
            <option value="#708068">Chappell Green 83</option>
          </optgroup>
          <optgroup label="Reds &amp; Pinks">
            <option value="#8c182b">Rectory Red 217</option>
            <option value="#6a1820">Incarnadine 248</option>
            <option value="#8a2030">Blazer 212</option>
            <option value="#d08880">Cinder Rose 246</option>
            <option value="#d4a0a0">Calamine 230</option>
            <option value="#e8a898">Pink Ground 202</option>
            <option value="#c09090">Sulking Room Pink 295</option>
            <option value="#d8b0a8">Peignoir 286</option>
          </optgroup>
          <optgroup label="Yellows &amp; Oranges">
            <option value="#ce923c">India Yellow 66</option>
            <option value="#dac586">Hay 37</option>
            <option value="#c89830">Sudbury Yellow 51</option>
            <option value="#d09878">Setting Plaster 231</option>
            <option value="#c07030">Charlotte's Locks 268</option>
            <option value="#d4a860">Babouche 223</option>
          </optgroup>
        </select>
      </label>
      <label className="control">
        <div className="control__row"><span>RAL number</span></div>
        <RalInput onColor={onChange} />
      </label>
    </div>
  );
}

function WallBackground() {
  const texture = useMemo(() => {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Gradient od ciemnego góra/boki do jasnego centrum
    const grad = ctx.createRadialGradient(size*0.55, size*0.4, 0, size*0.55, size*0.4, size * 0.85);
    grad.addColorStop(0,   '#d4d4d4');
    grad.addColorStop(0.55,'#b4b4b4');
    grad.addColorStop(1.0, '#787878');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Tynk — drobny pył, inny niż microcement
    for (let i = 0; i < 100000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 0.6;
      const v = Math.floor(150 + Math.random() * 80);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.06})`;
      ctx.fill();
    }
    // Poziome smugi tynku (inne niż pionowe smugi microcement)
    for (let i = 0; i < 60; i++) {
      const y = Math.random() * size;
      ctx.strokeStyle = `rgba(160,160,160,${Math.random() * 0.04})`;
      ctx.lineWidth = Math.random() * 1.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + (Math.random()-0.5)*20);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);

  return (
    <mesh position={[0, 0.5, -2.5]} rotation={[0, 0, 0]}>
      <planeGeometry args={[12, 10]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

function MicrocementFloor() {
  const { colorMap, roughnessMap } = useMemo(() => {
    const size = 1024;

    // Color map — jasny szary z subtelnym grain
    const cCanvas = document.createElement('canvas');
    cCanvas.width = size; cCanvas.height = size;
    const cCtx = cCanvas.getContext('2d');
    cCtx.fillStyle = '#cccccc';
    cCtx.fillRect(0, 0, size, size);

    // Microcement grain — losowe plamki różnej jasności
    for (let i = 0; i < 120000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 1.8;
      const v = Math.floor(180 + Math.random() * 50);
      const a = Math.random() * 0.22;
      cCtx.beginPath();
      cCtx.arc(x, y, r, 0, Math.PI * 2);
      cCtx.fillStyle = `rgba(${v},${v},${v},${a})`;
      cCtx.fill();
    }
    // Subtelne smugi — charakterystyczne dla microcement
    for (let i = 0; i < 150; i++) {
      const x1 = Math.random() * size;
      const y1 = Math.random() * size;
      const x2 = x1 + (Math.random() - 0.5) * 200;
      const y2 = y1 + (Math.random() - 0.5) * 200;
      const a = Math.random() * 0.08;
      cCtx.strokeStyle = `rgba(140,140,140,${a})`;
      cCtx.lineWidth = Math.random() * 2;
      cCtx.beginPath();
      cCtx.moveTo(x1, y1);
      cCtx.lineTo(x2, y2);
      cCtx.stroke();
    }
    const colorMap = new THREE.CanvasTexture(cCanvas);
    colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.repeat.set(4, 4);

    // Roughness map
    const rCanvas = document.createElement('canvas');
    rCanvas.width = 512; rCanvas.height = 512;
    const rCtx = rCanvas.getContext('2d');
    rCtx.fillStyle = '#666666';
    rCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 30000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const v = Math.floor(80 + Math.random() * 60);
      rCtx.beginPath();
      rCtx.arc(x, y, Math.random() * 1.5, 0, Math.PI * 2);
      rCtx.fillStyle = `rgb(${v},${v},${v})`;
      rCtx.fill();
    }
    const roughnessMap = new THREE.CanvasTexture(rCanvas);
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(4, 4);

    return { colorMap, roughnessMap };
  }, []);

  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.3, 0]}>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial
        map={colorMap}
        roughnessMap={roughnessMap}
        roughness={1.0}
        metalness={0.0}
        color="#c8c8c8"
      />
    </mesh>
  );
}



function Scene({ config }) {
  const [hovered, setHovered] = useState(false);
  const b = config.brightness ?? 1.0;

  const pedestalScale = useMemo(() => {
    const maxDimension = Math.max(config.width, config.height) / 1000;
    return clamp(maxDimension * 0.9, 1.2, 3.2);
  }, [config.width, config.height]);

  return (
    <>

      <PerspectiveCamera makeDefault position={[2.4, 0.8, 3.6]} fov={32} />

      {/* Ambient */}
      <ambientLight intensity={0.56 * b} />

      {/* Hemisphere */}
      <hemisphereLight args={['#fdf6e8', '#c8c0b0', 0.72 * b]} />

      {/* Główne słońce */}
      <directionalLight
        position={[4, 6, 5]}
        intensity={1.12 * b}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
      />

      {/* Fill boki — symetrycznie przód i tył */}
      <directionalLight position={[-3, 2,  3]} intensity={0.6 * b} />
      <directionalLight position={[-3, 2, -3]} intensity={0.6 * b} />
      <directionalLight position={[ 3, 2,  3]} intensity={0.56 * b} />
      <directionalLight position={[ 3, 2, -3]} intensity={0.56 * b} />

      {/* Fill z dołu pod 45° — obydwie strony */}
      <directionalLight position={[-2, -2,  2]} intensity={0.25 * b} color="#e8d8c0" />
      <directionalLight position={[ 2, -2, -2]} intensity={0.25 * b} color="#e8d8c0" />

      {/* Point lights — przód */}
      <pointLight position={[ 0.5, 0.5,  1.2]} intensity={0.98 * b} distance={6} decay={2} color="#fff8f0" />
      <pointLight position={[-0.5, 0,    1.2]} intensity={0.98 * b} distance={6} decay={2} color="#fff4e8" />

      {/* Point lights — tył */}
      <pointLight position={[ 0.5, 0,   -1.5]} intensity={0.98 * b} distance={6} decay={2} color="#f0f4ff" />
      <pointLight position={[-0.5, 0,   -1.5]} intensity={0.98 * b} distance={6} decay={2} color="#f0f4ff" />

      {/* Point lights — boki tył po skosie */}
      <pointLight position={[ 1.5, 0.5, -1.5]} intensity={0.70 * b} distance={6} decay={2} color="#f0f4ff" />
      <pointLight position={[-1.5, 0.5, -1.5]} intensity={0.70 * b} distance={6} decay={2} color="#f0f4ff" />

      {/* Point lights — boki przód po skosie */}
      <pointLight position={[ 1.5, 0.5,  1.2]} intensity={0.70 * b} distance={6} decay={2} color="#fff8f0" />
      <pointLight position={[-1.5, 0.5,  1.2]} intensity={0.70 * b} distance={6} decay={2} color="#fff8f0" />

      {/* Dedykowane światła na finger lift — z tyłu okna */}
      <pointLight position={[ 0.4, -0.3, -2.0]} intensity={0.96 * b} distance={3} decay={2} color="#f0f4ff" />
      <pointLight position={[-0.4, -0.3, -2.0]} intensity={0.96 * b} distance={3} decay={2} color="#f0f4ff" />

      <group position={[0, 0.18, 0]}>
        <Bounds fit margin={1.2}>
          <group onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
            <ParametricSashWindow {...config} />
          </group>
        </Bounds>
      </group>

      <WallBackground />
      <MicrocementFloor />

      <ContactShadows position={[0, -1.215, 0]} opacity={0.55} blur={2.5} far={3.5} scale={6} />

      <OrbitControls
        makeDefault
        enablePan={true}
        screenSpacePanning={true}
        minDistance={0.15}
        maxDistance={8}
        zoomSpeed={1.2}
        panSpeed={1.0}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
        autoRotate={config.autoRotate}
        autoRotateSpeed={0.9}
      />

      {hovered && (
        <Html position={[0, 1.55, 0]} center distanceFactor={8}>
          <div className="badge">Drag to rotate</div>
        </Html>
      )}
    </>
  );
}

export default function App() {
  const [extWidth, setExtWidth] = useState(1200);
  const [extHeight, setExtHeight] = useState(1500);
  const width = extWidth - 104;
  const height = extHeight - 87;
  const [opening, setOpening] = useState(0);
  const [upperOpening, setUpperOpening] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [showHorns, setShowHorns] = useState(true);
  const [brightness, setBrightness] = useState(1.0);
  const [hornType, setHornType] = useState('A');
  const [ironmongery, setIronmongery] = useState('brass');
  const [upperGlass, setUpperGlass] = useState('clear');
  const [lowerGlass, setLowerGlass] = useState('clear');
  const doubleGlazing = true;
  const [spacerColor, setSpacerColor] = useState('silver');
  const [boxType, setBoxType] = useState('standard');
  const [woodColor, setWoodColor] = useState('#F6F6F6');
  const [woodColorExt, setWoodColorExt] = useState('#F6F6F6');
  const [woodColorInt, setWoodColorInt] = useState('#F6F6F6');
  const [sameColor, setSameColor] = useState(true);

  const setColor = (hex) => {
    setWoodColor(hex);
    if (sameColor) { setWoodColorExt(hex); setWoodColorInt(hex); }
  };
  const setColorExt = (hex) => { setWoodColorExt(hex); };
  const setColorInt = (hex) => { setWoodColorInt(hex); };
  const [upperBars, setUpperBars] = useState('none');
  const [lowerBars, setLowerBars] = useState('none');
  const [sameBars, setSameBars] = useState(true);
  const [upperCustomBars, setUpperCustomBars] = useState([]);
  const [lowerCustomBars, setLowerCustomBars] = useState([]);

  const maxSashOpening = Math.max(0, height / 2 - 120);

  const config = useMemo(
    () => ({
      width,
      height,
      opening,
      upperOpening,
      autoRotate,
      showGuides,
      showHorns,
      hornType,
      ironmongery,
      upperGlass,
      lowerGlass,
      doubleGlazing,
      spacerColor,
      brightness,
      boxDepth: boxType === 'standard' ? 164 : 146,
      sashDepth: 57,
      boxType,
      upperBars,
      lowerBars,
      upperCustomBars,
      lowerCustomBars,
      woodColor,
      woodColorExt: sameColor ? woodColor : woodColorExt,
      woodColorInt: sameColor ? woodColor : woodColorInt,
    }),
    [width, height, opening, upperOpening, autoRotate, showGuides, showHorns, hornType, ironmongery, upperGlass, lowerGlass, doubleGlazing, spacerColor, brightness, boxType, upperBars, lowerBars, upperCustomBars, lowerCustomBars, woodColor, woodColorExt, woodColorInt, sameColor],
  );

  return (
    <div className="app-shell">
      <aside className="panel">
        <div className="eyebrow">Prime Sash Windows</div>
        <h1>Traditional timber sash — R3F prototype</h1>
        <p className="lede">
          Initial parametric model built around the information we already have: standard box depth 164 mm,
          sash depth 57 mm, simple sill, adjustable width and height, and a live 3D preview.
        </p>

        <div className="card">
          <h2>Size</h2>
          <Slider label="Width" value={extWidth} min={704} max={1904} step={10} onChange={setExtWidth} />
          <Slider label="Height" value={extHeight} min={887} max={3087} step={10} onChange={setExtHeight} />
          <Slider
            label="Lower sash opening"
            value={opening}
            min={0}
            max={maxSashOpening}
            step={5}
            onChange={setOpening}
          />
          <Slider
            label="Upper sash opening"
            value={upperOpening}
            min={0}
            max={maxSashOpening}
            step={5}
            onChange={setUpperOpening}
          />
        </div>

        <div className="card">
          <h2>Glazing bars</h2>
          <Toggle
            label="Same bars for both sashes"
            checked={sameBars}
            onChange={(v) => {
              setSameBars(v);
              if (v) setLowerBars(upperBars);
            }}
          />
          <label className="select-wrap">
            <span>Upper sash</span>
            <select
              value={upperBars}
              onChange={(e) => {
                setUpperBars(e.target.value);
                if (sameBars) setLowerBars(e.target.value);
              }}
            >
              <option value="none">No bars</option>
              <option value="2x2">2×2</option>
              <option value="3x3">3×3</option>
              <option value="4x4">4×4</option>
              <option value="6x6">6×6</option>
              <option value="9x9">9×9</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          {upperBars === 'custom' && (
            <div className="custom-bars">
              <div className="custom-bars__actions">
                <button
                  onClick={() => setUpperCustomBars(b => [...b, { type: 'v', mm: 100 }])}
                  disabled={upperCustomBars.filter(b => b.type === 'v').length >= 2}
                >+ Vertical</button>
                <button
                  onClick={() => setUpperCustomBars(b => [...b, { type: 'h', mm: 100 }])}
                  disabled={upperCustomBars.filter(b => b.type === 'h').length >= 2}
                >+ Horizontal</button>
              </div>
              {upperCustomBars.map((bar, i) => {
                const sameType = upperCustomBars.slice(0, i).filter(b => b.type === bar.type);
                const idx = sameType.length;
                const fromLabel = bar.type === 'v'
                  ? (idx === 0 ? 'from left' : 'from right')
                  : (idx === 0 ? 'from bottom' : 'from top');
                const maxVal = bar.type === 'v' ? width - 10 : height / 2 - 10;
                return (
                  <label key={i} className="control">
                    <div className="control__row">
                      <span>{bar.type === 'v' ? 'Vertical' : 'Horizontal'} — {fromLabel}</span>
                      <button onClick={() => setUpperCustomBars(b => b.filter((_, j) => j !== i))}>✕</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="range" min="10" max={maxVal} step="1" value={bar.mm}
                        onChange={(e) => setUpperCustomBars(b => b.map((x, j) => j === i ? { ...x, mm: Number(e.target.value) } : x))}
                        style={{ flex: 1 }} />
                      <input type="number" min="10" max={maxVal} value={bar.mm}
                        onChange={(e) => setUpperCustomBars(b => b.map((x, j) => j === i ? { ...x, mm: Number(e.target.value) } : x))}
                        style={{ width: '60px' }} />
                      <span>mm</span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          {!sameBars && (
            <label className="select-wrap">
              <span>Lower sash</span>
              <select value={lowerBars} onChange={(e) => setLowerBars(e.target.value)}>
                <option value="none">No bars</option>
                <option value="2x2">2×2</option>
                <option value="3x3">3×3</option>
                <option value="4x4">4×4</option>
                <option value="6x6">6×6</option>
                <option value="9x9">9×9</option>
                <option value="custom">Custom</option>
              </select>
            </label>
          )}
          {!sameBars && lowerBars === 'custom' && (
            <div className="custom-bars">
              <div className="custom-bars__actions">
                <button
                  onClick={() => setLowerCustomBars(b => [...b, { type: 'v', mm: 100 }])}
                  disabled={lowerCustomBars.filter(b => b.type === 'v').length >= 2}
                >+ Vertical</button>
                <button
                  onClick={() => setLowerCustomBars(b => [...b, { type: 'h', mm: 100 }])}
                  disabled={lowerCustomBars.filter(b => b.type === 'h').length >= 2}
                >+ Horizontal</button>
              </div>
              {lowerCustomBars.map((bar, i) => {
                const sameType = lowerCustomBars.slice(0, i).filter(b => b.type === bar.type);
                const idx = sameType.length;
                const fromLabel = bar.type === 'v'
                  ? (idx === 0 ? 'from left' : 'from right')
                  : (idx === 0 ? 'from bottom' : 'from top');
                const maxVal = bar.type === 'v' ? width - 10 : height / 2 - 10;
                return (
                  <label key={i} className="control">
                    <div className="control__row">
                      <span>{bar.type === 'v' ? 'Vertical' : 'Horizontal'} — {fromLabel}</span>
                      <button onClick={() => setLowerCustomBars(b => b.filter((_, j) => j !== i))}>✕</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="range" min="10" max={maxVal} step="1" value={bar.mm}
                        onChange={(e) => setLowerCustomBars(b => b.map((x, j) => j === i ? { ...x, mm: Number(e.target.value) } : x))}
                        style={{ flex: 1 }} />
                      <input type="number" min="10" max={maxVal} value={bar.mm}
                        onChange={(e) => setLowerCustomBars(b => b.map((x, j) => j === i ? { ...x, mm: Number(e.target.value) } : x))}
                        style={{ width: '60px' }} />
                      <span>mm</span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h2>Glass</h2>
          <label className="select-wrap">
            <span>Spacer colour</span>
            <select value={spacerColor} onChange={(e) => setSpacerColor(e.target.value)}>
              <option value="silver">Silver</option>
              <option value="white">White</option>
              <option value="black">Black</option>
            </select>
          </label>
          <label className="select-wrap">
            <span>Upper sash</span>
            <select value={upperGlass} onChange={(e) => setUpperGlass(e.target.value)}>
              <option value="clear">Clear</option>
              <option value="frosted">Frosted</option>
            </select>
          </label>
          <label className="select-wrap">
            <span>Lower sash</span>
            <select value={lowerGlass} onChange={(e) => setLowerGlass(e.target.value)}>
              <option value="clear">Clear</option>
              <option value="frosted">Frosted</option>
            </select>
          </label>
        </div>

        <div className="card">
          <h2>Build</h2>
          <label className="select-wrap">
            <span>Box type</span>
            <select value={boxType} onChange={(event) => setBoxType(event.target.value)}>
              <option value="standard">Standard 164 mm</option>
              <option value="slim">Slim 146 mm</option>
            </select>
          </label>
          <div className="stats">
            <div><span>Box depth</span><strong>{config.boxDepth} mm</strong></div>
            <div><span>Sash depth</span><strong>{config.sashDepth} mm</strong></div>
          </div>
          <Toggle label="Auto rotate" checked={autoRotate} onChange={setAutoRotate} />
          <Toggle label="Show guide dimensions" checked={showGuides} onChange={setShowGuides} />
          <Slider label="Brightness" value={Math.round((brightness - 1) * 100)} min={-30} max={30} step={5} suffix="%" onChange={(v) => setBrightness(1 + v / 100)} />
          <label className="select-wrap">
            <span>Ironmongery finish</span>
            <select value={ironmongery} onChange={(e) => setIronmongery(e.target.value)}>
              <option value="brass">Brass</option>
              <option value="chrome">Chrome</option>
              <option value="stainless">Stainless Steel</option>
              <option value="antique_brass">Antique Brass</option>
            </select>
          </label>
          <label className="select-wrap">
            <span>Sash horns</span>
            <select value={showHorns ? hornType : 'none'} onChange={(e) => {
              if (e.target.value === 'none') { setShowHorns(false); }
              else { setShowHorns(true); setHornType(e.target.value); }
            }}>
              <option value="none">No horns</option>
              <option value="A">Richmond</option>
              <option value="D">Type D</option>
            </select>
          </label>
        </div>

        <div className="card">
          <h2>Colour</h2>
          <Toggle label="Same colour both sides" checked={sameColor} onChange={(v) => {
            setSameColor(v);
            if (v) { setWoodColorExt(woodColorExt); setWoodColorInt(woodColorExt); }
          }} />
          {sameColor ? (
            <ColorPicker label="Colour" value={woodColorExt} onChange={(hex) => { setWoodColorExt(hex); setWoodColorInt(hex); setWoodColor(hex); }} inputId="cp-both" />
          ) : (
            <>
              <ColorPicker label="External colour" value={woodColorExt} onChange={setColorExt} inputId="cp-ext" />
              <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-tertiary)', margin: '8px 0' }} />
              <ColorPicker label="Internal colour" value={woodColorInt} onChange={setColorInt} inputId="cp-int" />
            </>
          )}
        </div>

        <div className="card note">
          <h2>Temporary assumptions</h2>
          <ul>
            <li>Face widths are placeholders until we read exact DXF section values into the model.</li>
            <li>Sill is intentionally simple for V1.</li>
            <li>No glazing bars or ironmongery yet.</li>
          </ul>
        </div>
      </aside>

      <main className="viewport">
        <Canvas shadows dpr={[1, 2]} gl={{ alpha: true }}>
          <Scene config={config} />
        </Canvas>
      </main>
    </div>
  );
}