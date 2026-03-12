// Admin Controller
const AdminController = {
  // Cached pricing config
  pricingConfig: null,

  init: async function() {
    console.log('Admin Controller initialized');
    await this.loadAllData();
    this.setupEventListeners();
    await this.renderIronmongeryTable();
    this.renderHornsGrid();
  },

  setupEventListeners: function() {
    // Product category change - show/hide stopper type
    const categorySelect = document.getElementById('product-category');
    if (categorySelect) {
      categorySelect.addEventListener('change', (e) => {
        const stopperTypeGroup = document.getElementById('stopper-type-group');
        if (e.target.value === 'stoppers') {
          stopperTypeGroup.style.display = 'block';
        } else {
          stopperTypeGroup.style.display = 'none';
        }
      });
    }

    // Add product form
    const addProductForm = document.getElementById('add-product-form');
    if (addProductForm) {
      addProductForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addProduct();
      });
    }

    // Add horn form
    const addHornForm = document.getElementById('add-horn-form');
    if (addHornForm) {
      addHornForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addHorn();
      });
    }
  },

  // Load all saved data from Supabase
  loadAllData: async function() {
    try {
      // Load pricing config from DB
      const { data, error } = await window.supabaseClient
        .from('pricing_config')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error) {
        console.error('Error loading pricing config:', error);
        return;
      }
      
      this.pricingConfig = data;
      console.log('Loaded pricing config from DB:', data);
      
      // Fill form fields
      if (data.bar_price) {
        document.getElementById('bar-price').value = data.bar_price;
      }
      if (data.glass_triple_price) {
        document.getElementById('triple-price').value = data.glass_triple_price;
      }
      if (data.glass_passive_price) {
        document.getElementById('passive-price').value = data.glass_passive_price;
      }
      if (data.glass_frosted_price) {
        document.getElementById('frosted-price').value = data.glass_frosted_price;
      }
      
      // Opening prices (zapisane jako wartości dodatnie, wyświetlane jako rabat)
      if (data.opening_bottom_price !== null && data.opening_bottom_price !== undefined) {
        const bottomInput = document.getElementById('bottom-base');
        if (bottomInput) bottomInput.value = Math.abs(data.opening_bottom_price);
      }
      if (data.opening_fixed_price !== null && data.opening_fixed_price !== undefined) {
        const fixedInput = document.getElementById('both-base');
        if (fixedInput) fixedInput.value = Math.abs(data.opening_fixed_price);
      }
      
    } catch (err) {
      console.error('Error in loadAllData:', err);
    }
  },

  // Save price to DB
  async updatePricingConfig(updates) {
    try {
      const { error } = await window.supabaseClient
        .from('pricing_config')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', 1);
      
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error updating pricing config:', err);
      alert('Error saving to database: ' + err.message);
      return false;
    }
  },

  // SECTION 2: Bars Price
  saveBarsPrice: async function() {
    const price = parseFloat(document.getElementById('bar-price').value);
    if (!price || price <= 0) {
      alert('Please enter a valid price');
      return;
    }
    
    const success = await this.updatePricingConfig({ bar_price: price });
    if (success) {
      alert('Bars price saved successfully!');
    }
  },

  // SECTION 5: Glass Prices
  saveGlassPrices: async function() {
    const triple = parseFloat(document.getElementById('triple-price').value);
    const passive = parseFloat(document.getElementById('passive-price').value);
    
    if (!triple || !passive || triple <= 0 || passive <= 0) {
      alert('Please enter valid prices for both glass types');
      return;
    }

    const success = await this.updatePricingConfig({ 
      glass_triple_price: triple,
      glass_passive_price: passive
    });
    if (success) {
      alert('Glass prices saved successfully!');
    }
  },

  // SECTION 6: Opening Prices
  saveOpeningPrices: async function() {
    const bottomPrice = parseFloat(document.getElementById('bottom-base').value);
    const fixedPrice = parseFloat(document.getElementById('both-base').value);

    if (isNaN(bottomPrice) || isNaN(fixedPrice)) {
      alert('Please fill all opening mechanism prices');
      return;
    }

    const success = await this.updatePricingConfig({ 
      opening_bottom_price: bottomPrice,
      opening_fixed_price: fixedPrice
    });
    if (success) {
      alert('Opening mechanism prices saved successfully!');
    }
  },

  // SECTION 9: Frosted Price
  saveFrostedPrice: async function() {
    const price = parseFloat(document.getElementById('frosted-price').value);
    if (!price || price <= 0) {
      alert('Please enter a valid price');
      return;
    }
    
    const success = await this.updatePricingConfig({ glass_frosted_price: price });
    if (success) {
      alert('Frosted glass price saved successfully!');
    }
  },

  // SECTION 8: IRONMONGERY
  openAddProductModal: function() {
    document.getElementById('add-product-modal').classList.add('active');
  },

  closeAddProductModal: function() {
    const modal = document.getElementById('add-product-modal');
    const form = document.getElementById('add-product-form');
    
    modal.classList.remove('active');
    form.reset();
    
    // Reset tytułu i przycisku
    const titleEl = document.querySelector('#add-product-modal h2');
    if (titleEl) titleEl.textContent = 'Add Ironmongery Product';
    
    const submitBtn = document.querySelector('#add-product-form button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Add Product';
    
    // Usuń editId
    delete form.dataset.editId;
  },

  addProduct: async function() {
    const form = document.getElementById('add-product-form');
    const editId = form.dataset.editId;
    
    const category = document.getElementById('product-category').value;
    const name = document.getElementById('product-name').value;
    const color = document.getElementById('product-color').value;
    const priceNet = parseFloat(document.getElementById('product-price-net').value);
    const description = document.getElementById('product-description').value;
    const isPAS24 = document.getElementById('product-pas24').checked;
    const recommended = document.getElementById('product-recommended').checked;
    const imageFile = document.getElementById('product-image').files[0];

    // Validation
    if (!category || !name || !color || !priceNet) {
      alert('Please fill all required fields');
      return;
    }

    // Stopper type
    let stopperType = null;
    if (category === 'stoppers') {
      stopperType = document.getElementById('product-stopper-type').value;
      if (!stopperType) {
        alert('Please select stopper type');
        return;
      }
    }
    
    // Prepare product data
    const productData = {
      category,
      name,
      color,
      price_net: priceNet,
      price_vat: priceNet * 1.2,
      description,
      is_pas24: isPAS24,
      recommended,
      type: stopperType
    };

    // Handle image upload
    if (imageFile) {
      try {
        const fileName = `ironmongery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${imageFile.name.split('.').pop()}`;
        
        const { error: uploadError } = await window.supabaseClient.storage
          .from('ironmongery-images')
          .upload(fileName, imageFile);
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
          // Fallback - use placeholder
          productData.image_url = 'img/placeholder.png';
        } else {
          const { data: { publicUrl } } = window.supabaseClient.storage
            .from('ironmongery-images')
            .getPublicUrl(fileName);
          productData.image_url = publicUrl;
        }
      } catch (err) {
        console.error('Image upload failed:', err);
        productData.image_url = 'img/placeholder.png';
      }
    } else if (!editId) {
      productData.image_url = 'img/placeholder.png';
    }

    // Save to DB
    await this.saveProduct(productData, editId);
  },

  saveProduct: async function(productData, editId) {
    try {
      if (editId) {
        // Update existing
        const { error } = await window.supabaseClient
          .from('ironmongery_products')
          .update(productData)
          .eq('id', editId);
        
        if (error) throw error;
        alert('Product updated successfully!');
      } else {
        // Insert new
        const { error } = await window.supabaseClient
          .from('ironmongery_products')
          .insert([productData]);
        
        if (error) throw error;
        alert('Product added successfully!');
      }
      
      this.closeAddProductModal();
      await this.renderIronmongeryTable();
      
    } catch (err) {
      console.error('Error saving product:', err);
      alert('Error saving product: ' + err.message);
    }
  },

  deleteProduct: async function(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const { error } = await window.supabaseClient
        .from('ironmongery_products')
        .delete()
        .eq('id', productId);
      
      if (error) throw error;
      
      alert('Product deleted successfully!');
      await this.renderIronmongeryTable();
      
    } catch (err) {
      console.error('Error deleting product:', err);
      alert('Error deleting product: ' + err.message);
    }
  },

  renderIronmongeryTable: async function() {
    const tbody = document.getElementById('ironmongery-tbody');
    
    try {
      const { data: products, error } = await window.supabaseClient
        .from('ironmongery_products')
        .select('*')
        .order('category', { ascending: true });
      
      if (error) throw error;

      if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No products added yet</td></tr>';
        return;
      }

      tbody.innerHTML = products.map(product => `
        <tr>
          <td><img src="${product.image_url || 'img/placeholder.png'}" alt="${product.name}" style="max-width: 60px; max-height: 60px;"></td>
          <td>${this.getCategoryName(product.category)}</td>
          <td>${product.name}</td>
          <td>${this.getColorName(product.color)}</td>
          <td>£${parseFloat(product.price_net).toFixed(2)}</td>
          <td>
            <button class="btn-edit" onclick="AdminController.editProduct('${product.id}')">Edit</button>
            <button class="btn-delete" onclick="AdminController.deleteProduct('${product.id}')">Delete</button>
          </td>
        </tr>
      `).join('');
      
    } catch (err) {
      console.error('Error loading products:', err);
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error loading products</td></tr>';
    }
  },

  getCategoryName: function(key) {
    const names = {
      fingerLifts: 'Finger Lifts',
      locks: 'Locks',
      pullHandles: 'Pull Handles',
      stoppers: 'Stoppers'
    };
    return names[key] || key;
  },

  getColorName: function(key) {
    const names = {
      'chrome': 'Chrome',
      'satin': 'Satin',
      'brass': 'Brass',
      'antique-brass': 'Antique Brass',
      'black': 'Black',
      'white': 'White'
    };
    return names[key] || key;
  },

  editProduct: async function(productId) {
    try {
      const { data: product, error } = await window.supabaseClient
        .from('ironmongery_products')
        .select('*')
        .eq('id', productId)
        .single();
      
      if (error) throw error;
      
      if (!product) {
        alert('Product not found');
        return;
      }
      
      // Wypełnij formularz danymi produktu
      document.getElementById('product-category').value = product.category;
      document.getElementById('product-name').value = product.name;
      document.getElementById('product-color').value = product.color;
      document.getElementById('product-price-net').value = product.price_net;
      document.getElementById('product-description').value = product.description || '';
      document.getElementById('product-pas24').checked = product.is_pas24 || false;
      document.getElementById('product-recommended').checked = product.recommended || false;
      
      // Pokaż stopper type jeśli stopper
      if (product.category === 'stoppers') {
        document.getElementById('stopper-type-group').style.display = 'block';
        document.getElementById('product-stopper-type').value = product.type;
      }
      
      // Otwórz modal
      this.openAddProductModal();
      
      // Zmień tytuł i przycisk
      const titleEl = document.querySelector('#add-product-modal h2');
      if (titleEl) titleEl.textContent = 'Edit Product';
      
      const submitBtn = document.querySelector('#add-product-form button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Update Product';
      
      // Zapisz ID edytowanego produktu
      document.getElementById('add-product-form').dataset.editId = productId;
      
    } catch (err) {
      console.error('Error loading product:', err);
      alert('Error loading product: ' + err.message);
    }
  },

  // SECTION 8: HORNS
  openAddHornModal: function() {
    document.getElementById('add-horn-modal').classList.add('active');
  },

  closeAddHornModal: function() {
    document.getElementById('add-horn-modal').classList.remove('active');
    document.getElementById('add-horn-form').reset();
  },

  addHorn: function() {
    const name = document.getElementById('horn-name').value;
    const imageFile = document.getElementById('horn-image').files[0];

    if (!name) {
      alert('Please enter horn name');
      return;
    }

    if (imageFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.saveHorn({
          id: Date.now().toString(),
          name,
          image: e.target.result
        });
      };
      reader.readAsDataURL(imageFile);
    } else {
      this.saveHorn({
        id: Date.now().toString(),
        name,
        image: 'img/placeholder.png'
      });
    }
  },

  saveHorn: function(horn) {
    const horns = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.HORNS) || '[]');
    horns.push(horn);
    localStorage.setItem(this.STORAGE_KEYS.HORNS, JSON.stringify(horns));
    
    alert('Horn style added successfully!');
    this.closeAddHornModal();
    this.renderHornsGrid();
  },

  deleteHorn: function(hornId) {
    if (!confirm('Are you sure you want to delete this horn style?')) return;

    let horns = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.HORNS) || '[]');
    horns = horns.filter(h => h.id !== hornId);
    localStorage.setItem(this.STORAGE_KEYS.HORNS, JSON.stringify(horns));
    
    alert('Horn style deleted successfully!');
    this.renderHornsGrid();
  },

  renderHornsGrid: function() {
    const grid = document.getElementById('horns-grid');
    const horns = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.HORNS) || '[]');

    if (horns.length === 0) {
      grid.innerHTML = '<p>No horn styles added yet</p>';
      return;
    }

    grid.innerHTML = horns.map(horn => `
      <div class="horn-card">
        <img src="${horn.image}" alt="${horn.name}">
        <h4>${horn.name}</h4>
        <button class="btn-delete" onclick="AdminController.deleteHorn('${horn.id}')">Delete</button>
      </div>
    `).join('');
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  AdminController.init();
});