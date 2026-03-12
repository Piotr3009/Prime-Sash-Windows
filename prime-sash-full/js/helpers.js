// helpers.js - Funkcje pomocnicze dla całej aplikacji
class UIHelpers {
  // Zarządzanie widocznością elementów
  static show(id, display = 'block') {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (el) el.style.display = display;
    return el;
  }
  
  static hide(id) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (el) el.style.display = 'none';
    return el;
  }
  
  static toggle(id, condition, display = 'block') {
    condition ? this.show(id, display) : this.hide(id);
  }
  
  // Aktualizacja tekstów
  static setText(id, text) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (el) el.textContent = text;
    return el;
  }
  
  static setHTML(id, html) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (el) el.innerHTML = html;
    return el;
  }
  
  // Zarządzanie klasami
  static addClass(id, className) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (el) el.classList.add(className);
    return el;
  }
  
  static removeClass(id, className) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (el) el.classList.remove(className);
    return el;
  }
  
  static toggleClass(id, className, condition) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (el) el.classList.toggle(className, condition);
    return el;
  }
  
  // Batch operations
  static findElements(selectors) {
    const elements = {};
    Object.entries(selectors).forEach(([key, selector]) => {
      if (selector.startsWith('#')) {
        elements[key] = document.querySelector(selector);
      } else if (selector.startsWith('.') || selector.includes('[')) {
        elements[key] = document.querySelectorAll(selector);
      } else {
        elements[key] = document.getElementById(selector);
      }
    });
    return elements;
  }
  
  // Event listeners
  static on(element, event, handler) {
    if (typeof element === 'string') {
      element = document.querySelector(element);
    }
    if (element) {
      if (NodeList.prototype.isPrototypeOf(element)) {
        element.forEach(el => el.addEventListener(event, handler));
      } else {
        element.addEventListener(event, handler);
      }
    }
  }
  
  static onClick(element, handler) {
    this.on(element, 'click', handler);
  }
  
  static onChange(element, handler) {
    this.on(element, 'change', handler);
  }
  
  // Radio buttons helper
  static attachRadios(name, callback) {
    document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
      radio.addEventListener('change', e => {
        if (e.target.checked) callback(e.target.value);
      });
    });
  }
  
  // Select helper
  static setSelectValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }
  
  static getSelectValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : null;
  }
  
  // Checkbox helper
  static setChecked(id, checked) {
    const el = document.getElementById(id);
    if (el) el.checked = checked;
  }
  
  static isChecked(id) {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  }
  
  // Value helpers
  static getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : null;
  }
  
  static setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }
  
  // Format helpers
  static formatPrice(price) {
    return price.toFixed(2);
  }
  
  static capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Global state manager
class AppState {
  constructor() {
    this.config = {
      width: 800,
      height: 1000,
      measurementType: 'brick-to-brick',
      frameType: 'standard',
      colorType: 'single',
      singleColor: 'white',
      interiorColor: 'white',
      exteriorColor: 'black',
      glassType: 'double',
      openingType: 'both',
      upperBars: 'none',
      lowerBars: 'none',
      upperBarPosition: 150,
      lowerBarPosition: 150,
      glassSpec: 'toughened',
      glassFinish: 'clear',
      frostedLocation: 'bottom',
      horns: 'none',
      ironmongery: 'none',
      quantity: 1,
      pas24: 'no'
    };
    
    this.listeners = new Set();
  }
  
  update(key, value) {
    if (typeof key === 'object') {
      Object.assign(this.config, key);
    } else {
      this.config[key] = value;
    }
    this.notify();
  }
  
  get(key) {
    return key ? this.config[key] : this.config;
  }
  
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  notify() {
    this.listeners.forEach(callback => callback(this.config));
  }
  
  reset() {
    this.config = {
      width: 800,
      height: 1000,
      measurementType: 'brick-to-brick',
      frameType: 'standard',
      colorType: 'single',
      singleColor: 'white',
      interiorColor: 'white',
      exteriorColor: 'black',
      glassType: 'double',
      openingType: 'both',
      upperBars: 'none',
      lowerBars: 'none',
      upperBarPosition: 150,
      lowerBarPosition: 150,
      glassSpec: 'toughened',
      glassFinish: 'clear',
      frostedLocation: 'bottom',
      horns: 'none',
      ironmongery: 'none',
      quantity: 1,
      pas24: 'no'
    };
    this.notify();
  }
}

// DOM Ready helper
function ready(fn) {
  if (document.readyState !== 'loading') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

// Export globals
window.UIHelpers = UIHelpers;
window.AppState = new AppState();
window.ready = ready;