// pricing-config.js - Zaawansowana konfiguracja cennika
const pricingConfig = {
  // Cena bazowa za m²
  basePricePerSqm: 850,

  // ── Sash base curve (owner, 06.09.2026) ──────────────────────────────────
  // Replaces the stepped sizeMultipliers below. Price is continuous and never
  // decreases with size: first m² is a minimum manufacturing price, every m²
  // above it is charged at perExtraSqm. The old tiers produced cliffs of
  // -£338 at 1.0 m² and -£381 at 3.0 m² (a bigger window got cheaper).
  sashCurve: {
    firstSqm: 850,       // £ for the first m² (also the minimum price)
    perExtraSqm: 645,    // £ per m² between 1.0 and largeFrom
    largeFrom: 3.0,      // m² threshold for the large-window rate
    perLargeSqm: 420     // £ per m² above largeFrom
  },

  // Mnożniki degresywne - LEGACY, no longer used by the sash base (see sashCurve).
  // Kept for reference and for any external reader of this config.
  sizeMultipliers: [
    { maxSqm: 1.0, multiplier: 1.35 },   // małe okna +35%
    { maxSqm: 1.5, multiplier: 0.95 },   // -5%
    { maxSqm: 2.0, multiplier: 0.9 },    // -10%
    { maxSqm: 3.0, multiplier: 0.85 },   // -15%
    { maxSqm: 999, multiplier: 0.7 }     // duże okna -30%
  ],
  
  // Ceny za szprosy Georgian bars
  barPricing: {
    pricePerBar: 15,  // 15£ za jeden bar - ŁADOWANE Z DB
    
    // Liczba barów dla każdego wzoru (PER SASH, nie x2!)
    barsPerPattern: {
      'none': 0,
      '2x2': 2,        // 1 pionowy + 1 poziomy = 2
      '3x3': 4,        // 2 pionowe + 2 poziome = 4
      '4x4': 4,        // 2 pionowe + 2 poziome = 4
      '6x6': 5,        // 2 pionowe + 3 poziome = 5
      '9x9': 8,        // 4 pionowe + 4 poziome = 8
      '2-vertical': 2, // 2 pionowe
      '1-vertical': 1, // 1 pionowy
      'custom': null   // będzie liczone dynamicznie
    }
  },
  
  // Dodatkowe opcje cenowe (na przyszłość)
  additionalOptions: {
    // Frame
    frameTypes: {
      'standard': 0,      // bez dopłaty
      'slim': 180         // +180£ za slim frame
    },
    
    // Glass - ŁADOWANE Z DB
    glassTypes: {
      'double': 0,        // bazowe
      'triple': 150,      // +150£
      'passive': 250      // +250£
    },
    
    // Glass specification
    glassSpec: {
      'toughened': 0,     // bazowe
      'laminated': 90     // +90£ za m² (mnożone przez powierzchnię)
    },
    
    // Glass finish - ŁADOWANE Z DB
    glassFinish: {
      'clear': 0,         // bazowe
      'frosted': 80       // +80£
    },
    
    // Horns - bez dopłaty (w cenie okna)
    horns: {
      'none': 0,
      'standard': 0,
      'deep': 0,
      'traditional': 0
    },
    
    // Ironmongery
    ironmongery: {
      'none': 0,
      'black': 40,
      'chrome': 50,
      'gold': 60
    },
    
    // Opening mechanism - ŁADOWANE Z DB
    openingTypes: {
      'both': 0,          // bazowe
      'bottom': -30,      // domyślnie -30£
      'fixed': -50        // domyślnie -50£
    },
    
    // Color
    colorTypes: {
      'single': 0,        // white = baza, inny kolor = +5% (liczone w price-calculator)
      'dual': 0.15        // +15% od subtotal single white
    },
    
    // Color surcharges - nieużywane, obsługiwane bezpośrednio w price-calculator
    colorSurcharges: {
      'white': 0,         // Traffic White (RAL 9016) - bez dopłaty
      'oak': 0.30,        // Oak - +30%
      'custom': 0.10,     // Custom Color - +10%
      'other': 0.05       // Inne kolory - +5%
    },

    // Window type surcharge
    windowType: {
      'double': 0,        // standard, no surcharge
      'triple': 0.20      // +20% surcharge
    },
    
    // Sill extension
    sillExtension: {
      'none': 0,
      '35': 45,
      '60': 65,
      '85': 85
    },
    
    // Security
    pas24: {
      'no': 0,
      'yes': 0            // PAS24 w cenie okna
    }
  },
  
  // Rabaty ilościowe
  quantityDiscounts: [
    { minQty: 1, discount: 0 },
    { minQty: 6, discount: 0 },
    { minQty: 12, discount: 0 },
    { minQty: 24, discount: 0 }
  ],
  
  // VAT
  vatRate: 0.20,  // 20% VAT
  
  // ═══ CASEMENT PRICING ═══
  casement: {
    basePriceMin: 300,         // minimum £300 (0.5 sqm)
    basePricePerSqm: 300,      // £300 per additional sqm above 1
    largeSqmFactor: 0.8,       // sqm above 3 charged at basePricePerSqm * 0.8 (volume discount, no price cliff)
    firstSqmPrice: 500,        // first sqm = £500
    mullionPrice: 150,         // per mullion
    transomPrice: 150,         // per transom
    sashPrice: 50,             // per opening sash (operable panel)
    
    // Layout data: mullions, transoms, sashes (operable only)
    layouts: {
      '010T': { mullions: 0, transoms: 0, sashes: 1 },
      '040L': { mullions: 0, transoms: 0, sashes: 1 },
      '040R': { mullions: 0, transoms: 0, sashes: 1 },
      '040D': { mullions: 1, transoms: 0, sashes: 2 },
      '051L': { mullions: 1, transoms: 0, sashes: 1 },
      '051R': { mullions: 1, transoms: 0, sashes: 1 },
      '052L': { mullions: 1, transoms: 1, sashes: 2 },
      '052R': { mullions: 1, transoms: 1, sashes: 2 },
      '022':  { mullions: 1, transoms: 2, sashes: 2 },
      '180L': { mullions: 1, transoms: 0, sashes: 1 },
      '180R': { mullions: 1, transoms: 0, sashes: 1 },
      '021':  { mullions: 0, transoms: 1, sashes: 1 },
      '021L': { mullions: 0, transoms: 1, sashes: 2 },
      '021R': { mullions: 0, transoms: 1, sashes: 2 },
      '031':  { mullions: 1, transoms: 1, sashes: 2 },
      '031L': { mullions: 1, transoms: 1, sashes: 3 },
      '031R': { mullions: 1, transoms: 1, sashes: 3 },
      '032':  { mullions: 1, transoms: 1, sashes: 3 },
      '130':  { mullions: 2, transoms: 0, sashes: 2 },
      '131':  { mullions: 2, transoms: 1, sashes: 3 },
      '132':  { mullions: 2, transoms: 2, sashes: 4 },
      '133':  { mullions: 2, transoms: 3, sashes: 3 },
      '013':  { mullions: 0, transoms: 2, sashes: 1 },
      '023':  { mullions: 1, transoms: 4, sashes: 2 },
      '140L': { mullions: 3, transoms: 0, sashes: 1 },
      '140R': { mullions: 3, transoms: 0, sashes: 1 }
    }
  }
};

