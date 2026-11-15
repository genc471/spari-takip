/*
  Sipariş Takip · web sitenize CANLI fiyat listesi (2026-11-15). Firma uygulamada fiyat değiştirince sitede de değişir.
  Kullanım (kodu firmanın uygulaması verir: Ayarlar → Sipariş sitesi → Web sitenize ekleyin):
    <div data-halitakip="fiyat" data-kod="ABC123"></div>
    <script src="https://genc471.github.io/spari-takip/gom.js" async></script>
  İsteğe bağlı: data-renk="0f766e" (vurgu rengi) · data-baslik="0" (başlıksız) · data-siparis="0" (sipariş düğmesiz)
  · data-zemin="0" (kartsız, sitenin zemininde). Çerçevenin yüksekliği içeriğe göre kendiliğinden ayarlanır.
  Yalnız kendi sayfamızdan (fiyat.html, bu dosyanın yanındaki) gelen boy mesajını dinler. Test: scripts/verify-site-embed.cjs.
*/
(function () {
  if (window.__halitakipGom) { window.__halitakipGom(); return; }
  var me = document.currentScript;
  var base = me && me.src ? me.src.replace(/[?#].*$/, "").replace(/[^\/]*$/, "") : "https://genc471.github.io/spari-takip/";
  var origin = (base.match(/^https?:\/\/[^\/]+/) || [""])[0];
  var count = 0;

  function mount(el) {
    if (el.getAttribute("data-halitakip-ok") || el.getAttribute("data-halitakip") !== "fiyat") return;
    var code = String(el.getAttribute("data-kod") || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(code)) { el.textContent = "Fiyat listesi: data-kod eksik ya da hatalı."; return; }
    el.setAttribute("data-halitakip-ok", "1");
    var id = "ht" + (++count) + "-" + Math.random().toString(36).slice(2, 8);
    var q = "s=" + code + "&id=" + id;
    ["renk", "baslik", "siparis", "zemin"].forEach(function (k) {
      var v = el.getAttribute("data-" + k);
      if (v != null && /^#?[0-9a-fA-F]{1,6}$/.test(v)) q += "&" + k + "=" + v.replace("#", "");
    });
    var f = document.createElement("iframe");
    f.src = base + "fiyat.html?" + q;
    f.title = "Fiyat listesi";
    f.setAttribute("loading", "lazy");
    f.setAttribute("scrolling", "no");
    f.setAttribute("data-halitakip-id", id);
    f.style.cssText = "display:block;width:100%;height:520px;border:0;overflow:hidden;background:transparent";
    el.appendChild(f);
  }
  function mountAll() { Array.prototype.forEach.call(document.querySelectorAll("[data-halitakip]"), mount); }

  window.addEventListener("message", function (e) {
    var d = e.data;
    if (e.origin !== origin || !d || d.halitakip !== "boy" || typeof d.id !== "string" || typeof d.h !== "number") return;
    var f = document.querySelector('iframe[data-halitakip-id="' + d.id.replace(/[^\w-]/g, "") + '"]');
    if (f) f.style.height = Math.max(80, Math.min(5000, Math.ceil(d.h))) + "px";
  });
  // Sayfa kurucuları kodu sonradan da ekleyebilir: betik ikinci kez yüklenirse yalnız yeni kutular kurulur
  window.__halitakipGom = mountAll;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
