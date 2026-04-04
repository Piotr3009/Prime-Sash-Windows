/**
 * ColorModule — shared colour picker for all window types (casement, fix-frame, future).
 * Single source of truth for RAL lookup, F&B palette, swatch tiles, dropdowns.
 *
 * Usage:
 *   const cm = new ColorModule({
 *     containerId: 'fix-color-container',
 *     prefix: 'f',
 *     onColorChange: function(state) {
 *       // state = { sameColor, woodColor, woodColorInt, woodColorExt }
 *       window.update3D && window.update3D(state);
 *     }
 *   });
 */
(function() {
  'use strict';

  // ── RAL lookup (full) ──
  var RAL = {
    '1000':'#BEBD7F','1001':'#C2B078','1002':'#C6A664','1003':'#E5BE01','1004':'#CDA434',
    '1005':'#A98307','1006':'#E4A010','1007':'#DC9D00','1011':'#8A6642','1012':'#C7B446',
    '1013':'#EAE6CA','1014':'#E1CC4F','1015':'#E6D690','1016':'#EDFF21','1017':'#F5D033',
    '1018':'#F8F32B','1019':'#9E9764','1020':'#999950','1021':'#F3DA0B','1023':'#FAD201',
    '1024':'#AEA04B','1026':'#FFFF00','1027':'#9D9101','1028':'#F4A900','1032':'#D6AE01',
    '1033':'#F3A505','1034':'#EFA94A','2000':'#ED760E','2001':'#C93C20','2002':'#CB2821',
    '2003':'#FF7514','2004':'#F44611','3000':'#AF2B1E','3001':'#A52019','3002':'#A2231D',
    '3003':'#9B111E','3004':'#75151E','3005':'#5E2129','3007':'#412227','3009':'#642424',
    '3011':'#781F19','3012':'#C1876B','3013':'#A12312','3014':'#D36E70','3015':'#EA899A',
    '3016':'#B32821','3017':'#E63244','3018':'#D53032','3020':'#CC0605','3022':'#D95030',
    '3027':'#C51D34','3031':'#B32428','4001':'#6D3F5B','4002':'#922B3E','4003':'#DE4C8A',
    '4004':'#641C34','4005':'#6C4675','4006':'#A03472','4007':'#4A192C','4008':'#924E7D',
    '5000':'#354D73','5001':'#1F3438','5002':'#1E2460','5003':'#1D1E33','5004':'#18171C',
    '5005':'#1E2460','5007':'#3E5F8A','5008':'#26252D','5009':'#025669','5010':'#0E4243',
    '5011':'#1B2A4A','5012':'#3B83BD','5013':'#1E213D','5014':'#606E8C','5015':'#2271B3',
    '5017':'#063971','5018':'#3F888F','5019':'#1B5583','5020':'#1D334A','5021':'#256D7B',
    '5022':'#252850','5023':'#49678D','5024':'#5D9B9B','6000':'#316650','6001':'#287233',
    '6002':'#2D572C','6003':'#424632','6004':'#1F3A3D','6005':'#2F4538','6006':'#3E3B32',
    '6007':'#343B29','6008':'#39352A','6009':'#31372B','6010':'#35682D','6011':'#587246',
    '6012':'#343E40','6013':'#6C7156','6014':'#47402E','6016':'#1E5945','7000':'#78858B',
    '7001':'#8A9597','7002':'#817F68','7003':'#7D7F7D','7004':'#9EA0A1','7005':'#6C7059',
    '7006':'#756F61','7008':'#6A5F31','7011':'#434B4D','7012':'#4E5754','7015':'#434750',
    '7016':'#293133','7021':'#23282B','7022':'#332F2C','7023':'#8B8C7A','7024':'#474A51',
    '7030':'#8B8B7A','7031':'#474B4E','7032':'#B8B799','7033':'#7D8471','7034':'#8F8B66',
    '7035':'#D7D7D7','7036':'#7F7679','7037':'#7D7F7D','7038':'#B5B8B1','7039':'#6C6960',
    '7040':'#9DA1AA','7042':'#8D948D','7043':'#4E5452','7044':'#CAC4B0','7045':'#909090',
    '7046':'#82898F','7047':'#D0D0D0','8000':'#826C34','8001':'#955F20','8002':'#6C3B2A',
    '8003':'#734222','8004':'#8E402A','8007':'#59351F','8008':'#6F4F28','8011':'#6F3B2A',
    '8014':'#382C1E','8017':'#45322E','8019':'#403A3A','8022':'#212121','8024':'#79553D',
    '8025':'#755C48','8028':'#4E3B31','9001':'#FDF4E3','9002':'#E7EBDA','9003':'#F4F4F4',
    '9004':'#282828','9005':'#0A0A0A','9006':'#A5A5A5','9007':'#8F8F8F','9010':'#FFFFFF',
    '9011':'#1C2023','9016':'#F6F6F6','9017':'#1E1E1E','9018':'#D7D7D7'
  };

  // ── Preset swatch tiles ──
  var SWATCHES = [
    { bg: '#FAFAFA', key: 'white', name: 'Pure White', ral: 'RAL 9016' },
    { bg: '#0A0A0A', key: 'black', name: 'Jet Black', ral: 'RAL 9005' },
    { bg: '#293133', key: 'anthracite', name: 'Anthracite Grey', ral: 'RAL 7016' },
    { bg: '#424632', key: 'olive', name: 'Olive Green', ral: 'RAL 6003' },
    { bg: '#F7F9F5', key: 'offwhite', name: 'Off-White', ral: 'RAL 9010' },
    { bg: '#F1EFDC', key: 'cream', name: 'Cream', ral: 'RAL 9001' },
    { bg: '#5E2028', key: 'burgundy', name: 'Burgundy Red', ral: 'RAL 3005' },
    { bg: '#222D5A', key: 'royal', name: 'Royal Blue', ral: 'RAL 5002' }
  ];

  // ── RAL dropdown options ──
  var RAL_OPTS = [
    ['Whites & Creams', [['#FFFFFF','9010 Pure White'],['#F6F6F6','9016 Traffic White'],['#F4F4F4','9003 Signal White'],['#FDF4E3','9001 Cream White'],['#E7EBDA','9002 Grey White'],['#E6D690','1015 Light Ivory'],['#C2B078','1001 Beige'],['#C6A664','1002 Sand Yellow']]],
    ['Greys', [['#D7D7D7','7035 Light Grey'],['#B5B8B1','7038 Agate Grey'],['#8D948D','7042 Traffic Grey A'],['#7D7F7D','7037 Dusty Grey'],['#78858B','7000 Squirrel Grey'],['#9EA0A1','7004 Signal Grey'],['#6C7059','7005 Mouse Grey'],['#474A51','7024 Graphite Grey'],['#293133','7016 Anthracite Grey'],['#23282B','7021 Black Grey'],['#434750','7015 Slate Grey'],['#4E5754','7012 Basalt Grey']]],
    ['Blacks', [['#0A0A0A','9005 Jet Black'],['#1C2023','9011 Graphite Black'],['#1E1E1E','9017 Traffic Black'],['#282828','9004 Signal Black']]],
    ['Greens', [['#31372B','6009 Fir Green'],['#2F4538','6005 Moss Green'],['#343B29','6007 Bottle Green'],['#1F3A3D','6004 Blue Green'],['#4A4F3B','6003 Olive Green'],['#587246','6011 Reseda Green'],['#35682D','6010 Grass Green'],['#1E5945','6016 Turquoise Green']]],
    ['Blues', [['#1E2460','5002 Ultramarine Blue'],['#1D1E33','5004 Black Blue'],['#1B2A4A','5011 Steel Blue'],['#2271B3','5015 Sky Blue'],['#063971','5017 Traffic Blue'],['#3B83BD','5012 Light Blue'],['#354D73','5000 Violet Blue'],['#49678D','5023 Distant Blue']]],
    ['Reds', [['#AF2B1E','3000 Flame Red'],['#9B111E','3003 Ruby Red'],['#75151E','3004 Purple Red'],['#5E2129','3005 Wine Red'],['#D53032','3018 Strawberry Red'],['#CC0605','3020 Traffic Red']]],
    ['Browns', [['#955F20','8001 Ochre Brown'],['#6F4F28','8008 Olive Brown'],['#6F3B2A','8011 Nut Brown'],['#4E3B31','8028 Terra Brown'],['#45322E','8017 Chocolate Brown'],['#382C1E','8014 Sepia Brown']]],
    ['Yellows & Oranges', [['#E5BE01','1003 Signal Yellow'],['#F4A900','1028 Melon Yellow'],['#ED760E','2000 Yellow Orange'],['#FF7514','2003 Pastel Orange']]]
  ];

  // ── F&B dropdown options ──
  var FB_OPTS = [
    ['Whites', [['#fbf8f4','All White 2005'],['#eee9e7','Wevet 273'],['#f2f0e8','Strong White 2001'],['#ede8dc','Great White 2006'],['#f0ece0','Wimborne White 239'],['#fdfeec','Pointing 2003'],['#f3f0e1','James White 2010'],['#ede6d5','White Tie 2002'],['#ede3ce','Slipper Satin 2004'],['#f4f0e5','School House White 291'],['#eceae5','Blackened 2011'],['#ecf0e0','Cabbage White 269'],['#dfe6e4','Borrowed Light 235'],['#eae4d6','Shadow White 282'],['#f0e4d4','Dimity 2008'],['#f0e4c8','Matchstick 2013']]],
    ['Creams & Yellows', [['#eee8d8','New White 59'],['#f0e8c8','Tallow 203'],['#f0deb8',"Farrow's Cream 67"],['#f4e4ba','Dorset Cream 68'],['#ede4b8','Pale Hound 71'],['#dac586','Hay 37'],['#c89830','Sudbury Yellow 51'],['#ce923c','India Yellow 66'],['#e8b830','Babouche 223'],['#ece0a0','Yellow Ground 218'],['#f0e0a0','Dayroom Yellow 233'],['#d8d498','Citron 74'],['#c07030',"Charlotte's Locks 268"]]],
    ['Neutrals & Stones', [['#e8e2d0','Skimming Stone 241'],['#c8b898','Stony Ground 211'],['#b8b0a0',"Joa's White 226"],['#c8b898','Oxford Stone 264'],['#a09880','London Stone 6'],['#ccbfb3',"Elephant's Breath 229"],['#d0ccc4','Ammonite 274'],['#c8c4b8','Cornforth White 228'],['#c0b8a8','Purbeck Stone 275'],['#c8bca8','Drop Cloth 283'],['#c0b498','Jitney 293'],['#d8ccae','String 8'],['#d6c39e','Cord 16'],['#deccb0','Bone 15'],['#ccc8c1','Shaded White 201'],['#b8a888','Stirabout 300'],['#e8ddc8','Old White 4'],['#f2ecd8','Lime White 1'],['#e4dcca','Off-White 3'],['#c8c0ae','Hardwick White 5']]],
    ['Greys', [['#d0ccc8','Dimpse 277'],['#c8ccc0','Cromarty 285'],['#b9beaa','Pigeon 25'],['#a8a8a0','Pavilion Gray 242'],['#9c9c98','Lamp Room Gray 88'],['#8c8880','Worsted 284'],['#949088','Manor House Gray 265'],['#8c887c','Charleston Gray 243'],['#9d9088',"Mole's Breath 276"],['#8c7c68',"Mouse's Back 40"],['#c8c0ae','Light Gray 17'],['#b8b0a0','French Gray 18'],['#787470','Plummett 272'],['#b0b8a0','Mizzle 266'],['#a0aab0','Blue Gray 91'],['#b0a8a0','Dove Tale 267'],['#a8a0a0','Tailor Tack 302']]],
    ['Pinks & Reds', [['#f0d8c8','Pink Ground 202'],['#e8c8b8','Setting Plaster 231'],['#e8c8c0','Calamine 230'],['#e8c8b8',"Nancy's Blushes 278"],['#cdb8b0','Peignoir 286'],['#d08880','Cinder Rose 246'],['#c09090','Sulking Room Pink 295'],['#c89888','Templeton Pink 303'],['#c8a898','Dead Salmon 28'],['#b8a0a0','Calluna 270'],['#6a1820','Incarnadine 248'],['#8c182b','Rectory Red 217'],['#a82830','Eating Room Red 43'],['#c84848','Picture Gallery Red 42'],['#7a2830','Preference Red 297'],['#6c2838','Radicchio 96'],['#a05838','Red Earth 64'],['#c07868','Whirlybird 309']]],
    ['Greens', [['#bbbe9f','Vert de Terre 234'],['#b0c0a8',"Teresa's Green 236"],['#a0a888','Lichen 19'],['#7a8868','Saxon Green 80'],['#73806e','Card Room Green 79'],['#5a6850','Calke Green 34'],['#636f65','Green Smoke 47'],['#98a878','Breakfast Room Green 81'],['#b0b898','Ball Green 75'],['#97a07a','Cooking Apple Green 32'],['#748860','Yeabridge Green 287'],['#808870','Treron 292'],['#4a5040','Bancha 298'],['#384030','Studio Green 93'],['#485840','Arsenic 214'],['#586048','Beverly 310'],['#788050','Sap Green 199'],['#708888','Green Blue 84']]],
    ['Blues', [['#6888a0','Lulworth Blue 89'],['#8898a8','Parma Gray 27'],['#759194','Stone Blue 86'],['#a0b8c8','Light Blue 22'],['#2c3437','Hague Blue 30'],['#2c3a48','Stiffkey Blue 281'],['#586768','Inchyra Blue 289'],['#7898a0','Dix Blue 82'],['#507898','Cooks Blue 237'],['#7888a0','Oval Room Blue 85'],['#c0d0d8','Skylight 205'],['#8098a8','Kittiwake 307'],['#485060','Selvedge 304'],['#6a7c80','De Nimes 299'],['#7890a0','Eddy 301']]],
    ['Darks & Blacks', [['#3c3d42','Down Pipe 26'],['#45484b','Railings 31'],['#313639','Off-Black 57'],['#292820','Pitch Black 256'],['#483830',"Tanner's Brown 255"],['#482838','Brinjal 222'],['#3a2830','Paean Black 294'],['#4a3030','Mahogany 36'],['#504838','Hopper Head 305'],['#2a5058','Vardo 288'],['#4a2028','Wine Dark 308'],['#5a5038','Broccoli Brown 198'],['#584858','Brassica 271']]],
    ['New 2025', [['#984838','Etruscan Red 56'],['#e8d8c8','Scallop 311'],['#485838','Dibber 312'],['#606850','Reduced Green 313'],['#c8c0a8','Sizing 314'],['#e8d8b8','Naperon 315'],['#b87838','Marmelo 316'],['#889068','Kakelugn 317'],['#9c9880','Douter 318'],['#b8a880','Duster 319']]]
  ];

  // ── Helpers ──
  function rgbToHex(rgb) {
    if (!rgb || rgb.charAt(0) === '#') return rgb;
    var m = rgb.match(/\d+/g);
    if (!m || m.length < 3) return '#F6F6F6';
    return '#' + ((1 << 24) + (parseInt(m[0]) << 16) + (parseInt(m[1]) << 8) + parseInt(m[2])).toString(16).slice(1).toUpperCase();
  }

  function esc(s) { return s.replace(/&/g,'&amp;').replace(/'/g,'&#39;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

  function buildSelect(id, groups, label) {
    var h = '<select id="' + id + '" class="color-ral-dropdown"><option value="">— ' + label + ' —</option>';
    groups.forEach(function(g) {
      h += '<optgroup label="' + esc(g[0]) + '">';
      g[1].forEach(function(o) { h += '<option value="' + o[0] + '">' + esc(o[1]) + '</option>'; });
      h += '</optgroup>';
    });
    return h + '</select>';
  }

  function buildSwatches(prefix, classExtra) {
    var h = '<div class="color-options">';
    SWATCHES.forEach(function(s) {
      h += '<div class="color-option-wrapper"><div class="color-option ' + prefix + '-co ' + classExtra +
           (s.key === 'white' ? ' selected' : '') +
           '" style="background-color:' + s.bg + ';" data-color="' + s.key +
           '" data-name="' + esc(s.name) + '" data-ral="' + esc(s.ral) + '"></div><span class="color-name">' + esc(s.name) + '</span></div>';
    });
    // Custom button
    h += '<div class="color-option-wrapper"><div class="color-option ' + prefix + '-co ' + classExtra + ' ' + prefix + '-custom" ' +
         'style="background:linear-gradient(135deg,#ff6b6b,#4ecdc4,#ffe66d,#95e1d3);position:relative;" ' +
         'data-color="custom" data-name="Custom Color" data-ral="Custom RAL">' +
         '<span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:18px;color:#333;text-shadow:0 0 3px white;">+</span>' +
         '</div><span class="color-name">Custom</span></div>';
    h += '</div>';
    return h;
  }

  function buildDropdownRow(prefix, target) {
    var ralId = prefix + '-' + target + '-ral-select';
    var fbId  = prefix + '-' + target + '-fb-select';
    return '<div class="color-dropdown-row">' +
           buildSelect(ralId, RAL_OPTS, 'RAL') +
           buildSelect(fbId, FB_OPTS, 'F&amp;B') +
           '</div>';
  }

  function buildRalInput(prefix, target) {
    var iid = prefix + '-' + target + '-ral-input';
    var bid = prefix + '-' + target + '-ral-apply';
    var eid = prefix + '-' + target + '-ral-error';
    return '<div class="ral-input-row">' +
           '<input type="text" id="' + iid + '" placeholder="RAL e.g. 7016">' +
           '<button type="button" id="' + bid + '">Apply</button>' +
           '<span class="ral-error" id="' + eid + '"></span></div>';
  }

  // ── ColorModule constructor ──
  function ColorModule(opts) {
    this.container = document.getElementById(opts.containerId);
    this.prefix = opts.prefix || 'cm';
    this.onColorChange = opts.onColorChange || function() {};
    this.state = { sameColor: true, woodColor: '#FAFAFA', woodColorInt: '#FAFAFA', woodColorExt: '#FAFAFA' };

    if (!this.container) { console.warn('ColorModule: container not found:', opts.containerId); return; }
    this.render();
    this.bind();
  }

  ColorModule.prototype.render = function() {
    var p = this.prefix;
    var h = '';

    // Single/Dual radio
    h += '<div class="radio-group" style="margin-bottom:10px;">';
    h += '<div class="radio-option"><input type="radio" id="' + p + '-col-same" name="' + p + '-colour-mode" value="same" checked>';
    h += '<label for="' + p + '-col-same" class="radio-label">Single Color</label></div>';
    h += '<div class="radio-option"><input type="radio" id="' + p + '-col-dual" name="' + p + '-colour-mode" value="dual">';
    h += '<label for="' + p + '-col-dual" class="radio-label">Dual Color +15%</label></div>';
    h += '</div>';

    // Single section
    h += '<div id="' + p + '-single-color-selector">';
    h += '<label>Select Color (both inside and outside):</label>';
    h += buildSwatches(p, '');
    h += buildDropdownRow(p, 'single');
    h += buildRalInput(p, 'single');
    h += '<div class="color-preview-info" id="' + p + '-single-preview-info">';
    h += '<div class="preview-item"><span class="preview-label">Selected Color:</span><span class="preview-value" id="' + p + '-single-preview-name">Pure White</span></div>';
    h += '<div class="preview-item"><span class="preview-label">Code:</span><span class="preview-value" id="' + p + '-single-preview-ral">#FAFAFA</span></div>';
    h += '</div></div>';

    // Dual section
    h += '<div id="' + p + '-dual-colour-section" style="display:none;">';

    // Interior
    h += '<div class="dual-color-section"><label>Interior Color:</label>';
    h += buildSwatches(p, p + '-interior');
    h += buildDropdownRow(p, 'int');
    h += buildRalInput(p, 'int');
    h += '</div>';

    // Exterior
    h += '<div class="dual-color-section"><label>Exterior Color:</label>';
    h += buildSwatches(p, p + '-exterior');
    h += buildDropdownRow(p, 'ext');
    h += buildRalInput(p, 'ext');
    h += '</div>';

    // Dual preview
    h += '<div class="color-preview-info" id="' + p + '-dual-preview-info" style="display:none;">';
    h += '<div class="preview-item"><span class="preview-label">Interior:</span><span class="preview-value" id="' + p + '-dual-preview-interior">Pure White (RAL 9016)</span></div>';
    h += '<div class="preview-item"><span class="preview-label">Exterior:</span><span class="preview-value" id="' + p + '-dual-preview-exterior">Pure White (RAL 9016)</span></div>';
    h += '</div></div>';

    this.container.innerHTML = h;
  };

  ColorModule.prototype.bind = function() {
    var self = this;
    var p = this.prefix;

    // Single/Dual toggle
    document.querySelectorAll('input[name="' + p + '-colour-mode"]').forEach(function(r) {
      r.addEventListener('change', function() {
        var dual = r.value === 'dual';
        var ss = document.getElementById(p + '-single-color-selector');
        var ds = document.getElementById(p + '-dual-colour-section');
        var sp = document.getElementById(p + '-single-preview-info');
        var dp = document.getElementById(p + '-dual-preview-info');
        if (ss) ss.style.display = dual ? 'none' : '';
        if (ds) ds.style.display = dual ? '' : 'none';
        if (sp) sp.style.display = dual ? 'none' : '';
        if (dp) dp.style.display = dual ? '' : 'none';
        if (dual) {
          self.state.sameColor = false;
        } else {
          self.state.sameColor = true;
          self.state.woodColorInt = self.state.woodColor;
          self.state.woodColorExt = self.state.woodColor;
        }
        self.onColorChange(self.state);
      });
    });

    // Tile clicks
    this._setupTiles('#' + p + '-single-color-selector .' + p + '-co', 'single');
    this._setupTiles('.' + p + '-interior', 'interior');
    this._setupTiles('.' + p + '-exterior', 'exterior');

    // Dropdowns (RAL + FB)
    var ddIds = [p+'-single-ral-select', p+'-single-fb-select', p+'-int-ral-select', p+'-int-fb-select', p+'-ext-ral-select', p+'-ext-fb-select'];
    ddIds.forEach(function(id) {
      var sel = document.getElementById(id);
      if (!sel) return;
      sel.addEventListener('change', function() {
        var hex = sel.value;
        if (!hex) return;
        var target = id.indexOf('int-') > -1 ? 'interior' : id.indexOf('ext-') > -1 ? 'exterior' : 'single';
        self._switchToCustom(target);
        var text = sel.options[sel.selectedIndex].text;
        self._updatePreview(target, text, hex);
        self._applyHex(hex, target);
        var row = sel.closest('.color-dropdown-row');
        if (row) row.querySelectorAll('select').forEach(function(s) { if (s !== sel) s.value = ''; });
      });
    });

    // RAL text inputs
    this._setupRalInput(p+'-single-ral-input', p+'-single-ral-apply', p+'-single-ral-error', 'single');
    this._setupRalInput(p+'-int-ral-input', p+'-int-ral-apply', p+'-int-ral-error', 'interior');
    this._setupRalInput(p+'-ext-ral-input', p+'-ext-ral-apply', p+'-ext-ral-error', 'exterior');
  };

  ColorModule.prototype._setupTiles = function(selector, target) {
    var self = this;
    var p = this.prefix;
    document.querySelectorAll(selector).forEach(function(tile) {
      tile.addEventListener('click', function() {
        tile.closest('.color-options').querySelectorAll('.' + p + '-co').forEach(function(t) { t.classList.remove('selected'); });
        tile.classList.add('selected');
        if (tile.dataset.color === 'custom') return;
        var hex = rgbToHex(tile.style.backgroundColor) || '#F6F6F6';
        self._updatePreview(target, tile.dataset.name || '', tile.dataset.ral || '');
        self._applyHex(hex, target);
      });
    });
  };

  ColorModule.prototype._switchToCustom = function(target) {
    var p = this.prefix;
    var sel = target === 'single' ? '#' + p + '-single-color-selector .' + p + '-co' :
              target === 'interior' ? '.' + p + '-interior' : '.' + p + '-exterior';
    document.querySelectorAll(sel).forEach(function(t) { t.classList.remove('selected'); });
    var cb = target === 'single' ? document.querySelector('#' + p + '-single-color-selector .' + p + '-custom') :
             target === 'interior' ? document.querySelector('.' + p + '-interior.' + p + '-custom') :
             document.querySelector('.' + p + '-exterior.' + p + '-custom');
    if (cb) cb.classList.add('selected');
  };

  ColorModule.prototype._setupRalInput = function(inputId, btnId, errorId, target) {
    var self = this;
    var input = document.getElementById(inputId);
    var btn = document.getElementById(btnId);
    var err = document.getElementById(errorId);
    if (!input || !btn) return;
    var apply = function() {
      var key = input.value.trim().replace(/^ral\s*/i, '');
      var hex = RAL[key];
      if (hex) {
        self._switchToCustom(target);
        self._updatePreview(target, 'RAL ' + key, hex);
        self._applyHex(hex, target);
        if (err) err.textContent = '';
      } else {
        if (err) err.textContent = 'RAL not found';
      }
    };
    btn.addEventListener('click', apply);
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter') apply(); });
  };

  ColorModule.prototype._updatePreview = function(target, name, code) {
    var p = this.prefix;
    if (target === 'single') {
      var pn = document.getElementById(p + '-single-preview-name');
      var pr = document.getElementById(p + '-single-preview-ral');
      if (pn) pn.textContent = name;
      if (pr) pr.textContent = code;
    } else if (target === 'interior') {
      var pi = document.getElementById(p + '-dual-preview-interior');
      if (pi) pi.textContent = name + ' (' + code + ')';
    } else if (target === 'exterior') {
      var pe = document.getElementById(p + '-dual-preview-exterior');
      if (pe) pe.textContent = name + ' (' + code + ')';
    }
  };

  ColorModule.prototype._applyHex = function(hex, target) {
    if (target === 'single') {
      this.state.sameColor = true;
      this.state.woodColor = hex;
      this.state.woodColorInt = hex;
      this.state.woodColorExt = hex;
    } else if (target === 'interior') {
      this.state.sameColor = false;
      this.state.woodColorInt = hex;
    } else if (target === 'exterior') {
      this.state.sameColor = false;
      this.state.woodColorExt = hex;
    }
    this.onColorChange(this.state);
  };

  // Expose globally
  window.ColorModule = ColorModule;

})();
