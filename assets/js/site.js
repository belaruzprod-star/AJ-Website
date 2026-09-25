/* Injecte les coordonnées définies dans config.js. Le site reste lisible sans JavaScript. */
(function () {
  var c = window.AJ_CONFIG || {};
  var email = String(c.email || '').trim().replace(/^mailto:/i, '');
  var ig = String(c.instagram || '').trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[\/?#].*$/, '');
  if (email) {
    document.querySelectorAll('[data-aj="email"]').forEach(function (el) {
      var a = document.createElement('a');
      a.href = 'mailto:' + email;
      a.textContent = email;
      el.classList.add('contact-big');
      el.classList.remove('muted');
      el.replaceChildren(a);
    });
    document.querySelectorAll('[data-aj-mailto]').forEach(function (a) {
      a.href = 'mailto:' + email + '?subject=' + encodeURIComponent(a.getAttribute('data-aj-mailto'));
    });
  }
  if (ig) {
    document.querySelectorAll('[data-aj="instagram"]').forEach(function (el) {
      var a = document.createElement('a');
      a.href = 'https://www.instagram.com/' + encodeURIComponent(ig) + '/';
      a.rel = 'noopener';
      a.textContent = 'Instagram : @' + ig;
      el.replaceChildren(a);
      el.hidden = false;
    });
  }
})();
