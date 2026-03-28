// Shared Footer Component
(function() {
  const footerHTML = `
  <footer id="if-footer">
    <div class="ft-top-line"></div>
    <div class="ft-grid">
      <div>
        <div class="ft-logo-block">
          <div class="silver-line"></div>
          <span class="ft-logo">Prime Sash Windows</span>
          <div class="silver-line"></div>
        </div>
        <p class="ft-brand-text">Premium timber sash windows for London's period homes.<br/>Every window handcrafted. Every project — unique.</p>
      </div>
      <div class="ft-col"><h4>Navigation</h4><ul>
        <li><a href="index.html">Home</a></li>
        <li><a href="sash-windows-history.html">Sash Windows History</a></li>
        <li><a href="why-not-sash-windows.html">Why You Shouldn't Buy</a></li>
        <li><a href="faq-top-companies.html">FAQ & Top Companies</a></li>
        <li><a href="certifications.html">Certifications & Technology</a></li>
        <li><a href="online-estimate.html">Online Estimate & 3D</a></li>
        <li><a href="gallery.html">Gallery</a></li>
        <li><a href="contact.html">Contact</a></li>
      </ul></div>
      <div class="ft-col"><h4>Services</h4><ul>
        <li><a href="online-estimate.html">Price Calculator</a></li>
        <li><a href="measurement-guide.html">Measurement Guide</a></li>
        <li><a href="contact.html">Book Survey</a></li>
        <li><a href="gallery.html">Our Projects</a></li>
      </ul></div>
      <div class="ft-col"><h4>Contact</h4><ul>
        <li><a href="tel:+447842510060">07842 510 060</a></li>
        <li><a href="tel:+441992450848">01992 450 848</a></li>
        <li><a href="mailto:info@skylonjoinery.co.uk">info@skylonjoinery.co.uk</a></li>
        <li>Unit 3, Leaside Industrial Park,<br>Sedge Green, Nazeing, EN9 2BF</li>
      </ul></div>
    </div>
    <div class="ft-bottom">
      <p>&copy; 2026 Prime Sash Windows. All rights reserved. A trading name of Skylon Joinery LTD</p>
      <p><a href="#" style="color:inherit;text-decoration:none;">Privacy Policy</a></p>
    </div>
  </footer>`;

  const placeholder = document.getElementById('footer-placeholder');
  if (placeholder) {
    placeholder.innerHTML = footerHTML;
  }
})();
