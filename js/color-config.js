// ═══════════════════════════════════════════════════════════════
// COLOR CONFIG — single source of truth for ALL product colours
// ═══════════════════════════════════════════════════════════════
// Edit colours HERE ONLY. Consumed by:
//   • color-module.js  → door & fix pickers (ColorModule)
//   • color-module.js  → populateStaticColorUI(): sash + casement
//     tiles (6 sections) and F&B/RAL dropdowns (12 selects)
//   • future products (Fire Doors etc.): new ColorModule({...})
//     or reuse .color-fb-dropdown / .color-ral-dropdown classes.
// Data extracted 1:1 from the previous static HTML (was 6 copies).

window.COLOR_DATA = {

  // Standard swatch tiles (identical set used by sash, casement, door, fix)
  SWATCHES: [
    { bg: '#FAFAFA', key: 'white', name: "Pure White", ral: 'RAL 9016' },
    { bg: '#0A0A0A', key: 'black', name: "Jet Black", ral: 'RAL 9005' },
    { bg: '#293133', key: 'anthracite', name: "Anthracite Grey", ral: 'RAL 7016' },
    { bg: '#424632', key: 'olive', name: "Olive Green", ral: 'RAL 6003' },
    { bg: '#F7F9F5', key: 'offwhite', name: "Off-White", ral: 'RAL 9010' },
    { bg: '#F1EFDC', key: 'cream', name: "Cream", ral: 'RAL 9001' },
    { bg: '#5E2028', key: 'burgundy', name: "Burgundy Red", ral: 'RAL 3005' },
    { bg: '#222D5A', key: 'royal', name: "Royal Blue", ral: 'RAL 5002' }
  ],

  // Farrow & Ball — [group, [[hex, 'Name No'], ...]]
  FB_OPTS: [
    ['Whites', [['#fbf8f4',"All White 2005"],['#eee9e7',"Wevet 273"],['#f2f0e8',"Strong White 2001"],['#ede8dc',"Great White 2006"],['#f0ece0',"Wimborne White 239"],['#fdfeec',"Pointing 2003"],['#f3f0e1',"James White 2010"],['#ede6d5',"White Tie 2002"],['#ede3ce',"Slipper Satin 2004"],['#f4f0e5',"School House White 291"],['#eceae5',"Blackened 2011"],['#ecf0e0',"Cabbage White 269"],['#dfe6e4',"Borrowed Light 235"],['#eae4d6',"Shadow White 282"],['#f0e4d4',"Dimity 2008"],['#f0e4c8',"Matchstick 2013"]]],
    ['Creams & Yellows', [['#eee8d8',"New White 59"],['#f0e8c8',"Tallow 203"],['#f0deb8',"Farrow's Cream 67"],['#f4e4ba',"Dorset Cream 68"],['#ede4b8',"Pale Hound 71"],['#dac586',"Hay 37"],['#c89830',"Sudbury Yellow 51"],['#ce923c',"India Yellow 66"],['#e8b830',"Babouche 223"],['#ece0a0',"Yellow Ground 218"],['#f0e0a0',"Dayroom Yellow 233"],['#d8d498',"Citron 74"],['#c07030',"Charlotte's Locks 268"]]],
    ['Neutrals & Stones', [['#e8e2d0',"Skimming Stone 241"],['#c8b898',"Stony Ground 211"],['#b8b0a0',"Joa's White 226"],['#c8b898',"Oxford Stone 264"],['#a09880',"London Stone 6"],['#ccbfb3',"Elephant's Breath 229"],['#d0ccc4',"Ammonite 274"],['#c8c4b8',"Cornforth White 228"],['#c0b8a8',"Purbeck Stone 275"],['#c8bca8',"Drop Cloth 283"],['#c0b498',"Jitney 293"],['#d8ccae',"String 8"],['#d6c39e',"Cord 16"],['#deccb0',"Bone 15"],['#ccc8c1',"Shaded White 201"],['#b8a888',"Stirabout 300"],['#e8ddc8',"Old White 4"],['#f2ecd8',"Lime White 1"],['#e4dcca',"Off-White 3"],['#c8c0ae',"Hardwick White 5"]]],
    ['Greys', [['#d0ccc8',"Dimpse 277"],['#c8ccc0',"Cromarty 285"],['#b9beaa',"Pigeon 25"],['#a8a8a0',"Pavilion Gray 242"],['#9c9c98',"Lamp Room Gray 88"],['#8c8880',"Worsted 284"],['#949088',"Manor House Gray 265"],['#8c887c',"Charleston Gray 243"],['#9d9088',"Mole's Breath 276"],['#8c7c68',"Mouse's Back 40"],['#c8c0ae',"Light Gray 17"],['#b8b0a0',"French Gray 18"],['#787470',"Plummett 272"],['#b0b8a0',"Mizzle 266"],['#a0aab0',"Blue Gray 91"],['#b0a8a0',"Dove Tale 267"],['#a8a0a0',"Tailor Tack 302"]]],
    ['Pinks & Reds', [['#f0d8c8',"Pink Ground 202"],['#e8c8b8',"Setting Plaster 231"],['#e8c8c0',"Calamine 230"],['#e8c8b8',"Nancy's Blushes 278"],['#cdb8b0',"Peignoir 286"],['#d08880',"Cinder Rose 246"],['#c09090',"Sulking Room Pink 295"],['#c89888',"Templeton Pink 303"],['#c8a898',"Dead Salmon 28"],['#b8a0a0',"Calluna 270"],['#6a1820',"Incarnadine 248"],['#8c182b',"Rectory Red 217"],['#a82830',"Eating Room Red 43"],['#c84848',"Picture Gallery Red 42"],['#7a2830',"Preference Red 297"],['#6c2838',"Radicchio 96"],['#a05838',"Red Earth 64"],['#c07868',"Whirlybird 309"]]],
    ['Greens', [['#bbbe9f',"Vert de Terre 234"],['#b0c0a8',"Teresa's Green 236"],['#a0a888',"Lichen 19"],['#7a8868',"Saxon Green 80"],['#73806e',"Card Room Green 79"],['#5a6850',"Calke Green 34"],['#636f65',"Green Smoke 47"],['#98a878',"Breakfast Room Green 81"],['#b0b898',"Ball Green 75"],['#97a07a',"Cooking Apple Green 32"],['#748860',"Yeabridge Green 287"],['#808870',"Treron 292"],['#4a5040',"Bancha 298"],['#384030',"Studio Green 93"],['#485840',"Arsenic 214"],['#586048',"Beverly 310"],['#788050',"Sap Green 199"],['#708888',"Green Blue 84"]]],
    ['Blues', [['#6888a0',"Lulworth Blue 89"],['#8898a8',"Parma Gray 27"],['#759194',"Stone Blue 86"],['#a0b8c8',"Light Blue 22"],['#2c3437',"Hague Blue 30"],['#2c3a48',"Stiffkey Blue 281"],['#586768',"Inchyra Blue 289"],['#7898a0',"Dix Blue 82"],['#507898',"Cooks Blue 237"],['#7888a0',"Oval Room Blue 85"],['#c0d0d8',"Skylight 205"],['#8098a8',"Kittiwake 307"],['#485060',"Selvedge 304"],['#6a7c80',"De Nimes 299"],['#7890a0',"Eddy 301"]]],
    ['Darks & Blacks', [['#3c3d42',"Down Pipe 26"],['#45484b',"Railings 31"],['#313639',"Off-Black 57"],['#292820',"Pitch Black 256"],['#483830',"Tanner's Brown 255"],['#482838',"Brinjal 222"],['#3a2830',"Paean Black 294"],['#4a3030',"Mahogany 36"],['#504838',"Hopper Head 305"],['#2a5058',"Vardo 288"],['#4a2028',"Wine Dark 308"],['#5a5038',"Broccoli Brown 198"],['#584858',"Brassica 271"]]],
    ['New 2025', [['#984838',"Etruscan Red 56"],['#e8d8c8',"Scallop 311"],['#485838',"Dibber 312"],['#606850',"Reduced Green 313"],['#c8c0a8',"Sizing 314"],['#e8d8b8',"Naperon 315"],['#b87838',"Marmelo 316"],['#889068',"Kakelugn 317"],['#9c9880',"Douter 318"],['#b8a880',"Duster 319"]]]
  ],

  // RAL classics — [group, [[hex, 'Code Name'], ...]]
  RAL_OPTS: [
    ['Whites & Creams', [['#FFFFFF',"9010 Pure White"],['#F6F6F6',"9016 Traffic White"],['#F4F4F4',"9003 Signal White"],['#FDF4E3',"9001 Cream White"],['#E7EBDA',"9002 Grey White"],['#E6D690',"1015 Light Ivory"],['#C2B078',"1001 Beige"],['#C6A664',"1002 Sand Yellow"]]],
    ['Greys', [['#D7D7D7',"7035 Light Grey"],['#B5B8B1',"7038 Agate Grey"],['#8D948D',"7042 Traffic Grey A"],['#7D7F7D',"7037 Dusty Grey"],['#78858B',"7000 Squirrel Grey"],['#9EA0A1',"7004 Signal Grey"],['#6C7059',"7005 Mouse Grey"],['#474A51',"7024 Graphite Grey"],['#293133',"7016 Anthracite Grey"],['#23282B',"7021 Black Grey"],['#434750',"7015 Slate Grey"],['#4E5754',"7012 Basalt Grey"]]],
    ['Blacks', [['#0A0A0A',"9005 Jet Black"],['#1C2023',"9011 Graphite Black"],['#1E1E1E',"9017 Traffic Black"],['#282828',"9004 Signal Black"]]],
    ['Greens', [['#31372B',"6009 Fir Green"],['#2F4538',"6005 Moss Green"],['#343B29',"6007 Bottle Green"],['#1F3A3D',"6004 Blue Green"],['#4A4F3B',"6003 Olive Green"],['#587246',"6011 Reseda Green"],['#35682D',"6010 Grass Green"],['#1E5945',"6016 Turquoise Green"]]],
    ['Blues', [['#1E2460',"5002 Ultramarine Blue"],['#1D1E33',"5004 Black Blue"],['#1B2A4A',"5011 Steel Blue"],['#2271B3',"5015 Sky Blue"],['#063971',"5017 Traffic Blue"],['#3B83BD',"5012 Light Blue"],['#354D73',"5000 Violet Blue"],['#49678D',"5023 Distant Blue"]]],
    ['Reds', [['#AF2B1E',"3000 Flame Red"],['#9B111E',"3003 Ruby Red"],['#75151E',"3004 Purple Red"],['#5E2129',"3005 Wine Red"],['#D53032',"3018 Strawberry Red"],['#CC0605',"3020 Traffic Red"]]],
    ['Browns', [['#955F20',"8001 Ochre Brown"],['#6F4F28',"8008 Olive Brown"],['#6F3B2A',"8011 Nut Brown"],['#4E3B31',"8028 Terra Brown"],['#45322E',"8017 Chocolate Brown"],['#382C1E',"8014 Sepia Brown"]]],
    ['Yellows & Oranges', [['#E5BE01',"1003 Signal Yellow"],['#F4A900',"1028 Melon Yellow"],['#ED760E',"2000 Yellow Orange"],['#FF7514',"2003 Pastel Orange"]]]
  ]
};
