// Supabase Configuration
const SUPABASE_URL = 'https://vwmtarmddydcxrhbqdfc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3bXRhcm1kZHlkY3hyaGJxZGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzA5ODgsImV4cCI6MjA3NjQwNjk4OH0.kT3tlzqHSX_t6upw25lIExUvY0qvoyc84Ddx3I0Zm6I';

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export to window for global access
window.supabaseClient = supabaseClient;

// Check if user is logged in
async function getCurrentUser() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    return user;
}

// Check if user is admin
async function isAdmin() {
    const user = await getCurrentUser();
    if (!user) return false;
    
    // Check user role from database
    const { data, error } = await supabaseClient
        .from('customers')
        .select('role')
        .eq('user_id', user.id)
        .single();
    
    return data?.role === 'admin';
}

window.getCurrentUser = getCurrentUser;
window.isAdmin = isAdmin;