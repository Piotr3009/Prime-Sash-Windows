// Menu Loader - ładuje unified menu i zarządza widocznością Admin Panel

class MenuLoader {
    constructor() {
        this.init();
    }

    async init() {
        await this.loadMenu();
        await this.configureMenu();
    }

    async loadMenu() {
        // Znajdź placeholder dla menu (będzie w każdym HTML)
        const menuPlaceholder = document.getElementById('unified-menu-placeholder');
        if (!menuPlaceholder) {
            console.warn('Menu placeholder not found');
            return;
        }

        try {
            // Załaduj unified menu
            const response = await fetch('unified-menu.html');
            const menuHTML = await response.text();
            menuPlaceholder.innerHTML = menuHTML;
        } catch (error) {
            console.error('Error loading menu:', error);
        }
    }

    async configureMenu() {
        // Sprawdź czy użytkownik jest zalogowany i czy jest adminem
        const user = await this.getCurrentUser();
        const adminPanelLink = document.getElementById('admin-panel-link');
        const adminDashboardLink = document.getElementById('admin-dashboard-link');
        const dashboardButton = document.getElementById('dashboard-button');
        
        if (user) {
            // Sprawdź rolę użytkownika
            const isAdmin = await this.checkIfAdmin(user.id);
            
            if (isAdmin) {
                if (adminPanelLink) adminPanelLink.style.display = 'inline-block';
                if (adminDashboardLink) adminDashboardLink.style.display = 'inline-block';
            }

            // Pulsowanie dashboard button - tylko jeśli nie kliknął wcześniej
            if (dashboardButton && !localStorage.getItem('dashboard_visited')) {
                dashboardButton.classList.add('pulse');
                
                // Usuń pulsowanie po kliknięciu
                document.getElementById('dashboard-link').addEventListener('click', () => {
                    localStorage.setItem('dashboard_visited', 'true');
                    dashboardButton.classList.remove('pulse');
                });
            }
        }

        // Podświetl aktywną stronę
        this.highlightActivePage();
    }

    async getCurrentUser() {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            return user;
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    }

    async checkIfAdmin(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('customers')
                .select('role')
                .eq('user_id', userId)
                .single();

            if (error) throw error;
            return data?.role === 'admin';
        } catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    }

    highlightActivePage() {
        const currentPage = window.location.pathname.split('/').pop();
        const menuButtons = document.querySelectorAll('.menu-bar button');
        
        menuButtons.forEach(button => {
            const link = button.parentElement;
            const href = link.getAttribute('href');
            
            if (href === currentPage || (currentPage === '' && href === 'index.html')) {
                button.classList.add('active');
            }
        });
    }
}

// Inicjalizuj menu loader gdy DOM jest gotowy
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new MenuLoader();
    });
} else {
    new MenuLoader();
}