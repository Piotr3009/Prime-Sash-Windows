class DetailsController {
 constructor() {
 this.init();
 }

 init() {
 // Inicjalizuj po załadowaniu DOM
 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', () => this.setup());
 } else {
 this.setup();
 }
 }

 setup() {
 this.setupCustomDropdowns();
 this.setupGlassCompatibility();
 this.setupModals();
 }

 setupCustomDropdowns() {
 // Horns dropdown
 const hornsDropdown = document.getElementById('horns-dropdown');
 if (hornsDropdown) {
 this.initDropdown(hornsDropdown, 'horns');
 }

 // Ironmongery dropdown
 const ironmongeryDropdown = document.getElementById('ironmongery-dropdown');
 if (ironmongeryDropdown) {
 this.initDropdown(ironmongeryDropdown, 'ironmongery');
 }
 }

 initDropdown(dropdown, type) {
 const selected = dropdown.querySelector('.dropdown-selected');
 const options = dropdown.querySelectorAll('.dropdown-option');
 const hiddenInput = document.getElementById(type);

 // Kliknięcie na selected - otwiera/zamyka dropdown
 selected.addEventListener('click', (e) => {
 e.stopPropagation();

 // Zamknij inne dropdowny
 document.querySelectorAll('.custom-dropdown').forEach(dd => {
 if (dd !== dropdown) {
 dd.classList.remove('open');
 }
 });

 // Toggle obecny dropdown
 dropdown.classList.toggle('open');
 });

 // Kliknięcie na opcję
 options.forEach(option => {
 option.addEventListener('click', (e) => {
 e.stopPropagation();

 const value = option.dataset.value;
 const img = option.querySelector('img').src;
 const text = option.querySelector('span').textContent;

 // Aktualizuj selected
 selected.dataset.value = value;
 selected.querySelector('img').src = img;
 selected.querySelector('span').textContent = text;

 // Aktualizuj hidden input
 if (hiddenInput) {
 hiddenInput.value = value;
 // Wywołaj event change
 hiddenInput.dispatchEvent(new Event('change'));
 }

 // Zaznacz opcję
 options.forEach(opt => opt.classList.remove('selected'));
 option.classList.add('selected');

 // Zamknij dropdown
 dropdown.classList.remove('open');

 // Aktualizuj konfigurację
 if (window.currentConfig) {
 window.currentConfig[type] = value;
 }

 // Aktualizuj cenę i wizualizację
 this.updatePriceAndDetails();
 });
 });

 // Zamknij dropdown przy kliknięciu poza nim
 document.addEventListener('click', (e) => {
 if (!dropdown.contains(e.target)) {
 dropdown.classList.remove('open');
 }
 });
 }

 setupGlassCompatibility() {
 const frameTypeRadios = document.querySelectorAll('input[name="frame-type"]');

 frameTypeRadios.forEach(radio => {
 radio.addEventListener('change', (e) => {
 this.handleFrameGlazingCompatibility(e.target.value);
 });
 });

 // Sprawdź początkowy stan
 const selectedFrameType = document.querySelector('input[name="frame-type"]:checked');
 if (selectedFrameType) {
 this.handleFrameGlazingCompatibility(selectedFrameType.value);
 }
 }

 handleFrameGlazingCompatibility(frameType) {
 const tripleGlazingOption = document.getElementById('triple-glazing')?.closest('.radio-option');
 const tripleGlazingInput = document.getElementById('triple-glazing');
 const doubleGlazingInput = document.getElementById('double-glazing');

 if (!tripleGlazingOption || !tripleGlazingInput) return;

 if (frameType === 'slim') {
 // Ukryj Triple Glazing dla Slim Frame
 tripleGlazingOption.style.display = 'none';

 // Jeśli Triple było wybrane, zmień na Double
 if (tripleGlazingInput.checked) {
 if (doubleGlazingInput) {
 doubleGlazingInput.checked = true;
 }
 if (window.currentConfig) {
 window.currentConfig.glassType = 'double';
 }
 this.updatePriceAndDetails();
 }
 } else {
 // Pokaż Triple Glazing dla Standard Frame
 tripleGlazingOption.style.display = 'block';
 }
 }

 setupModals() {
 // Funkcje globalne dla modali
 window.closeEstimateModal = () => {
 const modal = document.getElementById('estimate-modal');
 if (modal) modal.style.display = 'none';
 };

 window.closePdfModal = () => {
 const modal = document.getElementById('pdf-modal');
 if (modal) modal.style.display = 'none';
 };

 window.proceedToPayment = () => {
 alert('Processing payment... Feature coming soon!');
 window.closeEstimateModal();
 };

 window.downloadEstimatePDF = () => {
 const pdfModal = document.getElementById('pdf-modal');
 if (pdfModal) {
 pdfModal.style.display = 'block';

 // Symulacja generowania PDF
 setTimeout(() => {
 const pdfPreview = document.getElementById('pdf-preview');
 if (pdfPreview) {
 pdfPreview.srcdoc = `
 <html>
 <body style="font-family: Arial, sans-serif; padding: 20px;">
 <h1>Skylon Windows Estimate</h1>
 <p>Your detailed estimate will appear here.</p>
 <p>This is a preview of the PDF generation feature.</p>
 </body>
 </html>
 `;
 }
 }, 300);
 }
 };

 window.downloadPDF = () => {
 alert('PDF download feature is coming soon!');
 window.closePdfModal();
 };
 }

 updatePriceAndDetails() {
 // Aktualizuj cenę
 if (typeof window.updatePrice === 'function') {
 window.updatePrice();
 }

 // Aktualizuj wizualizację
 if (window.visualizationManager && window.currentConfig) {
 window.visualizationManager.update(window.currentConfig);
 }
 }
}

// Inicjalizuj kontroler
const detailsController = new DetailsController();

// Eksportuj do window dla kompatybilności
window.detailsController = detailsController;