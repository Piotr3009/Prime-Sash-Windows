class StorageManager {
 constructor() {
 this.keys = {
 savedConfig: 'savedWindowConfig',
 lastConfig: 'lastWindowConfig',
 estimates: 'windowEstimates',
 variants: 'savedWindowVariants'
 };

 this.maxVariants = 3;
 }

 saveConfig(config, key = this.keys.savedConfig) {
 try {
 localStorage.setItem(key, JSON.stringify(config));
 return true;
 } catch (error) {
 console.error('StorageManager: Error saving config:', error);
 return false;
 }
 }

 loadConfig(key = this.keys.savedConfig) {
 try {
 const saved = localStorage.getItem(key);
 return saved ? JSON.parse(saved) : null;
 } catch (error) {
 console.error('StorageManager: Error loading config:', error);
 return null;
 }
 }

 saveLastConfig(config) {
 return this.saveConfig(config, this.keys.lastConfig);
 }

 loadLastConfig() {
 return this.loadConfig(this.keys.lastConfig);
 }

 addToEstimates(config, unitPrice) {
 const estimates = this.getEstimates();

 const newEstimate = {
 ...config,
 unitPrice: unitPrice,
 price: unitPrice * (config.quantity || 1),
 id: Date.now(),
 date: new Date().toISOString()
 };

 estimates.push(newEstimate);

 try {
 localStorage.setItem(this.keys.estimates, JSON.stringify(estimates));
 return newEstimate;
 } catch (error) {
 console.error('StorageManager: Error saving estimate:', error);
 return null;
 }
 }

 getEstimates() {
 try {
 const saved = localStorage.getItem(this.keys.estimates);
 return saved ? JSON.parse(saved) : [];
 } catch (error) {
 console.error('StorageManager: Error loading estimates:', error);
 return [];
 }
 }

 removeEstimate(id) {
 try {
 const estimates = this.getEstimates();
 const filtered = estimates.filter(est => est.id !== id);
 localStorage.setItem(this.keys.estimates, JSON.stringify(filtered));
 return true;
 } catch (error) {
 console.error('StorageManager: Error removing estimate:', error);
 return false;
 }
 }

 clearEstimates() {
 try {
 localStorage.removeItem(this.keys.estimates);
 return true;
 } catch (error) {
 console.error('StorageManager: Error clearing estimates:', error);
 return false;
 }
 }

 saveVariant(config, name, unitPrice) {
 if (!name || name.trim() === '') {
 console.error('StorageManager: Variant name is required');
 return null;
 }

 const variants = this.getVariants();

 // Sprawdź limit
 if (variants.length >= this.maxVariants) {
 const shouldReplace = confirm(
 `You already have ${this.maxVariants} saved variants. ` +
 'Do you want to replace the oldest one?'
 );

 if (!shouldReplace) return null;

 // Usuń najstarszy
 variants.shift();
 }

 const newVariant = {
 ...config,
 name: name.trim(),
 unitPrice: unitPrice,
 price: unitPrice * (config.quantity || 1),
 id: Date.now(),
 date: new Date().toISOString()
 };

 variants.push(newVariant);

 try {
 localStorage.setItem(this.keys.variants, JSON.stringify(variants));
 return newVariant;
 } catch (error) {
 console.error('StorageManager: Error saving variant:', error);
 return null;
 }
 }

 getVariants() {
 try {
 const saved = localStorage.getItem(this.keys.variants);
 return saved ? JSON.parse(saved) : [];
 } catch (error) {
 console.error('StorageManager: Error loading variants:', error);
 return [];
 }
 }

 removeVariant(id) {
 try {
 const variants = this.getVariants();
 const filtered = variants.filter(v => v.id !== id);
 localStorage.setItem(this.keys.variants, JSON.stringify(filtered));
 return true;
 } catch (error) {
 console.error('StorageManager: Error removing variant:', error);
 return false;
 }
 }

 isStorageAvailable() {
 try {
 const test = '__storage_test__';
 localStorage.setItem(test, test);
 localStorage.removeItem(test);
 return true;
 } catch (error) {
 return false;
 }
 }

 exportAllData() {
 return {
 savedConfig: this.loadConfig(),
 lastConfig: this.loadLastConfig(),
 estimates: this.getEstimates(),
 variants: this.getVariants(),
 exportDate: new Date().toISOString()
 };
 }

 importData(data) {
 try {
 if (data.savedConfig) {
 this.saveConfig(data.savedConfig);
 }
 if (data.lastConfig) {
 this.saveLastConfig(data.lastConfig);
 }
 if (data.estimates) {
 localStorage.setItem(this.keys.estimates, JSON.stringify(data.estimates));
 }
 if (data.variants) {
 localStorage.setItem(this.keys.variants, JSON.stringify(data.variants));
 }
 return true;
 } catch (error) {
 console.error('StorageManager: Error importing data:', error);
 return false;
 }
 }

 getStats() {
 return {
 estimatesCount: this.getEstimates().length,
 variantsCount: this.getVariants().length,
 hasLastConfig: !!this.loadLastConfig(),
 hasSavedConfig: !!this.loadConfig(),
 storageUsed: this.getStorageSize()
 };
 }

 getStorageSize() {
 let totalSize = 0;

 Object.keys(this.keys).forEach(key => {
 const data = localStorage.getItem(this.keys[key]);
 if (data) {
 totalSize += data.length;
 }
 });

 // Konwertuj na KB
 const sizeKB = (totalSize / 1024).toFixed(2);
 return `${sizeKB} KB`;
 }
}

// Utwórz globalną instancję
window.storageManager = new StorageManager();

// Sprawdź dostępność przy starcie
if (!window.storageManager.isStorageAvailable()) {
 console.warn('StorageManager: localStorage is not available. Some features may not work.');
}