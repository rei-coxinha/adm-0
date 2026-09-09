/* ============================================================
   SW-ADM.js — Service Worker de Push do ADM
   Baseado no SW-PUSH-TESTE.js (que já provou funcionar).
   Escopo: registrado em './' pelo index.html do ADM.
   ============================================================ */

const CACHE_NAME = "sw-adm-v1";

/* ── INSTALL ── */
self.addEventListener("install", event => {
  console.log("[SW-ADM] 📦 install — instalando novo Service Worker do ADM...");
  event.waitUntil((async () => {
    await caches.open(CACHE_NAME);
    await self.skipWaiting();
    console.log("[SW-ADM] ✅ install concluído — skipWaiting() executado.");
  })());
});

/* ── ACTIVATE ── */
self.addEventListener("activate", event => {
  console.log("[SW-ADM] 🚀 activate — ativando Service Worker do ADM...");
  event.waitUntil((async () => {
    await self.clients.claim();
    console.log("[SW-ADM] ✅ activate concluído — clients.claim() executado. SW assumiu o controle.");
  })());
});

/* ── PUSH ── */
self.addEventListener("push", event => {
  console.log("[SW-ADM] 📨 Evento 'push' recebido pelo Service Worker.");

  event.waitUntil((async () => {
    let payload = {};

    // O backend (dynamic-function) envia: { notificacao: { titulo, mensagem, url, ... } }
    try {
      payload = event.data ? event.data.json() : {};
    } catch (_) {
      payload = { mensagem: event.data ? event.data.text() : "" };
    }

    console.log("[SW-ADM] 📦 Payload bruto recebido:", JSON.stringify(payload));

    // Aceita tanto { notificacao: {...} } quanto o objeto direto, por segurança
    const notificacao = payload.notificacao || payload;

    const titulo = notificacao.titulo || "🔔 ADM";
    const mensagem = notificacao.mensagem || "Você tem uma nova notificação no ADM.";
    const url = notificacao.url || "/";

    console.log("[SW-ADM] 📝 Dados extraídos → titulo:", titulo, "| mensagem:", mensagem, "| url:", url);

    // Tag determinística: se o MESMO Push for processado mais de uma vez,
    // a segunda tentativa atualiza a mesma notificação em vez de criar outra.
    // Se o backend fornecer um id, ele será usado; caso contrário usamos o conteúdo.
    const identificador = notificacao.id || notificacao.notification_id ||
      `${titulo}|${mensagem}|${url}`;
    let hash = 2166136261;
    for (let i = 0; i < identificador.length; i++) {
      hash ^= identificador.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const tagUnica = "sw-adm-" + (hash >>> 0).toString(36);

    console.log("[SW-ADM] ⏳ Chamando showNotification()... tag:", tagUnica);

    await self.registration.showNotification(titulo, {
      body: mensagem,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: tagUnica,
      renotify: false,
      data: { url, notificationId: notificacao.id || notificacao.notification_id || null }
    });

    console.log("[SW-ADM] ✅ showNotification() executado com sucesso para tag:", tagUnica);
  })());
});

/* ── NOTIFICATION CLICK ── */
self.addEventListener("notificationclick", event => {
  console.log("[SW-ADM] 🖱️ notificationclick — usuário clicou na notificação. tag:", event.notification.tag);

  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    console.log("[SW-ADM] 🔎 Janelas/abas encontradas para focar:", allClients.length);

    for (const client of allClients) {
      if ("focus" in client) {
        try {
          await client.navigate(new URL(url, self.location.origin).href);
        } catch (_) {
          console.warn("[SW-ADM] ⚠️ Não foi possível navegar na aba existente, apenas focando.");
        }
        console.log("[SW-ADM] ✅ Aba existente focada e navegada para:", url);
        return client.focus();
      }
    }

    if (self.clients.openWindow) {
      console.log("[SW-ADM] 🆕 Nenhuma aba aberta — abrindo nova janela em:", url);
      return self.clients.openWindow(new URL(url, self.location.origin).href);
    }
  })());
});
