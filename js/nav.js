// ============================================================
// PRIME SASH WINDOWS — Navigation interactivity
// HTML is inline in each page. This script handles:
//   - Hamburger menu toggle
//   - Active page highlight
//   - Auth state (login/admin links)
// ============================================================

(function(){
  // ── Active page highlight ──
  var page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-row a[data-page]').forEach(function(a){
    if (a.dataset.page && page.startsWith(a.dataset.page)) a.classList.add('active');
  });

  // ── Hamburger toggle ──
  var ham = document.getElementById('ham');
  var mob = document.getElementById('mob-menu');
  if (ham && mob) {
    ham.addEventListener('click', function(){ mob.classList.toggle('open'); });
    mob.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ mob.classList.remove('open'); });
    });
  }

  // ── Auth: swap My Account → Login if not logged in, add Admin links if admin ──
  function loadScript(src, cb) {
    if (document.querySelector('script[src="' + src + '"]')) { cb(); return; }
    var s = document.createElement('script');
    s.src = src; s.onload = cb;
    document.head.appendChild(s);
  }

  function initAuth() {
    if (!window.supabaseClient && window.supabase) {
      var url = 'https://rfelsfwjszjdtzuovlal.supabase.co';
      var key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZWxzZndqc3pqZHR6dW92bGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0Nzc1MTgsImV4cCI6MjA5MDA1MzUxOH0.Ut9EtffoU-L1g6IKiqcaVaoA2sEDoc0so821L1Uxn_A';
      // Singleton — reuse the shared client if supabase-config.js already made one
      window.supabaseClient = window.supabaseClient || window.supabase.createClient(url, key);
    }
    if (!window.supabaseClient) return;

    window.supabaseClient.auth.getUser().then(function(res) {
      var user = res.data && res.data.user;
      var userBtn = document.getElementById('nav-user-btn');
      var row2El = document.getElementById('nav-row-2');

      if (!user) {
        if (userBtn) { userBtn.href = 'login.html'; userBtn.title = 'Login / Register'; }
        document.querySelectorAll('.nav-row a[data-page="customer"]').forEach(function(a){
          a.href = 'login.html';
        });
        if (mob) {
          mob.querySelectorAll('a').forEach(function(a){
            if (a.textContent === 'My Account') a.href = 'login.html';
          });
        }
        return;
      }

      window.supabaseClient.from('customers').select('role').eq('user_id', user.id).single()
        .then(function(r) {
          if (r.data && r.data.role === 'admin' && row2El) {
            var adminLi = document.createElement('li');
            adminLi.innerHTML = '<a href="admin-panel.html" data-page="admin-panel">Admin Panel</a>';
            row2El.appendChild(adminLi);
            var dashLi = document.createElement('li');
            dashLi.innerHTML = '<a href="admin-dashboard.html" data-page="admin-dashboard">Admin Dashboard</a>';
            row2El.appendChild(dashLi);
            if (mob) {
              var adminMob = document.createElement('a');
              adminMob.href = 'admin-panel.html';
              adminMob.textContent = 'Admin Panel';
              mob.appendChild(adminMob);
              var dashMob = document.createElement('a');
              dashMob.href = 'admin-dashboard.html';
              dashMob.textContent = 'Admin Dashboard';
              mob.appendChild(dashMob);
            }
            if (page.startsWith('admin-panel')) {
              adminLi.querySelector('a').classList.add('active');
            }
            if (page.startsWith('admin-dashboard')) {
              dashLi.querySelector('a').classList.add('active');
            }
          }
        });
    });
  }

  loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', function(){
    setTimeout(initAuth, 50);
  });

})();
