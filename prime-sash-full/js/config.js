// Configuration and pricing data
const config = {
 basePrice: 300, // Base price in GBP
 sqmPrice: 150, // Price per square meter
 options: {
 // Frame options
 frame: {
 standard: { name: "Standard Frame (165mm)", priceMultiplier: 1 },
 slim: { name: "Slim Frame (145mm)", priceMultiplier: 1.05 }
 },
 // Glazing options
 glass: {
 double: { name: "Double Glazing", priceMultiplier: 1, uValue: 1.1 },
 triple: { name: "Triple Glazing", priceMultiplier: 1.15, uValue: 0.7 },
 passive: { name: "Passive Glass", priceMultiplier: 1.25, uValue: 0.5 }
 },
 // Opening mechanism options
 opening: {
 both: { name: "Both Sashes Open", priceMultiplier: 1 },
 top: { name: "Top Sash Only", priceMultiplier: 0.95 },
 bottom: { name: "Bottom Sash Only", priceMultiplier: 0.95 },
 fixed: { name: "Fixed Only (Non-opening)", priceMultiplier: 0.9 }
 },
 // Color options
 color: {
 single: { name: "Single Color", priceMultiplier: 1 },
 dual: { name: "Dual Color", priceMultiplier: 1.1 }
 },
 // Georgian bars options
 bars: {
 none: { name: "No Bars", priceMultiplier: 1 },
 "2x2": { name: "2x2 Pattern", priceMultiplier: 1.04 },
 "3x3": { name: "3x3 Pattern", priceMultiplier: 1.06 },
 "4x4": { name: "4x4 Pattern", priceMultiplier: 1.06 },
 "6x6": { name: "6x6 Pattern", priceMultiplier: 1.08 },
 "9x9": { name: "9x9 Pattern", priceMultiplier: 1.12 },
 "2-vertical": { name: "2 Vertical Bars", priceMultiplier: 1.05 },
 "1-vertical": { name: "1 Vertical Bar", priceMultiplier: 1.03 },
 "custom": { name: "Custom Design", priceMultiplier: 1.10 }
 },
 // Glass specification options
 glassSpec: {
 toughened: { name: "Toughened Glass", priceMultiplier: 1 },
 laminated: { name: "Laminated Glass", priceMultiplier: 1.15 }
 },
 // Glass finish options
 glassFinish: {
 clear: { name: "Clear Glass", priceMultiplier: 1 },
 frosted: { name: "Frosted Glass", priceMultiplier: 1.08 }
 },
 // Horn options
 horns: {
 none: { name: "No Horns", priceMultiplier: 1 },
 standard: { name: "Standard Horns", priceMultiplier: 1.03 },
 deep: { name: "Deep Horns", priceMultiplier: 1.05 },
 traditional: { name: "Traditional Horns", priceMultiplier: 1.07 }
 },
 // Ironmongery options
 ironmongery: {
 none: { name: "No Ironmongery", priceMultiplier: 1 },
 black: { name: "Black Ironmongery", priceMultiplier: 1.04 },
 gold: { name: "Gold Ironmongery", priceMultiplier: 1.06 },
 chrome: { name: "Chrome Ironmongery", priceMultiplier: 1.05 }
 }
 }
};

// Export to window
window.config = config;