// Funkcja do ładowania cen z Supabase
async function loadAdminPricesFromDB() {
  try {
    // Sprawdź czy supabaseClient jest dostępny
    if (!window.supabaseClient) {
      console.warn('Supabase client not available, using default prices');
      return;
    }
    
    const { data, error } = await window.supabaseClient
      .from('pricing_config')
      .select('bar_price, glass_triple_price, glass_passive_price, glass_frosted_price, opening_bottom_price, opening_fixed_price')
      .eq('id', 1)
      .single();
    
    if (error) {
      console.error('Error loading prices from DB:', error);
      return;
    }
    
    if (data) {
      // Bar price
      if (data.bar_price) {
        pricingConfig.barPricing.pricePerBar = parseFloat(data.bar_price);
      }
      
      // Glass triple price
      if (data.glass_triple_price) {
        pricingConfig.additionalOptions.glassTypes.triple = parseFloat(data.glass_triple_price);
      }
      
      // Glass passive price
      if (data.glass_passive_price) {
        pricingConfig.additionalOptions.glassTypes.passive = parseFloat(data.glass_passive_price);
      }
      
      // Frosted price
      if (data.glass_frosted_price) {
        pricingConfig.additionalOptions.glassFinish.frosted = parseFloat(data.glass_frosted_price);
      }
      
      // Opening bottom price
      if (data.opening_bottom_price !== null && data.opening_bottom_price !== undefined) {
        pricingConfig.additionalOptions.openingTypes.bottom = -Math.abs(parseFloat(data.opening_bottom_price));
      }
      
      // Opening fixed price
      if (data.opening_fixed_price !== null && data.opening_fixed_price !== undefined) {
        pricingConfig.additionalOptions.openingTypes.fixed = -Math.abs(parseFloat(data.opening_fixed_price));
      }
    }
  } catch (err) {
    console.error('Error in loadAdminPricesFromDB:', err);
  }
}

// Flag: are DB prices loaded?
window.pricingReady = false;
window.pricingReadyPromise = new Promise(resolve => {
  window._pricingReadyResolve = resolve;
});

// Załaduj ceny z DB gdy supabase będzie gotowy
document.addEventListener('DOMContentLoaded', () => {
  // Poczekaj chwilę na inicjalizację supabase
  setTimeout(async () => {
    await loadAdminPricesFromDB();
    window.pricingReady = true;
    window._pricingReadyResolve();
    // Recalculate price now that DB values are loaded
    if (window.configuratorCore && window.configuratorCore.isInitialized) {
      window.configuratorCore.updateAll();
    }
  }, 100);
});

// Export dla użycia w innych modułach
window.pricingConfig = pricingConfig;
window.loadAdminPricesFromDB = loadAdminPricesFromDB;