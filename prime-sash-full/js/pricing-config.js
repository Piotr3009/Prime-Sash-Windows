// pricing-config.js - Zaawansowana konfiguracja cennika
const pricingConfig = {
  // Cena bazowa za m²
  basePricePerSqm: 800,
  
  // Mnożniki degresywne - im większe okno, tym taniej za m²
  sizeMultipliers: [
    { maxSqm: 0.6, multiplier: 1.25 },   // małe okna +25%
    { maxSqm: 1.0, multiplier: 1.0 },    // bazowa cena
    { maxSqm: 1.5, multiplier: 0.95 },   // -5%
    { maxSqm: 2.0, multiplier: 0.9 },    // -10%
    { maxSqm: 3.0, multiplier: 0.85 },   // -15%
    { maxSqm: 999, multiplier: 0.8 }     // duże okna -20%
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
      'slim': 100         // +100£ za slim frame
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
      'laminated': 30     // +30£ za m² (mnożone przez powierzchnię)
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
      'single': 0,        // bazowe
      'dual': 0.10        // +10% od ceny bazowej
    },
    
    // Color surcharges (based on color choice)
    colorSurcharges: {
      'white': 0,         // Pure White - bez dopłaty
      'oak': 0.20,        // Oak - +20%
      'custom': 0.10,     // Custom Color - +10%
      'other': 0.05       // Inne kolory - +5%
    },
    
    // Security
    pas24: {
      'no': 0,
      'yes': 0            // PAS24 w cenie okna
    }
  },
  
  // Rabaty ilościowe
  quantityDiscounts: [
    { minQty: 1, discount: 0 },      // 1-5 okna: 0%
    { minQty: 6, discount: 0.05 },   // 6-11 okien: -5%
    { minQty: 12, discount: 0.10 },  // 12-23 okien: -10%
    { minQty: 24, discount: 0.15 }   // 24+ okien: -15%
  ],
  
  // VAT
  vatRate: 0.20  // 20% VAT
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
        console.log('Loaded bar price from DB:', data.bar_price);
      }
      
      // Glass triple price
      if (data.glass_triple_price) {
        pricingConfig.additionalOptions.glassTypes.triple = parseFloat(data.glass_triple_price);
        console.log('Loaded triple glass price from DB:', data.glass_triple_price);
      }
      
      // Glass passive price
      if (data.glass_passive_price) {
        pricingConfig.additionalOptions.glassTypes.passive = parseFloat(data.glass_passive_price);
        console.log('Loaded passive glass price from DB:', data.glass_passive_price);
      }
      
      // Frosted price
      if (data.glass_frosted_price) {
        pricingConfig.additionalOptions.glassFinish.frosted = parseFloat(data.glass_frosted_price);
        console.log('Loaded frosted price from DB:', data.glass_frosted_price);
      }
      
      // Opening bottom price
      if (data.opening_bottom_price !== null && data.opening_bottom_price !== undefined) {
        pricingConfig.additionalOptions.openingTypes.bottom = -Math.abs(parseFloat(data.opening_bottom_price));
        console.log('Loaded opening bottom price from DB:', data.opening_bottom_price);
      }
      
      // Opening fixed price
      if (data.opening_fixed_price !== null && data.opening_fixed_price !== undefined) {
        pricingConfig.additionalOptions.openingTypes.fixed = -Math.abs(parseFloat(data.opening_fixed_price));
        console.log('Loaded opening fixed price from DB:', data.opening_fixed_price);
      }
      
      console.log('All prices loaded from DB successfully');
    }
  } catch (err) {
    console.error('Error in loadAdminPricesFromDB:', err);
  }
}

// Załaduj ceny z DB gdy supabase będzie gotowy
document.addEventListener('DOMContentLoaded', () => {
  // Poczekaj chwilę na inicjalizację supabase
  setTimeout(() => {
    loadAdminPricesFromDB();
  }, 100);
});

// Export dla użycia w innych modułach
window.pricingConfig = pricingConfig;
window.loadAdminPricesFromDB = loadAdminPricesFromDB;