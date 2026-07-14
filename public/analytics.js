(function () {
  'use strict';

  var measurementId = 'G-W88F9KGDQM';
  var disableKey = 'ga-disable-' + measurementId;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  function isAdminRoute() {
    return window.location.hash.indexOf('#admin') === 0;
  }

  function trackPublicPage() {
    var isAdmin = isAdminRoute();
    window[disableKey] = isAdmin;
    if (isAdmin) return;
    window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname + window.location.search + window.location.hash
    });
  }

  window[disableKey] = isAdminRoute();
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: false });
  trackPublicPage();
  window.addEventListener('hashchange', trackPublicPage);
}());
