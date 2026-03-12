// Authentication System

class AuthSystem {
    constructor() {
        this.modal = null;
        this.currentUser = null;
        this.initModal();
        this.checkAuthState();
    }

    // Initialize auth modal
    initModal() {
        // Sprawdź czy modal już istnieje
        const existingModal = document.getElementById('auth-modal');
        if (existingModal) {
            this.modal = existingModal;
            return;
        }

        const modalHTML = `
            <div id="auth-modal" class="auth-modal" style="display: none;">
                <div class="auth-modal-content">
                    <span class="auth-close">&times;</span>
                    <div class="auth-tabs">
                        <button class="auth-tab active" data-tab="login">Login</button>
                        <button class="auth-tab" data-tab="register">Register</button>
                    </div>

                    <!-- Login Form -->
                    <div id="login-form" class="auth-form active">
                        <h2>Welcome Back</h2>
                        <p style="margin-bottom: 20px;">Login to save your estimates and track orders</p>
                        <input type="email" id="login-email" placeholder="Email" required>
                        <input type="password" id="login-password" placeholder="Password" required>
                        <button id="login-btn" class="auth-btn">Login</button>
                        <p class="auth-message" id="login-message"></p>
                    </div>

                    <!-- Register Form -->
                    <div id="register-form" class="auth-form">
                        <h2>Create Account</h2>
                        <p style="margin-bottom: 20px;">Register to save your estimates</p>
                        <input type="text" id="register-name" placeholder="Full Name" required>
                        <input type="email" id="register-email" placeholder="Email" required>
                        <input type="tel" id="register-phone" placeholder="Phone Number" required>
                        <input type="password" id="register-password" placeholder="Password (min 6 characters)" required>
                        <input type="password" id="register-confirm" placeholder="Confirm Password" required>
                        <button id="register-btn" class="auth-btn">Create Account</button>
                        <p class="auth-message" id="register-message"></p>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('auth-modal');
        this.attachEventListeners();
    }

    // Attach event listeners
    attachEventListeners() {
        // Close modal
        document.querySelector('.auth-close').addEventListener('click', () => {
            this.closeModal();
        });

        // Click outside to close
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        // Tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        // Login
        document.getElementById('login-btn').addEventListener('click', () => {
            this.login();
        });

        // Register
        document.getElementById('register-btn').addEventListener('click', () => {
            this.register();
        });

        // Enter key submit
        document.getElementById('login-password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });

        document.getElementById('register-confirm').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.register();
        });
    }

    // Switch between login and register tabs
    switchTab(tab) {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(`${tab}-form`).classList.add('active');
    }

    // Show modal
    showModal(tab = 'login') {
        this.modal.style.display = 'block';
        this.switchTab(tab);
    }

    // Close modal
    closeModal() {
        this.modal.style.display = 'none';
        this.clearMessages();
    }

    // Clear error messages
    clearMessages() {
        document.querySelectorAll('.auth-message').forEach(msg => {
            msg.textContent = '';
            msg.className = 'auth-message';
        });
    }

    // Show message
    showMessage(type, message, isError = false) {
        const msgElement = document.getElementById(`${type}-message`);
        msgElement.textContent = message;
        msgElement.className = `auth-message ${isError ? 'error' : 'success'}`;
    }

    // Login
    async login() {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            this.showMessage('login', 'Please fill in all fields', true);
            return;
        }

        document.getElementById('login-btn').disabled = true;
        document.getElementById('login-btn').textContent = 'Logging in...';

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            this.showMessage('login', 'Login successful! Redirecting...', false);
            
            // Track login
            await this.trackEvent('user_login', { user_id: data.user.id });

            // Transfer localStorage estimates
            await this.transferLocalEstimates(data.user.id);

            setTimeout(() => {
                this.closeModal();
                // Sprawdź czy jest redirect zapisany
                const redirectUrl = localStorage.getItem('redirect_after_login');
                if (redirectUrl) {
                    localStorage.removeItem('redirect_after_login');
                    window.location.href = redirectUrl;
                } else {
                    window.location.href = 'customer-dashboard.html';
                }
            }, 1000);

        } catch (error) {
            this.showMessage('login', error.message, true);
        } finally {
            document.getElementById('login-btn').disabled = false;
            document.getElementById('login-btn').textContent = 'Login';
        }
    }

    // Register
    async register() {
        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const phone = document.getElementById('register-phone').value.trim();
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;

        // Validation
        if (!name || !email || !phone || !password || !confirm) {
            this.showMessage('register', 'Please fill in all fields', true);
            return;
        }

        if (password.length < 6) {
            this.showMessage('register', 'Password must be at least 6 characters', true);
            return;
        }

        if (password !== confirm) {
            this.showMessage('register', 'Passwords do not match', true);
            return;
        }

        document.getElementById('register-btn').disabled = true;
        document.getElementById('register-btn').textContent = 'Creating account...';

        try {
            // Create auth user
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: email,
                password: password
            });

            if (authError) throw authError;

            // Create customer record
            const { error: customerError } = await supabaseClient
                .from('customers')
                .insert([{
                    user_id: authData.user.id,
                    full_name: name,
                    phone: phone,
                    email: email,
                    role: 'customer',
                    total_visits: 1,
                    total_estimates: 0
                }]);

            if (customerError) throw customerError;

            // Track registration
            await this.trackEvent('user_registration', { user_id: authData.user.id });
            
            // Google Ads conversion tracking
            if (typeof gtag === 'function') {
                gtag('event', 'ads_conversion_Book_appointment_1', {});
            }

            // Sprawdź czy email wymaga potwierdzenia
            const needsEmailConfirmation = authData.user && !authData.user.email_confirmed_at;

            if (needsEmailConfirmation) {
                // EMAIL NIE POTWIERDZONY - pokaż komunikat i NIE przekierowuj
                this.showMessage('register', '✅ Account created! Please check your email to confirm your account before logging in.', false);
                
                setTimeout(() => {
                    this.closeModal();
                    // NIE przekierowuj - użytkownik musi potwierdzić email
                }, 3000);
            } else {
                // EMAIL POTWIERDZONY - normalny flow (instant confirmation)
                this.showMessage('register', 'Account created successfully!', false);
                
                setTimeout(() => {
                    this.transferLocalEstimates(authData.user.id);
                    this.closeModal();
                    
                    const redirectUrl = localStorage.getItem('redirect_after_login');
                    if (redirectUrl) {
                        localStorage.removeItem('redirect_after_login');
                        window.location.href = redirectUrl;
                    } else {
                        window.location.href = 'customer-dashboard.html';
                    }
                }, 2000);
            }

        } catch (error) {
            this.showMessage('register', error.message, true);
        } finally {
            document.getElementById('register-btn').disabled = false;
            document.getElementById('register-btn').textContent = 'Create Account';
        }
    }

    // Logout
    async logout() {
        const { error } = await supabaseClient.auth.signOut();
        if (!error) {
            window.location.href = 'index.html';
        }
    }

    // Check auth state
    async checkAuthState() {
        const user = await getCurrentUser();
        this.currentUser = user;

        // Update UI based on auth state
        this.updateUIForAuth(user);
    }

    // Update UI based on authentication
    async updateUIForAuth(user) {
        const authButtons = document.querySelectorAll('.auth-required');
        const dashboardLink = document.getElementById('dashboard-link');
        const loginMenuLink = document.getElementById('login-menu-link');
        const loginMenuButton = document.getElementById('login-menu-button');
        
        if (user) {
            // User is logged in - pobierz dane z bazy
            try {
                const { data: customer, error } = await supabaseClient
                    .from('customers')
                    .select('full_name')
                    .eq('user_id', user.id)
                    .single();

                const displayName = customer?.full_name || user.email.split('@')[0];

                // Zaktualizuj wszystkie przyciski auth
                authButtons.forEach(btn => {
                    btn.textContent = `👤 ${displayName}`;
                    btn.onclick = () => window.location.href = 'customer-dashboard.html';
                    btn.style.cursor = 'pointer';
                });

                // Login button w menu - zmień na imię użytkownika
                if (loginMenuButton) {
                    loginMenuButton.textContent = `👤 ${displayName}`;
                    loginMenuButton.classList.remove('login-btn');
                }
                if (loginMenuLink) {
                    loginMenuLink.href = 'customer-dashboard.html';
                }

                // Dashboard link - zalogowany użytkownik
                if (dashboardLink) {
                    dashboardLink.onclick = (e) => {
                        e.preventDefault();
                        window.location.href = 'customer-dashboard.html';
                    };
                }

            } catch (error) {
                console.error('Error fetching user data:', error);
                // Fallback - pokaż email
                const fallbackName = user.email.split('@')[0];
                
                authButtons.forEach(btn => {
                    btn.textContent = `👤 ${fallbackName}`;
                    btn.onclick = () => window.location.href = 'customer-dashboard.html';
                });
                
                // Login button w menu - fallback
                if (loginMenuButton) {
                    loginMenuButton.textContent = `👤 ${fallbackName}`;
                    loginMenuButton.classList.remove('login-btn');
                }
                if (loginMenuLink) {
                    loginMenuLink.href = 'customer-dashboard.html';
                }
                
                // Dashboard link - zalogowany użytkownik (fallback)
                if (dashboardLink) {
                    dashboardLink.onclick = (e) => {
                        e.preventDefault();
                        window.location.href = 'customer-dashboard.html';
                    };
                }
            }
        } else {
            // User is not logged in
            authButtons.forEach(btn => {
                btn.textContent = 'Login / Register';
                btn.onclick = () => this.showModal();
            });
            
            // Login button w menu - pokaż Login / Register
            if (loginMenuButton) {
                loginMenuButton.textContent = 'Login / Register';
                loginMenuButton.classList.add('login-btn');
            }
            if (loginMenuLink) {
                loginMenuLink.href = 'login.html';
            }
            
            // Dashboard link - niezalogowany użytkownik
            if (dashboardLink) {
                dashboardLink.onclick = (e) => {
                    e.preventDefault();
                    this.showModal();
                };
            }
        }
    }

    // Dodaj dropdown menu dla zalogowanego użytkownika
    addUserDropdown(displayName, getContainer) {
        // Sprawdź czy dropdown już istnieje
        const existingDropdown = document.querySelector('.user-dropdown-menu');
        if (existingDropdown) return;

        // Dodaj style dla dropdown
        if (!document.getElementById('user-dropdown-styles')) {
            const style = document.createElement('style');
            style.id = 'user-dropdown-styles';
            style.textContent = `
                .user-menu-container {
                    position: relative;
                    display: inline-block;
                }
                .user-dropdown-menu {
                    display: none;
                    position: absolute;
                    top: 100%;
                    right: 0;
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    min-width: 180px;
                    margin-top: 5px;
                    z-index: 1000;
                }
                .user-dropdown-menu.show {
                    display: block;
                }
                .user-dropdown-item {
                    padding: 12px 20px;
                    cursor: pointer;
                    border-bottom: 1px solid #f0f0f0;
                }
                .user-dropdown-item:last-child {
                    border-bottom: none;
                }
                .user-dropdown-item:hover {
                    background: #f5f5f5;
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Transfer local estimates to database after registration
    async transferLocalEstimates(authUserId) {
        const savedEstimates = JSON.parse(localStorage.getItem('savedEstimates') || '[]');
        
        if (savedEstimates.length > 0) {
            try {
                // Get customer ID from auth user ID
                const { data: customer, error: customerError } = await supabaseClient
                    .from('customers')
                    .select('id')
                    .eq('user_id', authUserId)
                    .single();

                if (customerError) throw customerError;

                // Convert each estimate to order format
                const orders = savedEstimates.map(estimate => ({
                    customer_id: customer.id,
                    status: 'saved',
                    total_price: estimate.price || estimate.total_price || 0,
                    window_spec: estimate,
                    created_at: estimate.timestamp || new Date().toISOString()
                }));

                const { error } = await supabaseClient
                    .from('orders')
                    .insert(orders);

                if (!error) {
                    // Clear local storage after successful transfer
                    localStorage.removeItem('savedEstimates');
                    console.log(`Transferred ${orders.length} estimates to database`);
                }
            } catch (error) {
                console.error('Error transferring estimates:', error);
            }
        }
    }

    // Track events for analytics
    async trackEvent(eventName, data = {}) {
        try {
            await supabaseClient
                .from('analytics_events')
                .insert([{
                    event_name: eventName,
                    event_data: data,
                    created_at: new Date().toISOString()
                }]);
        } catch (error) {
            console.error('Analytics tracking error:', error);
        }
    }
}

// Initialize auth system when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.authSystem = new AuthSystem();
});

// Export for use in other scripts
window.AuthSystem = AuthSystem;