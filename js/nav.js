// ============================================================
// PRIME SASH WINDOWS — Shared Navigation
// Include this file on every page. Edit menu HERE only.
// ============================================================

(function(){
  // ── MENU ITEMS (edit here, changes everywhere) ──
  var menuItems = [
    { href: 'index.html',                page: 'index',                  label: 'Home' },
    { href: 'sash-windows-history.html',  page: 'sash-windows-history',   label: 'Sash Windows History' },
    { href: 'why-not-sash-windows.html',  page: 'why-not',                label: "Why You Shouldn\u2019t Buy" },
    { href: 'faq-top-companies.html',     page: 'faq-top',                label: 'FAQ & Top Companies' },
    { href: 'online-estimate.html',       page: 'online',                 label: 'Online Estimate & 3D' },
    { href: 'gallery.html',              page: 'gallery',                label: 'Gallery' },
    { href: 'contact.html',              page: 'contact',                label: 'Contact' }
  ];

  // ── BUILD NAV HTML ──
  var navLinksHTML = menuItems.map(function(item){
    return '<li><a href="' + item.href + '" data-page="' + item.page + '">' + item.label + '</a></li>';
  }).join('\n      ');

  var navHTML = ''
    + '<nav id="if-nav">'
    + '  <a href="index.html" class="logo-wrap">'
    + '    <div class="silver-line"></div>'
    + '    <span class="logo">Prime Sash</span>'
    + '    <span class="logo">Windows</span>'
    + '    <div class="silver-line"></div>'
    + '  </a>'
    + '  <ul class="nav-links">'
    + '    ' + navLinksHTML
    + '  </ul>'
    + '  <div class="hamburger" id="ham"><span></span><span></span><span></span></div>'
    + '</nav>';

  // ── BUILD MOB MENU HTML ──
  var mobLinksHTML = menuItems.map(function(item){
    return '<a href="' + item.href + '">' + item.label + '</a>';
  }).join('\n  ');

  var mobHTML = '<div id="mob-menu">\n  ' + mobLinksHTML + '\n</div>';

  // ── INJECT ──
  var placeholder = document.getElementById('nav-placeholder');
  if (placeholder) {
    placeholder.innerHTML = navHTML + '\n' + mobHTML;
  }

  // ── ACTIVE PAGE ──
  var page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a[data-page]').forEach(function(a){
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
})();
