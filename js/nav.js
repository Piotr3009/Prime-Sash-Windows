// ============================================================
// PRIME SASH WINDOWS — Shared Navigation
// Include this file on every page. Edit menu HERE only.
// ============================================================

(function(){
  // ── ROW 1 ITEMS ──
  var row1 = [
    { href: 'index.html',                page: 'index',                label: 'Home' },
    { href: 'sash-windows-history.html',  page: 'sash-windows-history', label: 'Sash Windows History' },
    { href: 'why-not-sash-windows.html',  page: 'why-not',              label: "Why You Shouldn\u2019t Buy" },
    { href: 'faq-top-companies.html',     page: 'faq-top',              label: 'FAQ & Top Companies' }
  ];

  // ── ROW 2 ITEMS ──
  var row2 = [
    { href: 'online-estimate.html',  page: 'online',  label: 'Online Estimate & 3D' },
    { href: 'gallery.html',         page: 'gallery', label: 'Gallery' },
    { href: 'contact.html',         page: 'contact', label: 'Contact' }
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
    +   '<ul class="nav-row">' + buildRow(row2) + '</ul>'
    + '</div>'
    + '<a href="login.html" class="nav-user" title="My Account">' + userIcon + '</a>'
    + '<div class="hamburger" id="ham"><span></span><span></span><span></span></div>'
    + '</nav>';

  var mobLinks = allItems.map(function(item){
    return '<a href="' + item.href + '">' + item.label + '</a>';
  }).join('\n  ');

  var mobHTML = '<div id="mob-menu">\n  ' + mobLinks
    + '\n  <a href="login.html">My Account</a>'
    + '\n</div>';

  var placeholder = document.getElementById('nav-placeholder');
  if (placeholder) {
    placeholder.innerHTML = navHTML + '\n' + mobHTML;
  }

  var page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-row a[data-page]').forEach(function(a){
    if (a.dataset.page && page.startsWith(a.dataset.page)) a.classList.add('active');
  });

  var ham = document.getElementById('ham');
  var mob = document.getElementById('mob-menu');
  if (ham && mob) {
    ham.addEventListener('click', function(){ mob.classList.toggle('open'); });
    mob.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ mob.classList.remove('open'); });
    });
  }
})();