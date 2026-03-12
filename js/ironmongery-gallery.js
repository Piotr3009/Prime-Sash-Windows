/**
 * Ironmongery Gallery Overlay
 * Full-screen product selection interface
 */

class IronmongeryGallery {
  constructor() {
    this.overlay = document.getElementById('ironmongeryOverlay');
    this.closeBtn = document.getElementById('galleryClose');
    this.confirmBtn = document.getElementById('confirmSelection');
    this.clearBtn = document.getElementById('clearSelection');
    this.productsGrid = document.getElementById('productsGrid');
    this.totalElement = document.getElementById('selectionTotal');
    
    this.selectedProducts = {}; // ZMIANA: Object zamiast Map, z quantity
    // Format: { category: { product: {...}, quantity: 1 } }
    this.currentCategory = 'locks';
    this.currentFinish = 'all';
    this.currentType = 'standard'; // NEW: standard, pas24, horns
    this.isAdminMode = false;
    
    this.init();
  }

  async init() {
    // Check if user is admin
    if (typeof isAdmin === 'function') {
      this.isAdminMode = await isAdmin();
    }
    
    // Close handlers
    this.closeBtn?.addEventListener('click', () => this.close());
    this.overlay?.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Confirm button
    this.confirmBtn?.addEventListener('click', () => this.confirmSelection());

    // Clear button
    this.clearBtn?.addEventListener('click', () => this.clearSelection());

    // Type selector (NEW)
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.target.dataset.type;
        this.switchType(type);
      });
    });

    // Category tabs
    document.querySelectorAll('.category-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const category = e.target.dataset.category;
        this.switchCategory(category);
      });
    });

    // Finish filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const finish = e.target.dataset.finish;
        this.filterByFinish(finish);
      });
    });
  }
  
  switchType(type) {
    this.currentType = type;
    
    // Update active button
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    
    // Show/hide PAS24 info box based on window PAS24 setting
    const pas24Info = document.getElementById('pas24-info-box');
    if (pas24Info) {
      // Show info when PAS24 window or when viewing PAS24 tab
      pas24Info.style.display = (this.windowRequiresPas24 || type === 'pas24') ? 'block' : 'none';
    }
    
    // Update category tabs visibility
    const categoryTabs = document.querySelectorAll('.category-tab');
    categoryTabs.forEach(tab => {
      const category = tab.dataset.category;
      
      if (type === 'pas24') {
        // PAS24: only locks
        tab.style.display = category === 'locks' ? 'block' : 'none';
        tab.classList.remove('disabled');
        tab.style.opacity = '';
        tab.style.pointerEvents = '';
      } else if (type === 'horns') {
        // Horns: only horns
        tab.style.display = category === 'horns' ? 'block' : 'none';
        tab.classList.remove('disabled');
        tab.style.opacity = '';
        tab.style.pointerEvents = '';
      } else {
        // Standard: all except horns
        tab.style.display = category !== 'horns' ? 'block' : 'none';
        
        // If PAS24 window selected, disable locks category in Standard
        if (this.windowRequiresPas24 && category === 'locks') {
          tab.classList.add('disabled');
          tab.style.opacity = '0.4';
          tab.style.pointerEvents = 'none';
          tab.title = 'PAS24 window selected - please use PAS24 Sash Locks tab';
        } else {
          tab.classList.remove('disabled');
          tab.style.opacity = '';
          tab.style.pointerEvents = '';
          tab.title = '';
        }
      }
    });
    
    // Set default category for type
    if (type === 'pas24') {
      this.switchCategory('locks');
    } else if (type === 'horns') {
      this.switchCategory('horns');
    } else {
      // Standard - if PAS24 window and current category is locks, switch to fingerLifts
      if (this.windowRequiresPas24 && (this.currentCategory === 'locks' || this.currentCategory === 'horns')) {
        this.switchCategory('fingerLifts');
      } else if (this.currentCategory === 'horns') {
        this.switchCategory('locks');
      } else {
        this.renderProducts();
      }
    }
  }

  open() {
    // Reload products from localStorage (in case admin added new products)
    if (window.IronmongeryHelper) {
      IronmongeryHelper.loadProductsFromStorage();
    }
    
    this.overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Check if window requires PAS24
    this.windowRequiresPas24 = window.currentConfig?.pas24 === 'yes';
    console.log('🔐 Window requires PAS24:', this.windowRequiresPas24);
    
    // Update type-selector based on window PAS24 setting
    const standardBtn = document.querySelector('.type-btn[data-type="standard"]');
    const pas24InfoBox = document.getElementById('pas24-info-box');
    
    if (this.windowRequiresPas24) {
      // Standard button stays visible - user needs access to Finger Lifts, Pull Handles, Stoppers
      // Only Sash Lock category will be disabled in Standard view
      if (pas24InfoBox) {
        pas24InfoBox.innerHTML = '<p>🔒 <strong>PAS24 Window Selected</strong> - Standard Sash Locks are not available. Please select a PAS24 certified Sash Lock. Other hardware (Finger Lifts, Pull Handles, Stoppers) are available in Standard.</p>';
        pas24InfoBox.style.display = 'block';
      }
    } else {
      // Reset info box to default message
      if (pas24InfoBox) {
        pas24InfoBox.innerHTML = '<p>⚠️ For PAS24 certified windows, select Sash Lock here. For other hardware (Finger Lifts, Pull Handles, Stoppers) please choose from <strong>Standard</strong> list.</p>';
        pas24InfoBox.style.display = 'none';
      }
    }
    
    // Load current selections from configurator
    this.loadCurrentSelections();
    
    // Always start with Standard view - user can switch to PAS24 if needed
    this.switchType('standard');
    
    // Render products
    this.renderProducts();
  }

  close() {
    this.overlay?.classList.remove('active');
    document.body.style.overflow = '';
  }

  loadCurrentSelections() {
    // Load from configurator state - POPRAWKA: window.currentConfig
    if (window.currentConfig?.ironmongery) {
      const ironmongery = window.currentConfig.ironmongery;
      
      // Map existing selections with quantity
      if (ironmongery.lock) {
        this.selectedProducts['locks'] = {
          product: ironmongery.lock,
          quantity: ironmongery.lock.quantity || 1
        };
      }
      if (ironmongery.fingerLift) {
        this.selectedProducts['fingerLifts'] = {
          product: ironmongery.fingerLift,
          quantity: ironmongery.fingerLift.quantity || 2 // Domyślnie 2 lifts
        };
      }
      if (ironmongery.horns) {
        this.selectedProducts['horns'] = {
          product: ironmongery.horns,
          quantity: ironmongery.horns.quantity || 2 // Domyślnie 2 horns
        };
      }
      if (ironmongery.pullHandles) {
        this.selectedProducts['pullHandles'] = {
          product: ironmongery.pullHandles,
          quantity: ironmongery.pullHandles.quantity || 1
        };
      }
      if (ironmongery.stoppers) {
        this.selectedProducts['stoppers'] = {
          product: ironmongery.stoppers,
          quantity: ironmongery.stoppers.quantity || 2 // Domyślnie 2 stoppers
        };
      }
    }
  }

  switchCategory(category) {
    this.currentCategory = category;
    
    // Update tab active state
    document.querySelectorAll('.category-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.category === category);
    });
    
    this.renderProducts();
  }

  filterByFinish(finish) {
    this.currentFinish = finish;
    
    // Update filter active state
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.finish === finish);
    });
    
    this.renderProducts();
  }

  renderProducts() {
    if (!this.productsGrid) return;
    
    const categoryData = IRONMONGERY_DATA.categories[this.currentCategory];
    if (!categoryData) return;

    let products = categoryData.products;

    // Filter by finish if not 'all'
    if (this.currentFinish !== 'all') {
      products = products.filter(p => 
        p.color?.toLowerCase() === this.currentFinish.toLowerCase()
      );
    }
    
    // Filter by PAS24 type (only for locks category)
    if (this.currentCategory === 'locks') {
      if (this.windowRequiresPas24 && this.currentType === 'standard') {
        // Window has PAS24 = YES, user in Standard → block, show message
        this.productsGrid.innerHTML = `
          <div class="no-products-message" style="
            text-align: center;
            padding: 60px 20px;
            color: #666;
          ">
            <div style="font-size: 3rem; margin-bottom: 15px;">🔒</div>
            <h3 style="color: #333; margin-bottom: 10px;">PAS24 Window Selected</h3>
            <p style="margin: 0;">
              Standard Sash Locks are not available for PAS24 windows.<br>
              Please select a <strong>PAS24 Sash Lock</strong> from the PAS24 tab.
            </p>
          </div>
        `;
        return;
      } else if (this.currentType === 'pas24') {
        // PAS24 section → show only PAS24 locks
        products = products.filter(p => p.is_pas24 === true || p.isPAS24 === true);
      }
      // Standard section with PAS24 = NO → show all locks (no filter)
    }

    // Group products by category (dla wyświetlania w kolumnach)
    const productsByCategory = {};
    
    // Dla aktualnej kategorii - pokaż wszystkie produkty
    if (!productsByCategory[this.currentCategory]) {
      productsByCategory[this.currentCategory] = [];
    }
    productsByCategory[this.currentCategory] = products;

    // Render w kolumnach
    let html = '';
    
    // Check if products is empty
    if (products.length === 0) {
      html = `
        <div class="no-products-message" style="
          text-align: center;
          padding: 60px 20px;
          color: #666;
        ">
          <div style="font-size: 3rem; margin-bottom: 15px;">📦</div>
          <h3 style="color: #333; margin-bottom: 10px;">No products available</h3>
          <p style="margin: 0;">
            ${this.currentType === 'standard' && this.currentCategory === 'locks' 
              ? 'Standard Sash Locks not yet added. Please add them in Admin Panel or use PAS24 locks.' 
              : 'No products match your current filters.'}
          </p>
        </div>
      `;
      this.productsGrid.innerHTML = html;
      return;
    }
    
    for (const [category, categoryProducts] of Object.entries(productsByCategory)) {
      if (categoryProducts.length === 0) continue;
      
      const categoryName = IRONMONGERY_DATA.categories[category]?.name || category;
      
      html += `
        <div class="category-products-column">
          <h4>${categoryName}</h4>
          <div class="category-products-row">
            ${categoryProducts.map(product => this.renderProductCard(product)).join('')}
          </div>
        </div>
      `;
    }

    this.productsGrid.innerHTML = html;

    // Add click handlers
    this.productsGrid.querySelectorAll('.product-card').forEach(card => {
      // Add button
      const addBtn = card.querySelector('.add-btn[data-action="add"]');
      if (addBtn) {
        addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const productId = card.dataset.productId;
          this.toggleProduct(productId, 'select');
        });
      }
      
      // Quantity buttons
      const minusBtn = card.querySelector('.qty-btn[data-action="minus"]');
      const plusBtn = card.querySelector('.qty-btn[data-action="plus"]');
      
      if (minusBtn) {
        minusBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const productId = card.dataset.productId;
          this.toggleProduct(productId, 'minus');
        });
      }
      
      if (plusBtn) {
        plusBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const productId = card.dataset.productId;
          this.toggleProduct(productId, 'plus');
        });
      }
      
      // Card click (select/deselect)
      card.addEventListener('click', (e) => {
        // Jeśli kliknięto zdjęcie - powiększ
        if (e.target.classList.contains('product-card-image')) {
          this.zoomImage(e.target.src);
          return;
        }
        
        // Jeśli kliknięto quantity button lub add button - nie toggleuj
        if (e.target.classList.contains('qty-btn') || e.target.classList.contains('add-btn')) {
          return;
        }
        
        const productId = card.dataset.productId;
        this.toggleProduct(productId, 'select');
      });
    });

    this.updateTotal();
  }

  renderProductCard(product) {
    const selection = this.selectedProducts[this.currentCategory];
    const isSelected = selection?.product?.id === product.id;
    const quantity = isSelected ? selection.quantity : 0;
    const price = product.price_net || product.price || 0;
    
    // Check if product should show "Recommended" badge
    const isPas24Product = product.is_pas24 === true || product.isPAS24 === true;
    const showRecommendedBadge = !this.windowRequiresPas24 && 
                                  this.currentCategory === 'locks' && 
                                  isPas24Product;
    
    // Admin buttons
    const adminButtons = this.isAdminMode ? `
      <div class="admin-actions" style="position: absolute; top: 3px; right: 3px; display: flex; gap: 3px; z-index: 10;">
        <button onclick="event.stopPropagation(); window.IronmongeryGallery.editProduct('${product.id}')" 
                class="btn-admin-edit" 
                style="padding: 3px 6px; background: #ffc107; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.7rem;">
          ✏️
        </button>
        <button onclick="event.stopPropagation(); window.IronmongeryGallery.deleteProduct('${product.id}')" 
                class="btn-admin-delete"
                style="padding: 3px 6px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.7rem;">
          🗑️
        </button>
      </div>
    ` : '';
    
    // Recommended badge for PAS24 locks when window doesn't require PAS24
    const recommendedBadge = showRecommendedBadge ? `
      <div class="recommended-badge" style="
        position: absolute;
        top: 5px;
        left: 5px;
        background: #28a745;
        color: white;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 600;
        z-index: 5;
      ">⭐ Recommended</div>
    ` : '';
    
    return `
      <div class="product-card ${isSelected ? 'selected' : ''}" 
           data-product-id="${product.id}">
        ${adminButtons}
        ${recommendedBadge}
        <img src="${product.image || product.image_url || 'img/placeholder-ironmongery.jpg'}" 
             alt="${product.name}"
             class="product-card-image"
             title="Click to zoom"
             onerror="this.src='img/placeholder-ironmongery.jpg'">
        <div class="product-card-name">${product.name}</div>
        <div class="product-card-price">£${price.toFixed(2)}</div>
        ${isSelected ? `
          <div class="quantity-controls" style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px;">
            <button class="qty-btn" data-action="minus" style="width: 28px; height: 28px; border: 1px solid var(--primary-color); background: white; color: var(--primary-color); border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 16px;">−</button>
            <span class="qty-display" style="min-width: 30px; text-align: center; font-weight: 600; color: var(--primary-color);">${quantity}</span>
            <button class="qty-btn" data-action="plus" style="width: 28px; height: 28px; border: 1px solid var(--primary-color); background: var(--primary-color); color: white; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 16px;">+</button>
          </div>
        ` : `
          <button class="add-btn" data-action="add" style="
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            width: 100%;
            margin-top: 10px;
            padding: 8px 12px;
            background: var(--primary-color);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: background 0.2s;
          ">
            <span style="font-size: 14px;">+</span> Add
          </button>
        `}
      </div>
    `;
  }

  toggleProduct(productId, action = 'select') {
    const categoryData = IRONMONGERY_DATA.categories[this.currentCategory];
    const product = categoryData.products.find(p => p.id === productId);
    
    if (!product) return;

    const currentSelection = this.selectedProducts[this.currentCategory];
    
    if (action === 'select') {
      // Toggle selection
      if (currentSelection?.product?.id === productId) {
        // Deselect
        delete this.selectedProducts[this.currentCategory];
      } else {
        // Select z domyślną ilością
        const defaultQty = (this.currentCategory === 'fingerLifts' || 
                           this.currentCategory === 'stoppers' || 
                           this.currentCategory === 'horns') ? 2 : 1;
        
        this.selectedProducts[this.currentCategory] = {
          product: product,
          quantity: defaultQty
        };
      }
    } else if (action === 'plus') {
      if (currentSelection) {
        currentSelection.quantity++;
      }
    } else if (action === 'minus') {
      if (currentSelection) {
        currentSelection.quantity--;
        if (currentSelection.quantity <= 0) {
          delete this.selectedProducts[this.currentCategory];
        }
      }
    }

    this.renderProducts();
  }

  updateTotal() {
    let total = 0;
    
    Object.values(this.selectedProducts).forEach(selection => {
      const price = selection.product.price_net || selection.product.price || 0;
      total += price * selection.quantity;
    });

    if (this.totalElement) {
      this.totalElement.textContent = `£${total.toFixed(2)}`;
    }

    // Render selected items preview
    this.renderSelectedItemsPreview();

    // Enable/disable confirm button
    if (this.confirmBtn) {
      this.confirmBtn.disabled = Object.keys(this.selectedProducts).length === 0;
    }
  }

  renderSelectedItemsPreview() {
    const previewContainer = document.getElementById('selectedItemsPreview');
    if (!previewContainer) return;

    const selectedEntries = Object.entries(this.selectedProducts);
    
    if (selectedEntries.length === 0) {
      previewContainer.innerHTML = '<span style="color: #888; font-size: 0.85rem;">No items selected</span>';
      return;
    }

    const html = selectedEntries.map(([category, selection]) => {
      const product = selection.product;
      const qty = selection.quantity;
      const price = (product.price_net || product.price || 0) * qty;
      const imgSrc = product.image || product.image_url || 'img/placeholder-ironmongery.jpg';
      
      return `
        <div class="selected-item-mini" style="
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          background: #f5f5f5;
          border-radius: 6px;
          font-size: 0.8rem;
        ">
          <img src="${imgSrc}" alt="${product.name}" style="width: 35px; height: 35px; object-fit: contain; border-radius: 4px; background: white;">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${product.name}</div>
            <div style="color: #666;">×${qty} = £${price.toFixed(2)}</div>
          </div>
        </div>
      `;
    }).join('');

    previewContainer.innerHTML = html;
    previewContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;';
  }

  zoomImage(imageSrc) {
    // Utwórz modal do powiększenia
    const modal = document.createElement('div');
    modal.className = 'image-zoom-modal active';
    modal.innerHTML = `<img src="${imageSrc}" alt="Zoomed product">`;
    
    // Zamknij po kliknięciu
    modal.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    document.body.appendChild(modal);
  }

  clearSelection() {
    // Wyczyść wszystkie wybory
    this.selectedProducts = {};
    
    // Usuń zaznaczenie z kart produktów
    document.querySelectorAll('.product-card.selected').forEach(card => {
      card.classList.remove('selected');
      // Reset quantity controls
      const controls = card.querySelector('.quantity-controls');
      if (controls) {
        controls.innerHTML = `<button class="btn-add">+ Add</button>`;
      }
    });
    
    // Zaktualizuj total i preview
    this.updateTotal();
    
    console.log('🗑️ Selection cleared');
  }

  confirmSelection() {
    // Convert to ironmongery format with quantity
    const ironmongery = {
      lock: this.selectedProducts['locks'] ? {
        ...this.selectedProducts['locks'].product,
        quantity: this.selectedProducts['locks'].quantity
      } : null,
      fingerLift: this.selectedProducts['fingerLifts'] ? {
        ...this.selectedProducts['fingerLifts'].product,
        quantity: this.selectedProducts['fingerLifts'].quantity
      } : null,
      horns: this.selectedProducts['horns'] ? {
        ...this.selectedProducts['horns'].product,
        quantity: this.selectedProducts['horns'].quantity
      } : null,
      pullHandles: this.selectedProducts['pullHandles'] ? {
        ...this.selectedProducts['pullHandles'].product,
        quantity: this.selectedProducts['pullHandles'].quantity
      } : null,
      stoppers: this.selectedProducts['stoppers'] ? {
        ...this.selectedProducts['stoppers'].product,
        quantity: this.selectedProducts['stoppers'].quantity
      } : null
    };

    console.log('✅ Confirm Selection - saving ironmongery:', ironmongery);

    // Save to configurator - POPRAWKA: window.currentConfig zamiast ConfiguratorCore.currentWindow
    if (!window.currentConfig) window.currentConfig = {};
    window.currentConfig.ironmongery = ironmongery;
    console.log('✅ Saved to currentConfig:', window.currentConfig.ironmongery);
    
    // DEBUG: Sprawdź czy to samo co zapisaliśmy
    console.log('🔍 Verify immediately:', window.currentConfig.ironmongery);

    // Update display on main page
    this.updateMainPageDisplay();

    // NOWE: Wywołaj przeliczenie CENY
    if (typeof window.updatePrice === 'function') {
      console.log('💰 Recalculating price...');
      window.updatePrice();
    }

    // Wywołaj applyDetails (specyfikacja)
    if (window.SpecificationController) {
      console.log('📋 Before applyDetails, currentConfig is:', window.currentConfig);
      console.log('📋 Calling applyDetails with:', window.currentConfig.ironmongery);
      window.SpecificationController.applyDetails();
    }
    
    this.close();
  }

  updateMainPageDisplay() {
    const displayContainer = document.getElementById('ironmongery-selection-display');
    const gridContainer = document.getElementById('selected-products-grid');
    const totalElement = document.getElementById('ironmongery-total');

    if (!displayContainer || !gridContainer || !totalElement) return;

    // Count items
    const itemCount = Object.keys(this.selectedProducts).length;

    // If no products selected, hide the display
    if (itemCount === 0) {
      displayContainer.style.display = 'none';
      return;
    }

    // Show the display
    displayContainer.style.display = 'block';

    // Generate miniatures
    let html = '';
    let total = 0;

    Object.entries(this.selectedProducts).forEach(([category, selection]) => {
      const product = selection.product;
      const quantity = selection.quantity;
      const price = product.price_net || product.price || 0;
      const itemTotal = price * quantity;
      total += itemTotal;

      const categoryName = {
        locks: 'Lock',
        fingerLifts: 'Lifts',
        pullHandles: 'Handle',
        stoppers: 'Stopper',
        horns: 'Horns'
      }[category] || category;

      html += `
        <div style="text-align: center; padding: 8px; background: white; border-radius: 6px; border: 1px solid #e0e0e0;">
          <img src="${product.image || product.image_url || 'img/placeholder-ironmongery.jpg'}" 
               alt="${product.name}"
               style="width: 100%; height: 60px; object-fit: cover; border-radius: 4px; margin-bottom: 5px;"
               onerror="this.src='img/placeholder-ironmongery.jpg'">
          <div style="font-size: 0.75rem; color: #666; margin-bottom: 3px;">${categoryName} (${quantity}x)</div>
          <div style="font-size: 0.85rem; font-weight: 600; color: var(--primary-color);">£${itemTotal.toFixed(2)}</div>
        </div>
      `;
    });

    gridContainer.innerHTML = html;
    totalElement.textContent = `£${total.toFixed(2)}`;
    
    // PREVIEW pod przyciskiem (Gemini style)
    const previewElement = document.getElementById('ironmongery-summary-preview');
    if (previewElement) {
      previewElement.textContent = `Selected: ${itemCount} items (+£${total.toFixed(2)})`;
      previewElement.style.color = 'var(--primary-color)';
      previewElement.style.fontWeight = '600';
    }
  }

  // ==========================================
  // ADMIN FUNCTIONS
  // ==========================================

  async addProduct() {
    // Open modal with form
    const modal = this.createProductModal();
    document.body.appendChild(modal);
  }

  async editProduct(productId) {
    console.log('Edit product:', productId);
    const categoryData = IRONMONGERY_DATA.categories[this.currentCategory];
    const product = categoryData.products.find(p => p.id === productId);
    
    if (!product) return;
    
    // Open modal with form pre-filled
    const modal = this.createProductModal(product);
    document.body.appendChild(modal);
  }

  async deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    console.log('Delete product:', productId);
    
    try {
      // 1. Get product to have image_url
      const { data: product, error: fetchError } = await window.supabaseClient
        .from('ironmongery_products')
        .select('image_url')
        .eq('id', productId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // 2. Delete image from bucket if exists
      if (product?.image_url && product.image_url.includes('ironmongery-images')) {
        const fileName = product.image_url.split('/').pop();
        if (fileName) {
          const { error: storageError } = await window.supabaseClient.storage
            .from('ironmongery-images')
            .remove([fileName]);
          
          if (storageError) {
            console.warn('Could not delete image from storage:', storageError);
          } else {
            console.log('Image deleted from bucket:', fileName);
          }
        }
      }
      
      // 3. Delete from DB
      const { error } = await window.supabaseClient
        .from('ironmongery_products')
        .delete()
        .eq('id', productId);
      
      if (error) throw error;
      
      alert('Product deleted successfully!');
      
      // Reload products
      await this.loadProductsFromDatabase();
      this.renderProducts();
      
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error deleting product: ' + error.message);
    }
  }

  createProductModal(existingProduct = null) {
    const isEdit = !!existingProduct;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      z-index: 20000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 30px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto;">
        <h2 style="margin: 0 0 20px 0;">${isEdit ? 'Edit' : 'Add New'} Product</h2>
        
        <form id="productForm" style="display: flex; flex-direction: column; gap: 15px;">
          
          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Category *</label>
            <select id="gallery-product-category" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
              <option value="locks">Sash Locks</option>
              <option value="fingerLifts">Finger Lifts</option>
              <option value="pullHandles">Pull Handles</option>
              <option value="stoppers">Stoppers</option>
              <option value="horns">Sash Horns</option>
            </select>
          </div>

          <!-- PAS24 Checkbox - only for locks -->
          <div id="pas24-field" style="display: none; background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #ddd;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 600;">
              <input type="checkbox" id="gallery-product-pas24" style="width: 20px; height: 20px;">
              <span>PAS24 Certified Lock</span>
            </label>
            <p style="margin: 8px 0 0 30px; font-size: 0.85rem; color: #666;">
              Check this if the lock is PAS24 certified for enhanced security windows.
            </p>
          </div>

          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Product Name *</label>
            <input type="text" id="gallery-product-name" required 
                   placeholder="e.g. Sash Lock PAS24"
                   style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
          </div>

          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Color</label>
            <select id="gallery-product-color" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
              <option value="">-- No Color --</option>
              <option value="chrome">Chrome</option>
              <option value="satin">Satin</option>
              <option value="brass">Brass</option>
              <option value="antique-brass">Antique Brass</option>
              <option value="black">Black</option>
              <option value="white">White</option>
            </select>
          </div>

          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Price (£) *</label>
            <input type="number" id="gallery-product-price" required step="0.01" min="0"
                   placeholder="e.g. 25.00"
                   style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
          </div>

          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Image</label>
            <input type="file" id="gallery-product-image" accept="image/*"
                   style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
          </div>

          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Description</label>
            <textarea id="gallery-product-description" rows="3"
                      style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;"></textarea>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button type="submit" class="btn" 
                    style="flex: 1; padding: 12px; background: var(--primary-color); color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
              ${isEdit ? 'Update' : 'Add'} Product
            </button>
            <button type="button" class="btn-cancel"
                    style="flex: 1; padding: 12px; background: #6c757d; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
              Cancel
            </button>
          </div>
        </form>
      </div>
    `;
    
    // Handle category change - show/hide PAS24 field
    const categorySelect = modal.querySelector('#gallery-product-category');
    const pas24Field = modal.querySelector('#pas24-field');
    
    const updatePas24Visibility = () => {
      pas24Field.style.display = categorySelect.value === 'locks' ? 'block' : 'none';
    };
    
    categorySelect.addEventListener('change', updatePas24Visibility);
    
    // Handle form submission
    const form = modal.querySelector('#productForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveProduct(existingProduct?.id, modal);
    });
    
    // Set default values AFTER modal is in DOM
    if (!existingProduct) {
      // New product - set defaults
      modal.querySelector('#gallery-product-category').value = 'locks';
      updatePas24Visibility();
    } else {
      // Edit product - populate values
      if (existingProduct.category) modal.querySelector('#gallery-product-category').value = existingProduct.category;
      updatePas24Visibility();
      if (existingProduct.is_pas24 || existingProduct.isPAS24) {
        modal.querySelector('#gallery-product-pas24').checked = true;
      }
      if (existingProduct.name) modal.querySelector('#gallery-product-name').value = existingProduct.name;
      if (existingProduct.color) modal.querySelector('#gallery-product-color').value = existingProduct.color;
      if (existingProduct.price || existingProduct.price_net) {
        modal.querySelector('#gallery-product-price').value = existingProduct.price || existingProduct.price_net;
      }
      if (existingProduct.description) modal.querySelector('#gallery-product-description').value = existingProduct.description;
    }
    
    // Handle cancel
    modal.querySelector('.btn-cancel').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
    
    return modal;
  }

  async saveProduct(existingId, modal) {
    // Debug - check if elements exist
    const categoryEl = document.getElementById('gallery-product-category');
    const nameEl = document.getElementById('gallery-product-name');
    const colorEl = document.getElementById('gallery-product-color');
    const priceEl = document.getElementById('gallery-product-price');
    
    console.log('🔍 Form elements check:');
    console.log('  category element:', categoryEl, 'value:', categoryEl?.value);
    console.log('  name element:', nameEl, 'value:', nameEl?.value);
    console.log('  color element:', colorEl, 'value:', colorEl?.value);
    console.log('  price element:', priceEl, 'value:', priceEl?.value);
    
    // Validation
    const priceInput = document.getElementById('gallery-product-price');
    const price = parseFloat(priceInput.value);
    
    if (isNaN(price) || price <= 0) {
      alert('Please enter a valid price!');
      priceInput.focus();
      return;
    }
    
    const formData = {
      category: document.getElementById('gallery-product-category').value,
      name: document.getElementById('gallery-product-name').value,
      color: document.getElementById('gallery-product-color').value || null,
      price_net: price,
      price_vat: price,
      description: document.getElementById('gallery-product-description').value || null,
      is_pas24: document.getElementById('gallery-product-pas24')?.checked || false
    };
    
    console.log('💾 Saving product with data:', formData);
    console.log('🔌 Supabase client exists:', !!window.supabaseClient);
    
    try {
      // Handle image upload
      const imageFile = document.getElementById('gallery-product-image').files[0];
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
          .from('ironmongery-images')
          .upload(fileName, imageFile);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = window.supabaseClient.storage
          .from('ironmongery-images')
          .getPublicUrl(fileName);
        
        formData.image_url = publicUrl;
      }
      
      // Save to Supabase
      if (existingId) {
        // Update
        const { error } = await window.supabaseClient
          .from('ironmongery_products')
          .update(formData)
          .eq('id', existingId);
        
        if (error) throw error;
        alert('Product updated successfully!');
      } else {
        // Insert
        const { error } = await window.supabaseClient
          .from('ironmongery_products')
          .insert([formData]);
        
        if (error) throw error;
        alert('Product added successfully!');
      }
      
      // Close modal
      document.body.removeChild(modal);
      
      // Reload products
      await this.loadProductsFromDatabase();
      console.log('🔍 Products in current category:', this.currentCategory, IRONMONGERY_DATA.categories[this.currentCategory]?.products);
      this.renderProducts();
      
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error saving product: ' + error.message);
    }
  }

  async loadProductsFromDatabase() {
    try {
      const { data, error } = await window.supabaseClient
        .from('ironmongery_products')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      console.log('📦 Raw data from DB:', data);
      
      // Clear existing products
      Object.keys(IRONMONGERY_DATA.categories).forEach(key => {
        IRONMONGERY_DATA.categories[key].products = [];
      });
      
      // Group by category
      data.forEach(product => {
        console.log('📌 Processing product:', product.name, 'category:', product.category);
        if (IRONMONGERY_DATA.categories[product.category]) {
          IRONMONGERY_DATA.categories[product.category].products.push(product);
          console.log('✅ Added to category:', product.category);
        } else {
          console.log('❌ Category not found:', product.category);
        }
      });
      
      console.log('Loaded products from database:', data.length);
      console.log('📊 Products by category:', Object.keys(IRONMONGERY_DATA.categories).map(key => 
        `${key}: ${IRONMONGERY_DATA.categories[key].products.length}`
      ));
      
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  window.IronmongeryGallery = new IronmongeryGallery();
});

// Function to open gallery (called from configurator)
async function openIronmongeryGallery() {
  if (!window.IronmongeryGallery) {
    window.IronmongeryGallery = new IronmongeryGallery();
  }
  
  // Load products from database
  await window.IronmongeryGallery.loadProductsFromDatabase();
  window.IronmongeryGallery.open();
}

// Function to open gallery in manager mode (called from admin panel)
async function openIronmongeryManager() {
  if (!window.IronmongeryGallery) {
    window.IronmongeryGallery = new IronmongeryGallery();
  }
  
  window.IronmongeryGallery.isAdminMode = true;
  await window.IronmongeryGallery.loadProductsFromDatabase();
  window.IronmongeryGallery.open();
  
  // Add "Add Product" button in gallery header
  const header = document.querySelector('.gallery-header');
  if (header && !document.getElementById('btn-add-product')) {
    const addBtn = document.createElement('button');
    addBtn.id = 'btn-add-product';
    addBtn.textContent = '+ Add New Product';
    addBtn.style.cssText = 'padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; margin-left: 20px;';
    addBtn.onclick = () => window.IronmongeryGallery.addProduct();
    header.appendChild(addBtn);
  }
}