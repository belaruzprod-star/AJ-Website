/* Injecte les coordonnées définies dans config.js. Le site reste lisible sans JavaScript. */
(function () {
  var c = window.AJ_CONFIG || {};
  if (c.email) {
    document.querySelectorAll('[data-aj="email"]').forEach(function (el) {
      var a = document.createElement('a');
      a.href = 'mailto:' + c.email;
      a.textContent = c.email;
      el.replaceChildren(a);
    });
    document.querySelectorAll('[data-aj-mailto]').forEach(function (a) {
      a.href = 'mailto:' + c.email + '?subject=' + encodeURIComponent(a.getAttribute('data-aj-mailto'));
    });
  }
  if (c.instagram) {
    document.querySelectorAll('[data-aj="instagram"]').forEach(function (el) {
      var a = document.createElement('a');
      a.href = 'https://www.instagram.com/' + encodeURIComponent(c.instagram) + '/';
      a.rel = 'noopener';
      a.textContent = 'Instagram : @' + c.instagram;
      el.replaceChildren(a);
      el.hidden = false;
    });
  }
})();
