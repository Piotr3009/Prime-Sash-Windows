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
  // ── Data: single source of truth in js/color-config.js (window.COLOR_DATA) ──
  if (!window.COLOR_DATA) console.error('color-module: window.COLOR_DATA missing — load js/color-config.js first');
  var CD = window.COLOR_DATA || {};
  var SWATCHES = CD.SWATCHES || [];

  // ── RAL dropdown options ──
  var RAL_OPTS = CD.RAL_OPTS || [];

  // ── F&B dropdown options ──
  var FB_OPTS = CD.FB_OPTS || [];

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

  // ═══ Static UI population (sash + casement sections in online-estimate) ═══
  // Fills the 6 tile sections and all 12 F&B/RAL dropdowns from COLOR_DATA.
  // Runs at parse time (script sits after the markup, before DOMContentLoaded),
  // so spec-controller bindings and edit-mode prefill see a fully built UI.
  function optionsHTML(groups) {
    var h = '';
    groups.forEach(function(g) {
      h += '<optgroup label="' + esc(g[0]) + '">';
      g[1].forEach(function(o) { h += '<option value="' + o[0] + '">' + esc(o[1]) + '</option>'; });
      h += '</optgroup>';
    });
    return h;
  }

  function tileHTML(classes, s, selected) {
    return '<div class="color-option-wrapper">' +
           '<div class="' + classes + (selected ? ' selected' : '') + '"' +
           ' style="background-color: ' + s.bg + ';"' +
           ' data-color="' + s.key + '" data-name="' + esc(s.name) + '" data-ral="' + esc(s.ral) + '"></div>' +
           '<span class="color-name">' + esc(s.name) + '</span></div>';
  }

  function customTileHTML(classes) {
    return '<div class="color-option-wrapper">' +
           '<div class="' + classes + '" style="background: linear-gradient(135deg, #ff6b6b, #4ecdc4, #ffe66d, #95e1d3); position: relative;"' +
           ' data-color="custom" data-name="Custom Color" data-ral="Custom RAL">' +
           '<span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 18px; color: #333; text-shadow: 0 0 3px white;">+</span>' +
           '</div><span class="color-name">Custom</span></div>';
  }

  function populateStaticColorUI() {
    // Dropdowns — every select carrying the shared classes (12 today: 6 sash + 6 casement)
    var fbHTML = optionsHTML(FB_OPTS), ralHTML = optionsHTML(RAL_OPTS);
    document.querySelectorAll('select.color-fb-dropdown').forEach(function(s) { s.insertAdjacentHTML('beforeend', fbHTML); });
    document.querySelectorAll('select.color-ral-dropdown').forEach(function(s) { s.insertAdjacentHTML('beforeend', ralHTML); });

    // Tiles — [containerId, .color-options index inside it, tile classes, custom-btn classes]
    var sections = [
      ['single-color-selector',   0, 'color-option',                  'color-option custom-color-btn'],
      ['dual-color-selector',     0, 'color-option interior-color',   'color-option interior-color custom-color-btn'],
      ['dual-color-selector',     1, 'color-option exterior-color',   'color-option exterior-color custom-color-btn'],
      ['c-single-color-selector', 0, 'color-option c-color-option',   'color-option c-color-option c-custom-color-btn'],
      ['c-dual-color-selector',   0, 'color-option c-interior-color', 'color-option c-interior-color c-custom-color-btn'],
      ['c-dual-color-selector',   1, 'color-option c-exterior-color', 'color-option c-exterior-color c-custom-color-btn']
    ];
    sections.forEach(function(sec) {
      var root = document.getElementById(sec[0]);
      if (!root) return;
      var box = root.querySelectorAll('.color-options')[sec[1]];
      if (!box || box.querySelector('.color-option')) return; // already filled / static fallback
      var h = '';
      SWATCHES.forEach(function(s, i) { h += tileHTML(sec[2], s, i === 0); }); // first (white) selected — as before
      h += customTileHTML(sec[3]);
      box.innerHTML = h;
    });
  }
  populateStaticColorUI();

})();
