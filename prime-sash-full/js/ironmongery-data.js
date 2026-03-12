// Ironmongery products data
const IRONMONGERY_DATA = {
  // Furniture finish colors
  finishColors: [
    { id: 'client-supply', name: 'Client Supply (Special Design)', hasProducts: false },
    { id: 'chrome', name: 'Chrome', hasProducts: true },
    { id: 'satin', name: 'Satin', hasProducts: true },
    { id: 'brass', name: 'Brass (Gold)', hasProducts: true },
    { id: 'antique-brass', name: 'Antique Brass', hasProducts: true },
    { id: 'black', name: 'Black', hasProducts: true },
    { id: 'white', name: 'White', hasProducts: true }
  ],

  // Product categories
  categories: {
    fingerLifts: {
      name: 'Sash Finger Lifts',
      autoQuantity: 2, // Zawsze 2 sztuki
      mandatory: false, // Opcjonalne ale zalecane
      products: [
        {
          id: 'finger-lift-chrome',
          name: 'Sash Finger Lift',
          color: 'chrome',
          prices: { net: 8.50, vat: 10.20 },
          image: 'img/ironmongery/finger-lift-chrome.jpg',
          description: 'Recommended - Always 2 per window'
        },
        {
          id: 'finger-lift-satin',
          name: 'Sash Finger Lift',
          color: 'satin',
          prices: { net: 8.50, vat: 10.20 },
          image: 'img/ironmongery/finger-lift-satin.jpg',
          description: 'Recommended - Always 2 per window'
        },
        {
          id: 'finger-lift-brass',
          name: 'Sash Finger Lift',
          color: 'brass',
          prices: { net: 9.50, vat: 11.40 },
          image: 'img/ironmongery/finger-lift-brass.jpg',
          description: 'Recommended - Always 2 per window'
        },
        {
          id: 'finger-lift-antique-brass',
          name: 'Sash Finger Lift',
          color: 'antique-brass',
          prices: { net: 9.50, vat: 11.40 },
          image: 'img/ironmongery/finger-lift-antique-brass.jpg',
          description: 'Recommended - Always 2 per window'
        },
        {
          id: 'finger-lift-black',
          name: 'Sash Finger Lift',
          color: 'black',
          prices: { net: 8.50, vat: 10.20 },
          image: 'img/ironmongery/finger-lift-black.jpg',
          description: 'Recommended - Always 2 per window'
        },
        {
          id: 'finger-lift-white',
          name: 'Sash Finger Lift',
          color: 'white',
          prices: { net: 8.50, vat: 10.20 },
          image: 'img/ironmongery/finger-lift-white.jpg',
          description: 'Recommended - Always 2 per window'
        }
      ]
    },

    locks: {
      name: 'Sash Locks',
      autoQuantity: true, // Ilość wyliczana automatycznie (1 lub 2)
      products: [
        {
          id: 'sash-lock-pas24-chrome',
          name: 'Sash Lock PAS24',
          color: 'chrome',
          isPAS24: true,
          recommended: true,
          prices: { net: 25.00, vat: 30.00 },
          image: 'img/ironmongery/lock-pas24-chrome.jpg',
          description: 'PAS24 certified security lock'
        },
        {
          id: 'sash-lock-pas24-satin',
          name: 'Sash Lock PAS24',
          color: 'satin',
          isPAS24: true,
          recommended: true,
          prices: { net: 25.00, vat: 30.00 },
          image: 'img/ironmongery/lock-pas24-satin.jpg',
          description: 'PAS24 certified security lock'
        },
        {
          id: 'sash-lock-pas24-brass',
          name: 'Sash Lock PAS24',
          color: 'brass',
          isPAS24: true,
          recommended: true,
          prices: { net: 27.00, vat: 32.40 },
          image: 'img/ironmongery/lock-pas24-brass.jpg',
          description: 'PAS24 certified security lock'
        },
        {
          id: 'sash-lock-pas24-antique-brass',
          name: 'Sash Lock PAS24',
          color: 'antique-brass',
          isPAS24: true,
          recommended: true,
          prices: { net: 27.00, vat: 32.40 },
          image: 'img/ironmongery/lock-pas24-antique-brass.jpg',
          description: 'PAS24 certified security lock'
        },
        {
          id: 'sash-lock-pas24-black',
          name: 'Sash Lock PAS24',
          color: 'black',
          isPAS24: true,
          recommended: true,
          prices: { net: 25.00, vat: 30.00 },
          image: 'img/ironmongery/lock-pas24-black.jpg',
          description: 'PAS24 certified security lock'
        },
        {
          id: 'sash-lock-pas24-white',
          name: 'Sash Lock PAS24',
          color: 'white',
          isPAS24: true,
          recommended: true,
          prices: { net: 25.00, vat: 30.00 },
          image: 'img/ironmongery/lock-pas24-white.jpg',
          description: 'PAS24 certified security lock'
        }
        // TODO: Dodać inne locki (non-PAS24) jeśli będą potrzebne
      ]
    },

    pullHandles: {
      name: 'Sash Pull Handles',
      autoQuantity: false, // User wybiera ilość
      products: [
        {
          id: 'pull-handle-chrome',
          name: 'Sash Pull Handle',
          color: 'chrome',
          prices: { net: 12.50, vat: 15.00 },
          image: 'img/ironmongery/pull-handle-chrome.jpg',
          description: 'Choose quantity as needed'
        },
        {
          id: 'pull-handle-satin',
          name: 'Sash Pull Handle',
          color: 'satin',
          prices: { net: 12.50, vat: 15.00 },
          image: 'img/ironmongery/pull-handle-satin.jpg',
          description: 'Choose quantity as needed'
        },
        {
          id: 'pull-handle-brass',
          name: 'Sash Pull Handle',
          color: 'brass',
          prices: { net: 14.00, vat: 16.80 },
          image: 'img/ironmongery/pull-handle-brass.jpg',
          description: 'Choose quantity as needed'
        },
        {
          id: 'pull-handle-antique-brass',
          name: 'Sash Pull Handle',
          color: 'antique-brass',
          prices: { net: 14.00, vat: 16.80 },
          image: 'img/ironmongery/pull-handle-antique-brass.jpg',
          description: 'Choose quantity as needed'
        },
        {
          id: 'pull-handle-black',
          name: 'Sash Pull Handle',
          color: 'black',
          prices: { net: 12.50, vat: 15.00 },
          image: 'img/ironmongery/pull-handle-black.jpg',
          description: 'Choose quantity as needed'
        },
        {
          id: 'pull-handle-white',
          name: 'Sash Pull Handle',
          color: 'white',
          prices: { net: 12.50, vat: 15.00 },
          image: 'img/ironmongery/pull-handle-white.jpg',
          description: 'Choose quantity as needed'
        }
      ]
    },

    stoppers: {
      name: 'Window Stoppers',
      autoQuantity: 2, // Zawsze 2 sztuki
      exclusive: true, // Można wybrać TYLKO JEDEN typ (stopper LUB weekes)
      products: [
        {
          id: 'window-stopper-chrome',
          name: 'Sash Window Stopper',
          color: 'chrome',
          type: 'stopper',
          prices: { net: 11.00, vat: 13.20 },
          image: 'img/ironmongery/window-stopper-chrome.jpg',
          description: 'Always 2 per window - Choose this OR Weekes Stop'
        },
        {
          id: 'window-stopper-satin',
          name: 'Sash Window Stopper',
          color: 'satin',
          type: 'stopper',
          prices: { net: 11.00, vat: 13.20 },
          image: 'img/ironmongery/window-stopper-satin.jpg',
          description: 'Always 2 per window - Choose this OR Weekes Stop'
        },
        {
          id: 'window-stopper-brass',
          name: 'Sash Window Stopper',
          color: 'brass',
          type: 'stopper',
          prices: { net: 12.50, vat: 15.00 },
          image: 'img/ironmongery/window-stopper-brass.jpg',
          description: 'Always 2 per window - Choose this OR Weekes Stop'
        },
        {
          id: 'window-stopper-antique-brass',
          name: 'Sash Window Stopper',
          color: 'antique-brass',
          type: 'stopper',
          prices: { net: 12.50, vat: 15.00 },
          image: 'img/ironmongery/window-stopper-antique-brass.jpg',
          description: 'Always 2 per window - Choose this OR Weekes Stop'
        },
        {
          id: 'window-stopper-black',
          name: 'Sash Window Stopper',
          color: 'black',
          type: 'stopper',
          prices: { net: 11.00, vat: 13.20 },
          image: 'img/ironmongery/window-stopper-black.jpg',
          description: 'Always 2 per window - Choose this OR Weekes Stop'
        },
        {
          id: 'window-stopper-white',
          name: 'Sash Window Stopper',
          color: 'white',
          type: 'stopper',
          prices: { net: 11.00, vat: 13.20 },
          image: 'img/ironmongery/window-stopper-white.jpg',
          description: 'Always 2 per window - Choose this OR Weekes Stop'
        },
        {
          id: 'weekes-stop-chrome',
          name: 'Weekes Sash Stop',
          color: 'chrome',
          type: 'weekes',
          prices: { net: 13.50, vat: 16.20 },
          image: 'img/ironmongery/weekes-stop-chrome.jpg',
          description: 'Always 2 per window - Choose this OR Window Stopper'
        },
        {
          id: 'weekes-stop-satin',
          name: 'Weekes Sash Stop',
          color: 'satin',
          type: 'weekes',
          prices: { net: 13.50, vat: 16.20 },
          image: 'img/ironmongery/weekes-stop-satin.jpg',
          description: 'Always 2 per window - Choose this OR Window Stopper'
        },
        {
          id: 'weekes-stop-brass',
          name: 'Weekes Sash Stop',
          color: 'brass',
          type: 'weekes',
          prices: { net: 15.00, vat: 18.00 },
          image: 'img/ironmongery/weekes-stop-brass.jpg',
          description: 'Always 2 per window - Choose this OR Window Stopper'
        },
        {
          id: 'weekes-stop-antique-brass',
          name: 'Weekes Sash Stop',
          color: 'antique-brass',
          type: 'weekes',
          prices: { net: 15.00, vat: 18.00 },
          image: 'img/ironmongery/weekes-stop-antique-brass.jpg',
          description: 'Always 2 per window - Choose this OR Window Stopper'
        },
        {
          id: 'weekes-stop-black',
          name: 'Weekes Sash Stop',
          color: 'black',
          type: 'weekes',
          prices: { net: 13.50, vat: 16.20 },
          image: 'img/ironmongery/weekes-stop-black.jpg',
          description: 'Always 2 per window - Choose this OR Window Stopper'
        },
        {
          id: 'weekes-stop-white',
          name: 'Weekes Sash Stop',
          color: 'white',
          type: 'weekes',
          prices: { net: 13.50, vat: 16.20 },
          image: 'img/ironmongery/weekes-stop-white.jpg',
          description: 'Always 2 per window - Choose this OR Window Stopper'
        }
      ]
    },

    horns: {
      name: 'Sash Horns',
      autoQuantity: 2, // Zawsze 2 sztuki
      products: [
        {
          id: 'horn-25mm',
          name: 'Sash Horn 25mm',
          size: '25mm',
          prices: { net: 8.00, vat: 9.60 },
          image: 'img/ironmongery/horn-25mm.jpg',
          description: '25mm traditional sash horn - Always 2 per window'
        },
        {
          id: 'horn-50mm',
          name: 'Sash Horn 50mm',
          size: '50mm',
          prices: { net: 10.00, vat: 12.00 },
          image: 'img/ironmongery/horn-50mm.jpg',
          description: '50mm traditional sash horn - Always 2 per window'
        },
        {
          id: 'horn-75mm',
          name: 'Sash Horn 75mm',
          size: '75mm',
          prices: { net: 12.00, vat: 14.40 },
          image: 'img/ironmongery/horn-75mm.jpg',
          description: '75mm traditional sash horn - Always 2 per window'
        }
      ]
    }
  }
};

