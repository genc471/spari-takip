// Sipariş Takip — müşteri bildirimi servis çalışanı (web push, 2026-11-15; supabase/web-bildirim.sql).
// Takip sayfasının yanında durur (GitHub Pages /spari-takip/sw.js; firmanın kendi sitesinde /takip/sw.js).
// İtme mesajı BOŞ gelir (şifreleme yok): bu tarayıcının görmediği mesajlar sunucudan çekilir (push_pull) ve gösterilir.
// Bildirime dokununca siparişin takip sayfası açılır; "Evdeyim / Evde değilim" düğmesi yanıtı sayfayı açmadan iletir
// (reply_order — sayfadaki yanıt kartıyla aynı). Sayfa önbelleğe ALINMAZ (fetch olayı yok): takip hep sunucudan gelir.
var SW_SURUM = 1;
var API = "https://hxldnojokckqgxecyxhc.supabase.co/rest/v1/rpc/";
var KEY = "sb_publishable_ZTqkY2ZJPKqtJo5eNycwAA_owbOKT52";
// İtme servisinin abonelik anahtarı (VAPID açık anahtarı; gizli yarısı firma uygulamasında — store/web-push.ts)
var PUSH_KEY = "BCkt9hx0IouIUDAtNR_3RysSwhh3wFqxFkazwsEZxEfTfzrTCFxgxy61iPpWTk46lxG42phprnTtCC5ugFQUdnA";
var GENEL = { baslik: "Sipariş Takip", metin: "Siparişinizle ilgili yeni bilgi var." };
// Sayfanın abone olurken bıraktığı not (hangi siparişin bağlantısından): tarayıcı adresi yenilerse yeniden kaydolmak için
var NOT_KUTU = "halitakip-bildirim";
var NOT_ADI = "abone";

function rpc(name, body) {
  return fetch(API + name, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY },
    body: JSON.stringify(body)
  }).then(function (r) {
    if (!r.ok) throw new Error("rpc " + name + " " + r.status);
    return r.json();
  });
}

function b64uBytes(s) {
  var pad = "====".slice(0, (4 - (s.length % 4)) % 4);
  var raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  var out = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function pageUrl(m) {
  return m && m.siparis ? self.registration.scope + "?id=" + encodeURIComponent(m.siparis) + (m.ek || "") : self.registration.scope;
}

// quiet: aynı bildirimi sessizce yeniden göster (yeni mesaj yokken — tarayıcı her itmede bir bildirim ister)
function show(m, quiet) {
  m = m || GENEL;
  var opts = {
    body: m.metin || GENEL.metin,
    tag: "siparis-" + (m.siparis || "genel"),
    renotify: !quiet,
    silent: !!quiet,
    badge: new URL("bildirim-rozet.png", self.registration.scope).href,
    data: { url: pageUrl(m), siparis: m.siparis || "", logo: m.logo || "" }
  };
  if (m.logo) opts.icon = m.logo;
  if (Array.isArray(m.dugmeler) && m.dugmeler.length) opts.actions = m.dugmeler.slice(0, 2);
  return self.registration.showNotification(m.baslik || GENEL.baslik, opts);
}

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (e) {
  e.waitUntil(
    self.registration.pushManager.getSubscription().then(function (sub) {
      if (!sub) return show(GENEL, false);
      return rpc("push_pull", { p_endpoint: sub.endpoint }).then(function (r) {
        var list = r && Array.isArray(r.mesajlar) ? r.mesajlar : [];
        if (list.length) return Promise.all(list.map(function (m) { return show(m, false); }));
        if (r && r.son) return show(r.son, true);
        return show((r && r.genel) || GENEL, false);
      });
    }).catch(function () {
      return show(GENEL, false);
    })
  );
});

function openPage(url) {
  url = url || self.registration.scope;
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (wins) {
    for (var i = 0; i < wins.length; i++) {
      if (wins[i].url.split("#")[0] === url && "focus" in wins[i]) return wins[i].focus();
    }
    return self.clients.openWindow(url);
  });
}

self.addEventListener("notificationclick", function (e) {
  var n = e.notification;
  var d = n.data || {};
  n.close();
  if ((e.action === "evde" || e.action === "yok") && d.siparis) {
    var evde = e.action === "evde";
    e.waitUntil(
      rpc("reply_order", { p_order: d.siparis, p_reply: e.action }).then(function (r) {
        if (!r || !r.ok) return openPage(d.url + "&yanit=1");
        var opts = {
          body: evde ? "Evde olacağınızı ilettik. Görüşmek üzere!" : "Evde olmayacağınızı ilettik. Sizi arayıp uygun günü birlikte belirleyeceğiz.",
          tag: n.tag,
          silent: true,
          badge: new URL("bildirim-rozet.png", self.registration.scope).href,
          data: { url: d.url, siparis: d.siparis, logo: d.logo }
        };
        if (d.logo) opts.icon = d.logo;
        return self.registration.showNotification("Yanıtınız iletildi ✓", opts);
      }).catch(function () {
        return openPage(d.url + "&yanit=1");
      })
    );
    return;
  }
  e.waitUntil(openPage(d.url));
});

// Tarayıcı itme adresini yeniledi: sayfanın bıraktığı nottaki sipariş bağlantısıyla yeniden kaydol (eski adres biliniyorsa
// taşınır). Not yoksa sessizce geçilir — müşteri sayfayı yeniden açınca kart yine sorar.
self.addEventListener("pushsubscriptionchange", function (e) {
  var old = e.oldSubscription ? e.oldSubscription.endpoint : null;
  e.waitUntil(
    caches.open(NOT_KUTU).then(function (c) { return c.match(NOT_ADI); }).then(function (res) {
      return res ? res.json() : null;
    }).then(function (not) {
      return self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uBytes(PUSH_KEY) }).then(function (sub) {
        var j = sub.toJSON();
        var keys = j.keys || {};
        if (old) return rpc("push_move", { p_old: old, p_new: sub.endpoint, p_p256dh: keys.p256dh || null, p_auth: keys.auth || null });
        if (not && not.siparis) return rpc("push_subscribe", { p_order: not.siparis, p_endpoint: sub.endpoint, p_p256dh: keys.p256dh || null, p_auth: keys.auth || null });
        return null;
      });
    }).catch(function () {})
  );
});
