// Supabase Configuration
const SUPABASE_URL = 'https://rfelsfwjszjdtzuovlal.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZWxzZndqc3pqZHR6dW92bGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0Nzc1MTgsImV4cCI6MjA5MDA1MzUxOH0.Ut9EtffoU-L1g6IKiqcaVaoA2sEDoc0so821L1Uxn_A';

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