// Helper functions
const IronmongeryHelper = {
  // Wylicza ilość locków na podstawie konfiguracji okna
  calculateLocksQuantity: function(windowWidth, hasBars) {
    // 2 locki jeśli szerokość frame > 1200mm LUB ma Georgian bars
    if (windowWidth > 1200 || hasBars) {
      return 2;
    }
    return 1;
  },

  // Sprawdza czy produkt może być wybrany przy PAS24
  canSelectWithPAS24: function(product, hasPAS24) {
    if (!hasPAS24) return true; // Jeśli nie ma PAS24, wszystko dostępne
    return product.isPAS24 === true; // Tylko produkty PAS24
  },

  // Filtruje produkty po kolorze
  getProductsByColor: function(category, colorId) {
    if (!IRONMONGERY_DATA.categories[category]) return [];
    return IRONMONGERY_DATA.categories[category].products.filter(
      product => product.color === colorId
    );
  },

  // Pobiera wszystkie produkty z kategorii
  getAllProducts: function(category) {
    if (!IRONMONGERY_DATA.categories[category]) return [];
    return IRONMONGERY_DATA.categories[category].products;
  },

  // Ładuje produkty z localStorage (dodane przez admin panel)
  loadProductsFromStorage: function() {
    const stored = localStorage.getItem('admin_ironmongery_products');
    
    if (!stored) {
      // Jeśli nie ma produktów w localStorage, ZOSTAW domyślne z hardcode
      console.log('No products in localStorage - using default hardcoded products');
      return;
    }

    const products = JSON.parse(stored);
    
    // Grupuj produkty po kategoriach
    const grouped = {};
    products.forEach(product => {
      if (!grouped[product.category]) {
        grouped[product.category] = [];
      }
      grouped[product.category].push(product);
    });

    // Wyczyść wszystkie kategorie najpierw
    Object.keys(IRONMONGERY_DATA.categories).forEach(categoryKey => {
      IRONMONGERY_DATA.categories[categoryKey].products = [];
    });

    // Aktualizuj IRONMONGERY_DATA tylko produktami z localStorage
    Object.keys(grouped).forEach(categoryKey => {
      if (IRONMONGERY_DATA.categories[categoryKey]) {
        IRONMONGERY_DATA.categories[categoryKey].products = grouped[categoryKey];
      }
    });

    console.log('Loaded products from localStorage:', products.length);
  },

  // Inicjalizacja - załaduj produkty przy starcie
  init: function() {
    this.loadProductsFromStorage();
  }
};

// Inicjalizacja helpera przy załadowaniu
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    IronmongeryHelper.init();
  });
}