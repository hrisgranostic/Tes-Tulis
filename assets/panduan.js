/* Panduan: tombol cetak, buka semua FAQ saat cetak, penanda bagian aktif di daftar isi */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var pb = $('#bPrint');
  if (pb) pb.onclick = function () { window.print(); };

  var wasOpen = [];
  window.addEventListener('beforeprint', function () {
    wasOpen = $$('details').map(function (d) { return d.open; });
    $$('details').forEach(function (d) { d.open = true; });
  });
  window.addEventListener('afterprint', function () {
    $$('details').forEach(function (d, i) { d.open = !!wasOpen[i]; });
  });

  var links = $$('.g-toc a'), secs = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  if (!('IntersectionObserver' in window) || !secs.length) return;
  var vis = {};
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { vis[e.target.id] = e.isIntersecting ? e.boundingClientRect.top : null; });
    var best = null;
    Object.keys(vis).forEach(function (id) { if (vis[id] !== null && (best === null || vis[id] < vis[best])) best = id; });
    if (best) links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + best); });
  }, { rootMargin: '-70px 0px -60% 0px', threshold: 0 });
  secs.forEach(function (s) { if (s) io.observe(s); });
})();
