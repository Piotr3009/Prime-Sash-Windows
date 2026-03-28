// ============================================================
// PRIME SASH WINDOWS — Shared Navigation
// Include this file on every page. Edit menu HERE only.
// ============================================================

(function(){
  // ── ROW 1 ITEMS (education / trust) ──
  var row1 = [
    { href: 'index.html',                page: 'index',                label: 'Home' },
    { href: 'sash-windows-history.html',  page: 'sash-windows-history', label: 'Sash Windows History' },
    { href: 'why-not-sash-windows.html',  page: 'why-not',              label: "Why You Shouldn\u2019t Buy" },
    { href: 'faq-top-companies.html',     page: 'faq-top',              label: 'FAQ & Top Companies' },
    { href: 'certifications.html',       page: 'cert',                 label: 'Certifications' }
  ];

  // ── ROW 2 ITEMS (action) ──
  var row2 = [
    { href: 'online-estimate.html',       page: 'online',    label: 'Online Estimate & 3D' },
    { href: 'measurement-guide.html',    page: 'measure',   label: 'Measurement Guide' },
    { href: 'gallery.html',              page: 'gallery',   label: 'Gallery' },
    { href: 'contact.html',              page: 'contact',   label: 'Contact' },
    { href: 'customer-dashboard.html',   page: 'customer',  label: 'My Account' }
  ];

  var allItems = row1.concat(row2);

  function buildRow(items) {
    return items.map(function(item){
      return '<li><a href="' + item.href + '" data-page="' + item.page + '">' + item.label + '</a></li>';
    }).join('');
  }

  var userIcon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    + '<circle cx="12" cy="8" r="4"/>'
    + '<path d="M4 21v-1a6 6 0 0 1 12 0v1" transform="translate(2,0)"/>'
    + '</svg>';

  var navHTML = '<nav id="if-nav">'
    + '<a href="index.html" class="logo-wrap">'
    +   '<div class="silver-line"></div>'
    +   '<span class="logo">Prime Sash</span>'
    +   '<span class="logo">Windows</span>'
    +   '<div class="silver-line"></div>'
    + '</a>'
    + '<div class="nav-rows">'
    +   '<ul class="nav-row">' + buildRow(row1) + '</ul>'
    +   '<ul class="nav-row" id="nav-row-2">' + buildRow(row2) + '</ul>'
    + '</div>'
    + '<a href="customer-dashboard.html" class="nav-user" id="nav-user-btn" title="My Account">' + userIcon + '</a>'
    + '<div class="hamburger" id="ham"><span></span><span></span><span></span></div>'
    + '</nav>';

  var mobLinks = allItems.map(function(item){
    return '<a href="' + item.href + '">' + item.label + '</a>';
  }).join('\n  ');

  var mobHTML = '<div id="mob-menu">\n  ' + mobLinks + '\n</div>';

  // ── INJECT ──
  var placeholder = document.getElementById('nav-placeholder');
  if (placeholder) {
    placeholder.innerHTML = navHTML + '\n' + mobHTML;
  }

  // ── ACTIVE PAGE ──
  var page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-row a[data-page]').forEach(function(a){
    if (a.dataset.page && page.startsWith(a.dataset.page)) a.classList.add('active');
  });

  // ── HAMBURGER TOGGLE ──
  var ham = document.getElementById('ham');
  var mob = document.getElementById('mob-menu');
  if (ham && mob) {
    ham.addEventListener('click', function(){ mob.classList.toggle('open'); });
    mob.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ mob.classList.remove('open'); });
    });
  }

  // ── AUTH: Load Supabase & check login status ──
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
      window.supabaseClient = window.supabase.createClient(url, key);
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

      // Logged in — check if admin
      window.supabaseClient.from('customers').select('role').eq('user_id', user.id).single()
        .then(function(r) {
          if (r.data && r.data.role === 'admin' && row2El) {
            var adminLi = document.createElement('li');
            adminLi.innerHTML = '<a href="admin-panel.html" data-page="admin">Admin Panel</a>';
            row2El.appendChild(adminLi);
            if (mob) {
              var adminMob = document.createElement('a');
              adminMob.href = 'admin-panel.html';
              adminMob.textContent = 'Admin Panel';
              mob.appendChild(adminMob);
            }
            if (page.startsWith('admin')) {
              adminLi.querySelector('a').classList.add('active');
            }
          }
        });
    });
  }

  loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', function(){
    setTimeout(initAuth, 50);
  });

})();