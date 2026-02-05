// Add to app.js - Dynamic URL generation for Sheets Links
(function() {
  // Get current hostname
  const hostname = window.location.hostname;
  const baseUrl = `https://${hostname}`;
  
  // Update all Sheets Links URLs dynamically on page load
  function updateSheetsUrls() {
    // Find all code elements with IMPORTDATA formulas
    const codeElements = document.querySelectorAll('code');
    
    codeElements.forEach(el => {
      const text = el.textContent;
      // Replace sandbox URL with current hostname
      if (text.includes('sandbox.novita.ai')) {
        const updated = text.replace(
          /https:\/\/[^\/]+\/api\//g,
          `${baseUrl}/api/`
        );
        el.textContent = updated;
      }
    });
    
    console.log('Sheets URLs updated to use:', baseUrl);
  }
  
  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateSheetsUrls);
  } else {
    updateSheetsUrls();
  }
})();
