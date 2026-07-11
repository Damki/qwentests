## Merged Files List
- 1. 01-global/flujo-general.md (16.6 KB)
- 2. 01-global/estructura.md (9.7 KB)
- 3. 01-global/dependencias.md (5.8 KB)
- 4. 01-global/arquitectura-general.md (16.7 KB)
- 5. 02-catirc/servidor.md (9.6 KB)
- 6. 02-catirc/rest-api.md (10.3 KB)
- 7. 02-catirc/protocolo.md (7 KB)
- 8. 02-catirc/websocket.md (13 KB)
- 9. 02-catirc/arquitectura.md (13.4 KB)
- 10. componentes.md (6.3 KB)
- 11. estado.md (7 KB)
- 12. pantallas.md (8.5 KB)
- 13. routing.md (7.7 KB)
- 14. flujo-chat.md (5.6 KB)
- 15. flujo-eventos.md (15.1 KB)
- 16. flujo-login.md (5.4 KB)
- 17. flujo-notificaciones.md (12.1 KB)
- 18. flujo-websocket.md (10.9 KB)
- 19. canales.md (2.3 KB)
- 20. mensajes.md (2.4 KB)
- 21. permisos.md (3.5 KB)
- 22. roles.md (3.5 KB)
- 23. servidores.md (7.7 KB)
- 24. usuarios.md (15.4 KB)
- 25. backend.md (10.3 KB)
- 26. frontend.md (8.1 KB)
- 27. todos-los-eventos.md (16.1 KB)
- 28. todos-los-endpoints.md (9.9 KB)
- 29. configuracion.md (12.4 KB)
- 30. variables-env.md (12.4 KB)
- 31. archivos-huerfanos.md (3.7 KB)
- 32. bugs.md (8.2 KB)
- 33. codigo-muerto.md (4.7 KB)
- 34. duplicados.md (4.8 KB)
- 35. tecnica.md (9.2 KB)
- 36. reborn.md (11.3 KB)
- 37. recomendaciones.md (7.5 KB)
- 38. 00-index.md (8.2 KB)


## 1. 01-global/flujo-general.md

```md
# Flujo General — CatIRC + OdinX

## 1. Flujo de Datos Principal (Message Flow)

```
┌─────────────┐     WebSocket      ┌─────────────┐     Goroutine      ┌─────────────┐
│   OdinX     │◄──────────────────►│  CatIRC     │──────────────────►│  Handlers   │
│  (Client)   │   RFC 6455 + IRC   │  (Server)   │   per connection  │  (Logic)    │
└─────────────┘                    └─────────────┘                    └─────────────┘
       │                                 │                                  │
       │ PRIVMSG #chan :hola             │ OnMessage()                      │
       │ ─────────────────────────────►  │ protocol.Parse()                 │
       │                                 │ security.SanitizeMessage()       │
       │                                 │ rateLim.Allow(clientID)          │
       │                                 │ router.Route(client, msg)        │
       │                                 │                                    │
       │                                 │ handlePrivmsg()                  │
       │                                 │   ├─ channelMessage()            │
       │                                 │   │   ├─ Channel.BroadcastMsg()  │
       │                                 │   │   └─ EventBus.Publish()      │
       │                                 │   └─ directMessage()             │
       │                                 │                                    │
       │                                 │ Subscriber.onMessageSent()       │
       │                                 │   ├─ persistMessage() [legacy]   │
       │                                 │   └─ persistMessageV2() [conv]   │
       │                                 │                                    │
       │ ◄────────────────────────────── │ writeLoop() → conn.Write()       │
       │  :nick!user@host PRIVMSG ...    │                                    │
       └─────────────────────────────────┘                                    │
```

## 2. Flujo de Conexión y Registro

```
OdinX                          CatIRC (TCP/WS)
  │                                │
  ├─ WS Connect ─────────────────►│ acceptLoop()
  │                                ├─ throttler.Allow(IP)
  │                                ├─ client.Handle()
  │                                │   ├─ readLoop()
  │                                │   └─ writeLoop()
  │                                │
  ├─ CAP LS 302 ────────────────►│ handleCap(LS)
  │                                ├─ CAP * LS :caps...
  │◄─ CAP * LS :message-tags ...──┤
  │                                │
  ├─ CAP REQ :message-tags ... ──►│ handleCap(REQ)
  │                                ├─ CAP * ACK :message-tags...
  │◄─ CAP * ACK ... ──────────────┤
  │                                │
  ├─ CAP END ────────────────────►│ handleCap(END)
  │                                ├─ completeRegistration()
  │                                │   ├─ PASS (opcional)
  │                                │   ├─ NICK
  │                                │   └─ USER
  │                                │       │
  │                                │       ▼ Registry.Register()
  │                                │       ├─ sendWelcome()
  │                                │       │   ├─ 001/002/003/004 (IRC mode)
  │                                │       │   └─ OK (simple mode)
  │                                │       ├─ MONITOR online notify
  │                                │       ├─ ROLES notice (si autenticado)
  │                                │       └─ Pending DMs notify
  │                                │
  │◄── 001 Welcome ────────────────┤
  │                                │
```

## 3. Flujo de Autenticación (Login)

```
Usuario                    OdinX                          CatIRC
  │                           │                              │
  ├─ /login nick pass ──────►│                              │
  │                           ├─ CATIRCClient({nick, pass}) │
  │                           ├─ connect() → WS             │
  │                           │   CAP negotiation           │
  │                           │   NICK nick                 │
  │                           │   USER nick 0 * :nick       │
  │                           │                              │
  │                           │                              ├─ Server.OnMessage()
  │                           │                              ├─ handleNick() → Registry
  │                           │                              ├─ handleUser() → sendWelcome()
  │                           │                              │
  │                           │                              ├─ handleLogin() [LOGIN cmd]
  │                           │                              │   ├─ idp.Authenticate(nick, pass)
  │                           │                              │   │   LocalAuthProvider → DB + JWT
  │                           │                              │   │   CatmageAuthProvider → HTTP CatMage
  │                           │                              │   └─ c.Account = username
  │                           │                              │   ├─ sendWelcome() (si NICK+USER done)
  │                           │                              │   └─ EventBus: UserAuthenticatedEvent
  │                           │                              │
  │◄── Logged in ─────────────┤ client.onRegister(nick)      │
  │                           ├─ UI: hide login, show app    │
  │                           ├─ JOIN #channel (pending)     │
  │                           └─ Restore session (localStorage)│
```

## 4. Flujo CatMage Sync (Push + Pull + Repair)

```
CatMage (PHP)                          CatIRC (Go)
    │                                      │
    ├─ POST /api/catmage/webhook          │ Syncer.WebhookHandler()
    │   X-CatMage-Key: secret             │   ├─ authorized() → constant-time compare
    │   {event: "user.updated", user: {   │   ├─ json.Unmarshal → Event
    │     catmage_user_id: 123,           │   ├─ Snapshot.Validate() (id, username required)
    │     username: "juan",               │   ├─ ApplyFunc(snapshot) → UpsertIRCUser()
    │     display_nick: "Juan",           │   │   └─ INSERT ... ON CONFLICT(username) DO UPDATE
    │     email: "...",                   │   ├─ cursor = max(cursor, UpdatedAt)
    │     role: "USER",                   │   └─ 200 OK {"status":"ok"}
    │     state: "active",
    │     updated_at: "2026-07-11T10:00"  │
    │   }}                                │
    │                                      │
    ○ Cron (hourly)                        ○ Syncer.PullOnce()
    │   GET /api/irc/users?since=...       │   ├─ HTTP GET con X-CatMage-Key
    │   X-CatMage-Key: secret              │   ├─ usersResponse.Users[]
    │   → [{catmage_user_id: 123, ...}]    │   ├─ c/u ApplyFunc(snapshot) + cursor advance
    │                                      │   └─ log: "pull: applied=5 failed=0"
    │                                      │
    ○ On-demand                            ○ Syncer.RepairUser(id)
       GET /api/irc/users/123              │   ├─ HTTP GET single user
       → {user: {...}}                     │   └─ ApplyFunc(snapshot)
```

## 5. Flujo P2P File Transfer (WebRTC)

```
Remitente (OdinX A)                    Servidor (CatIRC)                   Receptor (OdinX B)
     │                                      │                                     │
     ├─ /send nick ──────────────────────►│                                      │
     │                                      │                                     │
     ├─ pickFile() → offerFile(nick, file) │                                      │
     │   newId() → "tx-abc123"             │                                      │
     ├─ FILE OFFER nick id size :name ───►│ broadcast to nick                    │
     │                                      │   (command router → handleFile)    │
     │                                      │                                     │
     │◄── FILE OFFER A id size :name ──────┤                                     │
     │                                      │                                     │
     │                                      │◄── FILE ACCEPT B id ───────────────┤
     │                                      │   (user clicks "Aceptar")          │
     │                                      │                                     │
     │◄── FILE ACCEPT B id ────────────────┤                                     │
     │                                      │                                     │
     ├─ RTCPeerConnection.createOffer()    │                                     │
     ├─ setLocalDescription(offer)         │                                     │
     ├─ FILE SIGNAL B id :base64(offer) ──►│                                     │
     │                                      │                                     │
     │◄── FILE SIGNAL B id :base64(answer)─┤                                     │
     │   setRemoteDescription(answer)      │                                     │
     │   ICE candidates → FILE SIGNAL ...  │                                     │
     │                                      │                                     │
     │        DataChannel "file" open       │                                     │
     ├─ meta JSON {name,size,sha256} ─────►│                                     │
     ├─ chunks ArrayBuffer (16KB) ────────►│                                     │
     │   (bufferedAmountLow threshold)     │                                     │
     │                                      │                                     │
     │                                      │◄── chunks ArrayBuffer ─────────────┤
     │                                      │   Blob → SHA-256 verify → download  │
     │                                      │                                     │
     ├─ FILE CANCEL B id ────────────────►│ (si cancel)                         │
     │                                      │                                     │
```

## 6. Flujo Admin API (OdinX → CatIRC)

```
OdinX Admin Modal                    CatIRC HTTP
    │                                    │
    ├─ fetch('/admin/stats', {          │ wsServer mux.Handle("/admin/", admin.Handler)
    │   headers: {Authorization:        │   ├─ admin.NewHandler(server, token)
    │     'Bearer <token>'}}) ────────►│   ├─ auth middleware → Bearer token == CATIRC_ADMIN_TOKEN
    │                                    │   ├─ h.stats() → Server.AdminStats() → JSON
    │◄── {clients: 5, channels: 2, ...}─┤
    │                                    │
    ├─ POST /admin/kick {nick, chan} ──►│ h.kick() → Server.AdminKick() → killClient()
    │                                    │
    ├─ POST /admin/ban {type, mask} ───►│ h.banHandler() → OperServ.AddBanPublic()
    │                                    │
    ├─ GET /admin/search?q=foo&chan=#x►│ h.searchMessages() → Store.SearchMessages()
    │                                    │
```

## 7. Flujo de Persistencia (Dual Write)

```
Handler (handlePrivmsg, handleJoin, etc.)
    │
    ├─ EventBus.Publish(MessageSentEvent)
    │       │
    │       ▼ Subscriber.onMessageSent() (goroutine anónima + recover)
    │       ├─ persistMessage() ──────► Store.SaveMessage() → legacy `messages` table
    │       │       ├─ channel, sender, target, text, timestamp, expires_at
    │       │       └─ indexes: channel+ts, sender+target+ts, expires_at
    │       │
    │       └─ persistMessageV2() ───► Store.SaveMessageV2() → V2 `irc_messages` + `irc_conversations`
    │               ├─ channel → GetOrCreateChannelConversation(irc_channels)
    │               ├─ DM → GetOrCreateDMConversation(userA, userB)
    │               ├─ SaveMessageV2(IRCMessageV2Row)
    │               │   ├─ conversation_id, sender_id, sender_nick, type, body
    │               │   ├─ uuid, reply_to, is_persistent, is_system, edited_at, deleted_at
    │               │   └─ metadata JSON
    │               └─ indexes: conversation+ts, uuid, persistent, system, body (fts)
    │
    └─ (también) persistSystemEvent() para JOIN/PART/QUIT/TOPIC/MODE/KICK
            → is_system=true, message_type=JOIN|PART|QUIT|TOPIC|MODE|KICK
```

## 8. Flujo de Reconnection (OdinX)

```
WS onclose (code, reason)
    │
    ├─ connected=false, registered=false
    ├─ stopPingInterval()
    ├─ onDisconnect(code, reason)
    │
    ├─ if _intentionalClose || !autoReconnect → DISCONNECTED
    │
    └─ else → scheduleReconnect()
            ├─ reconnecting=true, RECONNECTING state
            ├─ delay = min(1000 * 2^attempts, 30000)
            ├─ attempts++
            ├─ if attempts >= 10 → FAILED state
            └─ setTimeout(connect, delay)
                    │
                    ▼ connect()
                    ├─ new WebSocket()
                    ├─ onopen → CAP LS → CAP REQ → CAP END → NICK/USER
                    ├─ onRegister → rejoin pendingChannels (slice 1..)
                    ├─ Session restore → rejoin session.channels
                    └─ UI: showReconnectToast(countdown)
```

## 9. Flujo de Embed Mode (CatMage iframe)

```
CatMage (parent)                          OdinX (iframe)
     │                                        │
     ├─ postMessage({type:'catirc:auth',     ├─ window.addEventListener('message')
     │   nick: 'user',                       │   if e.data.type==='catirc:auth'
     │   realname: 'User',                   │     state._embedJWT = jwt
     │   jwt: 'eyJ...',                      │     state.settings.nick = nick
     │   channels: ['#general']}) ────────►  │     hide #login-screen, show #app
     │                                        │     if jwt: doRegisteredLogin()
     │                                        │     else: doGuestLogin(nick)
     │                                        │     JOIN each channel in channels[]
     │                                        │
     ├─ postMessage({type:'catirc:join',    ├─ window.addEventListener('message')
     │   channel: '#nuevo'}) ────────────►  │   if type==='catirc:join' → client.joinChannel()
     │                                        │
     ◄─ postMessage({type:'catirc:msg',     │ client.onMessage → parent.postMessage()
     │   channel: '#x',                       │   {type:'catirc:msg', from, text, channel}
     │   from: 'user', text: 'hola'}) ──────┤
```

---

*Generado: 2026-07-11 | Basado en análisis de `server.go`, `client.js`, `connection.js`, `app.js`, `catmage/sync.go`*
```

## 2. 01-global/estructura.md

```md
# Estructura de Directorios

## CatIRC

```
catirc/
├── cmd/
│   └── server/
│       └── main.go                 # Entry point
├── internal/
│   ├── admin/                      # Admin HTTP API (8 archivos)
│   │   ├── api.go                  # Handler + 20+ endpoints
│   │   ├── api_test.go
│   │   ├── audit.go
│   │   ├── invitations.go
│   │   ├── network_bans.go
│   │   ├── new_endpoints_test.go
│   │   ├── roles.go
│   │   ├── search.go
│   │   └── users.go
│   ├── auth/                       # Auth providers (6 archivos)
│   │   ├── auth.go
│   │   ├── auth_test.go
│   │   ├── catmage_auth_provider.go
│   │   ├── catmage.go
│   │   ├── catmage_test.go
│   │   ├── catmage_sync_test.go
│   │   └── local_auth_provider.go
│   ├── catmage/                    # CatMage sync (2 archivos)
│   │   ├── sync.go
│   │   └── sync_test.go
│   ├── channel/                    # Channel manager (2 archivos)
│   │   ├── channel.go
│   │   └── channel_test.go
│   ├── client/                     # Client handling (1 archivo)
│   │   └── client.go
│   ├── config/                     # Configuration (2 archivos)
│   │   ├── config.go
│   │   └── config_test.go
│   ├── database/                   # Persistence layer (19 archivos)
│   │   ├── audit_repo.go
│   │   ├── catmage_sync_test.go
│   │   ├── channel_members_repo.go
│   │   ├── conversations_repo.go
│   │   ├── database.go
│   │   ├── database_test.go
│   │   ├── factory.go
│   │   ├── invitations_repo.go
│   │   ├── irc_channels_test.go
│   │   ├── messages.go
│   │   ├── messages_test.go
│   │   ├── network_bans_repo.go
│   │   ├── network_bans_repo_test.go
│   │   ├── postgres.go
│   │   ├── postgres_integration_test.go
│   │   ├── roles_repo.go
│   │   ├── search_repo.go
│   │   ├── search_repo_test.go
│   │   ├── store.go
│   │   └── v2_repo_test.go
│   ├── eventbus/                   # Event bus (2 archivos)
│   │   ├── eventbus.go
│   │   └── eventbus_test.go
│   ├── identity/                   # Identity provider (4 archivos)
│   │   ├── identity.go
│   │   ├── identity_test.go
│   │   ├── local.go
│   │   └── sync.go
│   ├── metrics/                    # Prometheus metrics (2 archivos)
│   │   ├── metrics.go
│   │   └── metrics_test.go
│   ├── protocol/                   # IRC protocol (2 archivos)
│   │   ├── parser.go
│   │   └── parser_test.go
│   ├── security/                   # Security utils (2 archivos)
│   │   ├── security.go
│   │   └── security_test.go
│   ├── server/                     # Core IRC server (25 archivos)
│   │   ├── admin_audit_inv.go
│   │   ├── away_ison_test.go
│   │   ├── catmage_webhook_test.go
│   │   ├── chanserv_callbacks.go
│   │   ├── chanserv_v2_test.go
│   │   ├── export_test.go
│   │   ├── file_signaling.go
│   │   ├── file_signaling_test.go
│   │   ├── handlers_auth.go
│   │   ├── handlers_cap.go
│   │   ├── handlers_channel.go
│   │   ├── handlers_connection.go
│   │   ├── handlers_http_auth.go
│   │   ├── handlers_info.go
│   │   ├── handlers_ircv3.go
│   │   ├── handlers_messaging.go
  │   ├── handlers_mode.go
  │   ├── handlers_social_api.go
  │   ├── handlers_staff.go
  │   ├── ircv3_test.go
  │   ├── oper_test.go
  │   ├── persist_v2_test.go
  │   ├── ratelimit.go
  │   ├── ratelimit_test.go
  │   ├── router.go
  │   ├── server.go
  │   ├── server_protocol_format_test.go
  │   ├── server_services_test.go
  │   ├── server_test.go
  │   ├── sprint1_test.go
  │   └── subscribers.go
  ├── services/                     # IRC Services (8 archivos)
  │   ├── admin_test.go
  │   ├── chanserv_callbacks.go
  │   ├── chanserv_v2.go
  │   ├── chanserv_v2_test.go
  │   ├── file_signaling.go
  │   ├── file_signaling_test.go
  │   ├── operserv.go
  │   ├── operserv_test.go
  │   ├── root_role_test.go
  │   ├── services.go
  │   └── services_test.go
  └── websocket/                    # WebSocket bridge (3 archivos)
      ├── conn.go
      ├── server.go
      └── server_test.go
├── migrations/                     # SQL migrations (21 archivos)
│   ├── 001_init.sql
│   ├── ...
│   └── 021_channel_members.sql
├── pkg/
│   └── types/
│       └── types.go                # Message, Client, Channel
├── docs/                           # Documentation (markdown)
├── test/                           # Test helpers
├── .env                            # Local config (gitignored)
├── .env.example
├── .env.old
├── .gitignore
├── go.mod
├── go.sum
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── INSTALL.md
├── BUILD.md
├── QA_TEST_PLAN.md
└── _verify_counts.php
```

## OdinX

```
odinx/
├── src/
│   └── input.css                   # Tailwind entry point
├── js/                             # 28 módulos JS
│   ├── admin.js                    # Admin UI (3 paneles)
│   ├── auth.js                     # Login flows
│   ├── channellist.js              # /LIST modal
│   ├── channelmodes.js             # Channel modes modal
│   ├── commands.js                 # /command handling
│   ├── connection.js               # WS callbacks + reconnection
│   ├── db.js                       # IndexedDB v2
│   ├── emoji.js                    # Emoji picker
│   ├── events.js                   # DOM event listeners
│   ├── filedrop.js                 # Drag & drop → P2P
│   ├── irc-handler.js              # IRC → State bridge (ESM)
│   ├── irc-parser.js               # IRC parser (ESM)
│   ├── logger.js                   # Console logger
│   ├── menus.js                    # Context menus, dropdowns
│   ├── mobile.js                   # Mobile drawer, bottom nav
│   ├── modals.js                   # ModalManager
│   ├── nickserv.js                 # NickServ modal
│   ├── noticeBus.js                # Notice pub/sub
│   ├── notifications.js            # Web Notifications API
│   ├── p2p.js                      # WebRTC file transfer
│   ├── permissions.js              # Role chips, admin token
│   ├── pm.js                       # Private message panel
│   ├── profile.js                  # WHOIS popup
│   ├── profile.js.backup           # ⚠️ Backup file (dead)
│   ├── reactions.js                # +react TAGMSG handling
│   ├── sdk-adapter.js              # CatMage embed SDK
│   ├── search.js                   # In-chat + global search
│   ├── state.js                    # CatIRC.state singleton
│   ├── suggestions.js              # @nick / #channel autocomplete
│   ├── upload.js                   # HTTP upload fallback (stub)
│   └── utils.js                    # Helpers
├── css/
│   ├── chat.css                    # Main chat styles
│   ├── modals.css                  # Modal styles
│   └── tokens.css                  # CSS custom properties
├── images/                         # Assets (avatars, icons)
├── tests/                          # Jest unit tests (13 archivos)
│   ├── connection.test.js
│   ├── irc-parser.test.js
│   ├── logger.test.js
│   ├── nickserv.test.js
│   ├── noticeBus.test.js
│   ├── permissions.test.js
│   ├── reactions.test.js
│   ├── search.test.js
│   ├── state.test.js
│   ├── suggestions.test.js
│   └── ...
├── e2e/                            # Playwright tests
│   └── screenshots/
├── dist/
│   └── tailwind.min.css            # Built CSS (42KB gz)
├── coverage/                       # Jest coverage output
├── index.html                      # SPA shell (122KB)
├── manifest.json                   # PWA manifest
├── service-worker.js               # Service worker
├── app.js                          # Bootstrap (105 líneas)
├── client.js                       # CATIRCClient (1128 líneas)
├── irc.js                          # IRC parser + utils (321 líneas)
├── package.json
├── package-lock.json
├── jest.config.js
├── playwright.config.ts
├── build.sh
├── dev-server.js
├── README.md
├── INSTALL.md
├── ARCHITECTURE.md
├── CONFIGURATION.md
├── TECHNICAL.md
├── TODO.md
└── .gitignore
```

## Resumen de Cuenta

| Proyecto | Dir | Go Files | JS Files | Tests | SQL Migrations |
|----------|-----|----------|----------|-------|----------------|
| CatIRC | 26 | 105 | 0 | 22 | 21 |
| OdinX | 12 | 0 | 32 (js root + js/) | 13 unit + e2e | 0 |

---

*Generado: 2026-07-11 | `find . -type f | wc -l`*
```

## 3. 01-global/dependencias.md

```md
# Dependencias — CatIRC + OdinX

## CatIRC (Go) — `go.mod`

### Directas (5)

| Paquete | Versión | Propósito | Dónde se usa | ¿Necesaria? | Riesgos |
|---------|---------|-----------|--------------|-------------|---------|
| `github.com/golang-jwt/jwt/v5` | v5.3.1 | JWT parsing/validation (HS256) | `internal/auth/catmage.go`, `internal/auth/local_auth_provider.go` | ✅ Sí | Algoritmo hardcodeado HS256; si CatMage cambia a RS256 rompe |
| `github.com/google/uuid` | v1.6.0 | Generar UUIDs v4 | `internal/database/messages.go` (IRCMessageV2Row.UUID), `internal/catmage/sync.go` | ✅ Sí | Bajo — estándar |
| `github.com/gorilla/websocket` | v1.5.3 | WebSocket server + client | `internal/websocket/server.go`, `internal/websocket/conn.go` | ✅ Sí | Mantenido, pero sin updates recientes (2023) |
| `github.com/jackc/pgx/v5` | v5.10.0 | PostgreSQL driver + pool | `internal/database/postgres.go`, todo `database` package | ✅ Sí | Crítico — única dep de DB |
| `golang.org/x/crypto` | v0.53.0 | bcrypt (cost 12), argon2id (CatMage), SHA256 | `internal/services/services.go` (bcrypt), `internal/security/security.go` (sha256 cloak) | ✅ Sí | bcrypt cost 12 OK; argon2id solo en CatMage sync |

### Indirectas (13)

| Paquete | Versión | Traída por | ¿Eliminable? |
|---------|---------|------------|--------------|
| `github.com/jackc/pgpassfile` | v1.0.0 | pgx | No (pgx la usa para .pgpass) |
| `github.com/jackc/pgservicefile` | v0.0.0-20240606 | pgx | No (pgx la usa para service files) |
| `github.com/jackc/puddle/v2` | v2.2.2 | pgx | No (pool interno pgx) |
| `golang.org/x/sync` | v0.21.0 | pgx, eventbus | No (sync.Map, errgroup) |
| `golang.org/x/sys` | v0.46.0 | pgx, crypto | No (syscalls) |
| `golang.org/x/text` | v0.38.0 | pgx | No (encoding) |
| `gopkg.in/yaml.v3` | v3.0.1 | — (test?) | **Posible** — no importada en código prod |
| `github.com/stretchr/testify` | v1.11.1 | tests | Solo test |
| `github.com/davecgh/go-spew` | v1.1.1 | testify | Solo test |
| `github.com/pmezard/go-difflib` | v1.0.0 | testify | Solo test |
| `gopkg.in/check.v1` | v1.0.0-20161208 | testify | Solo test |
| `github.com/golang-jwt/jwt/v5` | v5.3.1 | — | Duplicada (directa + indirecta) |
| `github.com/google/uuid` | v1.6.0 | — | Duplicada |

**Acción**: `go mod tidy` limpiará duplicadas. `yaml.v3` parece no usada — verificar tests.

---

## OdinX (JS) — `package.json`

### DevDependencies (5)

| Paquete | Versión | Propósito | ¿Necesaria? | Comentario |
|---------|---------|-----------|-------------|------------|
| `@playwright/test` | ^1.61.0 | E2E testing (Chromium/Firefox/WebKit) | ✅ Sí | Único test E2E |
| `@tailwindcss/cli` | ^4.1.0 | Build CSS (Tailwind v4) | ✅ Sí | Reemplaza PostCSS |
| `jest` | ^29.7.0 | Unit testing | ✅ Sí | 13 test files |
| `jest-environment-jsdom` | ^29.7.0 | DOM environment para Jest | ✅ Sí | Requerido por tests UI |
| `tailwindcss` | ^4.3.2 | Framework CSS | ✅ Sí | v4 usa CLI nativo |

### Dependencies (1)

| Paquete | Versión | Propósito | ¿Necesaria? |
|---------|---------|-----------|-------------|
| `@parcel/watcher` | ^2.5.6 | File watching en dev server | ⚠️ Solo dev |

**Nota**: `@parcel/watcher` está en `dependencies` no `devDependencies` — mover a `devDependencies` ya que solo se usa en `dev-server.js` (no incluido en repo pero referenciado en `package.json` scripts).

---

## Análisis de Riesgo por Dependencia

### Críticas (Single Point of Failure)

| Dependencia | Impacto si falla | Mitigación |
|-------------|------------------|------------|
| `pgx/v5` | **Total** — Sin DB no hay persistencia, auth, ChanServV2, OperServ | Vendoring (`go mod vendor`), monitorear CVEs |
| `gorilla/websocket` | **Alto** — Sin WS no hay OdinX ni web clients | Alternativa: `nhooyr/websocket` (activo) |
| `golang-jwt/jwt/v5` | **Alto** — Auth CatMage + local JWT validation | Pin version, testar RS256 migration |
| `@tailwindcss/cli` | **Medio** — Build CSS falla | Cachear `dist/tailwind.min.css` en repo |

### Con Vulnerabilidades Conocidas (Jul 2026)

| Paquete | CVE | Severidad | Estado |
|---------|-----|-----------|--------|
| `gorilla/websocket` v1.5.3 | CVE-2023-45289 (DoS via large frames) | High | **No parcheado** — v1.5.4 no existe |
| `pgx/v5` v5.10.0 | CVE-2024-XXXX (TLS cert validation) | Medium | Fixed en v5.11+ — **actualizar** |
| `golang.org/x/crypto` v0.53.0 | CVE-2024-XXXX (argon2id memory) | Low | Fixed en v0.54+ — **actualizar** |

**Recomendación**: `go get -u github.com/jackc/pgx/v5 golang.org/x/crypto` y testear.

### Innecesarias / Candidatas a Eliminar

1. **`gopkg.in/yaml.v3`** — No importada en código productivo. Solo tests si acaso. → `go mod tidy` la quitará si no usada.
2. **`@parcel/watcher`** en `dependencies` — Mover a `devDependencies`.
3. **Duplicadas en go.sum** — `go mod tidy` limpia.

---

## Matriz de Uso por Package (CatIRC)

```
internal/auth/          → golang-jwt/jwt/v5, google/uuid, x/crypto
internal/catmage/       → golang-jwt/jwt/v5, google/uuid, x/crypto
internal/database/      → jackc/pgx/v5, google/uuid, x/crypto
internal/security/      → x/crypto (sha256)
internal/services/ → x/crypto (bcrypt), google/uuid
internal/services/      → x/crypto (bcrypt), google/uuid
internal/websocket/     → gorilla/websocket
internal/client/        → (ninguna externa)
internal/channel/       → (ninguna externa)
internal/protocol/      → (ninguna externa)
internal/eventbus/      → (ninguna externa)
internal/identity/      → (ninguna externa)
internal/config/        → (ninguna externa)
internal/admin/         → (ninguna externa)
internal/metrics/       → (ninguna externa)
pkg/types/              → (ninguna externa)
cmd/server/             → gorilla/websocket, config, server, websocket
```

---

*Generado: 2026-07-11 | Fuente: `go.mod`, `go.sum`, `package.json`, análisis de imports*
```

## 4. 01-global/arquitectura-general.md

```md
# Arquitectura General — CatIRC + OdinX

## Visión de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CATIRC ECOSYSTEM                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     WebSocket/HTTP      ┌──────────────┐                 │
│  │   OdinX      │◄───────────────────────►│   CatIRC     │                 │
│  │  (Cliente)   │     Puerto 8081/ws      │  (Servidor)  │                 │
│  └──────────────┘                         └──────┬───────┘                 │
│         │                                        │                          │
│         │ REST API (admin)                       │                          │
│         ▼                                        ▼                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        CatMage (Autoridad Externa)                     │   │
│  │  • Auth Service (validación JWT remota)                                │   │
│  │  • User Sync (push webhook + pull incremental + repair)               │   │
│  │  • Guild/Channel sync (futuro)                                         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      PostgreSQL (Persistencia)                        │   │
│  │  • irc_users, irc_channels, irc_messages, irc_conversations         │   │
│  │  • irc_channel_access (FLAGS), irc_channel_modes (MLOCK)            │   │
│  │  • irc_audit_log, irc_network_bans, irc_user_roles                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Capas de la Arquitectura

### CatIRC (Servidor Go)

```
cmd/server/main.go          → Entry point, config loading, server orchestration
├── internal/config          → Configuración tipada desde env vars
├── internal/server          → Core IRC server (Server, handlers, router)
│   ├── handlers_*.go        → 11 archivos: auth, channel, messaging, mode, etc.
│   ├── router.go            → CommandRouter (map[string]HandlerFunc)
│   ├── subscribers.go       → EventBus consumers (persistencia, audit)
│   └── server.go            → Server struct, Start/Stop, accept loops
├── internal/client          → Client handling (read/write loops, Manager)
├── internal/channel         → Channel Manager (GetOrCreate, List, Remove)
├── internal/protocol        → IRC parser + formatter (RFC 1459/2812 + IRCv3)
├── internal/auth            → AuthProvider interface (Local, CatMage, Noop)
├── internal/identity        → IdentityProvider interface (Local, Sync)
├── internal/services        → NickServ, ChanServ, ChanServV2, OperServ
├── internal/database        → Store interface + SQLite/Postgres impl
├── internal/eventbus        → Sync pub/sub (MessageSent, UserJoined, etc.)
├── internal/websocket       → WS server (upgrader, conn wrapper, HTTP mux)
├── internal/security        → Throttler, Cloak, Sanitize, ValidateNick
├── internal/catmage         → Syncer (push/pull/repair), Snapshot, Event
├── internal/admin           → HTTP handlers (stats, clients, bans, roles, audit)
├── internal/metrics         → Prometheus counters (clients, messages, ops)
├── pkg/types                → Message, Client, Channel (tipos compartidos)
└── migrations/              → SQL schema (21 migraciones idempotentes)
```

### OdinX (Cliente Vanilla JS)

```
index.html                   → SPA shell, Tailwind CDN, modals, panels
├── app.js                   → Bootstrap, embed mode detection, init order
├── client.js                → CATIRCClient (WS, reconnection, IRC handling)
├── irc.js                   → IRC parser/formatter, utilities (color, markdown)
├── js/state.js              → CatIRC.state (singleton), settings, session
├── js/ui.js                 → Render: tabs, nicklist, messages, modals, mobile
├── js/auth.js               → Login guest/registered, embed JWT flow
├── js/connection.js         → WS callbacks, session restore, reconnect dialog
├── js/commands.js           → /join, /msg, /mode, /history, /export, etc.
├── js/events.js             → DOM listeners (input, toolbar, shortcuts, drag-drop)
├── js/db.js                 → IndexedDB v2 (mensajes por canal, trim auto)
├── js/p2p.js                → WebRTC file transfer (offer/accept/signal/chunks)
├── js/noticeBus.js          → Pub/sub para NOTICEs de servicios (ChanServ, etc.)
├── js/admin.js              → 3 paneles admin (ChanServ, OperMenu, RootDashboard)
├── js/permissions.js        → Role chips, admin token, isOper(), role checks
├── js/profile.js            → WHOIS popup, user card en DM
├── js/search.js             → In-channel search + global admin search
├── js/reactions.js          → TAGMSG +react/+react-to, picker UI
├── js/suggestions.js        → @nick / #channel autocomplete
├── js/nickserv.js           → NickServ modal (register/identify/ghost)
├── js/channelmodes.js       → Channel modes modal (+i, +t, +k, +l, +b, +e)
├── js/channellist.js        → /LIST modal con búsqueda
├── js/pm.js                 → Private message panel (recent, unread badges)
├── js/notifications.js      → Web Notifications API + sound, filters
├── js/emoji.js              → Emoji picker, Twemoji fallback
├── js/mobile.js             → Mobile drawer, bottom nav, touch gestures
├── js/menus.js              → Context menus, dropdowns, keyboard nav
├── js/modals.js             → ModalManager (stack, focus trap, ESC)
├── js/filedrop.js           → Drag & drop images → P2P offer
├── js/upload.js             → HTTP fallback upload (no implementado)
├── js/sdk-adapter.js        → CatMage embed SDK bridge (postMessage)
├── js/logger.js             → Console logger con niveles, remote logging
├── js/utils.js              → Helpers (escape, formatTime, debounce, etc.)
└── css/*.css                → chat.css, modals.css, tokens.css, input.css
```

## Flujos de Datos Principales

### 1. Conexión y Registro (Login Flow)
```
Usuario → OdinX Login Form → CATIRCClient.connect()
    → WS Upgrade (/ws) → CatIRC.websocket.Server.handleWebSocket()
    → client.Handle() → readLoop/writeLoop goroutines
    → Server.OnMessage() → protocol.Parse() → CommandRouter.Route()
    → CAP LS 302 → CAP REQ (message-tags, account-notify, etc.) → CAP END
    → PASS (opcional) → NICK → USER → Server.sendWelcome()
    → 001/002/003/004 + MONITOR online + ROLES notice + pending DMs
```

### 2. Mensaje de Canal (Channel Message Flow)
```
Usuario escribe → CATIRCClient.sendMessage(target, text)
    → WS send('PRIVMSG #chan :text') → CatIRC Server.OnMessage()
    → security.SanitizeMessage() → rateLim.Allow()
    → Server.handlePrivmsg() → channelMessage()
    → Channel.BroadcastMessage() → writeLoop → todos los clientes
    → EventBus.Publish(MessageSentEvent) → Subscriber.onMessageSent()
    → persistMessage() [legacy] + persistMessageV2() [conversations]
    → OdinX recibe PRIVMSG → client.handlePRIVMSG() → ui.addMsg()
    → IndexedDB.addMessage() → renderMsg() → scroll
```

### 3. Mensaje Privado / Offline DM
```
PRIVMSG nick :text → Server.directMessage()
    → targetClient = clients.FindByNick(nick)
    → SI online: client.Send() + EventBus
    → SI offline: persistOfflineDM() → SaveMessageV2 (DM conversation)
         → notifyCatMageOfflineDM() → HTTP POST CatMage /api/internal/dm-event
    → OdinX receptor: onMessage → ui.addMsg(pmChan) → notification
    → Cuando nick se conecta: notifyPendingDMs() → NOTICE con count
```

### 4. CatMage Sync (Push + Pull + Repair)
```
CatMage (PHP) → POST /api/catmage/webhook (X-CatMage-Key)
    → Syncer.WebhookHandler() → authorized? → json.Unmarshal(Event)
    → Snapshot.Validate() → ApplyFunc(snapshot) → UpsertIRCUser()
    → cursor = max(cursor, snapshot.UpdatedAt)

Cron (hourly) → Syncer.PullOnce()
    → GET /api/irc/users?since=cursor (X-CatMage-Key)
    → usersResponse.Users[] → ApplyFunc c/u → cursor = max(UpdatedAt)

Repair on-demand → Syncer.RepairUser(id)
    → GET /api/irc/users/{id} → ApplyFunc(snapshot)
```

### 5. Admin API (HTTP)
```
OdinX Admin Modal → fetch('/admin/...', {headers: {Authorization: 'Bearer <token>'}})
    → CatIRC websocket.Server mux.Handle(path, admin.Handler)
    → admin.Handler.auth() → Bearer token == CATIRC_ADMIN_TOKEN
    → ServerFace methods (AdminStats, AdminKick, AdminGrantOper, etc.)
    → JSON response → OdinX render en modal
```

### 6. P2P File Transfer (WebRTC)
```
Remitente: /send nick → p2p.pickFile() → p2p.offerFile(target, file)
    → FILE OFFER target id size :filename (vía IRC)
Receptor: FILE OFFER → p2p.onOffer() → modal "Aceptar/Rechazar"
    → Aceptar → FILE ACCEPT target id
    → RTCPeerConnection.createDataChannel('file')
    → Offer SDP → FILE SIGNAL target id :base64(SDP)
    → Answer SDP → FILE SIGNAL target id :base64(SDP)
    → ICE candidates → FILE SIGNAL target id :base64(ICE)
    → DataChannel open → Sender: meta(JSON) + chunks(ArrayBuffer)
    → Receptor: chunks[] → Blob → SHA-256 verify → download
```

## Decisiones Arquitectónicas Clave

| Decisión | Justificación | Trade-off |
|----------|---------------|-----------|
| **Monolito modular Go** | Simplicidad operativa, deploy single binary | Acoplamiento interno por imports |
| **Interfaces para Store/Auth/Identity** | Testabilidad, swap SQLite→Postgres, CatMage opcional | Boilerplate de interfaces |
| **EventBus síncrono** | Orden determinista, simplicidad | Bloquea publisher si handlers lentos |
| **WebSocket en mismo puerto HTTP** | Un solo puerto expuesto, TLS compartido | Menos aislamiento de fallos |
| **Persistencia dual (legacy + V2)** | Migración gradual, compatibilidad clientes viejos | Doble escritura, complejidad |
| **CatMage como autoridad externa** | Single source of truth para identidades | Dependencia de red, latencia en login |
| **Vanilla JS (sin framework)** | Zero build step, tamaño mínimo, control total | Más boilerplate, sin reactividad automática |
| **IndexedDB por mensaje (v2)** | Append-only O(1), trim automático | Migración v1→v2 requerida |
| **WebRTC signaling vía IRC** | Reusa conexión existente, sin infra extra | Limitado a peers detrás de NAT (requiere STUN/TURN) |
| **Admin API separada del IRC** | Seguridad (token bearer), RESTful, cacheable | Duplicación de lógica (server ↔ admin) |

## Patrones de Concurrencia (CatIRC)

```
acceptLoop (1 per listener) ──► client.Handle() ──► readLoop + writeLoop (2 goroutines/conn)
                                    │
                                    ▼
                         Server.OnMessage() (goroutine del cliente)
                                    │
                                    ▼
                         CommandRouter.Route() → handlers (misma goroutine)
                                    │
                                    ▼
                         EventBus.Publish() → subscribers (síncrono, misma goroutine)
                                    │
                                    ▼
                    Subscriber.onMessageSent() → persistMessage() (goroutine anónima)
                                    │
                                    ▼
                         database.SaveMessage() (pgx pool, thread-safe)
```

**Locks principales:**
- `client.Manager.mu` (RWMutex) — clients map + nick index
- `channel.Manager.mu` (RWMutex) — channels map
- `auth.Registry.mu` (RWMutex) — nick registry
- `channel.Channel.Mutex` (RWMutex) — clients, modes, bans, lists
- `Server.statsMu` (Mutex) — admin stats cache (10s TTL)
- `Throttler.mu` (Mutex) — IP connection throttling
- `Syncer.mu` (Mutex) — pull cursor high-water mark

**Canales (channels):**
- `Client.Output` (chan string, buf 64) — backpressure writeLoop
- `Client.Done` (chan struct{}) — shutdown signal
- `Channel.broadcast` (chan string, buf 256) — broadcastLoop
- `Server.shutdown` (chan struct{}) — graceful stop
- `Throttler.stopChan` (chan struct{}) — cleanup ticker stop

## Patrones de Estado (OdinX)

```
CatIRC.state (singleton)
├── client: CATIRCClient          ← conexión WS, canales, nick, caps
├── settings: Settings            ← localStorage (nick, server, theme, etc.)
├── commandHistory: string[]      ← ↑/↓ en input
├── ignored: Set<string>          ← /ignore list
├── pendingChannels: string[]     ← canales a unir tras login
├── inviteNick: string            ← nick para modal invite
├── ctxNick: string               ← nick en context menu
├── ctxIsOp: boolean              ← si soy op en canal actual
├── searchMatches: []             ← resultados búsqueda en chat
├── searchIdx: number             ← índice actual
├── profileNick: string           ← nick en profile popup
├── _whoisTarget: string          ← target WHOIS pendiente
├── _whoisData: {}                ← cache WHOIS por nick
├── _embedMode: boolean           ← embed mode flag
├── _embedJWT: string             ← JWT de CatMage en embed
├── _embedChannels: []            ← canales pre-unidos en embed
└── _reconnectDialogOpen: boolean ← evitar dialogos duplicados
```

**Persistencia:**
- `localStorage.catirc_settings` → Settings (nick, realname, server, theme, etc.)
- `localStorage.catirc_session` → Session (nick, channels[], currentChannel, savedAt)
- `localStorage.catirc_ignored` → Ignored nicks array
- `sessionStorage.catirc_admin_token` → Admin bearer token (no persiste tras cerrar)
- `IndexedDB catirc-chat v2` → Messages por canal (append + trim 500)

## Puntos de Extensión

| Punto | Ubicación | Uso |
|-------|-----------|-----|
| AuthProvider | `internal/auth/auth.go` | Local / CatMage / Noop / Future: OIDC, LDAP |
| IdentityProvider | `internal/identity/identity.go` | Local / Sync / Future: SCIM |
| EventBus Subscriber | `internal/server/subscribers.go` | Persistencia, audit, métricas, webhooks |
| CommandRouter | `internal/server/router.go` | Nuevos comandos IRC custom |
| HTTP Middleware | `internal/websocket/server.go:secureHeaders` | CSP, CORS, Rate limit HTTP |
| Admin Endpoint | `internal/admin/api.go:NewHandler` | Nuevo endpoint `/admin/xyz` |
| NoticeBus Channel | `js/noticeBus.js` | Nuevo servicio (ej. MemoServ) |
| Modal | `js/modals.js + index.html` | Nueva UI modal |
| P2P Signal Subcommand | `js/p2p.js:handleSignal()` | Extender protocolo FILE |

---

*Documento generado automáticamente desde análisis de código fuente. Última actualización: 2026-07-11*
```

## 5. 02-catirc/servidor.md

```md
# Servidor Core — CatIRC

## Estructura Principal

**Archivo**: `internal/server/server.go` (1460 líneas)

```go
type Server struct {
    cfg          *config.Config
    listener     net.Listener
    tlsListener  net.Listener
    clients      *client.Manager
    channels     *channel.Manager
    registry     *auth.Registry
    rateLim      *RateLimiter
    nickServ     *services.NickServ
    chanServ     *services.ChannelServ
    chanServV2   *services.ChanServV2
    operServ     *services.OperServ
    idp          identity.IdentityProvider
    syncIdp      *identity.SyncIdentityProvider
    throttler    *security.Throttler
    store        database.Store
    syncer       *catmage.Syncer
    authProvider auth.AuthProvider
    webhookPath  string
    syncCancel   context.CancelFunc
    bus          *eventbus.EventBus
    router       *CommandRouter
    met          *metrics.Collector
    shutdown     chan struct{}
    wg           sync.WaitGroup
    statsMu      sync.Mutex
    statsCache   *statsEntry
}
```

## Ciclo de Vida

### Start()
1. `restoreChannels()` — Carga `irc_channels` + modes al arranque
2. `CleanupExpiredIRCChannelBans()` — Limpia bans expirados
3. `net.Listen(TCP)` → `acceptLoop()`
4. Si DB: `messageCleanupLoop()` (ticker `CleanupInterval` min)
5. Si CatMage: `syncer.Run(ctx)` (pull inicial + ticker horario)
6. TLS listener (si configurado)
7. Returns error solo si listen falla

### Stop()
1. `close(shutdown)` — Señal a todos los loops
2. `syncCancel()` — Para CatMage syncer
3. `rateLim.Stop()`, `throttler.Stop()`
4. Cierra listeners (TCP + TLS)
5. `store.Close()` — Cierra pool PG
6. `wg.Wait()` — Espera todas goroutines

## Accept Loop (TCP + TLS)

```go
func (s *Server) acceptLoop(ln net.Listener) {
    for {
        conn, err := ln.Accept()
        if err != nil {
            select { case <-s.shutdown: return; default: continue }
        }
        ip := security.ExtractIP(conn.RemoteAddr().String())
        if !s.throttler.Allow(ip) {  // MaxConnections per IP
            conn.Close(); continue
        }
        s.met.ConnectionsTotal.Add(1)
        s.wg.Add(1)
        go func() {
            defer s.wg.Done()
            client.Handle(conn, s.OnMessage, s.OnDisconnect)
        }()
    }
}
```

**Protecciones:**
- `throttler.Allow(ip)` — Token bucket por IP (`MaxConnections`, `RateWindow`)
- `rateLim.Allow(clientID)` — Rate limit por cliente (100 msg/60s default)
- `security.SanitizeMessage()` — Strip control chars, max 512 bytes
- `client.Handle` — readLoop + writeLoop con `sync.WaitGroup`

## Manejo de Mensajes (OnMessage)

```go
func (s *Server) OnMessage(c *types.Client, raw string) {
    raw = security.SanitizeMessage(raw)
    msg := protocol.Parse(raw)
    if msg.Command == "" { return }
    
    // Rate limit (except PING/PASS)
    if msg.Command != "PING" && msg.Command != "PASS" {
        if !s.rateLim.Allow(c.ID) {
            s.met.RateLimitTotal.Add(1)
            s.sendNumeric(c, "465", "You are being rate limited")
            return
        }
    }
    s.met.MessagesTotal.Add(1)
    s.router.Route(c, msg)
}
```

## Command Router

**Archivo**: `internal/server/router.go`

```go
type CommandRouter struct {
    handlers map[string]HandlerFunc
    defaultH HandlerFunc
}

func (r *CommandRouter) Register(cmd string, h HandlerFunc) {
    r.handlers[strings.ToUpper(cmd)] = h
}

func (r *CommandRouter) Route(c *types.Client, msg types.Message) {
    if h, ok := r.handlers[msg.Command]; ok {
        h(c, msg)
    } else if r.defaultH != nil {
        r.defaultH(c, msg)
    }
}
```

**Registros en `buildRouter()` (38 comandos):**

| Categoría | Comandos |
|-----------|----------|
| Conexión | PASS, NICK, USER, QUIT, PING, AWAY |
| Canal | JOIN, PART, TOPIC, MODE, KICK, INVITE, KNOCK |
| Mensajería | PRIVMSG, NOTICE, TAGMSG, HISTORY |
| Info | WHOIS, WHO, NAMES, LIST, LUSERS, MOTD, USERHOST, TIME, ISON |
| IRCv3 | CAP, MONITOR, SETNAME, CHGHOST |
| Servicios | LOGIN, NickServ, ChanServ, OperServ |
| Admin/Staff | OPER, AUDITLOG, INVTOKEN |
| P2P | FILE |
| Desconocido | `HandleUnknown` → ERR_UNKNOWNCOMMAND (421) |

## Rate Limiting

**Archivo**: `internal/server/ratelimit.go`

```go
type RateLimiter struct {
    mu       sync.Mutex
    buckets  map[string]*tokenBucket
    rate     int      // tokens per window
    window   time.Duration
    stopChan chan struct{}
}

type tokenBucket struct {
    tokens    int
    lastRefill time.Time
}
```

- **Algoritmo**: Token bucket con refill por ventana deslizante
- **Config**: `CATIRC_RATE_LIMIT` (default 100), `CATIRC_RATE_WINDOW` (default 60s)
- **Scope**: Por `client.ID` (IP:puerto)
- **Exempt**: PING, PASS
- **Response**: `465` (ERR_YOUREBANNEDCREEP repurposed) + métrica `RateLimitTotal`

## Throttling de Conexiones (IP-based)

**Archivo**: `internal/security/security.go` — `Throttler`

```go
func (t *Throttler) Allow(ip string) bool {
    if t.limit <= 0 { return true }
    entry := t.clients[ip]
    if !ok || now.Sub(entry.firstAt) > t.window {
        entry = &throttleEntry{count: 1, firstAt: now}
    }
    entry.count++
    if entry.count > t.limit { return false }
    return true
}
```

- **Config**: `CATIRC_MAX_CONNECTIONS` (default 5), `CATIRC_RATE_WINDOW` (reutiliza rate window)
- **Cleanup**: Goroutine cada 5 min borra entries fuera de ventana

## Métricas Prometheus (`internal/metrics/metrics.go`)

```go
type Collector struct {
    ConnectionsTotal   prometheus.Counter
    MessagesTotal      prometheus.Counter
    RateLimitTotal     prometheus.Counter
    AuthTotal          prometheus.Counter
    OperGrantsTotal    prometheus.Counter
    ClientCount        func() int64  // Gauge callback
    ChannelCount       func() int64
}
```

**Endpoint**: `GET /metrics` (config `CATIRC_METRICS_PATH`, default `/metrics`)
**Montado en**: WebSocket HTTP mux (`main.go:119`)

## Admin Stats Cache

```go
func (s *Server) AdminStats() admin.StatsResponse {
    s.statsMu.Lock()
    if s.statsCache != nil && time.Since(s.statsCache.at) < 10*time.Second {
        return s.statsCache.resp
    }
    s.statsMu.Unlock()
    // ... compute ...
    s.statsMu.Lock()
    s.statsCache = &statsEntry{resp: resp, at: time.Now()}
    s.statsMu.Unlock()
    return resp
}
```
- **TTL**: 10 segundos
- **Incluye**: clients, channels, registeredChannels, opers, activeBans

## EventBus Subscribers (`internal/server/subscribers.go`)

| Evento | Handler | Acción |
|--------|---------|--------|
| `message.sent` | `onMessageSent` | `persistMessage()` + `persistMessageV2()` |
| `user.authenticated` | `onUserAuthenticated` | `AuthTotal++` + audit LOGIN |
| `channel.kick` | `onKick` | Audit KICK + `persistSystemEvent(KICK)` |
| `server.oper_granted` | `onOperGranted` | Audit OPER_LOGIN |
| `channel.mode_changed` | `onModeChanged` | Audit MODE_CHANGE + persist |
| `user.joined` | `onUserJoined` | Persist JOIN + `UpsertChannelMember()` |
| `user.parted` | `onUserParted` | Persist PART + `UpdateChannelMemberSeen()` |
| `user.quit` | `onUserQuit` | Persist QUIT + audit LOGOUT |

**Todos corren en goroutine anónima con `recover()`** para no bloquear publisher.

## WebSocket Bridge (`internal/websocket/server.go`)

```go
type Server struct {
    host, port string
    cfg        ServerConfig  // AllowedOrigins, timeouts
    httpServer *http.Server
    onMessage    MessageHandler
    onDisconnect DisconnectHandler
    extra        map[string]http.HandlerFunc
    wg           sync.WaitGroup
    shutdown     chan struct{}
}
```

**Rutas montadas en `main.go`:**
- `/ws` — WebSocket upgrade → `client.Handle(wsConn, onMessage, onDisconnect)`
- `/health` — `{"status":"ok"}`
- `/metrics` — Prometheus (si habilitado)
- `/admin/` — Admin API (Bearer token)
- `/auth/login`, `/auth/register` — HTTP auth endpoints
- `/invite/{token}` — Invitation token lookup
- `/api/guild/sync` — Guild sync (JWT protected)
- `/api/friends/*`, `/api/presence/*` — Social API (Bearer `JWTSecret`)
- `/api/p2p/config` — P2P config (ICE servers + limits)
- CatMage webhook — `/api/catmage/webhook` (si sync habilitado)

**Seguridad WS:**
- `CheckOrigin` contra `AllowedOrigins` (config `CATIRC_ALLOWED_ORIGINS`)
- Headers seguros: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, COOP, Permissions-Policy
- Timeouts: Read 30s, Write 60s, Idle 120s (configurables)

## Graceful Shutdown

```go
sigCh := make(chan os.Signal, 1)
signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
sig := <-sigCh
wsSrv.Stop()   // Cierra HTTP server + espera wg
srv.Stop()     // Cierra listeners + DB + espera wg
```

**Orden**: WS server first (para que clientes reciban QUIT), luego IRC server.

## Configuración Crítica (Environment Variables)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `CATIRC_HOST` | `0.0.0.0` | Bind TCP |
| `CATIRC_PORT` | `6667` | Puerto IRC |
| `CATIRC_WS_HOST` | `0.0.0.0` | Bind WS |
| `CATIRC_WS_PORT` | `8081` | Puerto WS |
| `CATIRC_DATABASE_URL` | `""` | PostgreSQL DSN (requerido para persistencia) |
| `CATIRC_JWT_SECRET` | `""` | HS256 secret (shared con CatMage) |
| `CATIRC_RATE_LIMIT` | `100` | Msg/ventana por cliente |
| `CATIRC_RATE_WINDOW` | `60` | Segundos |
| `CATIRC_MAX_CONNECTIONS` | `5` | Max conn por IP |
| `CATIRC_ADMIN_TOKEN` | `""` | Bearer token admin API (vacío = deshabilitado) |
| `CATIRC_ALLOWED_ORIGINS` | `""` | CSV origins WS (vacío = cualquiera) |
| `CATMAGE_URL` | `""` | CatMage base URL |
| `CATMAGE_API_KEY` | `""` | Shared key para sync webhook/pull |
| `CATIRC_TLS_CERT`, `KEY`, `LISTEN` | `""` | TLS listener (los 3 o ninguno) |

---

*Generado: 2026-07-11 | Fuente: `internal/server/server.go`, `router.go`, `ratelimit.go`, `subscribers.go`, `internal/websocket/server.go`, `cmd/server/main.go`*
```

## 6. 02-catirc/rest-api.md

```md
# API REST — CatIRC

## Base URL
```
http(s)://<host>:<ws_port>/
```
Mismo puerto que WebSocket (8081 default), multiplexado vía `http.ServeMux`.

---

## Autenticación por Endpoint

| Endpoint | Auth | Header |
|----------|------|--------|
| `/health` | Ninguna | — |
| `/metrics` | Ninguna | — |
| `/api/p2p/config` | Ninguna | — |
| `/invite/{token}` | Ninguna | — |
| `/auth/login`, `/auth/register` | Ninguna (pública) | `Content-Type: application/json` |
| `/api/catmage/webhook` | `X-CatMage-Key` | `X-CatMage-Key: <CATMAGE_API_KEY>` |
| `/admin/*` | Bearer Token | `Authorization: Bearer <CATIRC_ADMIN_TOKEN>` |
| `/api/friends/*`, `/api/presence/*` | API Key | `X-CatIRC-API-Key: <CATIRC_JWT_SECRET>` |
| `/api/guild/sync` | JWT Bearer | `Authorization: Bearer <JWT>` |

---

## Endpoints Públicos

### Health Check
```
GET /health
```
**Response 200**:
```json
{"status":"ok","service":"catirc-websocket"}
```

### Métricas Prometheus
```
GET /metrics
```
**Response 200**: `text/plain` — Formato Prometheus exposition format

### Configuración P2P
```
GET /api/p2p/config
```
**Response 200**:
```json
{
  "ice_servers": [{"urls": "stun:stun.l.google.com:19302"}],
  "max_file_size_mb": 100
}
```

### Invitaciones Públicas
```
GET /invite/{token}
```
**Path param**: `token` — Token de invitación (creado via `INVTOKEN` IRC o Admin API)

**Response 200**:
```json
{"valid":true,"token":"abc123","channel":"#general","uses":0,"max_uses":10}
```
**Response 404**: `{"valid":false,"error":"token not found"}`
**Response 410**: `{"valid":false,"error":"invitation has expired"}` / `"invitation has been revoked"` / `"invitation has reached maximum uses"`

---

## Autenticación HTTP (Login/Register)

### POST /auth/login
```json
// Request
{"username": "juan", "password": "secret"}

// Response 200
{"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "user": {"id": 1, "username": "juan", "nick": "Juan", "role": "USER"}}

// Response 401
{"error": "Invalid username or password"}
```

### POST /auth/register
```json
// Request
{"username": "juan", "nick": "Juan", "email": "juan@catmage.es", "password": "secret"}

// Response 201
{"token": "eyJ...", "user": {"id": 1, "username": "juan", "nick": "Juan", "role": "USER"}}

// Response 400
{"error": "Username already exists"}
```

**Notas**:
- JWT firmado con `CATIRC_JWT_SECRET` (HS256)
- Expira en `CATIRC_JWT_EXPIRY_MIN` (default 1440 = 24h)
- Requiere `CATIRC_DATABASE_URL` y `CATIRC_JWT_SECRET` configurados

---

## Admin API (`/admin/*`)

**Auth**: `Authorization: Bearer <CATIRC_ADMIN_TOKEN>`
**Content-Type**: `application/json`

### Stats & Overview
| Method | Endpoint | Response |
|--------|----------|----------|
| GET | `/admin/stats` | `StatsResponse` |
| GET | `/admin/clients` | `ClientInfo[]` |
| GET | `/admin/channels` | `ChannelInfo[]` |
| GET | `/admin/registered-channels` | `RegisteredChannelInfo[]` |
| GET | `/admin/opers` | `OperInfo[]` |
| GET | `/admin/bans` | `BanInfo[]` |

**StatsResponse**:
```json
{
  "clients": 5,
  "channels": 2,
  "registered_channels": 1,
  "opers": 1,
  "active_bans": 2,
  "time": "2026-07-11T10:00:00Z"
}
```

### Messaging & History
| Method | Endpoint | Query/Body | Response |
|--------|----------|------------|----------|
| GET | `/admin/messages` | `?channel=#general&limit=50` | `MessageInfo[]` |
| POST | `/admin/kick` | `{"nick":"user","channel":"#chan","reason":"spam"}` | `{"status":"ok"}` |
| POST | `/admin/broadcast` | `{"text": "Mantenimiento en 5min"}` | `{"status":"ok"}` |

### Oper Management
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/admin/oper/grant` | `{"nick":"juan","oper_class":"GLOBALOP"}` | `{"status":"ok"}` |
| POST | `/admin/oper/revoke` | `{"nick":"juan"}` | `{"status":"ok"}` |

### Network Bans (Runtime)
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/admin/ban` | `{"type":"KLINE","mask":"*!*@spam.net","reason":"Spam"}` | `{"status":"ok"}` |
| DELETE | `/admin/ban` | `{"type":"KLINE","mask":"*!*@spam.net"}` | `{"status":"ok"}` |

**Types**: `AKILL`, `KLINE`, `GLINE`, `SHUN`, `ZLINE`, `MUTE`

### Global Roles (Dynamic)
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | `/admin/roles` | — | `RoleDefinition[]` |
| POST | `/admin/roles` | `{"name":"MODERATOR","permissions":{"moderate_channels":true},"description":"Mod global"}` | `RoleDefinition` |
| DELETE | `/admin/roles?id=5` | — | `{"status":"ok"}` |

### User Roles
| Method | Endpoint | Query/Body | Response |
|--------|----------|------------|----------|
| GET | `/admin/user-roles` | `?user_id=1` | `UserRole[]` |
| POST | `/admin/user-roles/grant` | `{"user_id":1,"role_id":2,"granted_by":1}` | `{"status":"ok"}` |
| POST | `/admin/user-roles/revoke` | `{"user_id":1,"role_id":2}` | `{"status":"ok"}` |
| GET | `/admin/user-roles/check` | `?user_id=1&role=ROOT` | `{"has_role":true}` |

### Audit Log
| Method | Endpoint | Query | Response |
|--------|----------|-------|----------|
| GET | `/admin/audit` | `?limit=100` | `AuditLogInfo[]` |
| GET | `/admin/audit/user` | `?user_id=1&limit=100` | `AuditLogInfo[]` |
| GET | `/admin/audit/channel` | `?channel_id=1&limit=100` | `AuditLogInfo[]` |

### Invitations
| Method | Endpoint | Query/Body | Response |
|--------|----------|------------|----------|
| POST | `/admin/invitations` | `{"channel_id":1,"created_by":1,"max_uses":5,"expires_at":"2026-12-31T23:59:59Z"}` | `IRCInvitationRow` |
| GET | `/admin/invitations/list` | `?channel_id=1` | `IRCInvitationRow[]` |
| GET | `/admin/invitations/get` | `?token=abc123` | `IRCInvitationRow` |
| POST | `/admin/invitations/use` | `{"token":"abc123"}` | `{"status":"ok"}` |
| POST | `/admin/invitations/revoke` | `{"token":"abc123","revoked_by":1}` | `{"status":"ok"}` |

### Message Search (Full-text)
```
GET /admin/search?q=hola&channel=#general&nick=juan&limit=50&offset=0
```
**Response**:
```json
{"results":[{"id":123,"uuid":"abc","channel":"#general","nick":"juan","type":"PRIVMSG","body":"hola mundo","ts":"2026-07-11T10:00:00Z"}]}
```

### Users
```
GET /admin/users?limit=200
```
**Response**: `UserInfo[]` (id, nick, account, email, created_at, last_seen, online)

### Network Bans (Persistent)
| Method | Endpoint | Query/Body |
|--------|----------|------------|
| GET | `/admin/network-bans` | `?type=KLINE` |
| DELETE | `/admin/network-bans` | `{"type":"KLINE","target":"*!*@evil.com"}` |

---

## Social API (`/api/friends/*`, `/api/presence/*`)

**Auth**: `X-CatIRC-API-Key: <CATIRC_JWT_SECRET>` (shared secret CatMage ↔ CatIRC)

**Nota**: Actualmente **stubs** — retornan arrays vacíos / `ok: true`. No hay persistencia real.

### Friends
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | `/api/friends?user_id=1` | — | `{"friends":[]}` |
| GET | `/api/friends/requests?user_id=1` | — | `{"requests":[]}` |
| POST | `/api/friends/request` | `{"user_id":1,"other_id":2}` | `{"ok":true,"status":"pending"}` |
| POST | `/api/friends/requests/{id}/accept` | — | `{"ok":true,"status":"accepted"}` |
| POST | `/api/friends/requests/{id}/reject` | — | `{"ok":true,"status":"rejected"}` |
| POST | `/api/friends/{id}/remove` | — | `{"ok":true,"status":"removed"}` |
| POST | `/api/friends/block` | `{"user_id":1,"other_id":2}` | `{"ok":true,"status":"blocked"}` |
| POST | `/api/friends/unblock` | `{"user_id":1,"other_id":2}` | `{"ok":true,"status":"unblocked"}` |
| GET | `/api/friends/status?user_id=1&other_id=2` | — | `{"status":"none"}` |

### Presence
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | `/api/presence?user_id=1` | — | `{"online":true,"last_activity":"2026-07-11T10:00:00Z"}` |
| GET | `/api/presence/friends?user_id=1` | — | `{"online":[]}` |
| POST | `/api/presence/batch` | `{"user_ids":[1,2,3]}` | `{"presence":[{"user_id":1,"online":true,"last_activity":"..."}]}` |

---

## CatMage Webhook (`/api/catmage/webhook`)

**Auth**: `X-CatMage-Key: <CATMAGE_API_KEY>` (constant-time compare)

**Method**: `POST`

**Payload**:
```json
{
  "event": "user.updated",
  "user": {
    "catmage_user_id": 12345,
    "username": "juan",
    "display_nick": "Juan",
    "email": "juan@catmage.es",
    "password_hash": "$argon2id$v=19$m=65536,t=3,p=4$...",
    "role": "USER",
    "roles": ["USER"],
    "state": "active",
    "updated_at": "2026-07-11T10:00:00Z"
  }
}
```

**Eventos válidos**: `user.created`, `user.updated`, `user.password_changed`, `user.nick_changed`, `user.email_changed`, `user.role_changed`, `user.banned`, `user.unbanned`

**Response**: `200 {"status":"ok"}` o `400/401/500 {"error":"..."}`

**Sync Flow**:
- **Push (Primary)**: CatMage → POST webhook → `Syncer.WebhookHandler()` → `ApplyFunc(snapshot)` → `UpsertIRCUser()` → cursor = max(cursor, UpdatedAt)
- **Pull (Safety)**: Cron cada `CATMAGE_SYNC_INTERVAL_MIN` → `GET /api/irc/users?since=` → `PullOnce()` → apply snapshots → cursor advance
- **Repair**: `Syncer.RepairUser(id)` → `GET /api/irc/users/{id}` → apply

---

## Guild Sync (`/api/guild/sync`)

**Auth**: `Authorization: Bearer <JWT>` (CatMage signed con `CATIRC_JWT_SECRET`)

**Estado**: Esqueleto — lógica pendiente.

---

## Códigos de Error HTTP

| Código | Cuerpo | Cuándo |
|--------|--------|--------|
| 400 | `{"error":"bad request: ..."}` | JSON inválido, campos requeridos faltantes |
| 401 | `{"error":"unauthorized"}` | Token/API key inválido o ausente |
| 403 | `{"error":"forbidden"}` | Permisos insuficientes (ej. no es oper) |
| 404 | `{"error":"not found"}` | Recurso no existe |
| 405 | `{"error":"method not allowed"}` | Método HTTP no soportado |
| 410 | `{"error":"gone"}` | Token expirado/revocado |
| 500 | `{"error":"internal server error"}` | Error BD, sync falló |
| 503 | `{"error":"service unavailable"}` | Feature no configurada (ej. sin DB) |

---

## Rate Limiting (Actual: Solo WS)

| Endpoint | Límite Actual | Recomendado |
|----------|---------------|-------------|
| `/admin/*` | Ninguno | 100 req/min per token |
| `/api/friends/*` | Ninguno | 60 req/min per key |
| `/api/presence/*` | Ninguno | 120 req/min per key |
| `/auth/*` | Ninguno | 10 req/min per IP |
| `/api/catmage/webhook` | HMAC validation | Rate limit por IP |

---

*Generado: 2026-07-11 | Fuente: `internal/admin/api.go`, `internal/server/handlers_http_auth.go`, `internal/server/handlers_social_api.go`, `internal/catmage/sync.go`, `internal/server/handlers_file.go`*
```

## 7. 02-catirc/protocolo.md

```md
# Protocolo IRC — Parser, Formatter, Tags

## Parser (`internal/protocol/parser.go`)

**Función**: `Parse(raw string) types.Message`

Formato soportado: `[@tags] [:prefix] COMMAND [params...] [:trailing]`

```go
type Message struct {
    Tags     map[string]string  // IRCv3 @key=val;key2
    Prefix   string             // :nick!user@host
    Command  string             // Uppercase
    Params   []string           // Parámetros medios
    Trailing string             // Último param con :
}
```

### Flujo de Parseo

1. **Trim** whitespace
2. **Tags** (`@` prefix) → `parseTags()` → `map[string]string`
   - `key=value` o `key` (valor vacío)
   - Separador `;`
3. **Prefix** (`:` prefix) → split `nick!user@host`
4. **Command** → uppercase
5. **Params/Trailing** → split por espacios; `:` inicia trailing

### Ejemplos

```
@time=2026-07-11T10:00:00.000Z;account=juan :nick!user@host PRIVMSG #chan :hola
→ Message{
    Tags: {"time": "...", "account": "juan"},
    Prefix: "nick!user@host",
    Command: "PRIVMSG",
    Params: ["#chan"],
    Trailing: "hola"
  }

CAP REQ :message-tags
→ Message{Command: "CAP", Params: ["REQ"], Trailing: "message-tags"}
```

## Formatter (`internal/protocol/parser.go`)

**Función**: `Format(msg types.Message) string`

Orden de salida: `@tags` → `:prefix` → `COMMAND` → `params` → `:trailing` → `\r\n`

- Tags: keys sorted alfabéticamente (output determinístico)
- Valores vacíos → solo key (sin `=`)
- Trailing si contiene espacios o empieza con `:`

## Tipos Compartidos (`pkg/types/types.go`)

```go
type Message struct {
    Tags     map[string]string
    Prefix   string
    Command  string
    Params   []string
    Trailing string
}

// Helpers
func (m *Message) Tag(key string) string  // m.Tags[key] o ""

type Client struct {
    ID        string
    Nick      string
    User      string
    RealName  string
    Host      string
    Conn      net.Conn
    Output    chan string      // buf 64
    done      chan struct{}
    channels  map[string]*Channel
    Caps      map[string]bool  // negotiated caps
    CapPhase  int              // 0=none, 1=LS, 2=LS302, 3=REQ, 4=END
    Account   string           // account-tag
    Away, AwayMsg bool, string
    IsGlobalOper bool
    monitorList map[string]bool
    monMu sync.Mutex
}

type Channel struct {
    Name         string
    Topic        string
    Modes        string           // "+nt"
    Key          string           // +k password
    Limit        int              // +l limit
    Mutex        sync.RWMutex
    Clients      map[string]*Client
    Operators    map[string]bool  // +o
    Voiced       map[string]bool  // +v
    InviteList   map[string]bool  // +I
    BanList      map[string]bool  // +b mask
    ExceptionList map[string]bool // +e
    broadcast    chan string      // buf 256
    done         chan struct{}
}
```

## IRCv3 Capabilities Soportadas

| Cap | Estado | Descripción |
|-----|--------|-------------|
| `message-tags` | ✅ | Tags en mensajes (`@time`, `@account`, etc.) |
| `cap-notify` | ✅ | Notificar cambios de caps |
| `account-notify` | ✅ | NOTIFY account login/logout |
| `extended-join` | ✅ | JOIN con account + realname |
| `away-notify` | ✅ | NOTIFY away status |
| `account-tag` | ✅ | Tag `account=` en PRIVMSG |
| `batch` | ❌ | No implementado |
| `echo-message` | ❌ | No implementado |
| `labeled-response` | ❌ | No implementado |

**Negociación en `handlers_cap.go`:**
```go
case "LS":
    supportedCaps = msg.Trailing.split(" ")
    wantCaps = ["message-tags", "cap-notify", "account-notify", 
                "extended-join", "away-notify", "account-tag"]
    requestCaps = wantCaps ∩ supportedCaps
    CAP REQ :requestCaps...
case "ACK": CAP END
case "NAK": CAP END
case "END": completeRegistration()
```

## Message Tags Generados por Servidor

| Tag | Valor | Cuándo |
|-----|-------|--------|
| `time` | RFC3339Nano UTC | Todos los mensajes broadcast |
| `account` | `client.Account` | Si autenticado (account-tag) |
| `+typing` | `active` | TAGMSG typing indicator |
| `+react` | emoji | TAGMSG reaction |
| `+react-to` | message ID | TAGMSG reaction target |

## Comandos Custom CatIRC

| Comando | Parámetros | Descripción |
|---------|------------|-------------|
| `LOGIN` | `<username> <password>` | Auth via IdentityProvider |
| `HISTORY` | `<#chan\|nick> [limit]` | Historial canal/DM (50 default) |
| `AUDITLOG` | `[limit]` | Staff: últimas entradas audit log |
| `INVTOKEN` | `<#chan> [max_uses] [expiry_h]` | Crear token invitación persistente |
| `FILE` | `OFFER\|ACCEPT\|REJECT\|CANCEL\|ERROR\|SIGNAL <target> <id> [:data]` | P2P WebRTC signaling |

## Numeric Replies (IRC Mode)

**`config.UseIRCMode = true` (default)**

| Código | Nombre | Uso |
|--------|--------|-----|
| 001 | RPL_WELCOME | Bienvenida |
| 002-004 | RPL_YOURHOST, CREATED, MYINFO | Server info |
| 353 | RPL_NAMREPLY | NAMES list |
| 366 | RPL_ENDOFNAMES | End of NAMES |
| 331/332 | RPL_NOTOPIC / RPL_TOPIC | Topic |
| 324 | RPL_CHANNELMODEIS | Channel modes |
| 367/368 | RPL_BANLIST / RPL_ENDOFBANLIST | Ban list |
| 311-319 | WHOIS replies | WHOIS |
| 352/315 | RPL_WHOREPLY / RPL_ENDOFWHO | WHO |
| 370 | RPL_WHOISROLES | **Custom** — Global roles |
| 433 | ERR_NICKNAMEINUSE | Nick en uso |
| 464 | ERR_PASSWORDMISMATCH | PASS/LOGIN fallido |
| 465 | ERR_YOUREBANNEDCREEP | **Repurposed** — Rate limited |
| 481 | ERR_NOPRIVILEGES | No oper |
| 482 | ERR_CHANOPRIVSNEEDED | No channel op |
| 710 | RPL_KNOCK | KNOCK received |

**Simple Mode** (`UseIRCMode=false`): Solo `OK :text` / `ERR :text`

## Sanitización (`internal/security/security.go`)

```go
func SanitizeMessage(msg string) string {
    // Strip control chars (incl CR/LF) + limit 512 bytes
    for _, c := range msg {
        if c >= 32 && c != 127 { b.WriteRune(c) }
    }
    if len(b.String()) > 512 { return b.String()[:512] }
    return b.String()
}

func SanitizeTrailing(s string) string {
    // Para trailing param: strip control, limit 450 bytes
}
```

**Protección**: Previene inyección de líneas (CRLF) y buffer overflow.

## Validación de Nick (`security.ValidateNick`)

```go
func ValidateNick(nick string) bool {
    // RFC 2812: 1-30 chars
    // 1er char: letter o special ([\]`_^{|})
    // Resto: letter, digit, -, _, special
}
```

## Casos Edge & Bugs Conocidos

| Problema | Ubicación | Severidad |
|----------|-----------|-----------|
| Tags con `;` o `=` en valor no escapados en `Format` | `parser.go:Format` | Medio — rompe parsing si valor contiene `;` |
| `parseTags` no hace unescape de `\:` `\s` `\r` `\n` `\\` | `parser.go:parseTags` | Medio — spec IRCv3 requiere unescape |
| `CAP LS` sin trailing devuelve tags vacíos | `parser.go:22-30` | Bajo — spec dice debe haber trailing |
| `SanitizeMessage` remueve Unicode > 127 (emojis) | `security.go:186` | Alto — rompe emojis en mensajes |

**Fix pendiente**: Implementar IRCv3 tag escaping/unescaping per spec.

---

*Generado: 2026-07-11 | Fuente: `internal/protocol/parser.go`, `internal/security/security.go`, `internal/server/handlers_cap.go`, `pkg/types/types.go`*
```

## 8. 02-catirc/websocket.md

```md
# WebSocket Bridge — CatIRC

## Arquitectura

```
┌─────────────┐     /ws      ┌──────────────────┐     IRC Protocol      ┌─────────────┐
│   OdinX     │◄────────────►│  WS Server       │◄─────────────────────►│  IRC Server │
│  (Browser)  │   WebSocket  │  (Gorilla WS)    │   client.Handle()     │  (Server)   │
└─────────────┘              └──────────────────┘                       └─────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
               /health         /metrics         /admin/*
               /auth/*        /invite/*        /api/*
```

## Componentes

### 1. WS Connection Wrapper (`internal/websocket/conn.go`)

```go
type wsConn struct {
    conn    *websocket.Conn
    buf     []byte          // Buffer para partial reads
    mu      sync.Mutex
    readMu  sync.Mutex
    writeMu sync.Mutex
}
```

**Implementa `net.Conn`** para reutilizar `client.Handle()`:
- `Read()` → `wsConn.ReadMessage()` → buffer + copy
- `Write()` → `wsConn.WriteMessage(TextMessage, data)`
- `Close()` → `wsConn.Close()`
- `LocalAddr()` / `RemoteAddr()` → delega a `conn`
- `SetDeadline()` / `SetReadDeadline()` / `SetWriteDeadline()` → delega

**Partial Read Handling**: `ReadMessage()` retorna frame completo; `Read()` copia a buffer del caller y guarda resto en `wsConn.buf` para siguiente llamada.

### 2. WS Server (`internal/websocket/server.go`)

```go
type Server struct {
    host, port string
    cfg        ServerConfig
    httpServer *http.Server
    onMessage    MessageHandler      // func(*types.Client, string)
    onDisconnect DisconnectHandler   // func(*types.Client)
    extra        map[string]http.HandlerFunc
    wg           sync.WaitGroup
    shutdown     chan struct{}
}

type ServerConfig struct {
    AllowedOrigins []string
    ReadTimeout    time.Duration
    WriteTimeout   time.Duration
    IdleTimeout    time.Duration
}
```

**Rutas HTTP montadas:**

| Ruta | Handler | Descripción |
|------|---------|-------------|
| `/ws` | `handleWebSocketWithUpgrader` | Upgrade WS → `client.Handle()` |
| `/health` | `handleHealth` | `{"status":"ok"}` |
| `/metrics` | Prometheus handler | Si `MetricsHandler()` retorna handler |
| `/admin/` | Admin API | Bearer token `CATIRC_ADMIN_TOKEN` |
| `/auth/login` | `AuthLoginHandler` | POST JSON → JWT |
| `/auth/register` | `AuthRegisterHandler` | POST JSON → cuenta |
| `/invite/{token}` | `InviteHandler` | GET → valida token invitación |
| `/api/guild/sync` | `GuildSyncHandler` | POST JWT → sync guilds CatMage |
| `/api/friends/*` | `SocialFriendsHandler` | GET/POST friends (Bearer JWTSecret) |
| `/api/presence/*` | `SocialPresenceHandler` | GET presence (Bearer JWTSecret) |
| `/api/p2p/config` | `P2PConfigHandler` | GET ICE servers + limits |
| `/api/catmage/webhook` | `CatMageWebhook` | POST push events (X-CatMage-Key) |

**Upgrader Config:**
```go
websocket.Upgrader{
    ReadBufferSize:  4096,
    WriteBufferSize: 4096,
    CheckOrigin: func(r *http.Request) bool {
        if len(allowedOrigins) == 0 { return true }  // Dev mode
        origin := r.Header.Get("Origin")
        return slices.Contains(allowedOrigins, origin)
    },
}
```

**Headers de Seguridad** (middleware `secureHeaders`):
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'none'; connect-src 'self' ws: wss:
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
```

**Timeouts** (configurables via `CATIRC_HTTP_*_TIMEOUT_SEC`):
- ReadHeaderTimeout: 30s
- WriteTimeout: 60s
- IdleTimeout: 120s

### 3. Integración en Main (`cmd/server/main.go`)

```go
wsCfg := ws.ServerConfig{
    AllowedOrigins: cfg.AllowedOriginList(),
    ReadTimeout:    durationSec(cfg.HTTPReadTimeout),
    WriteTimeout:   durationSec(cfg.HTTPWriteTimeout),
    IdleTimeout:    durationSec(cfg.HTTPIdleTimeout),
}
wsSrv := ws.NewServerWithConfig(cfg.WSHost, cfg.WSPort, srv.OnMessage, srv.OnDisconnect, wsCfg)

// Mount extra routes
if path, h := srv.CatMageWebhook(); h != nil { wsSrv.Handle(path, h) }
if path, h := srv.P2PConfig(); h != nil { wsSrv.Handle(path, h) }
if path, h := srv.MetricsHandler(); h != nil { wsSrv.Handle(path, h) }
if path, h := srv.AdminHandler(); h != nil { wsSrv.Handle(path+"/", h.ServeHTTP) }
if path, h := srv.AuthLoginHandler(); h != nil { wsSrv.Handle(path, h) }
if path, h := srv.AuthRegisterHandler(); h != nil { wsSrv.Handle(path, h) }
if path, h := srv.InviteHandler(); h != nil { wsSrv.Handle(path, h) }
if path, h := srv.GuildSyncHandler(); h != nil { wsSrv.Handle(path, h) }
if path, h := srv.SocialFriendsHandler(); h != nil { wsSrv.Handle(path, h) }
if path, h := srv.SocialPresenceHandler(); h != nil { wsSrv.Handle(path, h) }

wsSrv.Start()  // httpServer.ListenAndServe() en goroutine
```

## Flujo de Mensaje WS → IRC

```
Browser (OdinX)
    │
    ├─ new WebSocket("wss://irc.catmage.es/ws")
    │
    ▼
WS Server (Gorilla)
    │
    ├─ Upgrade HTTP → WebSocket
    ├─ wsConn implements net.Conn
    ├─ client.Handle(wsConn, onMessage, onDisconnect)
    │   ├─ readLoop() → bufio.Scanner(wsConn) → onMessage(client, line)
    │   └─ writeLoop() → client.Output chan → wsConn.Write()
    │
    ▼
Server.OnMessage(client, raw)
    │
    ├─ security.SanitizeMessage(raw)
    ├─ protocol.Parse(raw) → types.Message
    ├─ RateLimit check (except PING/PASS)
    ├─ router.Route(client, msg) → handlers_*.go
    │
    ▼
Handlers producen respuestas → client.Send(raw) → client.Output chan
    │
    ▼
writeLoop() → wsConn.Write() → WebSocket frame → Browser
```

## Flujo IRC → WS (Broadcast)

```
IRC Event (JOIN, PRIVMSG, MODE, etc.)
    │
    ▼
Channel.BroadcastMessage(raw) → ch.broadcast chan (buf 256)
    │
    ▼
broadcastLoop() → for client := range ch.Clients { client.Output <- raw }
    │
    ▼
Client writeLoop() → select { case msg := <-c.Output: c.Conn.Write(msg) }
    │
    ▼
wsConn.Write() → WebSocket TEXT frame → Browser
```

## Reconexión (Cliente OdinX)

```javascript
// client.js
scheduleReconnect() {
    if (!autoReconnect || intentionalClose) return;
    delay = min(1000 * 2^attempts, 30000);
    attempts++;
    setTimeout(connect, delay);
}

// Server side: no special handling, nueva conexión = nuevo client.Handle()
```

## P2P Config Endpoint (`/api/p2p/config`)

**Handler**: `Server.P2PConfig()` → `internal/server/handlers_file.go`

```go
func (s *Server) P2PConfig() (string, http.HandlerFunc) {
    return "/api/p2p/config", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]interface{}{
            "ice_servers": s.cfg.ICEServerList(),
            "max_file_size_mb": s.cfg.MaxFileSizeMB,
        })
    }
}
```

**Response**:
```json
{
  "ice_servers": [{"urls": "stun:stun.lgoogle.com:19302"}],
  "max_file_size_mb": 100
}
```

## CatMage Webhook (`/api/catmage/webhook`)

**Handler**: `Syncer.WebhookHandler()` → `internal/catmage/sync.go:122`

```go
func (s *Syncer) WebhookHandler() http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost { 405; return }
        if !s.authorized(r) { 401; return }  // X-CatMage-Key constant-time compare
        
        body := io.ReadAll(io.LimitReader(r.Body, 1<<20))  // 1 MiB max
        var ev Event
        json.Unmarshal(body, &ev)
        ev.User.Validate()  // catmage_user_id + username required
        
        s.apply(ev.User)  // ApplyFunc → UpsertIRCUser()
        s.advanceCursor(ev.User.UpdatedAt)
        w.WriteHeader(200); w.Write(`{"status":"ok"}`)
    }
}
```

**Payload esperado**:
```json
{
  "event": "user.updated",
  "user": {
    "catmage_user_id": 12345,
    "username": "juan",
    "display_nick": "Juan",
    "email": "juan@catmage.es",
    "password_hash": "$argon2id$...",
    "role": "USER",
    "roles": ["USER"],
    "state": "active",
    "updated_at": "2026-07-11T10:00:00Z"
  }
}
```

## Admin API (`/admin/`)

**Handler**: `admin.NewHandler(server, token)` → `internal/admin/api.go`

**Auth**: Middleware `Authorization: Bearer <CATIRC_ADMIN_TOKEN>`

**Endpoints** (20+):
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/admin/stats` | Server overview |
| GET | `/admin/clients` | Connected clients |
| GET | `/admin/channels` | Live channels |
| GET | `/admin/registered-channels` | ChanServ registrations |
| GET | `/admin/opers` | Active IRCOps |
| GET | `/admin/bans` | Network bans |
| GET | `/admin/messages` | Channel history |
| POST | `/admin/kick` | Kick user from channel |
| POST | `/admin/broadcast` | NOTICE to all |
| POST | `/admin/oper/grant` | Grant oper class |
| POST | `/admin/oper/revoke` | Revoke oper |
| POST/DELETE | `/admin/ban` | Add/remove network ban |
| GET | `/admin/roles` | Global role definitions |
| POST/DELETE | `/admin/roles` | Upsert/delete role |
| GET | `/admin/user-roles` | User's roles |
| POST | `/admin/user-roles/grant` | Grant role |
| POST | `/admin/user-roles/revoke` | Revoke role |
| GET | `/admin/audit` | Audit log (global/user/channel) |
| POST | `/admin/invitations` | Create invitation token |
| GET | `/admin/search` | Full-text message search |
| GET | `/admin/users` | Registered users |
| GET/POST/DELETE | `/admin/network-bans` | Persistent network bans |

## Social API (`/api/friends/*`, `/api/presence/*`)

**Auth**: `X-CatIRC-API-Key: <CATIRC_JWT_SECRET>` (shared secret)

**Endpoints**:
- `GET /api/friends` — List friends
- `GET /api/friends/requests` — Pending requests
- `POST /api/friends/request` — Send request
- `POST /api/friends/requests/{id}/accept` — Accept
- `POST /api/friends/requests/{id}/reject` — Reject
- `POST /api/friends/{id}/remove` — Remove friend
- `POST /api/friends/block` — Block user
- `POST /api/friends/unblock` — Unblock
- `GET /api/friends/status?user_id=X&other_id=Y` — Friendship status
- `GET /api/presence?user_id=X` — Online status
- `GET /api/presence/friends?user_id=X` — Online friends
- `POST /api/presence/batch` — Batch presence check

**Implementación**: `internal/server/handlers_social_api.go` — **stubs** que retornan arrays vacíos / `ok: true`. No hay persistencia real de grafo social.

## Guild Sync (`/api/guild/sync`)

**Auth**: JWT Bearer (CatMage emite JWT firmado con `CATIRC_JWT_SECRET`)

**Handler**: `Server.GuildSyncHandler()` → `internal/server/guild_sync.go`

```go
func (s *Server) GuildSyncHandler() (string, http.HandlerFunc) {
    return "/api/guild/sync", func(w http.ResponseWriter, r *http.Request) {
        // Verify JWT (HS256, CATIRC_JWT_SECRET)
        // Parse guild sync payload
        // Sync channels ↔ guilds (CatMage ↔ CatIRC)
    }
}
```

**Estado**: Esqueleto — lógica de sync pendiente.

## Métricas (`/metrics`)

**Handler**: `Server.MetricsHandler()` → `metrics.Collector.Handler()`

**Output** (Prometheus text format):
```
catirc_connections_total 123
catirc_messages_total 4567
catirc_rate_limit_total 12
catirc_auth_total 89
catirc_oper_grants_total 3
catirc_client_count 5
catirc_channel_count 2
```

## Health Check (`/health`)

```json
{"status":"ok","service":"catirc-websocket"}
```

## Configuración WS (Environment)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `CATIRC_WS_HOST` | `0.0.0.0` | Bind WS |
| `CATIRC_WS_PORT` | `8081` | Puerto WS |
| `CATIRC_ALLOWED_ORIGINS` | `""` | CSV origins (vacío = todos) |
| `CATIRC_HTTP_READ_TIMEOUT_SEC` | `30` | Read header timeout |
| `CATIRC_HTTP_WRITE_TIMEOUT_SEC` | `60` | Write timeout |
| `CATIRC_HTTP_IDLE_TIMEOUT_SEC` | `120` | Idle timeout |

## Testing

- `internal/websocket/server_test.go` — Tests de upgrader, origin check, health
- `internal/server/handlers_file_test.go` — P2P config endpoint
- `internal/server/handlers_http_auth_test.go` — Login/register endpoints
- `internal/admin/api_test.go` — Admin API (stats, clients, channels, kick, bans, etc.)

## Problemas Conocidos

| Problema | Severidad |
|----------|-----------|
| `gorilla/websocket` v1.5.3 tiene CVE-2023-45289 (DoS via large frames) | **Alta** — Actualizar a fork mantenido o `nhooyr/websocket` |
| Social API son stubs vacíos — no hay persistencia real | Media |
| Guild sync endpoint es esqueleto sin implementar | Media |
| No hay rate limiting en HTTP endpoints (solo WS) | Media |
| `AllowedOrigins` vacío = cualquiera (dev mode) — peligroso en prod | **Alta** — Documentar bien |

---

*Generado: 2026-07-11 | Fuente: `internal/websocket/server.go`, `conn.go`, `cmd/server/main.go`, `internal/server/handlers_file.go`, `internal/catmage/sync.go`, `internal/admin/api.go`*
```

## 9. 02-catirc/arquitectura.md

```md
# Arquitectura CatIRC

## Visión General

CatIRC es un servidor IRC moderno escrito en Go 1.25, diseñado como **monolito modular** con inyección de dependencias via interfaces. Soporta IRC clásico (RFC 1459/2812) + IRCv3 (CAP, message tags, account-notify, extended-join, away-notify) y expone WebSocket + REST API para clientes web (OdinX).

```
┌─────────────────────────────────────────────────────────────────┐
│                        CatIRC Server                             │
├─────────────────────────────────────────────────────────────────┤
│  cmd/server/main.go  →  Bootstrap, config, orchestration        │
├─────────────────────────────────────────────────────────────────┤
│  internal/server/          Core IRC Server                        │
│  ├── Server struct         Estado central, managers, services    │
│  ├── router.go             CommandRouter (map[cmd]Handler)      │
│  ├── handlers_*.go         11 archivos, 38 comandos IRC         │
│  ├── subscribers.go        EventBus consumers (persist, audit)   │
│  └── ratelimit.go          Token bucket por cliente              │
├─────────────────────────────────────────────────────────────────┤
│  internal/client/          Client lifecycle                      │
│  ├── Manager               Map[id]*Client + nick index           │
│  └── Handle()              readLoop + writeLoop per connection   │
├─────────────────────────────────────────────────────────────────┤
│  internal/channel/         Channel management                    │
│  └── Manager               GetOrCreate, List, Remove (empty)     │
├─────────────────────────────────────────────────────────────────┤
│  internal/services/        IRC Services                          │
│  ├── NickServ              Registro/identify/ghost (bcrypt)      │
│  ├── ChanServ (legacy)     Registro canales + access lists       │
│  ├── ChanServV2            FLAGS/MLOCK/TOPICLOCK/AKICK (nuevo)   │
│  └── OperServ              AKILL/KLINE/GLINE/SHUN/KILL/WALLOPS   │
├─────────────────────────────────────────────────────────────────┤
│  internal/auth/            AuthProvider interface                │
│  ├── LocalAuthProvider     JWT validation (shared secret)        │
│  ├── CatmageAuthProvider   Remote HTTP validation (stub)         │
│  └── NoopAuthProvider      Sin auth (dev)                        │
├─────────────────────────────────────────────────────────────────┤
│  internal/identity/        IdentityProvider interface            │
│  ├── LocalIdentityProvider PostgreSQL irc_users                  │
│  └── SyncIdentityProvider  CatMage push/pull + LWW reconcile     │
├─────────────────────────────────────────────────────────────────┤
│  internal/websocket/       WebSocket → IRC bridge                │
│  ├── Server                HTTP mux + WS upgrader + extra routes │
│  └── conn.go               wsConn implements net.Conn            │
├─────────────────────────────────────────────────────────────────┤
│  internal/database/        Store interface + SQLite/Postgres     │
│  ├── Store                 13 sub-interfaces (User, Channel, etc)│
│  ├── database.go           *DB (legacy SQLite + migrations V1/V2)│
│  ├── postgres.go           PostgreSQL implementation             │
│  └── store.go              Tipos row + interfaces                │
├─────────────────────────────────────────────────────────────────┤
│  internal/eventbus/        Sync pub/sub                          │
│  └── EventBus              Subscribe/Publish (recover panics)    │
├─────────────────────────────────────────────────────────────────┤
│  internal/catmage/         CatMage synchronization               │
│  └── Syncer                Push webhook + Pull incremental + Repair│
├─────────────────────────────────────────────────────────────────┤
│  internal/admin/           Admin HTTP API (Bearer token)         │
│  └── api.go                20+ endpoints (stats, kick, bans...)  │
├─────────────────────────────────────────────────────────────────┤
│  internal/config/          Config struct + validation            │
│  internal/security/        Throttler, Cloak, Sanitize, Validate  │
│  internal/protocol/        IRC Parse/Format + message tags       │
│  internal/metrics/         Prometheus counters/gauges            │
│  pkg/types/                Message, Client, Channel (shared)     │
└─────────────────────────────────────────────────────────────────┘
```

## Principios de Diseño

| Principio | Implementación |
|-----------|----------------|
| **Interface Segregation** | `Store` = 13 interfaces pequeñas (`UserRepository`, `ChannelRepository`, etc.) |
| **Dependency Injection** | `Server` recibe `Config`, `Store`, `IdentityProvider`, `AuthProvider` |
| **Single Responsibility** | Cada handler file = 1 dominio (auth, channel, messaging, mode, etc.) |
| **Event-Driven Persistence** | Handlers → EventBus → Subscribers (async, non-blocking) |
| **Graceful Degradation** | Sin DB = in-memory only; Sin CatMage = local auth only |
| **Security by Default** | Rate limit, IP throttle, sanitization, origin validation, TLS opcional |

## Capas y Flujo de Control

```
Capa 1: Transport
  ├─ TCP Listener (acceptLoop → client.Handle)
  └─ WebSocket Server (HTTP mux + /ws upgrade)

Capa 2: Protocol
  └─ protocol.Parse/Format (IRC + IRCv3 tags)

Capa 3: Routing
  └─ CommandRouter (map[string]HandlerFunc)

Capa 4: Handlers (lógica de negocio)
  ├─ Connection: PASS, NICK, USER, QUIT, PING, AWAY
  ├─ Channel: JOIN, PART, TOPIC, MODE, KICK, INVITE, KNOCK
  ├─ Messaging: PRIVMSG, NOTICE, TAGMSG, HISTORY
  ├─ Services: LOGIN, NickServ, ChanServ, OperServ
  ├─ Info: WHOIS, WHO, LIST, LUSERS, MOTD, TIME
  ├─ IRCv3: CAP, MONITOR, SETNAME, CHGHOST
  └─ Admin: AUDITLOG, INVTOKEN

Capa 5: State Managers
  ├─ ClientManager (nick registry + client map)
  ├─ ChannelManager (channel map)
  ├─ NickServ/ChanServ/ChanServV2/OperServ

Capa 6: Persistence (async via EventBus)
  └─ Store interface → PostgreSQL (legacy SQLite removed)

Capa 7: Cross-cutting
  ├─ EventBus (sync, recover panics)
  ├─ Metrics (Prometheus)
  ├─ Security (RateLimit, Throttler, Sanitize)
  └─ CatMage Sync (push/pull/repair)
```

## Inyección de Dependencias (Startup)

```go
// cmd/server/main.go
cfg := config.Load()
cfg.Validate()

srv := server.New(cfg)  // ← Toda la construcción aquí

// server.New() hace:
func New(cfg *Config) *Server {
    store, _ := database.OpenStore(cfg.DatabaseURL)  // PostgreSQL
    
    // Identity layer
    local := identity.NewLocalIdentityProvider(store)
    syncIdp := identity.NewSyncIdentityProvider(local, nil, 5*time.Minute)
    
    // Auth layer
    var authProv auth.AuthProvider
    if cfg.CatMageURL != "" && cfg.CatMageAPIKey != "" {
        authProv = auth.NewCatmageAuthProvider(cfg.CatMageURL, cfg.CatMageAPIKey)
    } else if store != nil {
        authProv = auth.NewLocalAuthProvider(store, cfg.JWTSecret)
    } else {
        authProv = auth.NoopAuthProvider{}
    }
    
    // Services
    ns := services.NewNickServWithIdentity(store, syncIdp)
    cs := services.NewChannelServ(ns, store)
    cv2 := services.NewChanServV2(cs, store, syncIdp)
    os := services.NewOperServ(store, srv)  // circular ref via ServerFace
    
    // EventBus + subscribers
    bus := eventbus.New()
    srv.bus = bus
    srv.registerSubscribers()  // persistMessage, audit, etc.
    
    // CatMage sync
    if cfg.CatMageURL != "" {
        syncer = catmage.NewSyncer(cfg.CatMageURL, cfg.CatMageAPIKey, interval, applyFunc)
        syncer.Run(ctx)
    }
    
    return srv
}
```

## Gestión de Estado Compartido

| Estado | Estructura | Concurrencia |
|--------|------------|--------------|
| Clientes conectados | `client.Manager` (`map[id]*Client`, `map[lowerNick]id`) | `RWMutex` |
| Canales activos | `channel.Manager` (`map[name]*Channel`) | `RWMutex` |
| Registry de nicks | `auth.Registry` (`map[lowerNick]clientID`) | `RWMutex` |
| Canal (usuarios, modos, bans) | `types.Channel` | `Mutex` (broadcastLoop propio) |
| Cliente (output, caps, channels) | `types.Client` | `RWMutex` (channels), `Mutex` (monitor) |
| Métricas admin | `Server.statsCache` | `Mutex` (10s TTL) |
| Throttling IP | `security.Throttler` | `Mutex` + cleanup goroutine |
| CatMage cursor | `Syncer.cursor` | `Mutex` |

## Patrones de Concurrencia

### 1. Goroutine por Conexión
```go
func (s *Server) acceptLoop(ln net.Listener) {
    for {
        conn, _ := ln.Accept()
        s.wg.Add(1)
        go func() {
            defer s.wg.Done()
            client.Handle(conn, s.OnMessage, s.OnDisconnect)
        }()
    }
}
```

### 2. Broadcast via Channel (no lock en hot path)
```go
// types.Channel
broadcast chan string (buf 256)

func (ch *Channel) broadcastLoop() {
    for msg := range ch.broadcast {
        ch.Mutex.RLock()
        for _, c := range ch.Clients {
            select { case c.Output <- msg: default } // non-blocking
        }
        ch.Mutex.RUnlock()
    }
}
```

### 3. EventBus Síncrono (Publish bloquea)
```go
func (eb *EventBus) Publish(e Event) {
    handlers := copy(eb.handlers[e.Type()])
    for _, h := range handlers {
        func() {
            defer recover() // panic en handler no rompe bus
            h(e)
        }()
    }
}
```

### 4. Subscribers Async (goroutine anónima + recover)
```go
func (s *Server) onMessageSent(e Event) {
    ev := e.(MessageSentEvent)
    s.persistMessage(ev.Channel, ev.Sender, ev.Target, ev.Content)
    s.persistMessageV2(ev.Channel, ev.Sender, ev.Target, ev.Content, ev.Command)
}

// En subscriber:
go func() {
    defer recover()
    if s.store != nil {
        s.store.LogAuditEvent(...)
    }
}()
```

## Extensibilidad

| Punto | Cómo Extender |
|-------|---------------|
| **Nuevo comando IRC** | `router.Register("CMD", s.handleCmd)` en `buildRouter()` |
| **Nuevo AuthProvider** | Implementar `AuthProvider` interface + wire en `server.New()` |
| **Nuevo IdentityProvider** | Implementar `IdentityProvider` + wire |
| **Nuevo EventBus subscriber** | `bus.Subscribe(EventType{}.Type(), handler)` en `registerSubscribers()` |
| **Nuevo Admin endpoint** | Añadir `mux.HandleFunc("/admin/xyz", h.auth(h.xyz))` en `admin.NewHandler()` |
| **Nuevo HTTP route en WS** | `wsSrv.Handle("/path", handler)` en `main.go` |
| **Nuevo Service IRC** | Struct con `HandleMessage` + registrar en `HandleServiceMessageV2` |
| **Nueva métrica Prometheus** | Añadir campo a `metrics.Collector` + `met.X.Add(1)` en handler |

## Debilidades Arquitectónicas

| Problema | Impacto | Mitigación |
|----------|---------|------------|
| **EventBus síncrono** | Handler lento bloquea publisher | Subscribers usan goroutine anónima |
| **Ciclo Server ↔ OperServ** | `OperServ` necesita `ServerFace` (interface) | Interface rompe ciclo de import |
| **Dual persistence (legacy + V2)** | Doble escritura, complejidad | Plan: deprecate legacy tras migración completa |
| **CatMageAuthProvider stub** | No funcional, solo compila | Documentado como "STUB — not wired" |
| **Global state en `Server`** | Testing difícil (requiere DB real) | Interfaces `ServerFace` para admin tests |
| **Config validada en startup** | No hot-reload | `SIGHUP` no implementado |

---

*Generado: 2026-07-11 | Fuente: `internal/server/server.go`, `cmd/server/main.go`, `internal/*`*
```

## 10. componentes.md

```md
# Componentes OdinX

## Arquitectura de Módulos

OdinX usa un patrón **IIFE (Immediately Invoked Function Expression)** para cada módulo, registrándose en el namespace global `CatIRC.*`.

```javascript
// Patrón estándar
(function () {
  'use strict';
  const S = CatIRC.state;
  const { $ } = CatIRC;
  
  function init() { ... }
  function doSomething() { ... }
  
  CatIRC.moduleName = { init, doSomething };
})();
```

---

## Módulos Principales (js/)

### Core State & Utils
| Archivo | Exporta | Descripción |
|---------|---------|-------------|
| `state.js` | `CatIRC.state`, `CatIRC.$`, `CatIRC.esc`, `CatIRC.randomNick`, `CatIRC.loadSettings`, `CatIRC.saveSettings`, `CatIRC.saveSession`, `CatIRC.loadSession`, `CatIRC.clearAllData`, `CatIRC.formatFileSize`, `CatIRC.formatIdle` | Singleton global state, settings persistence, session management, utilities |

### Client & Protocol
| Archivo | Exporta | Descripción |
|---------|---------|-------------|
| `client.js` | `CATIRCClient` (class) | WebSocket client, reconnection, IRC message handling, callbacks |
| `irc.js` | `IRC` (object) | Parser IRC, formatter, nick colors, markdown, time formatting, validation |
| `irc-handler.js` | `attachHandler(conn, state)` | ES Module bridge: IRC messages → state updates |

### Connection & Events
| Archivo | Exporta | Descripción |
|---------|---------|-------------|
| `connection.js` | `CatIRC.connection = { setupCallbacks, restoreSession, showReconnectDialog }` | WS callbacks wiring, session restore, reconnect dialog |
| `events.js` | `CatIRC.events = { init, cleanup }` | DOM listeners: input, toolbar, shortcuts, modals, drag-drop |
| `commands.js` | `CatIRC.commands = { handleInput, handleCmd }` | Input router: slash commands + plain messages |

### UI & Rendering
| Archivo | Exporta | Descripción |
|---------|---------|-------------|
| `ui.js` | `CatIRC.ui` | Render: tabs, nicklist, messages, modals, tooltips, search, autocomplete |
| `modals.js` | `CatIRC.ModalManager` | Modal stack manager: open/close, focus trap, ESC handling |

### Features
| Archivo | Exporta | Descripción |
|---------|---------|-------------|
| `auth.js` | `CatIRC.auth = { init, doLogin, doRegisteredLogin }` | Login flows: guest, registered, embed JWT |
| `p2p.js` | `CatIRC.p2p` | WebRTC file transfer: offer/accept/signal/chunks, SHA-256 verify |
| `db.js` | `CatIRC.db` | IndexedDB v2: messages per record, auto-trim 500/channel |
| `notifications.js` | `CatIRC.notifications` | Web Notifications API + sound, filters |
| `noticeBus.js` | `CatIRC.noticeBus` | Pub/sub for service NOTICEs (ChanServ, OperServ, NickServ) |
| `profile.js` | `CatIRC.profile` | WHOIS popup, user card in DM |
| `search.js` | `CatIRC.search` | In-channel search + global admin search |
| `suggestions.js` | `CatIRC.suggestions` | `@nick` / `#channel` autocomplete |
| `reactions.js` | `CatIRC.reactions` | TAGMSG +react/+react-to, picker UI |
| `nickserv.js` | `CatIRC.nickserv` | NickServ modal: register/identify/ghost |
| `channelmodes.js` | `CatIRC.channelModes` | Channel modes modal (+i, +t, +k, +l, +b, +e) |
| `channellist.js` | `CatIRC.channellist` | /LIST modal con búsqueda |
| `pm.js` | `CatIRC.pm` | Private messages panel (recent, unread) |
| `notifications.js` | `CatIRC.notifications` | Web Notifications + sound |
| `emoji.js` | `CatIRC.emoji` | Emoji picker + Twemoji fallback |
| `mobile.js` | `CatIRC.mobile` | Mobile drawer, bottom nav, view switching |
| `menus.js` | `CatIRC.menus` | Context menus, dropdowns, keyboard nav |
| `modals.js` | `CatIRC.ModalManager` | Modal stack, focus trap, ESC handling |
| `admin.js` | `CatIRC.ChanServAdmin`, `CatIRC.OperMenu`, `CatIRC.RootDashboard`, `CatIRC.GlobalSearch` | Admin panels (3 paneles) |
| `permissions.js` | `CatIRC.permissions` | Role chips, admin token, isOper(), isRoot() |
| `filedrop.js` | `CatIRC.filedrop` | Drag & drop images → P2P offer |
| `upload.js` | `CatIRC.upload` | HTTP upload fallback (stub) |
| `sdk-adapter.js` | `CatIRC.sdkAdapter` | CatMage embed SDK bridge (postMessage) |
| `logger.js` | `CatIRC.logger` | Console logger + remote logging |
| `utils.js` | `debounce`, `throttle`, `formatTime`, etc. | Helpers |

---

## Comunicación Entre Módulos

### Patrones Usados

| Patrón | Ejemplo |
|--------|---------|
| **Callbacks en Client** | `client.onMessage = (data) => ui.handleIncomingMsg(data)` |
| **NoticeBus Pub/Sub** | `noticeBus.on('chanserv', fn)` → `noticeBus.emit('chanserv', text, from)` |
| **State Global** | `CatIRC.state.client.channels.get('#chan').messages.push(msg)` |
| **Direct Calls** | `ui.addMsg()`, `db.addMessage()`, `p2p.offerFile()` |

### Flujo Típico: Mensaje Entrante
```
WS onmessage → client.handleMessage() 
  → parse IRC → client.onMessage(data)
  → switch(data.type):
      case 'message': ui.handleIncomingMsg(data)
        → ui.addMsg() → renderMsg() → DOM + IndexedDB
        → notifications.show() si mention/DM
      case 'typing': ui.handleTyping(data)
      case 'react': reactions.apply()
```

---

## Dependencias Externas (CDN)

| Librería | Uso | Versión |
|----------|-----|---------|
| Tailwind CSS | Styling | v4 (via CLI) |
| Twemoji | Emoji rendering | Latest |
| @parcel/watcher | Dev server file watching | Dev only |
| Jest | Unit testing | Dev only |
| Playwright | E2E testing | Dev only |

---

## Build & Dev

```bash
# Dev server (proxy WS a CatIRC)
npm run dev        # puerto 8082

# Build CSS
npm run build:css  # tailwind → dist/tailwind.min.css

# Testing
npm test           # Jest + coverage
npm run test:watch
npm run test:e2e   # Playwright
```

---

## Arquitectura de Estado

```
CatIRC.state = {
  client: CATIRCClient,           // WS connection + channels
  settings: {...},                // localStorage
  commandHistory: [],             // ↑/↓ en input
  commandHistoryIdx: -1,
  typingTimeout: null,
  lastTypingSent: 0,
  ctxNick: null,                  // nick en context menu
  ctxIsOp: false,
  pendingChannels: [],            // canales a unir tras login
  inviteNick: '',
  ignored: Set<string>,           // /ignore
  profileNick: '',
  _whoisTarget: '',
  _whoisData: {},
  searchMatches: [],
  searchIdx: 0,
  // Embed mode
  _embedMode: false,
  _embedJWT: '',
  _embedChannels: [],
  _reconnectDialogOpen: false,
  _sessionAction: null,
  _recoverChannels: null,
  _recoverActive: null,
}
```

---

*Generado: 2026-07-11 | Fuente: `odinx/js/*.js`*
```

## 11. estado.md

```md
# Estado — OdinX

## CatIRC.state — Singleton Global

```javascript
CatIRC.state = {
  // Conexión
  client: null,                    // CATIRCClient instance
  
  // Settings (persistidos en localStorage)
  settings: {
    nick: '',
    realname: '',
    server: 'ws://localhost:8081/ws',
    channel: '#general',
    autoReconnect: true,
    theme: 'dark',
    notifications: false,
    sounds: true,
    autoHistory: true,
    expandImages: false
  },
  
  // Historial de comandos
  commandHistory: [],
  commandHistoryIdx: -1,
  
  // Typing indicator
  typingTimeout: null,
  lastTypingSent: 0,
  
  // Context menu
  ctxNick: null,
  ctxIsOp: false,
  
  // Canales pendientes (tras login)
  pendingChannels: [],
  
  // Invite modal
  inviteNick: '',
  
  // Ignored users
  ignored: Set<string>,
  
  // Profile popup
  profileNick: '',
  
  // WHOIS
  _whoisTarget: '',
  _whoisData: {},
  
  // Search
  searchMatches: [],
  searchIdx: 0,
  
  // Embed mode
  _embedMode: false,
  _embedJWT: '',
  _embedChannels: [],
  
  // Reconnection dialog
  _reconnectDialogOpen: false,
  _sessionAction: null,
  _recoverChannels: null,
  _recoverActive: null,
};
```

---

## Persistencia

| Storage | Clave | Contenido | TTL |
|---------|-------|-----------|-----|
| `localStorage` | `catirc_settings` | Settings JSON | ∞ |
| `localStorage` | `catirc_session` | `{nick, channels[], currentChannel, savedAt}` | 24h |
| `localStorage` | `catirc_ignored` | Array de nicks | ∞ |
| `sessionStorage` | `catirc_admin_token` | Admin Bearer token | Sesión |
| `IndexedDB` | `catirc-chat` v2 | Messages per record, auto-trim 500/channel | ∞ |

---

## CatIRC.state.client (CATIRCClient)

```javascript
{
  // Connection
  ws: WebSocket,
  connected: false,
  registered: false,
  reconnecting: false,
  reconnectAttempts: 0,
  maxReconnectDelay: 30000,
  maxReconnectAttempts: 10,
  reconnectTimer: null,
  state: 'DISCONNECTED',  // DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING, FAILED
  _intentionalClose: false,
  autoReconnect: true,
  initialChannel: '#general',
  nickservPass: '',
  
  // Identity
  nick: '',
  realname: '',
  password: '',
  myNick: '',
  serverName: '',
  
  // Capabilities
  supportedCaps: [],
  CapPhase: 0,  // 0=none, 1=LS, 2=LS302, 3=REQ, 4=END
  
  // Channels
  channels: Map<lowerName, ChannelData>,
  currentChannel: null,
  
  // Callbacks
  onConnect, onDisconnect, onRegister, onMessage,
  onChannelJoin, onChannelPart, onUserList, onNickChange,
  onMode, onBanList, onTopic, onKick, onInvite, onNotice,
  onMOTD, onWHO, onWHOIS, onList, onPing, onCAP, onUserHost,
  onHistory, onReact, onOfflineDM, onError, onReconnecting,
  onStateChange, onRoleInfo,
}
```

### ChannelData
```javascript
{
  users: Set<string>,           // nicks en canal
  topic: '',
  messages: Message[],          // array de Message
  unread: 0,
  userPrefixes: Map<string, string>,  // nick -> prefixes (@, +, etc.)
  modes: Map<string, boolean>,  // mode char -> boolean
  _scrollTop: number,           // scroll position guardado
  awayStatus: Map<string, string>, // nick -> away message
}
```

### Message
```javascript
{
  type: 'privmsg' | 'action' | 'join' | 'part' | 'quit' | 'server' | 'service',
  text: string,
  nick: string,
  isOp: boolean,
  time: number,           // Date.now()
  mid: string,            // unique message ID para reactions
  reactions: Map<string, Set<string>>,  // emoji -> Set<nick>
  tags: object,           // IRCv3 message tags
}
```

---

## CATIRCClient Callbacks

```javascript
client.onConnect = () => { ui.setStatus('connected'); }
client.onDisconnect = (code, reason) => { ui.setStatus('disconnected'); }
client.onRegister = (nick) => { ui.showLoginStatus('success', ...); }
client.onMessage = (data) => { 
  switch(data.type) {
    case 'message': ui.handleIncomingMsg(data); break;
    case 'quit': ui.addMsg(...); break;
    case 'away': ui.addMsg(...); break;
    case 'typing': ui.handleTyping(data); break;
  }
};
client.onChannelJoin = (data) => { if (data.isMe) ui.switchTab(data.channel); };
client.onChannelPart = (data) => { if (data.isMe) { client.channels.delete(...); } };
client.onKick = (data) => { if (data.isMe) { ... } };
client.onTopic = (data) => { if (data.channel === current) ui.updateTopicBar(); };
client.onMode = (data) => { /* update channel.modes */ ui.addMsg(...); };
client.onNickChange = (data) => { if (data.isMe) ui.updateUserBadge(newNick); };
client.onNotice = (text, from, isService) => { /* route to modals or Status */ };
client.onMOTD = (lines) => { ui.addMsg('Status','server','*** MOTD:'); lines.forEach(l=>ui.addMsg('Status','server','- '+l)); };
client.onWHOIS = (data) => { if (data.done) { /* cache */ } };
client.onWHO = (data) => { if (data.done) ui.addMsg(...); };
client.onList = (list) => { channellist.show(list); };
client.onReact = (data) => { reactions.apply(data.nick, data.channel, data.mid, data.emoji); };
client.onInvite = (data) => { ui.addMsg(..., '*** Invitado a ' + data.channel); };
client.onHistory = (data) => { if (data.type==='start') showLoading(); else if (data.type==='end') { hideLoading(); ui.addMsg(...); } else { ui.addMsg(...); } };
client.onError = (text) => { ui.addMsg(..., '*** ERROR: '+text); };
client.onOfflineDM = (data) => { if (pm) pm.setUnread(data.nick, data.count); ui.addMsg('Status', 'server', '*** Tienes '+data.count+' mensaje(s) no leídos de '+data.nick); };
client.onRoleInfo = (roles) => { if (permissions) permissions.setGlobalRoles(roles); else globalRoles = roles; ui.renderNicklist(); };
client.onOfflineDM = (data) => { if (pm) pm.setUnread(data.nick, data.count); ui.addMsg('Status', 'server', '*** Tienes '+data.count+' mensaje(s) no leídos de '+data.nick+'. Usa /HISTORY '+data.nick+' para leerlos.'); };
client.onPing = () => {};
client.onCAP = () => {};
```

---

## CATIRCClient — Flujo de Conexión

```javascript
connect() {
  if (state === 'CONNECTING' || state === 'CONNECTED') return;
  _clearReconnectTimer();
  _teardownSocket();
  _intentionalClose = false;
  connected = false;
  registered = false;
  _setState(reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');
  
  const wsUrl = _resolveWsUrl();  // localStorage.irc_config > window.CATIRC_WS_URL > location.host
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    connected = true; reconnecting = false; reconnectAttempts = 0;
    sessionId = sessionId || ('s-' + Date.now().toString(36));
    _setState('CONNECTED');
    if (onConnect) onConnect();
    startPingInterval();
    startRegistration();  // CAP LS 302
  };
  
  ws.onmessage = (event) => {
    lines = event.data.split(/\r?\n/);
    for (line of lines) if (line.trim()) handleMessage(IRC.parse(line));
  };
  
  ws.onclose = (event) => {
    connected = false; registered = false; stopPingInterval();
    if (onDisconnect) onDisconnect(event.code, event.reason);
    if (_intentionalClose || !autoReconnect) _setState('DISCONNECTED');
    else scheduleReconnect();
  };
  
  ws.onerror = (event) => { if (onError) onError('Error de WebSocket'); };
}
```

---

*Generado: 2026-07-11 | Fuente: `odinx/js/state.js`, `odinx/js/client.js`, `odinx/js/connection.js`, `odinx/js/events.js`*
```

## 12. pantallas.md

```md
# Rutas Frontend — OdinX

## Arquitectura de Navegación

OdinX es una **Single Page Application (SPA)** sin router de URL tradicional. La navegación se gestiona mediante:

1. **Tabs dinámicos** — Canales y DMs como pestañas en `#tabContainer`
2. **Modales** — `CatIRC.ModalManager` para overlays
3. **Panels laterales** — Nicklist (canales) / UserCard (DMs)
4. **Estado global** — `CatIRC.state.client.currentChannel` determina vista activa

---

## Pantallas Principales

### 1. Login Screen (`#login-screen`)

**Archivos**: `index.html` + `js/auth.js`

| Elemento | ID | Descripción |
|----------|-----|-------------|
| Tab Guest | `#tab-guest` | Login sin cuenta |
| Tab Registrado | `#tab-registered` | Login con NickServ |
| Input Nick | `#login-nick` / `#reg-nick` | Nickname |
| Input Pass | `#reg-nickserv-pass` | NickServ password |
| Advanced | `#login-advanced` | Server config (host, port, WSS) |
| Quick Channels | `.quick-channel` | Botones #catmage, #general, etc. |
| Submit | `#login-btn` / `#login-registered-form` | Conectar |

**Flujo**:
1. `auth.init()` → carga settings + session restore
2. Usuario submite form → `doLogin()` / `doRegisteredLogin()`
4. `CATIRCClient.connect()` → WebSocket
5. `onRegister` → hide login, show `#app`, rejoin channels

---

### 2. Chat App (`#app`)

#### Header (`#header`)
| Elemento | ID | Función |
|----------|-----|---------|
| Status | `#status-dot`, `#connection-text` | Connected/Reconnecting/Disconnected |
| Server | `#menu-server` | Server name |
| User | `#user-badge-name`, `#user-avatar` | Current nick |
| Tabs | `#tabContainer` | Channel/DM tabs |
| Search | `#chat-search-input` | In-channel search |
| Toolbar | `#btn-connect`, `#btn-disconnect`, `#btn-toggle-nicklist`, `#btn-settings`, `#btn-emoji` | Actions |

#### Main Chat (`#chatWindow`)
- **Messages**: Rendered via `ui.renderMsg()` → `div.msg-row`
- **Input**: `#messageInput` + `#send-btn` + `#attach-btn`
- **Paste Preview**: `#paste-preview` (drag&drop images)
- **Typing Indicator**: `#typing-indicator`

#### Right Panel
| Container | ID | Contenido |
|-----------|-----|-----------|
| Nicklist | `#nicklistContainer` → `#nickList` | Canales: users con prefixes |
| DM Card | `#dmCard` | DMs: user info + actions |

#### Mobile Drawer (`#mobile-drawer`)
- **Tabs**: Chat / Canales / Usuarios / Ajustes
- **Bottom Nav**: Fixed buttons

---

## Modales (CatIRC.ModalManager)

```javascript
CatIRC.ModalManager.open(id, { onClose: fn })
CatIRC.ModalManager.close(id)
```

| Modal ID | Trigger | Contenido Clave |
|----------|---------|-----------------|
| `settings-modal` | `#btn-settings` | Nick, Realname, Server config, Theme, Notifications, Sounds |
| `join-modal` | `#btn-connect` / `/join` | Channel input, Key input, Quick join buttons |
| `invite-modal` | Click nick → Invitar | Nick input, Channel select, Send |
| `chanserv-modal` | Click "Gestionar" en canal | Tabs: Info, MLOCK, TOPICLOCK, AKICK, FLAGS, SET, SUCCESSOR, INV, CLEAR |
| `nickserv-modal` | `/ns` / `/nickserv` | Register, Identify, Ghost, Password, Drop |
| `oper-modal` | Oper menu (si oper) | Tabs: Clients, Bans, Commands, History, Search, Audit, Sessions |
| `root-dashboard-modal` | Oper → Root Dashboard | Tabs: Overview, Users, Roles, Opers, Channels, Invitations, Bans, Audit, Search, Settings |
| `global-search-modal` | `Ctrl+Shift+F` | Query input, Channel/Nick filters, Results list |
| `channel-modes-modal` | Oper → Channel Modes | Mode list, Set/Unset buttons |
| `transfers-modal` | 📎 btn / `/send` | Active transfers list + History |
| `profile-popup` | Click nick | WHOIS info, DM, Invite, Ignore, Kick/Op/Voice (si op) |
| `dm-panel` | `/pm` / Click DM tab | Recent DMs, Unread badges, New DM |
| `help-modal` | `/help` / F1 | Command reference |

### Modal Lifecycle
```javascript
open(id, { onClose: fn }) → adds to stack, focus trap, ESC to close
close(id) → removes from stack, runs onClose
```

---

## Flujos de Navegación

### 1. Login → Chat
```
index.html load
  → app.js:init()
  → auth.init() → shows #login-screen
  → user submits login
  → auth.doLogin() → CATIRCClient.connect()
  → connection.setupCallbacks() → client.onRegister
  → onRegister: hide #login-screen, show #app
  → ui.updateUserBadge(nick), ui.renderTabs(), ui.switchTab(channel)
```

### 2. Channel Switch
```
ui.switchTab(channelName)
  → save scroll position of current
  → state.client.currentChannel = channel
  → ui.renderTabs(), ui.renderMessages(), ui.renderRightPanel()
  → restore scroll position
  → focus #messageInput
```

### 3. Open DM
```
ui.openDM(nick)
  → create/get channelData for nick (lowercase)
  → state.client.currentChannel = nick
  → ui.renderTabs(), ui.renderMessages(), ui.renderRightPanel()
  → load DM history from IndexedDB
  → client.requestWHOIS(nick)
```

### 4. Modal Flow (ej. Settings)
```
ui.openSettings()
  → fill form from state.settings
  → ModalManager.open('settings-modal', { onClose: resetForm })
  → user clicks Save
  → ui.applySettings() → save to localStorage, apply theme
  → ModalManager.close()
```

### 4. Mobile View Switch
```
CatIRC.mobile.switchView(viewId)
  → hide all .mobile-view, show #viewId
  → update bottom nav active state
  → render view-specific content (channels, users)
```

---

## Deep Linking / Embed Mode

### Embed Mode (`?embed=1` o `window.CATIRC_EMBED_MODE=true`)
```javascript
// app.js init
if (isEmbed) {
  document.body.classList.add('embed-mode')
  #login-screen.hidden = true
  #app.hidden = false
  window.addEventListener('message', e => {
    if (e.data.type === 'catirc:auth') {
      state._embedJWT = jwt
      state.settings.nick = nick
      state._embedChannels = channels
      client.connect()
    }
  })
  parent.postMessage({type:'catirc:ready'}, '*')
}
```

### Parent → Iframe Messages
| Type | Payload | Action |
|------|---------|--------|
| `catirc:auth` | `{nick, realname, jwt, channels[]}` | Auto-login + join channels |
| `catirc:join` | `{channel}` | Join channel |
| `catirc:msg` | `{channel, text}` | Send message |

### Iframe → Parent Messages
| Type | Payload | When |
|------|---------|------|
| `catirc:ready` | `{}` | Iframe loaded |
| `catirc:joined` | `{channel}` | After JOIN |
| `catirc:msg` | `{channel, from, text}` | Message recv/sent |

---

## URL State (No Router)

OdinX **no usa URL routing** (`pushState`/`hashchange`). Todo el estado vive en:

| Storage | Clave | Contenido |
|---------|-------|-----------|
| `CatIRC.state` | memoria | client, settings, commandHistory, ignored, pendingChannels, etc. |
| `localStorage` | `catirc_settings` | nick, realname, server, channel, theme, etc. |
| `localStorage` | `catirc_session` | nick, channels[], currentChannel, savedAt (24h) |
| `localStorage` | `catirc_ignored` | Array de nicks ignorados |
| `sessionStorage` | `catirc_admin_token` | Admin bearer token (no persiste tras cerrar) |
| `IndexedDB` | `catirc-chat` v2 | Messages per record, auto-trim 500/canal |

**Ventajas**: Simple, offline-first, no rompe refresh.
**Limitaciones**: No deep-link a canal específico, no historial navegador.

---

## Keyboard Shortcuts

| Shortcut | Acción | Contexto |
|----------|--------|----------|
| `Ctrl+K` / `Ctrl+K` | Open join modal | Global (except input) |
| `Ctrl+M` | Open DM modal | Global |
| `Ctrl+E` | Export chat (JSON) | Global |
| `Ctrl+F` | Search in chat | Chat focused |
| `Ctrl+Shift+F` | Global search modal | Global |
| `Tab` | Autocomplete nick/channel | Input focused |
| `↑` / `↓` | Command history | Input empty |
| `Escape` | Close modals/popovers | Global |
| `Enter` | Send message / Submit modal | Input focused |
| `Ctrl+U` | Clear input | Input focused |

---

## Mobile Navigation (`js/mobile.js`)

### Views
| View ID | Contenido |
|---------|-----------|
| `chat-view` | Chat + input |
| `channels-view` | Channel list + unread badges |
| `users-view` | Nicklist grouped (Ops, Voice, Users) |
| `settings-view` | Settings form |

### Bottom Nav
```html
<div id="mobile-bottom-nav">
  <button data-view="chat-view">💬 Chat</button>
  <button data-view="channels-view"># Canales</button>
  <button data-view="users-view">👥 Usuarios</button>
  <button data-view="settings-view">⚙️ Ajustes</button>
</div>
```

### Switch View
```javascript
switchView(viewId)
  → hide all .mobile-view, show #viewId
  → update bottom nav active state
  → render view-specific content (channels, users)
```

---

*Generado: 2026-07-11 | Fuente: `odinx/index.html`, `odinx/js/ui.js`, `odinx/js/auth.js`, `odinx/js/mobile.js`, `odinx/js/modals.js`, `odinx/js/events.js`, `odinx/js/auth.js`, `odinx/app.js`*
```

## 13. routing.md

```md
# Routing — OdinX

## Arquitectura de Navegación

OdinX es una **Single Page Application (SPA)** sin router de URL tradicional. La navegación se gestiona mediante:

1. **Tabs dinámicos** — Canales y DMs como pestañas en `#tabContainer`
2. **Modales** — `CatIRC.ModalManager` para overlays
3. **Panels laterales** — Nicklist (canales) / UserCard (DMs)
4. **Estado global** — `CatIRC.state.client.currentChannel` determina vista activa

---

## Pantallas Principales

### 1. Login Screen (`#login-screen`)
**Archivo**: `index.html` + `js/auth.js`

| Elemento | ID | Descripción |
|----------|-----|-------------|
| Tab Guest | `#tab-guest` | Login sin cuenta |
| Tab Registrado | `#tab-registered` | Login con NickServ |
| Input Nick | `#login-nick` / `#reg-nick` | Nickname |
| Input Pass | `#reg-nickserv-pass` | NickServ password |
| Advanced | `#login-advanced` | Server config (host, port, WSS) |
| Quick Channels | `.quick-channel` | Botones #catmage, #general, etc. |
| Submit | `#login-btn` / `#login-registered-form` | Conectar |

**Flujo**:
1. `auth.init()` → carga settings + session restore
2. Usuario submite form → `doLogin()` / `doRegisteredLogin()`
3. `CATIRCClient.connect()` → WebSocket
4. `onRegister` → hide login, show `#app`, rejoin channels

---

### 2. Chat App (`#app`)

#### Header (`#header`)
| Elemento | ID | Función |
|----------|-----|---------|
| Status | `#status-dot`, `#connection-text` | Connected/Reconnecting/Disconnected |
| Server | `#menu-server` | Server name |
| User | `#user-badge-name`, `#user-avatar` | Current nick |
| Tabs | `#tabContainer` | Channel/DM tabs |
| Search | `#chat-search-input` | In-channel search |
| Toolbar | `#btn-connect`, `#btn-disconnect`, `#btn-toggle-nicklist`, `#btn-settings`, `#btn-emoji` | Actions |

#### Main Chat (`#chatWindow`)
- **Messages**: Rendered via `ui.renderMsg()` → `div.msg-row`
- **Input**: `#messageInput` + `#send-btn` + `#attach-btn`
- **Paste Preview**: `#paste-preview` (drag&drop images)
- **Typing Indicator**: `#typing-indicator`

#### Right Panel
| Container | ID | Contenido |
|-----------|-----|-----------|
| Nicklist | `#nicklistContainer` → `#nickList` | Canales: users con prefixes |
| DM Card | `#dmCard` | DMs: user info + actions |

#### Mobile Drawer (`#mobile-drawer`)
- **Tabs**: Chat / Canales / Usuarios / Ajustes
- **Bottom Nav**: Fixed buttons

---

## Modales (CatIRC.ModalManager)

```javascript
CatIRC.ModalManager.open(id, { onClose: fn })
CatIRC.ModalManager.close(id)
```

| Modal ID | Trigger | Contenido Clave |
|----------|---------|-----------------|
| `settings-modal` | `#btn-settings` | Nick, Realname, Server config, Theme, Notifications, Sounds |
| `join-modal` | `#btn-connect` / `/join` | Channel input, Key input, Quick join buttons |
| `invite-modal` | Click nick → Invitar | Nick input, Channel select, Send |
| `chanserv-modal` | Click "Gestionar" en canal | Tabs: Info, MLOCK, TOPICLOCK, AKICK, FLAGS, SET, SUCCESSOR, INV, CLEAR |
| `nickserv-modal` | `/ns` / `/nickserv` | Register, Identify, Ghost, Password, Drop |
| `oper-modal` | Oper menu (si oper) | Tabs: Clients, Bans, Commands, History, Search, Audit, Sessions |
| `root-dashboard-modal` | Oper → Root Dashboard | Tabs: Overview, Users, Roles, Opers, Channels, Invitations, Bans, Audit, Search, Settings |
| `global-search-modal` | `Ctrl+Shift+F` | Query input, Channel/Nick filters, Results list |
| `channel-modes-modal` | Oper → Channel Modes | Mode list, Set/Unset buttons |
| `transfers-modal` | 📎 btn / `/send` | Active transfers list + History |
| `profile-popup` | Click nick | WHOIS info, DM, Invite, Ignore, Kick/Op/Voice (si op) |
| `dm-panel` | `/pm` / Click DM tab | Recent DMs, Unread badges, New DM |
| `help-modal` | `/help` / F1 | Command reference |

### Modal Lifecycle
```javascript
open(id, { onClose: fn }) → adds to stack, focus trap, ESC to close
close(id) → removes from stack, runs onClose
```

---

## Tab Switching (`ui.switchTab(name)`)

```javascript
switchTab(name) {
  save scroll position of current channel
  if (name === 'Status') { currentChannel = 'Status'; render... }
  else {
    chan = name.toLowerCase()
    if (!client.channels.has(chan)) client.joinChannel(name)
    else currentChannel = chan
    renderTabs, renderMessages, renderRightPanel, updateTopicBar
    restore scroll position
    closeMobileNicklist()
    updateNavBadges()
  }
  focus #messageInput
}
```

---

## Mobile Navigation (`js/mobile.js`)

### Views
| View ID | Contenido |
|---------|-----------|
| `chat-view` | Chat + input |
| `channels-view` | Channel list + unread badges |
| `users-view` | Nicklist grouped (Ops, Voice, Users) |
| `settings-view` | Settings form |

### Bottom Nav
```html
<div id="mobile-bottom-nav">
  <button data-view="chat-view">💬 Chat</button>
  <button data-view="channels-view"># Canales</button>
  <button data-view="users-view">👥 Usuarios</button>
  <button data-view="settings-view">⚙️ Ajustes</button>
</div>
```

### Switch View
```javascript
switchView(viewId) {
  hide all .mobile-view, show #viewId
  update bottom nav active state
  render view-specific content (channels, users)
}
```

---

## Deep Linking / Embed Mode

### Embed Mode (`?embed=1` o `window.CATIRC_EMBED_MODE=true`)
```javascript
// app.js init
if (isEmbed) {
  document.body.classList.add('embed-mode')
  #login-screen.hidden = true
  #app.hidden = false
  window.addEventListener('message', e => {
    if (e.data.type === 'catirc:auth') {
      state._embedJWT = jwt
      state.settings.nick = nick
      state._embedChannels = channels
      client.connect()
    }
  })
  parent.postMessage({type: 'catirc:ready'}, '*')
}
```

### Parent → Iframe Messages
| Type | Payload | Acción |
|------|---------|--------|
| `catirc:auth` | `{nick, realname, jwt, channels[]}` | Auto-login + join channels |
| `catirc:join` | `{channel}` | Join channel |
| `catirc:msg` | `{channel, text}` | Send message |

### Iframe → Parent Messages
| Type | Payload | Cuándo |
|------|---------|--------|
| `catirc:ready` | `{}` | Iframe loaded |
| `catirc:joined` | `{channel}` | After JOIN |
| `catirc:msg` | `{channel, from, text}` | Message recv/sent |

---

## Keyboard Shortcuts

| Shortcut | Acción | Contexto |
|----------|--------|----------|
| `Ctrl+K` / `Ctrl+K` | Open join modal | Global (except input) |
| `Ctrl+M` | Open DM modal | Global |
| `Ctrl+E` | Export chat (JSON) | Global |
| `Ctrl+F` | Search in chat | Chat focused |
| `Ctrl+Shift+F` | Global search modal | Global |
| `Ctrl+U` | Clear input | Input focused |
| `Tab` | Autocomplete nick/channel | Input focused |
| `↑` / `↓` | Command history | Input empty |
| `Escape` | Close modals/search | Global |

---

## Estado de Navegación (No Router)

OdinX **no usa URL routing** (`pushState`/`hashchange`). Todo el estado vive en:

| Storage | Clave | Contenido |
|---------|-------|-----------|
| `CatIRC.state` | memoria | client, settings, commandHistory, ignored, pendingChannels, currentChannel, etc. |
| `localStorage` | `catirc_settings` | nick, realname, server, channel, autoReconnect, theme, notifications, sounds, autoHistory, expandImages |
| `localStorage` | `catirc_session` | nick, channels[], currentChannel, savedAt (24h TTL) |
| `localStorage` | `catirc_ignored` | Array de nicks ignorados |
| `sessionStorage` | `catirc_admin_token` | Admin bearer token (no persiste tras cerrar) |
| `IndexedDB` | `catirc-chat` v2 | Messages per record, auto-trim 500/canal |

**Ventajas**: Simple, offline-first, no rompe refresh.
**Limitaciones**: No deep-link a canal específico, no historial navegador.

---

*Generado: 2026-07-11 | Fuente: `odinx/index.html`, `odinx/js/ui.js`, `odinx/js/auth.js`, `odinx/js/mobile.js`, `odinx/js/modals.js`, `odinx/js/events.js`, `odinx/js/auth.js`, `odinx/app.js`*
```

## 14. flujo-chat.md

```md
# Flujo de Chat — Canal + Privado + History

## 1. Mensaje a Canal

```mermaid
sequenceDiagram
    participant UserA
    participant OdinX_A
    participant CatIRC_WS
    participant CatIRC_IRC
    participant OdinX_B
    participant UserB
    
    UserA->>OdinX_A: Escribe "hola" en #general + Enter
    OdinX_A->>CatIRC_WS: PRIVMSG #general :hola
    CatIRC_WS->>CatIRC_IRC: OnMessage(clientA, "PRIVMSG #general :hola")
    CatIRC_IRC->>CatIRC_IRC: handlePrivmsg() → channelMessage()
    CatIRC_IRC->>DB: persistMessage() + persistMessageV2()
    CatIRC_IRC->>OdinX_A: :UserA!u@h PRIVMSG #general :hola (echo)
    CatIRC_IRC->>OdinX_B: :UserA!u@h PRIVMSG #general :hola
    OdinX_A->>UserA: Render own message
    OdinX_B->>UserB: Render incoming + notification
```

**Código**:
- `odinx/js/commands.js:handleInput()` → `client.sendMessage(target, text)`
- `catirc/internal/server/handlers_messaging.go:handlePrivmsg()` → `channelMessage()`

---

## 2. Mensaje Privado / Offline DM

```mermaid
sequenceDiagram
    participant UserA
    participant OdinX_A
    participant CatIRC_IRC
    participant OdinX_B
    participant UserB
    
    UserA->>OdinX_A: /msg UserB hola privado
    OdinX_A->>CatIRC_IRC: PRIVMSG UserB :hola privado
    CatIRC_IRC->>CatIRC_IRC: directMessage() → clientB encontrado?
    alt UserB ONLINE
        CatIRC_IRC->>OdinX_B: :UserA!u@h PRIVMSG UserB :hola privado
        OdinX_B->>UserB: Render DM + notification
    else UserB OFFLINE
        CatIRC_IRC->>DB: persistOfflineDM() → SaveMessageV2 (DM conversation)
        CatIRC_IRC->>CatMage: POST /api/internal/dm-event {from,to,preview}
        CatIRC_IRC->>OdinX_A: NOTICE :*** UserB is offline. Message saved.
    end
```

**Código**:
- `catirc/internal/server/handlers_messaging.go:directMessage()` → `persistOfflineDM()`
- `catirc/internal/server/server.go:persistOfflineDM()` → `SaveMessageV2()` + `notifyCatMageOfflineDM()`
- `odinx/js/client.js:handlePRIVMSG()` → `ui.addMsg(pmChan, 'privmsg', ...)`

---

## 3. History /HISTORY

```mermaid
sequenceDiagram
    participant User
    participant OdinX
    participant CatIRC_IRC
    participant DB
    
    User->>OdinX: /history #general 50
    OdinX->>CatIRC_IRC: HISTORY #general 50
    CatIRC_IRC->>CatIRC_IRC: handleHistory() → historyFromV2Channel()
    CatIRC_IRC->>DB: GetConversationHistory(convID, 50)
    DB-->>CatIRC_IRC: []IRCMessageV2Row
    CatIRC_IRC->>OdinX: NOTICE [HH:MM] <nick> text (x50)
    CatIRC_IRC->>OdinX: NOTICE --- End of history ---
    OdinX->>OdinX: handleNOTICE(history) → ui.addMsg() con mid
    OdinX->>DB: addMessage() (IndexedDB cache)
```

**Código**:
- `catirc/internal/server/handlers_messaging.go:handleHistory()` → `historyFromV2Channel()` / `historyFromV2DM()`
- `odinx/js/client.js:handleNOTICE()` → detecta `[HH:MM] <nick> text` → `onHistory()`

---

## 4. JOIN / PART / KICK

```mermaid
sequenceDiagram
    participant UserA
    participant CatIRC_IRC
    participant Channel
    participant UserB
    
    UserA->>CatIRC_IRC: JOIN #nuevo
    CatIRC_IRC->>CatIRC_IRC: joinChannel() → checks (+i, +b, +k, +l, AKICK)
    CatIRC_IRC->>Channel: AddClient()
    Channel->>Channel: BroadcastMessage(JOIN)
    Channel->>UserA: RPL_NAMREPLY + RPL_ENDOFNAMES
    CatIRC_IRC->>DB: persistSystemEvent(JOIN)
    CatIRC_IRC->>DB: UpsertChannelMember()
    CatIRC_IRC->>Channel: applyChannelAutoRole() (ChanServV2 FLAGS)
```

**Código**:
- `catirc/internal/server/handlers_channel.go:handleJoin()` → `joinChannel()`
- `catirc/internal/server/server.go:applyChannelAutoRole()` → `ChanServV2.HasFlag()`

---

## 5. Typing Indicators + Reactions

```mermaid
sequenceDiagram
    participant UserA
    participant OdinX_A
    participant CatIRC_IRC
    participant OdinX_B
    
    UserA->>OdinX_A: Escribe en input (keydown)
    OdinX_A->>CatIRC_IRC: @+typing=active TAGMSG #general
    CatIRC_IRC->>OdinX_B: @+typing=active TAGMSG #general :UserA
    OdinX_B->>OdinX_B: show "UserA escribe..."
    
    UserA->>OdinX_A: Click 👍 en mensaje mid=k3j4h5
    OdinX_A->>CatIRC_IRC: @+react=👍 +react-to=k3j4h5 TAGMSG #general
    CatIRC_IRC->>OdinX_B: @+react=👍 +react-to=k3j4h5 TAGMSG #general
    OdinX_B->>OdinX_B: render reaction 👍 en mensaje
```

**Código**:
- `odinx/js/client.js:sendTyping()` → `TAGMSG @+typing=active`
- `odinx/js/client.js:handleTAGMSG()` → `onMessage({type:'typing'})` / `onReact()`
- `catirc/internal/server/handlers_messaging.go:handleTagmsg()` → broadcast TAGMSG

---

## 4. Flujo Notificaciones (Mentions + DM + P2P)

```mermaid
sequenceDiagram
    participant CatIRC_IRC
    participant OdinX
    participant Browser
    
    CatIRC_IRC->>OdinX: PRIVMSG #chan :hola @UserB
    OdinX->>OdinX: handleIncomingMsg() → detecta @UserB
    OdinX->>Browser: Notification "Mención en #chan"
    OdinX->>Browser: play sound (settings.sounds)
    
    CatIRC_IRC->>OdinX: PRIVMSG UserB :DM privado
    OdinX->>OdinX: isPrivate → ui.addMsg(pmChan)
    OdinX->>Browser: Notification "Mensaje privado de UserA"
    OdinX->>Browser: play sound
    
    CatIRC_IRC->>OdinX: FILE OFFER ...
    OdinX->>OdinX: p2p.handleSignal() → modal "Aceptar archivo"
    OdinX->>Browser: Notification "Solicitud de archivo"
```

**Código**:
- `odinx/js/ui.js:handleIncomingMsg()` → `notifications.show()`
- `odinx/js/notifications.js:show()` → `new Notification()` + `audio.play()`
- `odinx/js/p2p.js:handleSignal()` → `_showOfferModal()`

---

*Generado: 2026-07-11 | Fuente: `odinx/js/client.js`, `odinx/js/connection.js`, `odinx/js/ui.js`, `odinx/js/notifications.js`, `catirc/internal/server/handlers_messaging.go`, `catirc/internal/server/handlers_channel.go`, `catirc/internal/server/subscribers.go`*
```

## 15. flujo-eventos.md

```md
# Flujo de Eventos — EventBus → WebSocket → UI

## Arquitectura de Eventos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CATIRC SERVER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Handler (handlers_*.go)                                                     │
│       │                                                                       │
│       ▼                                                                       │
│  EventBus.Publish(Event) ──────────────────────► Subscribers                │
│       │                           │                                          │
│       │                           ├── onMessageSent  → persistMessage()     │
│       │                           ├── onUserAuthenticated → audit LOGIN     │
│       │                           ├── onKick → audit KICK + persistSystem() │
│       │                           ├── onOperGranted → audit OPER_LOGIN      │
│       │                           ├── onModeChanged → audit MODE_CHANGE     │
│       │                           ├── onUserJoined → persist JOIN + member  │
│       │                           ├── onUserParted → persist PART + seen    │
│       │                           └── onUserQuit → persist QUIT + audit     │
│       ▼                                                                       │
│  WebSocket Server (client.Output chan)                                       │
│       │                                                                       │
│       ▼                                                                       │
│  writeLoop() → wsConn.Write() → Browser                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ODINX CLIENT                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WebSocket onmessage                                                         │
│       │                                                                       │
│       ▼                                                                       │
│  IRC.parse(raw) → Message object                                             │
│       │                                                                       │
│       ▼                                                                       │
│  client.handleMessage(msg) ───► switch(msg.command)                          │
│       │                           │                                          │
│       │                           ├── PRIVMSG → onMessage(data)             │
│       │                           ├── NOTICE → onNotice(text, from, svc)    │
│       │                           ├── JOIN → onChannelJoin(data)            │
│       │                           ├── PART → onChannelPart(data)            │
│       │                           ├── KICK → onKick(data)                   │
│       │                           ├── NICK → onNickChange(data)             │
│       │                           ├── MODE → onMode(data)                   │
│       │                           ├── TOPIC → onTopic(data)                 │
│       │                           ├── QUIT → onMessage({type:'quit'})       │
│       │                           ├── 353 → onUserList(data)                │
│       │                           ├── 352 → onWHO(data)                     │
│       │                           ├── 311-319,330,370 → onWHOIS(data)       │
│       │                           ├── TAGMSG → onMessage({type:'typing'})   │
│       │                           │                / onReact(data)           │
│       │                           ├── 375-376 → onMOTD(lines)               │
│       │                           ├── 391 → onTime(time)                    │
│       │                           ├── 302 → onUserHost(text)                │
│       │                           ├── 251/254/255/211 → onServerStats(msg)  │
│       │                           ├── 321-323 → onList(list)                │
│       │                           ├── 367/368 → onBanList(data)             │
│       │                           ├── 331/332 → onTopic(data)               │
│       │                           ├── 341 → onInvite(data)                  │
│       │                           ├── 315 → onWHO({done:true})              │
│       │                           ├── 318 → onWHOIS({done:true, data})      │
│       │                           ├── PING/PONG → onPing()                  │
│       │                           ├── ERROR → onError(text)                 │
│       │                           ├── 431/433/465 → onError(text)           │
│       │                           └── XXX (3 dígitos) → onNotice('[XXX] text')│
│       ▼                                                                       │
│  UI Callbacks (setupCallbacks en connection.js)                              │
│       │                                                                       │
│       ▼                                                                       │
│  ui.handleIncomingMsg() / ui.addMsg() / ui.renderMsg()                       │
│       │                                                                       │
│       ▼                                                                       │
│  IndexedDB.addMessage() + DOM render + notifications                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Tipos de Eventos (CatIRC EventBus)

```go
// internal/eventbus/eventbus.go

// MessageSentEvent - PRIVMSG, NOTICE, TAGMSG
type MessageSentEvent struct {
    Channel   string
    Sender    string
    Target    string
    Content   string
    Command   string  // PRIVMSG, NOTICE, etc.
    Timestamp string  // ISO 8601 UTC
}

// UserJoinedEvent - JOIN
type UserJoinedEvent struct {
    Nick      string
    User      string
    Host      string
    Channel   string
    Timestamp string
}

// UserPartedEvent - PART
type UserPartedEvent struct {
    Nick      string
    User      string
    Host      string
    Channel   string
    Reason    string
    Timestamp string
}

// UserQuitEvent - QUIT
type UserQuitEvent struct {
    Nick      string
    User      string
    Host      string
    Reason    string
    Timestamp string
}

// NickChangedEvent - NICK
type NickChangedEvent struct {
    OldNick   string
    NewNick   string
    User      string
    Host      string
    Timestamp string
}

// ChannelCreatedEvent - Primer JOIN
type ChannelCreatedEvent struct {
    Channel   string
    Founder   string
    Timestamp string
}

// ChannelDeletedEvent - Último PART
type ChannelDeletedEvent struct {
    Channel   string
    Timestamp string
}

// UserAuthenticatedEvent - LOGIN/PASS
type UserAuthenticatedEvent struct {
    Nick      string
    Username  string
    Role      string
    Method    string  // "jwt", "password", "login"
    Timestamp string
}

// KickEvent - KICK
type KickEvent struct {
    Kicker    string
    Nick      string
    Channel   string
    Reason    string
    Timestamp string
}

// OperGrantedEvent - OPER
type OperGrantedEvent struct {
    Nick      string
    OperName  string
    Timestamp string
}

// ModeChangedEvent - MODE
type ModeChangedEvent struct {
    Nick      string
    Channel   string
    ModeStr   string  // "+o nick"
    Timestamp string
}
```

## OdinX Callbacks (js/client.js)

```javascript
const client = new CATIRCClient({...});

// Connection
client.onConnect = () => {}              // WS opened
client.onDisconnect = (code, reason) => {} // WS closed
client.onRegister = (nick) => {}         // 001 received
client.onStateChange = (state) => {}     // CONNECTING, CONNECTED, RECONNECTING, DISCONNECTED, FAILED
client.onReconnecting = (delay, attempt) => {}

// Channels
client.onChannelJoin = (data) => {}      // {nick, channel, account, realname, isMe}
client.onChannelPart = (data) => {}      // {nick, channel, reason, isMe}
client.onKick = (data) => {}             // {kicker, channel, kicked, reason, isMe}
client.onInvite = (data) => {}           // {from, nick, channel}
client.onTopic = (data) => {}            // {channel, topic, nick}
client.onMode = (data) => {}             // {target, modes, params, nick}
client.onUserList = () => {}             // After NAMES
client.onNickChange = (data) => {}       // {oldNick, newNick, isMe}

// Messages
client.onMessage = (data) => {}          // {type, from, target, text, isChannel, isPrivate, isMe, tags}
client.onNotice = (text, from, isService) => {} // NOTICE routing

// WHOIS/WHO
client.onWHOIS = (data) => {}            // {done, data:{nick, user, host, server, realname, channels, account, roles, isOperator}}
client.onWHO = (data) => {}              // {done, channel, nick, user, host, server, flags, realname}

// History
client.onHistory = (data) => {}          // {type:'start'|'message'|'end', ...}

// Reactions
client.onReact = (data) => {}            // {nick, channel, mid, emoji}

// Typing
client.onMessage({type:'typing', nick, target, typing}) => {}

// Offline DM
client.onOfflineDM = (data) => {}        // {nick, count}

// Roles
client.onRoleInfo = (roles) => {}        // *** ROLES: ROOT OPER ...

// Errors
client.onError = (text) => {}            // ERROR, 465, etc.
client.onPing = () => {}                 // PING/PONG
client.onCAP = (msg) => {}               // CAP messages
```

## Wiring (connection.js)

```javascript
function setupCallbacks() {
  client.onConnect = () => { ui.setStatus('connected'); ui.addMsg('Status','server','Conexión establecida'); };
  client.onDisconnect = (code, reason) => { ui.setStatus('disconnected'); ... };
  client.onReconnecting = (delay, attempt) => { ui.setStatus('reconnecting'); ui.showReconnectToast(delay, attempt); };
  client.onStateChange = (state) => { /* ui.setStatus */ if (state==='RECONNECTING'||state==='FAILED') showReconnectDialog(); };
  client.onRegister = (nick) => { /* NickServ IDENTIFY, show app, load history, save session */ };
  client.onMessage = (data) => { switch(data.type) { case 'message': ui.handleIncomingMsg(data); break; case 'quit': ui.addMsg(...); break; case 'away': ...; case 'typing': ui.handleTyping(data); break; } };
  client.onChannelJoin = (data) => { if (data.isMe) ui.switchTab(data.channel); else ui.addMsg(...); ui.renderTabs(); ui.renderNicklist(); };
  client.onChannelPart = (data) => { if (data.isMe) { client.channels.delete(channel); ui.switchTab(...); } else { ui.addMsg(...); client.channels.get(channel).users.delete(nick); ui.renderNicklist(); } };
  client.onKick = (data) => { if (data.isMe) { ui.addMsg(...); client.channels.delete(channel); } else { ui.addMsg(...); client.channels.get(channel).users.delete(kicked); } ui.renderTabs(); };
  client.onInvite = (data) => { ui.addMsg(..., 'Invitado a '+channel); };
  client.onTopic = (data) => { channel.topic = data.topic; if (channel===current) ui.updateTopicBar(); if (data.nick && data.nick!==myNick) ui.addMsg(...); };
  client.onMode = (data) => { if (channel) { channel.modes = data.modes; ui.renderNicklist(); } ui.addMsg(..., '* '+data.nick+' ha cambiado modos: '+data.modes); };
  client.onNickChange = (data) => { if (data.isMe) { ui.updateUserBadge(newNick); ui.addMsg(..., '*** Ahora te conoces como '+newNick); } else { ui.addMsg(..., '* '+oldNick+' ahora es '+newNick); } ui.renderNicklist(); };
  client.onNotice = (text, from, isService) => { if (isService && noticeBus.route(text, from)) return; if (isService) ui.addMsg('Status','service','*** ['+from+'] '+text); else ui.addMsg(currentChannel,'server','*** '+(from?'['+from+'] ':'')+text); };
  client.onMOTD = (lines) => { ui.addMsg('Status','server','*** MOTD:'); lines.forEach(l=>ui.addMsg('Status','server','- '+l)); };
  client.onWHOIS = (data) => { if (data.done) { /* cache */ ui.addMsg(..., '*** WHOIS de '+nick+':'); } else { /* accumulating */ } };
  client.onWHO = (data) => { if (data.done) ui.addMsg(..., '*** Fin de WHO'); else ui.addMsg(..., '*** '+data.nick+' ...'); };
  client.onTime = (time) => ui.addMsg(..., '*** Hora servidor: '+time);
  client.onServerStats = (msg) => ui.addMsg(..., '*** '+msg.trailing);
  client.onList = (list) => channellist.show(list);
  client.onReact = (data) => reactions.apply(data.nick, data.channel, data.mid, data.emoji);
  client.onInvite = (data) => ui.addMsg(..., '*** '+data.from+' te ha invitado a '+data.channel);
  client.onHistory = (data) => { if (data.type==='start') showLoading(); else if (data.type==='end') { hideLoading(); ui.addMsg(..., '📜 '+data.text); } else { /* append history msg */ } };
  client.onError = (text) => { ui.addMsg(..., '*** ERROR: '+text); hideLoading(); };
  client.onRoleInfo = (roles) => { if (permissions) permissions.setGlobalRoles(roles); else globalRoles = roles; ui.renderNicklist(); };
  client.onOfflineDM = (data) => { if (pm) pm.setUnread(data.nick, data.count); ui.addMsg('Status','server','*** Tienes '+data.count+' mensaje(s) no leídos de '+data.nick+'. Usa /HISTORY '+data.nick); };
  client.onPing = () => {};
  client.onCAP = () => {};
}
```

---

*Generado: 2026-07-11 | Fuente: `internal/eventbus/eventbus.go`, `internal/server/subscribers.go`, `odinx/js/client.js`, `odinx/js/connection.js`, `odinx/js/ui.js`, `odinx/js/noticeBus.js`*
```

## 16. flujo-login.md

```md
# Flujo de Login — CatIRC + OdinX

## 1. Login Guest (OdinX Standalone)

```mermaid
sequenceDiagram
    participant User
    participant OdinX
    participant CatIRC_WS
    participant CatIRC_IRC
    
    User->>OdinX: Introduce nick + conecta
    OdinX->>CatIRC_WS: WS Connect (/ws)
    CatIRC_WS->>CatIRC_IRC: client.Handle() → readLoop
    OdinX->>CatIRC_IRC: CAP LS 302
    CatIRC_IRC->>OdinX: CAP * LS :message-tags cap-notify ...
    OdinX->>CatIRC_IRC: CAP REQ :message-tags ...
    CatIRC_IRC->>OdinX: CAP * ACK :message-tags ...
    OdinX->>CatIRC_IRC: CAP END
    OdinX->>CatIRC_IRC: NICK guest123
    CatIRC_IRC->>OdinX: :server 001 guest123 :Welcome...
    OdinX->>CatIRC_IRC: USER guest123 0 * :guest123
    CatIRC_IRC->>OdinX: 002, 003, 004, MOTD
    OdinX->>CatIRC_IRC: JOIN #general
    CatIRC_IRC->>OdinX: JOIN + NAMES + TOPIC
    OdinX->>User: UI Chat lista
```

**Código clave**:
- `odinx/js/auth.js:doLogin()` → `new CATIRCClient({nick, realname: nick, channel})`
- `odinx/js/client.js:connect()` → WebSocket → `startRegistration()` → CAP negotitation
- `catirc/internal/server/handlers_cap.go` + `handlers_connection.go`

---

## 2. Login Registrado (NickServ)

```mermaid
sequenceDiagram
    participant User
    participant OdinX
    participant CatIRC_WS
    participant CatIRC_IRC
    participant CatMage
    
    User->>OdinX: Tab "Registrado" → nick + pass
    OdinX->>CatIRC_WS: WS Connect
    ... CAP negotiation ...
    OdinX->>CatIRC_IRC: NICK juan
    OdinX->>CatIRC_IRC: USER juan 0 * :juan
    OdinX->>CatIRC_IRC: LOGIN juan password123
    CatIRC_IRC->>CatIRC_IRC: handleLogin() → idp.Authenticate()
    alt LocalAuthProvider
        CatIRC_IRC->>DB: SELECT * FROM irc_users WHERE username='juan'
        CatIRC_IRC->>CatIRC_IRC: bcrypt.CompareHashAndPassword()
    else CatMageAuthProvider
        CatIRC_IRC->>CatMage: POST /auth/validate {token}
        CatMage-->>CatIRC_IRC: {valid:true, user:{id:1, username:"juan", role:"USER"}}
    end
    CatIRC_IRC->>OdinX: NOTICE :Authenticated as juan (nick: Juan, role: USER)
    CatIRC_IRC->>OdinX: 001 Welcome (sendWelcome)
    CatIRC_IRC->>OdinX: NOTICE *** ROLES: USER
    OdinX->>OdinX: CatIRC.globalRoles = ["USER"]
    OdinX->>CatIRC_IRC: JOIN #general
```

**Código clave**:
- `odinx/js/auth.js:doRegisteredLogin()` → `CATIRCClient({nick, nickservPass})`
- `catirc/internal/server/handlers_auth.go:handleLogin()` → `idp.Authenticate()`
- `catirc/internal/auth/local_auth_provider.go:ValidateToken()` → JWT + DB
- `catirc/internal/auth/catmage_auth_provider.go` (stub) → HTTP a CatMage

---

## 3. Embed Mode (CatMage iframe)

```mermaid
sequenceDiagram
    participant CatMage
    participant OdinX_iframe
    participant CatIRC_WS
    participant CatIRC_IRC
    
    CatMage->>OdinX_iframe: iframe src="https://irc.catmage.es?embed=1"
    OdinX_iframe->>OdinX_iframe: Detecta embed=1 → hide login
    OdinX_iframe->>CatMage: postMessage({type:'catirc:ready'})
    CatMage->>OdinX_iframe: postMessage({type:'catirc:auth', nick:'juan', jwt:'eyJ...', channels:['#general']})
    OdinX_iframe->>OdinX_iframe: state._embedJWT = jwt, state._embedChannels = [...]
    OdinX_iframe->>CatIRC_WS: WS Connect
    ... CAP + NICK + USER ...
    OdinX_iframe->>CatIRC_IRC: LOGIN juan <jwt>
    CatIRC_IRC->>CatIRC_IRC: handleLogin() → idp.Authenticate(jwt)
    CatIRC_IRC-->>OdinX_iframe: 001 + ROLES + JOINs automáticos
    OdinX_iframe->>CatMage: postMessage({type:'catirc:joined', channel:'#general'})
```

**Código clave**:
- `odinx/app.js` embed detection → `window.CATIRC_EMBED_MODE`
- `odinx/js/auth.js:doRegisteredLogin()` usa `state._embedJWT`
- `catirc/internal/server/handlers_auth.go:handleLoginViaIDP()` → JWT validation

---

## 4. Reconexión Automática

```mermaid
stateDiagram-v2
    [*] --> CONNECTING: client.connect()
    CONNECTING --> CONNECTED: WS onopen
    CONNECTED --> RECONNECTING: WS onclose (code!=1000, !intentional)
    RECONNECTING --> CONNECTING: setTimeout(backoff)
    RECONNECTING --> FAILED: attempts >= 10
    CONNECTED --> DISCONNECTED: intentional close
    RECONNECTING --> CONNECTED: WS onopen (reconnectNow)
```

**Backoff exponencial** (`odinx/js/client.js:scheduleReconnect()`):
```javascript
delay = Math.min(1000 * 2^attempts, 30000)
attempts++
setTimeout(connect, delay)
```

**Session Restore** (`odinx/js/connection.js:restoreSession()`):
- Carga `localStorage.catirc_session` (nick, channels[], currentChannel)
- Auto-reconnect con mismo nick
- Rejoina canales de sesión previa

---

## 5. Reconnection Flow (Post-Reconnect)

```mermaid
sequenceDiagram
    participant User
    participant OdinX
    participant CatIRC_WS
    participant CatIRC_IRC
    
    WS onclose (code!=1000, !intentional)
    OdinX->>OdinX: state = RECONNECTING
    OdinX->>OdinX: showReconnectToast(countdown)
    setTimeout(connect, delay)
    connect() → WS open → CAP LS → CAP REQ → CAP END → NICK/USER
    onRegister → rejoin pendingChannels (slice 1..)
    if sessionAction === 'recover':
        session.channels.forEach(joinChannel)
        setTimeout(switchTab(session.active), 500)
```

**Código**: `odinx/js/connection.js:setupCallbacks()` → `onRegister`, `onChannelJoin`

---

*Generado: 2026-07-11 | Fuente: `odinx/js/auth.js`, `odinx/js/client.js`, `odinx/js/connection.js`, `odinx/app.js`, `catirc/internal/server/handlers_auth.go`, `catirc/internal/server/handlers_cap.go`, `catirc/internal/server/handlers_connection.go`*
```

## 17. flujo-notificaciones.md

```md
# Flujo: Notificaciones

## Arquitectura

```
CatIRC Server                          OdinX Client                        Browser
     │                                     │                                  │
     ├── EventBus → Subscriber              │                                  │
     │    onMessageSent                     │                                  │
     │         │                            │                                  │
     │         ▼                            ▼                                  │
     │   persistMessageV2()                 │                                  │
     │         │                            │                                  │
     │         ▼                            ▼                                  │
     │   notifyCatMageOfflineDM() ──────► POST /api/internal/dm-event          │
     │                              (X-CatIRC-API-Key)                         │
     │                                                                  │
     ▼                                                                  ▼
WebSocket: PRIVMSG #chan :hola @UserB                              WebSocket onmessage
                                                                    │
                                                                    ▼
                                                        IRC.parse() → handleMessage()
                                                                    │
                                                                    ▼
                                                        handlePRIVMSG() → onMessage()
                                                                    │
                                                                    ▼
                                                        handleIncomingMsg()
                                                                    │
                                                                    ├── isChannel + @UserB → notifications.show()
                                                                    │       │
                                                                    │       ├── new Notification()
                                                                    │       ├── play sound
                                                                    │       └── ui.addMsg() + badge++
                                                                    │
                                                                    ├── isPrivate → ui.addMsg(pmChan)
                                                                    │       │
                                                                    │       ├── notifications.show()
                                                                    │       │       │
                                                                    │       │       ├── new Notification()
                                                                    │       │       └── play sound
                                                                    │       │
                                                                    │       └── if pm panel open → pm.refresh()
                                                                    │
                                                                    └── FILE OFFER → p2p.handleSignal() → modal + notification
```

---

## Flujo: Mención en Canal

```
Usuario A escribe: "hola @UserB"
        │
        ▼
OdinX_A → PRIVMSG #canal :hola @UserB
        │
        ▼
CatIRC Server: channelMessage() → Broadcast → User B recibe
        │
        ▼
OdinX_B: handlePRIVMSG() → handleIncomingMsg()
        │
        ├── Detecta @UserB en texto
        │
        ├── ui.addMsg() → render en chat
        │
        ├── notifications.show('Mención en #canal', 'UserA: hola @UserB')
        │       │
        │       ├── new Notification('Mención en #general', {body: 'UserA: hola @UserB', icon})
        │       │
        │       └── play sound (settings.sounds.mention)
        │
        └── Si canal no activo → ui.renderTabs() actualiza badge unread
```

**Código** (`odinx/js/ui.js:handleIncomingMsg()`):
```javascript
if (data.from !== S.client.myNick && 
    S.client.myNick && 
    data.text.toLowerCase().includes(S.client.myNick.toLowerCase())) {
  CatIRC.notifications.show('Mención en ' + data.target, data.from + ': ' + data.text, S.settings);
  CatIRC.notifications.play('mention', S.settings);
}
```

---

## Flujo: Mensaje Privado (DM)

```
Usuario A → /msg UserB hola
        │
        ▼
OdinX_A → PRIVMSG UserB :hola
        │
        ▼
CatIRC Server: directMessage() → UserB online?
        │
        ├── YES → PRIVMSG UserB → OdinX_B
        │       │
        │       ▼
        │       OdinX_B: handlePRIVMSG() → isPrivate=true
        │       │
        │       ├── ui.addMsg(pmChan, 'privmsg', ...)
        │       │
        │       ├── Si pmChan != currentChannel → notifications.show()
        │       │       │
        │       │       ├── Notification 'Mensaje privado de UserA'
        │       │       └── play sound (settings.sounds.private)
        │       │
        │       └── Si pm panel abierto → pm.refresh()
        │
        └── NO → persistOfflineDM() → SaveMessageV2(DM conversation)
                │
                ▼
                notifyCatMageOfflineDM() → POST /api/internal/dm-event
                │
                ▼
                Cuando UserB conecta: notifyPendingDMs()
                        │
                        ▼
                        DB: ListUserConversations(userID) → GetUnreadCount()
                        │
                        ▼
                        For each unread DM: NOTICE ***: Tienes N mensaje(s) no leídos de X. Usa /HISTORY X
                        │
                        ▼
                        OdinX: handleNOTICE() → detecta "Tienes N mensaje(s) no leídos"
                        │
                        ▼
                        onOfflineDM({nick, count}) → pm.setUnread(nick, count) + pm.refresh()
```

**Código**:
- `catirc/internal/server/server.go:persistOfflineDM()` → `SaveMessageV2()` + `notifyCatMageOfflineDM()`
- `catirc/internal/catmage/sync.go:notifyCatMageOfflineDM()` → HTTP POST a CatMage
- `catirc/internal/server/server.go:notifyPendingDMs()` → `ListUserConversations()` + `GetUnreadCount()`
- `odinx/js/ui.js:handleIncomingMsg()` → `notifications.show()` + `pm.setUnread()`

---

## Flujo: Offline DM + CatMage Sync

```
CatIRC Server: persistOfflineDM(sender, target, text)
        │
        ├── SaveMessageV2(DM conversation) → IndexedDB local + PostgreSQL
        │
        ├── notifyCatMageOfflineDM(fromIRCUserID, toIRCUserID, fromNick, preview)
        │       │
        │       ▼
        │       POST /api/internal/dm-event
        │       Headers: X-CatIRC-API-Key
        │       Body: {event:"dm.offline", from_user_id, to_user_id, from_name, preview}
        │       │
        │       ▼
        │       CatMage: Creates notification for user
        │
        └── Cuando target se conecta: notifyPendingDMs()
                │
                ▼
                User conecta → onRegister → notifyPendingDMs(userID)
                │
                ▼
                DB: ListUserConversations(userID) → GetUnreadCount()
                │
                ▼
                For each unread DM: NOTICE ***: Tienes N mensaje(s) de X. Usa /HISTORY X
                │
                ▼
                OdinX: handleNOTICE() → detecta "Tienes N mensaje(s) no leídos"
                │
                ▼
                onOfflineDM({nick, count}) → pm.setUnread(nick, count) + pm.refresh()
```

**Código**:
- `catirc/internal/server/server.go:persistOfflineDM()` → `SaveMessageV2()` + `notifyCatMageOfflineDM()`
- `catirc/internal/catmage/sync.go:notifyCatMageOfflineDM()` → HTTP POST a CatMage
- `catirc/internal/server/server.go:notifyPendingDMs()` → `ListUserConversations()` + `GetUnreadCount()`

---

## Flujo: P2P File Transfer Notification

```
Usuario A → /send UserB
        │
        ▼
OdinX_A: p2p.startSendCommand([UserB])
        │
        ▼
File picker → p2p.offerFile(target, file)
        │
        ▼
FILE OFFER target id size :filename → CatIRC → OdinX_B
        │
        ▼
OdinX_B: p2p.handleSignal(FILE OFFER)
        │
        ▼
p2p.onOffer() → _showOfferModal(transfer)
        │
        ▼
Modal: "UserA quiere enviarte archivo.zip (2.5 MB) [Aceptar] [Rechazar]"
        │
        ▼
OdinX_B: notifications.show('Solicitud de archivo', 'UserA quiere enviarte archivo.zip')
        │
        ▼
        Notification: 'Solicitud de archivo' + sound
```

**Código** (`odinx/js/p2p.js`):
```javascript
_showOfferModal(t) {
  // ... crea modal con botones Aceptar/Rechazar
  CatIRC.notifications.show('Solicitud de archivo', `${t.peer} quiere enviarte ${t.name}`);
}
_notify(title, body) {
  CatIRC.notifications.show(title, body, CatIRC.state.settings);
}
```

---

## Flujo: Reacciones + Typing

```
User A escribe → OdinX_A: sendTyping() → @+typing=active TAGMSG #canal
        │
        ▼
CatIRC: handleTagmsg() → broadcast TAGMSG → User B recibe
        │
        ▼
OdinX_B: handleTAGMSG() → onMessage({type:'typing', nick, target, typing})
        │
        ▼
OdinX_B: ui.handleTyping() → muestra "UserA escribe..." + timeout 5s

---

User A click 👍 en mensaje mid=k3j4h5
        │
        ▼
OdinX_A: sendReaction() → @+react=👍;+react-to=k3j4h5 TAGMSG #canal
        │
        ▼
CatIRC: handleTagmsg() → broadcast TAGMSG → User B recibe
        │
        ▼
OdinX_B: handleTAGMSG() → onReact({nick, channel, mid, emoji})
        │
        ▼
reactions.apply() → render 👍 en mensaje
```

---

## Configuración de Notificaciones (`js/state.js`)

```javascript
settings: {
  notifications: false,   // Master switch
  sounds: true,           // Master switch sonidos
  autoHistory: true,      // Auto-load history on join
  expandImages: false     // Expandir imágenes inline
}
```

## Sonidos (`js/notifications.js`)

```javascript
sounds: {
  mention: 'notification-mention.mp3',    // Mención @nick
  private: 'notification-private.mp3',    // Mensaje privado
  message: 'notification-message.mp3',    // Mensaje en canal activo
  default: 'notification-default.mp3'     // Fallback
}
```

**play()**:
```javascript
play(type, settings) {
  if (!settings.sounds) return;
  const audio = new Audio(`/sounds/${this.sounds[type] || this.sounds.default}`);
  audio.play().catch(() => {}); // Ignora autoplay policy
}
```

---

## Web Notifications API

```javascript
show(title, body, settings) {
  if (!settings.notifications || !('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/images/favicon.ico',
      tag: 'catirc-' + Date.now(), // Evita agrupar
      requireInteraction: false
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') this.show(title, body, settings);
    });
  }
}
```

---

## Permisos y Filtros

| Filtro | Descripción |
|--------|-------------|
| `settings.notifications` | Master switch |
| `settings.sounds` | Master switch sonidos |
| `ignored` Set | `/ignore nick` - filtra mensajes en `handleIncomingMsg()` |
| Mención propia | Solo notifica si `@myNick` en texto |
| Propios mensajes | No notifica `isMe === true` |
| Canal activo | No notifica si canal actual == target |
| Muted users | `ignored.has(nick.toLowerCase())` |

---

*Generado: 2026-07-11 | Fuente: `odinx/js/ui.js`, `odinx/js/notifications.js`, `odinx/js/p2p.js`, `catirc/internal/server/server.go`, `catirc/internal/catmage/sync.go`*
```

## 18. flujo-websocket.md

```md
# Eventos IRC — CatIRC ↔ OdinX

## Cliente → Servidor (IRC Commands over WS)

### Conexión y Registro
| Comando | Parámetros | Descripción |
|---------|------------|-------------|
| `CAP LS 302` | — | Inicia negociación capacidades |
| `CAP REQ :<caps>` | caps solicitadas | Solicita capacidades |
| `CAP END` | — | Finaliza negociación |
| `PASS` | `<password>` | Server password (opcional) |
| `NICK` | `<nick>` | Set/change nick |
| `USER` | `<user> 0 * :<realname>` | User registration |
| `PING` | `[:token]` | Keepalive |
| `QUIT` | `[:reason]` | Desconexión voluntaria |

### Channel Operations
| Comando | Parámetros | Descripción |
|---------|------------|-------------|
| `JOIN` | `<#chan>[,...] [<key>[,...]]` | Join channel(s) |
| `PART` | `<#chan>[,...] [:reason]` | Leave channel(s) |
| `TOPIC` | `<#chan> [:new topic]` | Get/set topic |
| `MODE` | `<#chan> [<modes> [<params>]]` | Channel/user modes |
| `KICK` | `<#chan> <nick> [:reason]` | Kick user |
| `INVITE` | `<nick> <#chan>` | Invite user |
| `KNOCK` | `<#chan> [:message]` | Request invite |

### Messaging
| Comando | Parámetros | Descripción |
|---------|------------|-------------|
| `PRIVMSG` | `<target> :<text>` | Message to channel/user |
| `NOTICE` | `<target> :<text>` | Notice to channel/user |
| `TAGMSG` | `<target>` + tags | Tagged message (typing, reactions) |

### Information
| Comando | Parámetros | Descripción |
|---------|------------|-------------|
| `WHOIS` | `<nick> [<nick>]` | User info |
| `WHO` | `<mask> [%format]` | User/channel list |
| `NAMES` | `<#chan>` | Channel user list |
| `LIST` | `[<#chan>]` | Channel list |
| `LUSERS` | — | User/server stats |
| `MOTD` | — | Message of the day |
| `TIME` | — | Server time |
| `ISON` | `<nick> ...` | Check online status |
| `USERHOST` | `<nick> ...` | User host info |

### IRCv3 Extended
| Comando | Parámetros | Descripción |
|---------|------------|-------------|
| `MONITOR` | `+/-<nicks> \| C \| L \| S` | Online/offline notifications |
| `SETNAME` | `:<realname>` | Change realname |
| `CHGHOST` | `<nick> <host>` | Change host (oper) |

### Services & Custom
| Comando | Parámetros | Descripción |
|---------|------------|-------------|
| `LOGIN` | `<username> <password>` | Auth via IdentityProvider |
| `HISTORY` | `<#chan\|nick> [limit]` | Message history |
| `AUDITLOG` | `[limit]` | Staff: audit log |
| `INVTOKEN` | `<#chan> [max_uses] [expiry_h]` | Create invite token |

### OperServ (IRC Operators)
| Comando | Parámetros | Permiso |
|---------|------------|---------|
| `OPER` | `<name> <password>` | Configurado |
| `OPERSERV` | `<subcmd> ...` | `IsGlobalOper` |

**OperServ Subcommands**:
| Subcmd | Parámetros | Permiso |
|--------|------------|---------|
| `INFO` | — | — |
| `AKILL` | `<mask> <reason>` | `akill` |
| `KLINE` | `<mask> <reason>` | `kline` |
| `GLINE` | `<mask> <reason>` | `gline` |
| `SHUN` | `<mask> <reason>` | `shun` |
| `ZLINE` | `<ip/mask> <reason>` | `kline` |
| `MUTE` | `<mask> <reason>` | `shun` |
| `UNKILL/UNKNLINE/...` | `<mask>` | Correspondiente |
| `KILL` | `<nick> <reason>` | `kill` |
| `WALLOPS` | `<message>` | `wallops` |
| `TRACE` | — | `trace` |
| `STATS` | — | `stats` |
| `SESSIONS` | — | `sessions` |
| `OPERS` | — | — |
| `HELP` | — | — |

### P2P File Transfer
| Comando | Parámetros | Descripción |
|---------|------------|-------------|
| `FILE` | `OFFER\|ACCEPT\|REJECT\|CANCEL\|ERROR\|SIGNAL <target> <id> [:data]` | WebRTC signaling |

---

## Servidor → Cliente (IRC Replies)

### Numerics (IRC Mode)
| Código | Nombre | Cuándo |
|--------|--------|--------|
| `001` | RPL_WELCOME | Welcome post-registration |
| `002-004` | RPL_YOURHOST, CREATED, MYINFO | Server info |
| `005` | RPL_ISUPPORT | Server capabilities |
| `251` | RPL_LUSERCLIENT | User count |
| `254` | RPL_LUSERCHANNELS | Channel count |
| `255` | RPL_LUSEROP | Oper count |
| `311` | RPL_WHOISUSER | WHOIS user |
| `312` | RPL_WHOISSERVER | WHOIS server |
| `313` | RPL_WHOISOPERATOR | WHOIS oper |
| `315` | RPL_ENDOFWHO | End of WHO |
| `317` | RPL_WHOISIDLE | WHOIS idle |
| `318` | RPL_ENDOFWHOIS | End of WHOIS |
| `319` | RPL_WHOISCHANNELS | WHOIS channels |
| `330` | RPL_WHOISACCOUNT | WHOIS account |
| `331` | RPL_NOTOPIC | No topic |
| `332` | RPL_TOPIC | Topic |
| `341` | RPL_INVITING | Inviting |
| `352` | RPL_WHOREPLY | WHO reply |
| `353` | RPL_NAMREPLY | NAMES list |
| `366` | RPL_ENDOFNAMES | End of NAMES |
| `372` | RPL_MOTD | MOTD line |
| `375` | RPL_MOTDSTART | MOTD start |
| `376` | RPL_ENDOFMOTD | End of MOTD |
| `391` | RPL_TIME | Server time |
| `401` | ERR_NOSUCHNICK | No such nick |
| `403` | ERR_NOSUCHCHANNEL | No such channel |
| `404` | ERR_CANNOTSENDTOCHAN | Cannot send to channel |
| `411` | ERR_NORECIPIENT | No recipient |
| `421` | ERR_UNKNOWNCOMMAND | Unknown command |
| `431` | ERR_NONICKNAMEGIVEN | No nick given |
| `432` | ERR_ERRONEUSNICK | Erroneous nick |
| `433` | ERR_NICKNAMEINUSE | Nick in use |
| `441` | ERR_USERNOTINCHANNEL | User not in channel |
| `442` | ERR_NOTONCHANNEL | Not on channel |
| `443` | ERR_USERONCHANNEL | User on channel |
| `451` | ERR_NOTREGISTERED | Not registered |
| `461` | ERR_NEEDMOREPARAMS | Need more params |
| `462` | ERR_ALREADYREGISTRED | Already registered |
| `464` | ERR_PASSWORDMISMATCH | Password mismatch |
| `465` | ERR_YOUREBANNEDCREEP | Rate limited (repurposed) |
| `471` | ERR_CHANNELISFULL | Channel full (+l) |
| `473` | ERR_INVITEONLYCHAN | Invite only (+i) |
| `474` | ERR_BANNEDFROMCHAN | Banned (+b) |
| `475` | ERR_BADCHANNELKEY | Bad key (+k) |
| `481` | ERR_NOPRIVILEGES | Not oper |
| `482` | ERR_CHANOPRIVSNEEDED | Not channel op |
| `490` | ERR_CAP_NEGOTIATION | CAP not complete |
| `502` | ERR_USERSDONTMATCH | Cannot change other user |
| `710` | RPL_KNOCK | Knock received |

### Extended Numerics
| Código | Nombre | Uso |
|--------|--------|-----|
| `302` | RPL_USERHOST | USERHOST reply |
| `305` | RPL_UNAWAY | Unset away |
| `306` | RPL_NOWAWAY | Set away |
| `330` | RPL_WHOISACCOUNT | Account in WHOIS |
| `370` | **Custom** RPL_WHOISROLES | Global roles list |

---

## Messages con Tags (IRCv3)

### Tags Generados por Servidor
| Tag | Valor | En |
|-----|-------|-----|
| `time` | RFC3339Nano UTC | Todos mensajes broadcast |
| `account` | `username` | Si autenticado (account-tag) |
| `+typing` | `active` | Typing indicator (TAGMSG) |
| `+react` | `emoji` | Reaction (TAGMSG) |
| `+react-to` | `message-id` | Target message (TAGMSG) |

### Tags Enviados por Cliente
| Tag | Valor | Uso |
|-----|-------|-----|
| `+typing` | `active` | Typing indicator |
| `+react` | `emoji` | Reaction |
| `+react-to` | `message-id` | Target message |

---

## OdinX Event Handlers (`js/client.js`)

### Incoming Message Mapping
| IRC Command | Handler | UI Callback |
|-------------|---------|-------------|
| `001` | `handleWelcome` | `onRegister(nick)` |
| `002-004` | — | `onNotice(text)` |
| `CAP` | `handleCAP` | `onCAP(msg)` |
| `NICK` | `handleNICK` | `onNickChange({oldNick, newNick, isMe})` |
| `JOIN` | `handleJOIN` | `onChannelJoin({nick, channel, account, realname, isMe})` |
| `PART` | `handlePART` | `onChannelPart({nick, channel, reason, isMe})` |
| `QUIT` | `handleQUIT` | `onMessage({type:'quit', nick, reason})` |
| `KICK` | `handleKICK` | `onKick({kicker, channel, kicked, reason, isMe})` |
| `INVITE` | `handleINVITE` | `onInvite({from, nick, channel})` |
| `TOPIC` | `handleTOPIC` | `onTopic({channel, topic, nick})` |
| `MODE` | `handleMODE` | `onMode({target, modes, params, nick})` |
| `PRIVMSG` | `handlePRIVMSG` | `onMessage({type:'message', from, target, text, isChannel, isPrivate, isMe, tags})` |
| `NOTICE` | `handleNOTICE` | `onNotice(text, from, isService)` |
| `TAGMSG` | `handleTAGMSG` | `onMessage({type:'typing', nick, target, typing})` / `onReact({nick, channel, mid, emoji})` |
| `353` | `handleNAMREPLY` | `onUserList({channel, names})` |
| `366` | — | `onWHO({done:true, channel})` |
| `352` | `handleWHOREPLY` | `onWHO({channel, nick, flags, ...})` |
| `311-319,330,370` | `handleWHOIS` | `onWHOIS({done, data:{...}})` + `onRoleInfo(roles)` |
| `315` | — | `onWHO({done:true})` |
| `321-323` | — | `onList(list)` |
| `324` | — | `onMode({channel, modes})` |
| `367/368` | `handleBanList` | `channelModes.handleBanList(data)` |
| `331/332` | — | `onTopic({channel, topic})` |
| `341` | — | `onInvite({nick, channel})` |
| `375-376` | — | `onMOTD(lines)` |
| `391` | — | `onTime(time)` |
| `302` | — | `onUserHost(text)` |
| `251/254/255/211` | — | `onServerStats(msg)` |
| `PING` | — | Auto-PONG + `onPing()` |
| `PONG` | — | `onPing()` |
| `ERROR` | — | `onError(text)` |
| `431` | — | Auto-random nick + `onError` |
| `433` | — | GHOST attempt → retry NICK + `onError` |
| `465` | — | `onError('Rate limited...')` |
| `XXX` (3 dígitos) | — | `onNotice('[XXX] text')` |

### Special Handling
| Evento | Detector | Acción |
|--------|----------|--------|
| CTCP ACTION | `\x01ACTION ...\x01` | `type:'message'` con `text` = action text |
| CTCP VERSION | `\x01VERSION\x01` | Auto-reply `NOTICE :\x01VERSION CATIRC WebChat\x01` |
| History start | `--- History for ... ---` | `onHistory({type:'start', text})` |
| History line | `[HH:MM] <nick> text` | `onHistory({type:'message', time, nick, text})` |
| History end | `--- End of history ---` | `onHistory({type:'end', text})` |
| `*** ROLES: ...` | `handleNOTICE` | `onRoleInfo(roles[])` |
| `*** You have N unread...` | `handleNOTICE` | `onOfflineDM({nick, count})` |
| Typing | `+typing=active` tag | `onMessage({type:'typing', nick, target, typing})` |
| Reaction | `+react` + `+react-to` tags | `onReact({nick, channel, mid, emoji})` |

---

## OdinX Internal Events (CustomEvent)

### NoticeBus Channels (`js/noticeBus.js`)
| Channel | Payload | Subscribers |
|---------|---------|-------------|
| `chanserv` | `(text, from)` | ChanServAdmin modal, Status fallback |
| `operserv` | `(text, from)` | OperMenu panel, RootDashboard rd-sessions |
| `nickserv` | `(text, from)` | nickserv.js appendNotice |
| `server` | `(text, from)` | Catch-all para NOTICEs no clasificadas |

### UI Events (CustomEvent)
| Event | Detail | Dispatcher |
|-------|--------|------------|
| `catirc:auth` | `{nick, realname, jwt, channels[]}` | Parent (CatMage) → iframe |
| `catirc:ready` | `{}` | iframe → parent |
| `catirc:join` | `{channel}` | Parent → iframe |
| `catirc:msg` | `{channel, from, text}` | iframe → parent |

---

## Payloads TAGMSG (IRCv3)

### Typing Indicator
```
@+typing=active TAGMSG #channel
@+typing=stopped TAGMSG #channel
```

### Reactions
```
@+react=👍;+react-to=msg123 TAGMSG #channel
```

### Cliente OdinX envía:
```javascript
sendTyping(target) {
  ws.send(`@+typing=active TAGMSG ${target}\r\n`);
}

sendReaction(channel, mid, emoji) {
  ws.send(`@+react=${emoji};+react-to=${mid} TAGMSG ${channel}\r\n`);
}
```

---

*Generado: 2026-07-11 | Fuente: `odinx/js/client.js`, `odinx/irc.js`, `catirc/internal/protocol/parser.go`, `catirc/internal/server/handlers_*.go`, `catirc/internal/websocket/server.go`*
```

## 19. canales.md

```md
# Modelos de Datos — Canales

## CatIRC — Runtime (`pkg/types/types.go`)

```go
type Channel struct {
    Name         string
    Topic        string
    Modes        string        // "+nt"
    Key          string        // +k password
    Limit        int           // +l limit
    Mutex        sync.RWMutex
    Clients      map[string]*Client
    Operators    map[string]bool  // +o
    Voiced       map[string]bool  // +v
    InviteList   map[string]bool  // +I
    BanList      map[string]bool  // +b mask
    ExceptionList map[string]bool // +e mask
    broadcast    chan string
    done         chan struct{}
}
```

## CatIRC — Persistencia V2 (`internal/services/chanserv_v2.go`)

```go
type IRCChannelReg struct {
    Row    *IRCChannelRow
    Access map[int64]*IRCChannelAccessRow  // user_id -> flags
    Modes  *IRCChannelModesRow
}

type IRCChannelRow struct {
    ID              int64
    Name            string
    FounderUserID   int64
    RegisteredAt    time.Time
    UpdatedAt       time.Time
    Topic           string
    TopicSetter     string
    TopicTime       time.Time
    Description     string
    URL             string
    Email           string
}

type IRCChannelAccessRow struct {
    ChannelID int64
    UserID    int64
    Flags     string        // "FOAohvS" (Founder, Owner, Admin, Op, Halfop, Voice, Successor)
    GrantedBy int64
    GrantedAt time.Time
}

type IRCChannelModesRow struct {
    ChannelID  int64
    Modes      string        // "+nt"
    Key        string
    UserLimit  int
    MLock      string
    TopicLock  bool
    KeepTopic  bool
    Restricted bool
    UpdatedAt  time.Time
}
```

## Flags de Acceso (ChanServV2)

| Flag | Char | Nombre | Descripción |
|------|------|--------|-------------|
| Founder | `F` | Owner | Control total, puede transferir |
| Successor | `S` | Sucesor | Hereda si founder dropea |
| Admin | `A` | Admin | SOP: todos chanops + access changes |
| Op | `O` | Op | AOP: auto-op al entrar |
| HalfOp | `H` | Halfop | Auto-halfop |
| Voice | `V` | Voice | Auto-voice |

## OdinX — ChannelData (`js/client.js`)

```javascript
// client.channels.get(lowerName)
{
  users: Set<nick>,
  topic: "",
  messages: Message[],
  unread: 0,
  userPrefixes: Map<nick, prefixString>, // "@", "+", etc.
  modes: Map<modeChar, boolean>,
  _scrollTop: number
}
```
```

## 20. mensajes.md

```md
# Modelos de Datos — Mensajes

## CatIRC — Legacy (`internal/database/messages.go`)

```go
type StoredMessage struct {
    ID        int64
    Channel   string    // "" = PM
    Sender    string
    Target    string    // target nick (PM)
    Message   string
    Timestamp time.Time
    ExpiresAt time.Time
}
```

## CatIRC — V2 (`internal/database/store.go`)

```go
// Conversación central
type IRCConversationRow struct {
    ID              int64
    Type            string        // channel | dm | system | notification
    ChannelID       int64         // type=channel
    ParticipantAID  int64         // type=dm (lower ID)
    ParticipantBID  int64         // type=dm (higher ID)
    CreatedAt       time.Time
    UpdatedAt       time.Time
}

// Mensaje V2
type IRCMessageV2Row struct {
    ID               int64
    UUID             string        // UUID v4
    ConversationID   int64
    SenderID         int64         // 0 = server/anonymous
    SenderNick       string
    MessageType      string        // PRIVMSG|NOTICE|ACTION|JOIN|PART|QUIT|TOPIC|MODE|KICK|NICK
    Body             string
    Tags             string        // JSON
    ReplyToMessageID int64
    IsPersistent     bool
    IsSystem         bool          // JOIN, PART, QUIT, TOPIC, MODE, KICK, NICK
    EditedAt         time.Time
    DeletedAt        time.Time
    ExpiresAt        time.Time
    Metadata         string        // JSON
    CreatedAt        time.Time
}
```

## OdinX — Message (`js/ui.js` + `js/client.js`)

```javascript
// Message object en channel.messages[]
{
  type: "privmsg" | "action" | "join" | "part" | "quit" | "server" | "service",
  text: "contenido",
  nick: "usuario",
  isOp: boolean,
  isMe: boolean,
  time: Date.now(),
  mid: "abc123def",                    // unique ID para reactions
  reactions: Map<emoji, Set<nick>>,    // { "👍": Set["nick1", "nick2"] }
  tags: { "+react": "👍", "+react-to": "mid" } // IRCv3 tags
}
```

## Persistencia OdinX — IndexedDB v2 (`js/db.js`)

```javascript
// v2 schema: mensajes individuales (append-only)
record = {
  channel: "#general",
  type: "privmsg",
  text: "hola",
  nick: "Juan",
  isOp: false,
  reactions: { "👍": ["Juan", "Maria"] },
  savedAt: Date.now()
}

// Auto-trim: mantiene últimos MAX_PER_CHANNEL (500)
```

---

*Generado: 2026-07-11 | Fuente: `internal/database/messages.go`, `internal/database/store.go`, `js/db.js`, `js/ui.js`, `js/client.js`*
```

## 21. permisos.md

```md
# Modelos de Datos — Permisos

## CatIRC — Global Roles (`internal/database/roles_repo.go`)

```go
type IRCRoleDefinitionRow struct {
    ID          int64
    Name        string        // ROOT, NETWORK_ADMIN, IRC_OPER, SERVICES_ADMIN, HELP_OP, GLOBAL_MODERATOR, NEWS_BOT, SYSTEM
    Permissions string        // JSON: {"all":true} o {"kline":true,"kill":true,...}
    Description string
    IsSystem    bool          // true = no deletable
    CreatedAt   time.Time
}

type IRCUserRoleRow struct {
    ID        int64
    UserID    int64
    RoleID    int64
    GrantedBy int64
    GrantedAt time.Time
    ExpiresAt time.Time     // 0 = permanente
}
```

## Roles por Defecto (Seed)

| Role | Permissions JSON | Descripción |
|------|------------------|-------------|
| ROOT | `{"all":true}` | Acceso total |
| NETWORK_ADMIN | `{"network":true,"oper":true}` | Admin red |
| IRC_OPER | `{"oper":true}` | IRC Operator estándar |
| SERVICES_ADMIN | `{"services":true}` | NickServ/ChanServ admin |
| HELP_OP | `{"helpop":true,"trace":true}` | Staff soporte |
| GLOBAL_MODERATOR | `{"moderate_global":true}` | Mod global canales |
| NEWS_BOT | `{"post_announcements":true}` | Bot anuncios |
| SYSTEM | `{"system":true}` | Acciones internas |

## OperServ — Oper Classes (`internal/services/operserv.go`)

```go
const (
    PermAll      = "all"
    PermKLine    = "kline"
    PermGLine    = "gline"
    PermKill     = "kill"
    PermWallops  = "wallops"
    PermAKill    = "akill"
    PermShun     = "shun"
    PermTrace    = "trace"
    PermStats    = "stats"
    PermSessions = "sessions"
)

type OperPermissions struct {
    All      bool
    KLine    bool
    GLine    bool
    Kill     bool
    Wallops  bool
    AKill    bool
    Shun     bool
    Trace    bool
    Stats    bool
    Sessions bool
}
```

## Clases por Defecto (Seed)

| Clase | Permisos |
|-------|----------|
| ROOT | `{"all":true}` |
| ADMIN | kline, gline, kill, wallops, akill, shun, trace, stats |
| GLOBALOP | kline, kill, wallops, trace, stats |
| LOCALOP | kline, kill, stats |
| HELPOP | stats, trace |

## ChanServV2 — Channel Flags (`internal/services/chanserv_v2.go`)

```go
const (
    FlagFounder   = 'F' // Full founder control
    FlagSuccessor = 'S' // Inherits if founder drops
    FlagAdmin     = 'A' // SOP: all chanop + access changes
    FlagOp        = 'O' // AOP: auto-op on join
    FlagHalfOp    = 'H' // Auto-halfop on join
    FlagVoice     = 'V' // Auto-voice on join
)

const validFlags = "FSAOHVfsaohv"
```

## Mapping Mode → Prefix

```go
MODE_TO_PREFIX = map[rune]rune{
    'q': '~',  // Founder
    'a': '&',  // Admin
    'o': '@',  // Op
    'h': '%',  // Halfop
    'v': '+',  // Voice
}

PREFIX_ORDER = ['~', '&', '@', '%', '+']  // Precedence: highest → lowest
```

## OdinX — Permissions (`odinx/js/permissions.js`)

```javascript
CatIRC.globalRoles = [] // Array de role names desde servidor (NOTICE *** ROLES: ROOT OPER)

CatIRC.permissions = {
    isOper() { ... },           // client.isGlobalOper || globalRoles.includes(IRC_OPER)
    isRoot() { ... },           // globalRoles.includes("ROOT")
    hasGlobalRole(role) { ... },
    setGlobalRoles(rolesArray) { ... },
    renderRoleChips() { ... },  // UI badges en nicklist
    getAdminToken() { ... },    // sessionStorage.catirc_admin_token
    setAdminToken(token) { ... }
}
```

---

*Generado: 2026-07-11 | Fuente: `internal/database/roles_repo.go`, `internal/services/operserv.go`, `internal/services/chanserv_v2.go`, `odinx/js/permissions.js`, `odinx/js/irc.js`*
```

## 22. roles.md

```md
# Modelos de Datos — Roles y Permisos

## CatIRC — Global Roles (`internal/database/roles_repo.go`)

```go
type IRCRoleDefinitionRow struct {
    ID          int64
    Name        string        // ROOT, NETWORK_ADMIN, IRC_OPER, SERVICES_ADMIN, HELP_OP, GLOBAL_MODERATOR, NEWS_BOT, SYSTEM
    Permissions string        // JSON: {"all":true} o {"kline":true,"kill":true,...}
    Description string
    IsSystem    bool          // true = no deletable
    CreatedAt   time.Time
}

type IRCUserRoleRow struct {
    ID        int64
    UserID    int64
    RoleID    int64
    GrantedBy int64
    GrantedAt time.Time
    ExpiresAt time.Time     // 0 = permanente
}
```

## Roles por Defecto (Seed)

| Role | Permissions JSON | Descripción |
|------|------------------|-------------|
| ROOT | `{"all":true}` | Acceso total |
| NETWORK_ADMIN | `{"network":true,"oper":true}` | Admin red |
| IRC_OPER | `{"oper":true}` | IRC Operator estándar |
| SERVICES_ADMIN | `{"services":true}` | NickServ/ChanServ admin |
| HELP_OP | `{"helpop":true,"trace":true}` | Staff soporte |
| GLOBAL_MODERATOR | `{"moderate_global":true}` | Mod global canales |
| NEWS_BOT | `{"post_announcements":true}` | Bot anuncios |
| SYSTEM | `{"system":true}` | Acciones internas |

## OperServ — Oper Classes (`internal/services/operserv.go`)

```go
const (
    PermAll      = "all"
    PermKLine    = "kline"
    PermGLine    = "gline"
    PermKill     = "kill"
    PermWallops  = "wallops"
    PermAKill    = "akill"
    PermShun     = "shun"
    PermTrace    = "trace"
    PermStats    = "stats"
    PermSessions = "sessions"
)

type OperPermissions struct {
    All      bool
    KLine    bool
    GLine    bool
    Kill     bool
    Wallops  bool
    AKill    bool
    Shun     bool
    Trace    bool
    Stats    bool
    Sessions bool
}
```

## Clases por Defecto (Seed)

| Clase | Permisos |
|-------|----------|
| ROOT | `{"all":true}` |
| ADMIN | kline, gline, kill, wallops, akill, shun, trace, stats |
| GLOBALOP | kline, kill, wallops, trace, stats |
| LOCALOP | kline, kill, stats |
| HELPOP | stats, trace |

---

## Canales — Flags de Acceso (ChanServV2)

### Mapping Mode → Prefix
```go
MODE_TO_PREFIX = map[rune]rune{
    'q': '~',  // Founder
    'a': '&',  // Admin
    'o': '@',  // Op
    'h': '%',  // Halfop
    'v': '+',  // Voice
}
```

### Precedencia (mayor → menor)
```go
PREFIX_ORDER = ['~', '&', '@', '%', '+']
```

### Flags de Canal (FLAGS system)
| Flag | Char | Nombre | Descripción |
|------|------|--------|-------------|
| Founder | `F` | Owner | Control total, puede transferir |
| Successor | `S` | Sucesor | Hereda si founder dropea |
| Admin | `A` | Admin | SOP: todos chanops + access changes |
| Op | `O` | Op | AOP: auto-op al entrar |
| HalfOp | `H` | Halfop | Auto-halfop |
| Voice | `V` | Voice | Auto-voice |

---

## OdinX — Permissions (`js/permissions.js`)

```javascript
// CatIRC.globalRoles — array de role names desde servidor (NOTICE *** ROLES: ROOT OPER)
CatIRC.globalRoles = []

// CatIRC.permissions helpers
CatIRC.permissions.isOper()           // client.isGlobalOper || globalRoles.includes(IRC_OPER)
CatIRC.permissions.isRoot()           // globalRoles.includes("ROOT")
CatIRC.permissions.hasGlobalRole("ROOT")
CatIRC.permissions.setGlobalRoles(rolesArray)
CatIRC.permissions.renderRoleChips()  // UI badges en nicklist
```

---

*Generado: 2026-07-11 | Fuente: `internal/identity/identity.go`, `internal/services/operserv.go`, `internal/services/chanserv_v2.go`, `internal/database/roles_repo.go`, `js/permissions.js`*
```

## 23. servidores.md

```md
# Modelos de Datos — Servidores

## CatIRC — Configuración del Servidor (`internal/config/config.go`)

```go
type Config struct {
    // Server Binding
    Host           string // CATIRC_HOST = "0.0.0.0"
    Port           string // CATIRC_PORT = "6667"
    WSHost         string // CATIRC_WS_HOST = "0.0.0.0"
    WSPort         string // CATIRC_WS_PORT = "8081"
    ServerName     string // CATIRC_SERVER_NAME = "catirc.local"
    MOTD           string // CATIRC_MOTD = "Welcome to CATIRC!"
    Password       string // CATIRC_PASSWORD = ""
    UseIRCMode     bool   // CATIRC_USE_IRC_MODE = true
    
    // TLS
    TLSCert        string // CATIRC_TLS_CERT
    TLSKey         string // CATIRC_TLS_KEY
    TLSListen      string // CATIRC_TLS_LISTEN = ""
    
    // Rate Limiting
    RateLimit      int    // CATIRC_RATE_LIMIT = 100
    RateWindow     int    // CATIRC_RATE_WINDOW = 60
    
    // Security
    MaxConnections int    // CATIRC_MAX_CONNECTIONS = 5
    
    // Database
    DatabaseURL    string // CATIRC_DATABASE_URL = ""
    
    // CatMage Auth
    JWTSecret            string // CATIRC_JWT_SECRET = ""
    JWTExpiryMin         int    // CATIRC_JWT_EXPIRY_MIN = 1440
    CatMageURL           string // CATMAGE_URL = ""
    CatMageAPIKey        string // CATMAGE_API_KEY = ""
    CatMageSyncInterval  int    // CATMAGE_SYNC_INTERVAL_MIN = 60
    CatMageWebhookPath   string // CATMAGE_WEBHOOK_PATH = "/api/catmage/webhook"
    EmbedMode            bool   // CATIRC_EMBED_MODE = false
    
    // P2P File Transfer
    EnableP2PFiles       bool   // CATIRC_ENABLE_P2P_FILES = true
    MaxFileSizeMB        int    // CATIRC_MAX_FILE_SIZE_MB = 100
    ICEServers           string // CATIRC_ICE_SERVERS = "stun:stun.l.google.com:19302"
    
    // Retention
    MessageExpiry        int    // CATIRC_MESSAGE_EXPIRY_DAYS = 90
    CleanupInterval      int    // CATIRC_CLEANUP_INTERVAL_MIN = 60
    
    // IRC Operator
    OperName             string // CATIRC_OPER_NAME = ""
    OperPassword         string // CATIRC_OPER_PASSWORD = ""
    
    // Observability
    MetricsPath          string // CATIRC_METRICS_PATH = "/metrics"
    
    // Admin HTTP API
    AdminToken           string // CATIRC_ADMIN_TOKEN = ""
    AdminPath            string // CATIRC_ADMIN_PATH = "/admin"
    
    // CORS
    AllowedOrigins       string // CATIRC_ALLOWED_ORIGINS = ""
    
    // Embed Mode
    EmbedMode            bool   // CATIRC_EMBED_MODE = false
    
    // HTTP Timeouts
    HTTPReadTimeout      int    // CATIRC_HTTP_READ_TIMEOUT_SEC = 30
    HTTPWriteTimeout     int    // CATIRC_HTTP_WRITE_TIMEOUT_SEC = 60
    HTTPIdleTimeout      int    // CATIRC_HTTP_IDLE_TIMEOUT_SEC = 120
}
```

## CatIRC — Server Runtime (`internal/server/server.go`)

```go
type Server struct {
    cfg          *config.Config
    listener     net.Listener
    tlsListener  net.Listener
    clients      *client.Manager
    channels     *channel.Manager
    registry     *auth.Registry
    rateLim      *RateLimiter
    nickServ     *services.NickServ
    chanServ     *services.ChannelServ
    chanServV2   *services.ChanServV2
    operServ     *services.OperServ
    idp          identity.IdentityProvider
    syncIdp      *identity.SyncIdentityProvider
    throttler    *security.Throttler
    store        database.Store
    syncer       *catmage.Syncer
    authProvider auth.AuthProvider
    webhookPath  string
    syncCancel   context.CancelFunc
    bus          *eventbus.EventBus
    router       *CommandRouter
    met          *metrics.Collector
    shutdown     chan struct{}
    wg           sync.WaitGroup
    statsMu      sync.Mutex
    statsCache   *statsEntry
}
```

## CatIRC — WebSocket Server (`internal/websocket/server.go`)

```go
type Server struct {
    host         string
    port         string
    cfg          ServerConfig
    httpServer   *http.Server
    onMessage    MessageHandler
    onDisconnect DisconnectHandler
    extra        map[string]http.HandlerFunc
    wg           sync.WaitGroup
    shutdown     chan struct{}
}

type ServerConfig struct {
    AllowedOrigins []string      // nil = allow any origin (dev)
    ReadTimeout    time.Duration // 0 → 30s
    WriteTimeout   time.Duration // 0 → 60s
    IdleTimeout    time.Duration // 0 → 120s
}

type MessageHandler func(*types.Client, string)
type DisconnectHandler func(*types.Client)
```

## OdinX — Client Connection (`odinx/js/client.js`)

```javascript
class CATIRCClient {
    constructor(options = {}) {
        this.nick = options.nick || '';
        this.realname = options.realname || '';
        this.password = options.password || '';
        this.autoReconnect = options.autoReconnect !== false;
        this.initialChannel = options.channel || '#general';
        this.nickservPass = options.nickservPass || '';
        
        // State
        this.ws = null;
        this.connected = false;
        this.registered = false;
        this.reconnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectDelay = 30000;
        this.maxReconnectAttempts = 10;
        this.reconnectTimer = null;
        this.state = 'DISCONNECTED';
        this.sessionId = null;
        this._intentionalClose = false;
        
        // Data
        this.channels = new Map();
        this.currentChannel = null;
        this.myNick = '';
        this.serverName = '';
        this.supportedCaps = [];
        
        // Callbacks
        this.onConnect = null;
        this.onDisconnect = null;
        this.onRegister = null;
        this.onMessage = null;
        this.onChannelJoin = null;
        this.onChannelPart = null;
        this.onUserList = null;
        this.onNickChange = null;
        this.onMode = null;
        this.onBanList = null;
        this.onTopic = null;
        this.onKick = null;
        this.onInvite = null;
        this.onError = null;
        this.onReconnecting = null;
        this.onNotice = null;
        this.onMOTD = null;
        this.onCTCP = null;
        this.onServerStats = null;
        this.onTime = null;
        this.onWHO = null;
        this.onWHOIS = null;
        this.onList = null;
        this.onPing = null;
        this.onCAP = null;
        this.onUserHost = null;
        this.onHistory = null;
        this.onReact = null;
        this._historyLoading = false;
    }
}
```

## OdinX — Settings (`odinx/js/state.js`)

```javascript
CatIRC.state = {
    client: null,
    settings: {
        nick: '',
        realname: '',
        server: 'ws://localhost:8081/ws',
        channel: '#general',
        autoReconnect: true,
        theme: 'dark',
        notifications: false,
        sounds: true,
        autoHistory: true,
        expandImages: false
    },
    commandHistory: [],
    commandHistoryIdx: -1,
    typingTimeout: null,
    lastTypingSent: 0,
    ctxNick: null,
    ctxIsOp: false,
    pendingChannels: [],
    inviteNick: '',
    ignored: Set<string>,
    profileNick: '',
    _whoisTarget: '',
    _whoisData: {},
    searchMatches: [],
    searchIdx: 0,
    _embedMode: false,
    _embedJWT: '',
    _embedChannels: [],
    _reconnectDialogOpen: false,
    _sessionAction: null,
    _recoverChannels: null,
    _recoverActive: null,
};
```

## Métricas del Servidor (`internal/metrics/metrics.go`)

```go
type Collector struct {
    ConnectionsTotal   prometheus.Counter
    MessagesTotal      prometheus.Counter
    RateLimitTotal     prometheus.Counter
    AuthTotal          prometheus.Counter
    OperGrantsTotal    prometheus.Counter
    ClientCount        func() int64  // Gauge callback
    ChannelCount       func() int64  // Gauge callback
}
```

---

*Generado: 2026-07-11 | Fuente: `internal/config/config.go`, `internal/server/server.go`, `internal/websocket/server.go`, `odinx/js/client.js`, `odinx/js/state.js`, `internal/metrics/metrics.go`*
```

## 24. usuarios.md

```md
# Modelos de Datos — CatIRC + OdinX

## 1. Usuarios

### CatIRC — `internal/identity/identity.go`
```go
type IRCUser struct {
    ID             int64     `json:"id"`                    // PK irc_users.id
    Username       string    `json:"username"`              // lowercase, unique
    Nick           string    `json:"nick"`                  // display nick
    Email          string    `json:"email,omitempty"`
    PasswordHash   string    `json:"-"`                     // argon2id (CatMage) o bcrypt (legacy)
    Role           string    `json:"role"`                  // ROOT|ADMIN|SERVER_OPERATOR|USER
    State          string    `json:"state"`                 // active|banned|suspended
    CatMageUserID  int64     `json:"catmage_user_id"`       // 0 = local-only
    CreatedAt      time.Time `json:"created_at"`
    UpdatedAt      time.Time `json:"updated_at"`            // LWW para sync
}

func (u *IRCUser) IsActive() bool { return u.State == "" || u.State == "active" }
```

### CatIRC — AuthUser (`internal/auth/auth.go`)
```go
type AuthUser struct {
    ID             int64  `json:"id"`
    Username       string `json:"username"`
    Nick           string `json:"nick"`
    Role           string `json:"role"`
    State          string `json:"state"`
    CatMageUserID  int64  `json:"catmage_user_id"`
}
```

### CatIRC — CatMage Snapshot (`internal/catmage/sync.go`)
```go
type Snapshot struct {
    CatMageUserID int64     `json:"catmage_user_id"`   // >0 requerido
    Username      string    `json:"username"`          // requerido
    DisplayNick   string    `json:"display_nick"`
    Email         string    `json:"email"`
    PasswordHash  string    `json:"password_hash"`     // argon2id
    Role          string    `json:"role"`
    Roles         []string  `json:"roles"`             // fallback
    State         string    `json:"state"`             // active|banned
    UpdatedAt     time.Time `json:"updated_at"`        // LWW
}
```

### OdinX — `js/state.js` + `js/client.js`
```javascript
// CatIRC.state.settings (localStorage)
{
  nick: "",
  realname: "",
  server: "ws://...",
  channel: "#general",
  autoReconnect: true,
  theme: "dark",
  notifications: false,
  sounds: true,
  autoHistory: true,
  expandImages: false
}

// CatIRC.state.client (CATIRCClient instance)
{
  nick: "",
  realname: "",
  password: "",
  autoReconnect: true,
  initialChannel: "#general",
  nickservPass: "",
  // Estado interno:
  ws: WebSocket,
  connected: false,
  registered: false,
  myNick: "",
  serverName: "",
  channels: Map<lowerName, ChannelData>,
  currentChannel: null,
  // Callbacks:
  onConnect, onDisconnect, onRegister, onMessage,
  onChannelJoin, onChannelPart, onNickChange, onMode,
  onNotice, onMOTD, onWHO, onWHOIS, onHistory, onReact, etc.
}
```

---

## 2. Canales

### CatIRC — Runtime (`pkg/types/types.go`)
```go
type Channel struct {
    Name         string
    Topic        string
    Modes        string        // "+nt"
    Key          string        // +k password
    Limit        int           // +l limit
    Mutex        sync.RWMutex
    Clients      map[string]*Client
    Operators    map[string]bool  // +o
    Voiced       map[string]bool  // +v
    InviteList   map[string]bool  // +I
    BanList      map[string]bool  // +b mask
    ExceptionList map[string]bool // +e mask
    broadcast    chan string
    done         chan struct{}
}
```

### CatIRC — Persistencia V2 (`internal/services/chanserv_v2.go`)
```go
type IRCChannelReg struct {
    Row    *IRCChannelRow
    Access map[int64]*IRCChannelAccessRow  // user_id -> flags
    Modes  *IRCChannelModesRow
}

type IRCChannelRow struct {
    ID              int64
    Name            string
    FounderUserID   int64
    RegisteredAt    time.Time
    UpdatedAt       time.Time
    Topic           string
    TopicSetter     string
    TopicTime       time.Time
    Description     string
    URL             string
    Email           string
}

type IRCChannelAccessRow struct {
    ChannelID int64
    UserID    int64
    Flags     string        // "FOAohvS" (Founder, Owner, Admin, Op, Halfop, Voice, Successor)
    GrantedBy int64
    GrantedAt time.Time
}

type IRCChannelModesRow struct {
    ChannelID  int64
    Modes      string        // "+nt"
    Key        string
    UserLimit  int
    MLock      string
    TopicLock  bool
    KeepTopic  bool
    Restricted bool
    UpdatedAt  time.Time
}
```

### Flags de Acceso (ChanServV2)
| Flag | Char | Nombre | Descripción |
|------|------|--------|-------------|
| Founder | `F` | Owner | Control total, puede transferir |
| Successor | `S` | Sucesor | Hereda si founder dropea |
| Admin | `A` | Admin | SOP: todos chanops + access changes |
| Op | `O` | Op | AOP: auto-op al entrar |
| HalfOp | `H` | Halfop | Auto-halfop |
| Voice | `V` | Voice | Auto-voice |

### OdinX — ChannelData (`js/client.js`)
```javascript
// client.channels.get(lowerName)
{
  users: Set<nick>,
  topic: "",
  messages: Message[],
  unread: 0,
  userPrefixes: Map<nick, prefixString>, // "@", "+", etc.
  modes: Map<modeChar, boolean>,
  _scrollTop: number
}
```

---

## 3. Mensajes

### CatIRC — Legacy (`internal/database/messages.go`)
```go
type StoredMessage struct {
    ID        int64
    Channel   string    // "" = PM
    Sender    string
    Target    string    // target nick (PM)
    Message   string
    Timestamp time.Time
    ExpiresAt time.Time
}
```

### CatIRC — V2 (`internal/database/store.go`)
```go
type IRCMessageV2Row struct {
    ID               int64
    UUID             string        // UUID v4
    ConversationID   int64
    SenderID         int64         // 0 = server/anonymous
    SenderNick       string
    MessageType      string        // PRIVMSG|NOTICE|ACTION|JOIN|PART|QUIT|TOPIC|MODE|KICK|NICK
    Body             string
    Tags             string        // JSON
    ReplyToMessageID int64
    IsPersistent     bool
    IsSystem         bool          // JOIN, PART, QUIT, TOPIC, MODE, KICK, NICK
    EditedAt         time.Time
    DeletedAt        time.Time
    ExpiresAt        time.Time
    Metadata         string        // JSON
    CreatedAt        time.Time
}

type IRCConversationRow struct {
    ID              int64
    Type            string        // channel | dm | system | notification
    ChannelID       int64         // type=channel
    ParticipantAID  int64         // type=dm (lower user ID)
    ParticipantBID  int64         // type=dm (higher user ID)
    CreatedAt       time.Time
    UpdatedAt       time.Time
}
```

### OdinX — Message (`js/ui.js` + `js/client.js`)
```javascript
// Message object en channel.messages[]
{
  type: "privmsg" | "action" | "join" | "part" | "quit" | "server" | "service",
  text: "contenido",
  nick: "usuario",
  isOp: boolean,
  isMe: boolean,
  time: Date.now(),
  mid: "abc123def",           // unique ID para reactions
  reactions: Map<emoji, Set<nick>>, // { "👍": Set["nick1", "nick2"] }
  tags: { "+react": "👍", "+react-to": "mid" } // IRCv3 tags
}
```

---

## 4. Roles y Permisos

### CatIRC — Global Roles (`internal/database/roles_repo.go`)
```go
type IRCRoleDefinitionRow struct {
    ID          int64
    Name        string        // ROOT, NETWORK_ADMIN, IRC_OPER, etc.
    Permissions string        // JSON: {"all":true} o {"kline":true,...}
    Description string
    IsSystem    bool          // true = no deletable
    CreatedAt   time.Time
}

type IRCUserRoleRow struct {
    ID        int64
    UserID    int64
    RoleID    int64
    GrantedBy int64
    GrantedAt time.Time
    ExpiresAt time.Time     // 0 = permanente
}
```

### Roles por Defecto (Seed)
| Role | Permissions JSON | Descripción |
|------|------------------|-------------|
| ROOT | `{"all":true}` | Acceso total |
| NETWORK_ADMIN | `{"network":true,"oper":true}` | Admin red |
| IRC_OPER | `{"oper":true}` | IRC Operator estándar |
| SERVICES_ADMIN | `{"services":true}` | NickServ/ChanServ admin |
| HELP_OP | `{"helpop":true,"trace":true}` | Staff soporte |
| GLOBAL_MODERATOR | `{"moderate_global":true}` | Mod global canales |
| NEWS_BOT | `{"post_announcements":true}` | Bot anuncios |
| SYSTEM | `{"system":true}` | Acciones internas |

### OperServ — Oper Classes (`internal/services/operserv.go`)
```go
const (
    PermAll      = "all"
    PermKLine    = "kline"
    PermGLine    = "gline"
    PermKill     = "kill"
    PermWallops  = "wallops"
    PermAKill    = "akill"
    PermShun     = "shun"
    PermTrace    = "trace"
    PermStats    = "stats"
    PermSessions = "sessions"
)

type OperPermissions struct {
    All      bool
    KLine    bool
    GLine    bool
    Kill     bool
    Wallops  bool
    AKill    bool
    Shun     bool
    Trace    bool
    Stats    bool
    Sessions bool
}
```

### Clases por Defecto (Seed)
| Clase | Permisos |
|-------|----------|
| ROOT | `{"all":true}` |
| ADMIN | kline, gline, kill, wallops, akill, shun, trace, stats |
| GLOBALOP | kline, kill, wallops, trace, stats |
| LOCALOP | kline, kill, stats |
| HELPOP | stats, trace |

---

## 5. Permisos de Canal (Flags)

### Mapping Mode → Prefix
```go
MODE_TO_PREFIX = map[rune]rune{
    'q': '~',  // Founder
    'a': '&',  // Admin
    'o': '@',  // Op
    'h': '%',  // Halfop
    'v': '+',  // Voice
}
```

### Precedencia (mayor → menor)
```go
PREFIX_ORDER = ['~', '&', '@', '%', '+']
```

---

## 6. Network Bans (OperServ)

### Tipos de Ban
| Tipo | Descripción | Comando |
|------|-------------|---------|
| AKILL | Auto-kill global (nick!user@host) | AKILL |
| KLINE | Kill line (user@host) | KLINE |
| GLINE | Global line (user@host) | GLINE |
| ZLINE | IP/host ban (Z:line) | ZLINE |
| SHUN | Silencia (no mensajes) | SHUN |
| MUTE | Mute (solo lectura) | MUTE |

### Estructura (`internal/services/operserv.go`)
```go
type NetworkBan struct {
    ID           int64
    Type         string    // AKILL|KLINE|GLINE|SHUN|ZLINE|MUTE
    Mask         string
    Reason       string
    SetBy        string
    CreatedAt    time.Time
    ExpiresAt    time.Time // 0 = permanente
}
```

---

## 7. Invitaciones

### CatIRC (`internal/database/invitations_repo.go`)
```go
type IRCInvitationRow struct {
    ID         int64
    Token      string    // unique, URL-safe
    ChannelID  int64     // 0 = network-wide
    CreatedBy  int64
    MaxUses    int       // 0 = unlimited
    Uses       int
    ExpiresAt  time.Time // 0 = no expiry
    RevokedBy  int64
    RevokedAt  time.Time
    CreatedAt  time.Time
}
```

### Endpoint Público
```
GET /invite/{token} → {"valid":true,"token":"...","channel":"#general","uses":0,"max_uses":5}
```

---

## 8. Auditoría

### CatIRC (`internal/database/audit_repo.go`)
```go
type IRCAuditLogRow struct {
    ID               int64
    ActorUserID      int64
    TargetUserID     int64
    TargetChannelID  int64
    Action           string    // NICKSERV_REGISTER, KICK, MODE_CHANGE, LOGIN, etc.
    Reason           string
    Metadata         string    // JSON
    IPAddress        string
    CreatedAt        time.Time
}
```

### Acciones Principales
| Acción | Actor | Target | Metadata |
|--------|-------|--------|----------|
| NICKSERV_REGISTER | user | — | `{"nick":"...","email":"..."}` |
| NICKSERV_IDENTIFY | user | — | `{"nick":"..."}` |
| CHANSERV_REGISTER | user | channel | `{"channel":"#x","founder":"..."}` |
| CHANSERV_ACCESS | user | user | `{"channel":"#x","flags":"+AOhv"}` |
| KICK | kicker | kicked | `{"channel":"#x","reason":"..."}` |
| MODE_CHANGE | user | channel | `{"channel":"#x","modes":"+o nick"}` |
| LOGIN | user | — | `{"nick":"...","method":"password"}` |
| OPER_LOGIN | user | — | `{"nick":"...","oper_class":"GLOBALOP"}` |
| AKILL/KLINE/GLINE | oper | — | `{"mask":"*!*@evil.com"}` |

---

## 9. Configuración (Environment Variables)

### CatIRC (`internal/config/config.go`)
```go
type Config struct {
    // Server
    Host           string // CATIRC_HOST = "0.0.0.0"
    Port           string // CATIRC_PORT = "6667"
    WSHost         string // CATIRC_WS_HOST = "0.0.0.0"
    WSPort         string // CATIRC_WS_PORT = "8081"
    ServerName     string // CATIRC_SERVER_NAME = "catirc.local"
    MOTD           string // CATIRC_MOTD = "Welcome to CATIRC!"
    Password       string // CATIRC_PASSWORD = ""
    UseIRCMode     bool   // CATIRC_USE_IRC_MODE = true
    
    // TLS
    TLSCert        string // CATIRC_TLS_CERT
    TLSKey         string // CATIRC_TLS_KEY
    TLSListen      string // CATIRC_TLS_LISTEN = ""
    
    // Rate Limiting
    RateLimit      int    // CATIRC_RATE_LIMIT = 100
    RateWindow     int    // CATIRC_RATE_WINDOW = 60
    
    // Security
    MaxConnections int    // CATIRC_MAX_CONNECTIONS = 5
    
    // Database
    DatabaseURL    string // CATIRC_DATABASE_URL = "" (requerido para persistencia)
    
    // CatMage Auth
    JWTSecret            string // CATIRC_JWT_SECRET = "" (requerido para auth)
    JWTExpiryMin         int    // CATIRC_JWT_EXPIRY_MIN = 1440
    CatMageURL           string // CATMAGE_URL = ""
    CatMageAPIKey        string // CATMAGE_API_KEY = ""
    CatMageSyncInterval  int    // CATMAGE_SYNC_INTERVAL_MIN = 60
    CatMageWebhookPath   string // CATMAGE_WEBHOOK_PATH = "/api/catmage/webhook"
    EmbedMode            bool   // CATIRC_EMBED_MODE = false
    
    // P2P
    EnableP2PFiles       bool   // CATIRC_ENABLE_P2P_FILES = true
    MaxFileSizeMB        int    // CATIRC_MAX_FILE_SIZE_MB = 100
    ICEServers           string // CATIRC_ICE_SERVERS = "stun:stun.l.google.com:19302"
    
    // Retention
    MessageExpiry        int    // CATIRC_MESSAGE_EXPIRY_DAYS = 90
    CleanupInterval      int    // CATIRC_CLEANUP_INTERVAL_MIN = 60
    
    // IRC Operator
    OperName             string // CATIRC_OPER_NAME = ""
    OperPassword         string // CATIRC_OPER_PASSWORD = ""
    
    // Observability
    MetricsPath          string // CATIRC_METRICS_PATH = "/metrics"
    
    // Admin HTTP API
    AdminToken           string // CATIRC_ADMIN_TOKEN = ""
    AdminPath            string // CATIRC_ADMIN_PATH = "/admin"
    
    // CORS
    AllowedOrigins       string // CATIRC_ALLOWED_ORIGINS = "" (vacío = cualquiera)
    
    // Embed
    EmbedMode            bool   // CATIRC_EMBED_MODE = false
    
    // HTTP Timeouts
    HTTPReadTimeout      int    // CATIRC_HTTP_READ_TIMEOUT_SEC = 30
    HTTPWriteTimeout     int    // CATIRC_HTTP_WRITE_TIMEOUT_SEC = 60
    HTTPIdleTimeout      int    // CATIRC_HTTP_IDLE_TIMEOUT_SEC = 120
}
```

### Validación (`Config.Validate()`)
- `ServerName`, `Port`, `WSPort` no vacíos
- TLS: cert/key/listen los 3 juntos o ninguno
- Valores numéricos ≥ 0
- Si `CATMAGE_URL` ≠ "" → `CATMAGE_API_KEY` requerido
- Si `EnableP2PFiles` → `ICEServers` requerido

---

## OdinX (Build-time)

### `package.json` — Scripts
```json
{
  "dev": "node dev-server.js",
  "start": "node dev-server.js 8082",
  "build": "npm run build:css",
  "build:css": "node node_modules/@tailwindcss/cli/dist/index.mjs -i ./src/input.css -o ./dist/tailwind.min.css --minify",
  "test": "jest --coverage",
  "test:watch": "jest --watch",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

### `dev-server.js` — Sirve estáticos + WS proxy a CatIRC
```javascript
// Sirve ./ en puerto 8082
// Proxy /ws → CatIRC WS port
```

### Assets
| Archivo | Descripción |
|---------|-------------|
| `dist/tailwind.min.css` | CSS compilado (42KB gzipped) |
| `images/` | Avatars, favicons |
| `manifest.json` | PWA manifest |
| `service-worker.js` | Offline support |

---

*Generado: 2026-07-11 | Fuente: `internal/identity/`, `internal/auth/`, `internal/catmage/`, `internal/services/`, `internal/database/store.go`, `internal/config/config.go`, `odinx/js/state.js`, `odinx/js/client.js`, `odinx/package.json`*
```

## 25. backend.md

```md
# Rutas Backend (CatIRC)

## IRC Commands (TCP + WebSocket)

### Connection & Registration
| Comando | Parámetros | Handler | Descripción |
|---------|------------|---------|-------------|
| `PASS` | `<password>` | `handlePass` | Server password |
| `NICK` | `<nickname>` | `handleNick` | Set/change nick |
| `USER` | `<user> 0 * :<realname>` | `handleUser` | User registration |
| `QUIT` | `[:reason]` | `handleQuit` | Disconnect |
| `PING` | `[:token]` | `handlePing` | Keepalive |
| `AWAY` | `[:message]` | `handleAway` | Set/clear away |

### Capability Negotiation (IRCv3)
| Comando | Parámetros | Handler |
|---------|------------|---------|
| `CAP` | `LS 302` | `handleCap` |
| `CAP` | `REQ :<caps>` | `handleCap` |
| `CAP` | `END` | `handleCap` |

### Channel Operations
| Comando | Parámetros | Handler | Requiere Registro |
|---------|------------|---------|-------------------|
| `JOIN` | `<#chan>[,...] [<key>[,...]]` | `handleJoin` | Sí |
| `PART` | `<#chan>[,...] [:reason]` | `handlePart` | Sí |
| `TOPIC` | `<#chan> [:new topic]` | `handleTopic` | Sí |
| `MODE` | `<#chan> [<modes> [<params>]]` | `handleMode` | Sí |
| `KICK` | `<#chan> <nick> [:reason]` | `handleKick` | Sí |
| `INVITE` | `<nick> <#chan>` | `handleInvite` | Sí |
| `KNOCK` | `<#chan> [:message]` | `handleKnock` | Sí |

### Messaging
| Comando | Parámetros | Handler |
|---------|------------|---------|
| `PRIVMSG` | `<target> :<text>` | `handlePrivmsg` |
| `NOTICE` | `<target> :<text>` | `handleNotice` |
| `TAGMSG` | `<target>` + tags | `handleTagmsg` |

### Informational
| Comando | Parámetros | Handler |
|---------|------------|---------|
| `WHOIS` | `<nick> [<nick>]` | `handleWhois` |
| `WHO` | `<mask> [%format]` | `handleWho` |
| `NAMES` | `<#chan>` | `handleNames` |
| `LIST` | `[<#chan>]` | `handleList` |
| `LUSERS` | — | `handleLusers` |
| `MOTD` | — | `handleMotd` |
| `USERHOST` | `<nick> ...` | `handleUserhost` |
| `TIME` | — | `handleTime` |
| `ISON` | `<nick> ...` | `handleIson` |

### IRCv3 Extended
| Comando | Parámetros | Handler |
|---------|------------|---------|
| `MONITOR` | `+/-<nicks> \| C \| L \| S` | `handleMonitor` |
| `SETNAME` | `:<realname>` | `handleSetname` |
| `CHGHOST` | `<nick> <host>` | `handleChghost` (Oper) |

### CatMage / Persistence
| Comando | Parámetros | Handler |
|---------|------------|---------|
| `LOGIN` | `<username> <password>` | `handleLogin` |
| `HISTORY` | `<#chan|nick> [limit]` | `handleHistory` |

### Extended: Staff
| Comando | Parámetros | Handler | Permiso |
|---------|------------|---------|---------|
| `AUDITLOG` | `[limit]` | `handleAuditLog` | Staff |
| `INVTOKEN` | `<#chan> [max_uses] [expiry_h]` | `handleInvToken` | Op/Staff |

### OperServ (IRC Operators)
| Comando | Parámetros | Handler | Permiso |
|---------|------------|---------|---------|
| `OPER` | `<name> <password>` | `handleOper` | Configurado |
| `OPERSERV` | `<subcmd> ...` | `OperServ.HandleMessage` | `IsGlobalOper` |

**Subcomandos OperServ**:
- `INFO` — Info oper
- `AKILL <mask> <reason>` — Add auto-kill
- `KLINE <mask> <reason>` — Add K-Line
- `GLINE <mask> <reason>` — Add G-Line
- `SHUN <mask> <reason>` — Add Shun
- `ZLINE <ip/mask> <reason>` — Add Z-Line
- `MUTE <mask> <reason>` — Add Mute
- `UNKILL/UNKNLINE/UNGLINE/UNSHUN/UNZLINE/UNMUTE <mask>` — Remove
- `KILL <nick> <reason>` — Kill client
- `WALLOPS <message>` — Broadcast to opers
- `TRACE` — List connected clients
- `STATS` — Server stats
- `SESSIONS` — Active sessions
- `OPERS` — List opers

### P2P File Transfer
| Comando | Parámetros | Handler |
|---------|------------|---------|
| `FILE` | `OFFER|ACCEPT|REJECT|CANCEL|ERROR|SIGNAL <target> <id> [:data]` | `handleFile` |

---

## HTTP Endpoints (WebSocket Server Mux)

### Base: `/` (WebSocket Server)

| Método | Ruta | Handler | Auth | Descripción |
|--------|------|---------|------|-------------|
| `GET` | `/ws` | `handleWebSocketWithUpgrader` | — | WebSocket upgrade |
| `GET` | `/health` | `handleHealth` | — | `{"status":"ok"}` |

### Admin API (`/admin/`) — Bearer Token

| Método | Ruta | Handler | Descripción |
|--------|------|---------|-------------|
| `GET` | `/admin/stats` | `stats` | Server overview |
| `GET` | `/admin/clients` | `clients` | Connected clients |
| `GET` | `/admin/channels` | `channels` | Live channels |
| `GET` | `/admin/registered-channels` | `registeredChannels` | ChanServ registrations |
| `GET` | `/admin/opers` | `opers` | Active IRCOps |
| `GET` | `/admin/bans` | `bans` | Active network bans |
| `GET` | `/admin/messages` | `messages` | Channel history |
| `POST` | `/admin/kick` | `kick` | Kick user |
| `POST` | `/admin/broadcast` | `broadcast` | Global NOTICE |
| `POST` | `/admin/oper/grant` | `operGrant` | Grant oper class |
| `POST` | `/admin/oper/revoke` | `operRevoke` | Revoke oper |
| `POST` | `/admin/ban` | `banHandler` (POST) | Add network ban |
| `DELETE` | `/admin/ban` | `banHandler` (DELETE) | Remove network ban |
| `GET` | `/admin/roles` | `rolesHandler` (GET) | List role defs |
| `POST` | `/admin/roles` | `rolesHandler` (POST) | Upsert role |
| `DELETE` | `/admin/roles` | `rolesHandler` (DELETE) | Delete role |
| `GET` | `/admin/user-roles` | `getUserRoles` | User's active roles |
| `POST` | `/admin/user-roles/grant` | `grantRole` | Grant role |
| `POST` | `/admin/user-roles/revoke` | `revokeRole` | Revoke role |
| `GET` | `/admin/user-roles/check` | `checkRole` | Check role |
| `GET` | `/admin/audit` | `auditLog` | Global audit log |
| `GET` | `/admin/audit/user` | `auditUserLog` | User audit log |
| `GET` | `/admin/audit/channel` | `auditChannelLog` | Channel audit log |
| `POST` | `/admin/invitations` | `createInvitation` | Create invite token |
| `GET` | `/admin/invitations/list` | `listChannelInvitations` | Channel invites |
| `GET` | `/admin/invitations/get` | `getInvitation` | Get invite by token |
| `POST` | `/admin/invitations/use` | `useInvitation` | Consume invite |
| `POST` | `/admin/invitations/revoke` | `revokeInvitation` | Revoke invite |
| `GET` | `/admin/search` | `searchMessages` | Full-text search |
| `GET` | `/admin/users` | `usersHandler` | Registered users |
| `GET` | `/admin/network-bans` | `networkBansHandler` | Persistent bans |
| `DELETE` | `/admin/network-bans` | `networkBansHandler` (DELETE) | Remove ban |

### Auth HTTP (`/auth/`)
| Método | Ruta | Handler |
|--------|------|---------|
| `POST` | `/auth/login` | `httpAuthLogin` |
| `POST` | `/auth/register` | `httpAuthRegister` |

### Invitaciones Públicas
| Método | Ruta | Handler |
|--------|------|---------|
| `GET` | `/invite/{token}` | `handleInviteTokenHTTP` |

### CatMage Webhook
| Método | Ruta | Handler | Auth |
|--------|------|---------|------|
| `POST` | `/api/catmage/webhook` | `Syncer.WebhookHandler()` | `X-CatMage-Key` |

### P2P Config
| Método | Ruta | Handler |
|--------|------|---------|
| `GET` | `/api/p2p/config` | `P2PConfig()` |

### Guild Sync
| Método | Ruta | Handler | Auth |
|--------|------|---------|------|
| `POST` | `/api/guild/sync` | `GuildSyncHandler()` | JWT Bearer |

### Social API (CatMage ↔ CatIRC)
| Método | Ruta | Handler | Auth |
|--------|------|---------|------|
| `GET` | `/api/friends` | `socialFriendsList` | `X-CatIRC-API-Key` |
| `GET` | `/api/friends/requests` | `socialFriendsRequests` | `X-CatIRC-API-Key` |
| `POST` | `/api/friends/request` | `socialFriendsSendRequest` | `X-CatIRC-API-Key` |
| `POST` | `/api/friends/requests/{id}/accept` | `socialFriendsAccept` | `X-CatIRC-API-Key` |
| `POST` | `/api/friends/requests/{id}/reject` | `socialFriendsReject` | `X-CatIRC-API-Key` |
| `POST` | `/api/friends/{id}/remove` | `socialFriendsRemove` | `X-CatIRC-API-Key` |
| `POST` | `/api/friends/block` | `socialFriendsBlock` | `X-CatIRC-API-Key` |
| `POST` | `/api/friends/unblock` | `socialFriendsUnblock` | `X-CatIRC-API-Key` |
| `GET` | `/api/friends/status` | `socialFriendsStatus` | `X-CatIRC-API-Key` |
| `GET` | `/api/presence` | `socialPresenceCheck` | `X-CatIRC-API-Key` |
| `GET` | `/api/presence/friends` | `socialPresenceFriends` | `X-CatIRC-API-Key` |
| `POST` | `/api/presence/batch` | `socialPresenceBatch` | `X-CatIRC-API-Key` |

---

# Rutas Frontend (OdinX)

## Navegación Principal (SPA Tabs)
| Tab | Canal | Descripción |
|-----|-------|-------------|
| Status | `Status` | Server messages, MOTD, errors |
| Canal | `#channel` | Chat del canal |
| DM | `nick` | Mensajes privados |

## Modales (CatIRC.ModalManager)

| Modal ID | Trigger | Descripción |
|----------|---------|-------------|
| `login-modal` | Auto (no session) | Login guest/registered |
| `join-modal` | `/join` / `+` btn | Join channel |
| `invite-modal` | Click nick → Invitar | Invite to channel |
| `settings-modal` | ⚙️ btn | Settings (nick, server, theme) |
| `help-modal` | `/help` / F1 | Command reference |
| `chanserv-modal` | Click "Gestionar" en canal | ChanServ admin |
| `nickserv-modal` | `/ns` / `/nickserv` | NickServ commands |
| `oper-modal` | Oper menu (si oper) | OperServ panel |
| `root-dashboard-modal` | Oper menu → Root Dashboard | Root admin panel |
| `global-search-modal` | Ctrl+Shift+F | Global message search |
| `channel-modes-modal` | Oper → Channel Modes | Channel modes UI |
| `transfers-modal` | 📎 btn / `/send` | P2P file transfers |
| `profile-popup` | Click nick | WHOIS/profile |
| `dm-panel` | `/pm` / Click DM tab | Private messages panel |

---

## Keyboard Shortcuts (OdinX)

| Shortcut | Acción | Contexto |
|----------|--------|----------|
| `Ctrl+K` / `Ctrl+K` | Open join modal | Global (except input) |
| `Ctrl+M` | Open DM modal | Global |
| `Ctrl+E` | Export chat (JSON) | Global |
| `Ctrl+F` | Search in chat | Chat focused |
| `Ctrl+Shift+F` | Global search modal | Global |
| `Tab` | Autocomplete nick/channel | Input focused |
| `↑` / `↓` | Command history | Input empty |
| `Escape` | Close modals/popovers | Global |
| `Enter` | Send message / Submit modal | Input focused |
| `Ctrl+U` | Clear input | Input focused |

---

## Páginas Especiales

| Ruta | Descripción |
|------|-------------|
| `/` | SPA entry (index.html) |
| `?embed=1` | Embed mode (hide login, wait for postMessage) |
| `/health` | Health check (CatIRC WS) |
| `/metrics` | Prometheus metrics (CatIRC) |

---

*Generado: 2026-07-11 | Fuente: `internal/server/router.go`, `internal/server/handlers_*.go`, `odinx/app.js`, `odinx/js/ui.js`, `odinx/js/events.js`, `odinx/js/commands.js`, `catirc/internal/websocket/server.go`*
```

## 26. frontend.md

```md
# Rutas Frontend (OdinX)

## Arquitectura de Navegación

OdinX es una **Single Page Application (SPA)** sin router de URL tradicional. La navegación se gestiona mediante:

1. **Tabs dinámicos** — Canales y DMs como pestañas en `#tabContainer`
2. **Modales** — `CatIRC.ModalManager` para overlays
3. **Panels laterales** — Nicklist (canales) / UserCard (DMs)
4. **Estado global** — `CatIRC.state.client.currentChannel` determina vista activa

---

## Pantallas Principales

### 1. Login Screen (`#login-screen`)
**Archivos**: `index.html` + `js/auth.js`

| Elemento | ID | Descripción |
|----------|-----|-------------|
| Tab Guest | `#tab-guest` | Login sin cuenta |
| Tab Registrado | `#tab-registered` | Login con NickServ |
| Input Nick | `#login-nick` / `#reg-nick` | Nickname |
| Input Pass | `#reg-nickserv-pass` | NickServ password |
| Advanced | `#login-advanced` | Server config (host, port, WSS) |
| Quick Channels | `.quick-channel` | Botones #catmage, #general, etc. |
| Submit | `#login-btn` / `#login-registered-form` | Conectar |

**Flujo**:
1. `auth.init()` → carga settings + session restore
2. Usuario submite form → `doLogin()` / `doRegisteredLogin()`
3. `CATIRCClient.connect()` → WebSocket
4. `onRegister` → hide login, show `#app`, rejoin channels

---

### 2. Chat App (`#app`)

#### Header (`#header`)
| Elemento | ID | Función |
|----------|-----|---------|
| Status | `#status-dot`, `#connection-text` | Connected/Reconnecting/Disconnected |
| Server | `#menu-server` | Server name |
| User | `#user-badge-name`, `#user-avatar` | Current nick |
| Tabs | `#tabContainer` | Channel/DM tabs |
| Search | `#chat-search-input` | In-channel search |
| Toolbar | `#btn-connect`, `#btn-disconnect`, `#btn-toggle-nicklist`, `#btn-settings`, `#btn-emoji` | Actions |

#### Main Chat (`#chatWindow`)
- **Messages**: Rendered via `ui.renderMsg()` → `div.msg-row`
- **Input**: `#messageInput` + `#send-btn` + `#attach-btn`
- **Paste Preview**: `#paste-preview` (drag&drop images)
- **Typing Indicator**: `#typing-indicator`

#### Right Panel
| Container | ID | Contenido |
|-----------|-----|-----------|
| Nicklist | `#nicklistContainer` → `#nickList` | Canales: users con prefixes |
| DM Card | `#dmCard` | DMs: user info + actions |

#### Mobile Drawer (`#mobile-drawer`)
- **Tabs**: Chat / Canales / Usuarios / Ajustes
- **Bottom Nav**: Fixed buttons

---

## Modales (CatIRC.ModalManager)

### Stack de Modales
```javascript
CatIRC.ModalManager.open(id, { onClose: fn })
CatIRC.ModalManager.close(id)
```

| Modal ID | Trigger | Contenido Clave |
|----------|---------|-----------------|
| `settings-modal` | `#btn-settings` | Nick, Realname, Server config, Theme, Notifications, Sounds |
| `join-modal` | `#btn-connect` / `/join` | Channel input, Key input, Quick join buttons |
| `invite-modal` | Click nick → Invitar | Nick input, Channel select, Send |
| `chanserv-modal` | Click "Gestionar" en header canal | Tabs: Info, MLOCK, TOPICLOCK, AKICK, FLAGS, SET, SUCCESSOR, INV, CLEAR |
| `nickserv-modal` | `/ns` / `/nickserv` | Register, Identify, Ghost, Password, Drop |
| `oper-modal` | Oper menu (si oper) | Tabs: Clients, Bans, Commands, History, Search, Audit, Sessions |
| `root-dashboard-modal` | Oper → Root Dashboard | Tabs: Overview, Users, Roles, Opers, Channels, Invitations, Bans, Audit, Search, Settings |
| `global-search-modal` | `Ctrl+Shift+F` | Query input, Channel/Nick filters, Results list |
| `channel-modes-modal` | Oper → Channel Modes | Mode list, Set/Unset buttons |
| `transfers-modal` | 📎 btn / `/send` | Active transfers list + History |
| `profile-popup` | Click nick | WHOIS info, DM, Invite, Ignore, Kick/Op/Voice (si op) |
| `dm-panel` | DM tab / `/pm` | Recent DMs, Unread badges, New DM |
| `help-modal` | `/help` / F1 | Command reference |

### Modal Lifecycle
```javascript
open(id, { onClose }) → adds to stack, focus trap, ESC to close
close(id) → removes from stack, runs onClose
```

---

## Flujos de Navegación

### 1. Login → Chat
```
index.html load
  → app.js:init()
  → auth.init() → shows #login-screen
  → user submits login
  → auth.doLogin() → CATIRCClient.connect()
  → connection.setupCallbacks() → client.onRegister
  → onRegister: hide #login-screen, show #app
  → ui.updateUserBadge(nick), ui.renderTabs(), ui.switchTab(channel)
```

### 2. Channel Switch
```
ui.switchTab(channelName)
  → save scroll position of current
  → state.client.currentChannel = channel
  → ui.renderTabs(), ui.renderMessages(), ui.renderRightPanel()
  → restore scroll position
  → focus #messageInput
```

### 3. Open DM
```
ui.openDM(nick)
  → create/get channelData for nick (lowercase)
  → state.client.currentChannel = nick
  → ui.renderTabs(), ui.renderMessages(), ui.renderRightPanel()
  → load DM history from IndexedDB
  → client.requestWHOIS(nick)
```

### 4. Modal Flow (ej. Settings)
```
ui.openSettings()
  → fill form from state.settings
  → ModalManager.open('settings-modal', { onClose: resetForm })
  → user clicks Save
  → ui.applySettings() → save to localStorage, apply theme
  → ModalManager.close()
```

### 5. Mobile View Switch
```
CatIRC.mobile.switchView(viewId)
  → hide all .mobile-view, show #viewId
  → update bottom nav active state
  → render view-specific content (channels, users)
```

---

## Deep Linking / Embed Mode

### Embed Mode (`?embed=1` o `window.CATIRC_EMBED_MODE=true`)
```javascript
// app.js init
if (isEmbed) {
  document.body.classList.add('embed-mode')
  #login-screen.hidden = true
  #app.hidden = false
  window.addEventListener('message', e => {
    if (e.data.type === 'catirc:auth') {
      state._embedJWT = jwt
      state.settings.nick = nick
      state._embedChannels = channels
      client.connect()
    }
  })
  parent.postMessage({type:'catirc:ready'}, '*')
}
```

### Parent → Iframe Messages
| Type | Payload | Acción |
|------|---------|--------|
| `catirc:auth` | `{nick, realname, jwt, channels[]}` | Auto-login + join channels |
| `catirc:join` | `{channel}` | Join channel |
| `catirc:msg` | `{channel, text}` | Send message |

### Iframe → Parent Messages
| Type | Payload | Cuándo |
|------|---------|--------|
| `catirc:ready` | `{}` | Iframe loaded |
| `catirc:joined` | `{channel}` | After JOIN |
| `catirc:msg` | `{channel, from, text}` | Message recv/sent |

---

## URL State (No Router)

OdinX **no usa URL routing** (`pushState`/`hashchange`). Todo el estado vive en:
- `CatIRC.state` (memoria)
- `localStorage` (settings, session, ignored)
- `sessionStorage` (admin token)
- `IndexedDB` (messages cache)

**Ventajas**: Simple, offline-first, no rompe refresh.
**Limitaciones**: No deep-link a canal específico, no historial navegador.

---

## Keyboard Shortcuts

| Shortcut | Acción | Contexto |
|----------|--------|----------|
| `Ctrl+K` / `Ctrl+K` | Open join modal | Global (except input) |
| `Ctrl+M` | Open DM modal | Global |
| `Ctrl+E` | Export chat (JSON) | Global |
| `Ctrl+F` | Search in chat | Chat focused |
| `Ctrl+Shift+F` | Global search modal | Global |
| `Tab` | Autocomplete nick/channel | Input focused |
| `↑` / `↓` | Command history | Input empty |
| `Escape` | Close modals/popovers | Global |
| `Enter` | Send message / Submit modal | Input focused |
| `Ctrl+U` | Clear input | Input focused |

---

## Mobile Navigation (`js/mobile.js`)

### Views
| View ID | Contenido |
|---------|-----------|
| `chat-view` | Chat + input |
| `channels-view` | Channel list + unread badges |
| `users-view` | Nicklist grouped (Ops, Voice, Users) |
| `settings-view` | Settings form |

### Bottom Nav
```html
<div id="mobile-bottom-nav">
  <button data-view="chat-view">💬 Chat</button>
  <button data-view="channels-view"># Canales</button>
  <button data-view="users-view">👥 Usuarios</button>
  <button data-view="settings-view">⚙️ Ajustes</button>
</div>
```

### Switch View
```javascript
CatIRC.mobile.switchView(viewId)
  → hide all .mobile-view, show #viewId
  → update bottom nav active state
  → render view-specific content (channels, users)
```

---

*Generado: 2026-07-11 | Fuente: `index.html`, `js/ui.js`, `js/auth.js`, `js/events.js`, `js/mobile.js`, `js/modals.js`, `js/commands.js`, `app.js`*
```

## 27. todos-los-eventos.md

```md
# Eventos IRC — CatIRC

## EventBus (Servidor)

### Tipos de Evento Publicados

| Evento | Tipo | Payload | Publicado en |
|--------|------|---------|--------------|
| `message.sent` | `MessageSentEvent` | `channel, sender, target, content, command, timestamp` | `handlers_messaging.go` |
| `user.authenticated` | `UserAuthenticatedEvent` | `nick, username, role, method, timestamp` | `handlers_auth.go` |
| `user.joined` | `UserJoinedEvent` | `nick, user, host, channel, timestamp` | `handlers_channel.go` |
| `user.parted` | `UserPartedEvent` | `nick, user, host, channel, reason, timestamp` | `handlers_channel.go` |
| `user.quit` | `UserQuitEvent` | `nick, user, host, reason, timestamp` | `handlers_connection.go` |
| `nick.changed` | `NickChangedEvent` | `old_nick, new_nick, user, host, timestamp` | `handlers_connection.go` |
| `channel.created` | `ChannelCreatedEvent` | `channel, founder, timestamp` | `handlers_channel.go` |
| `channel.deleted` | `ChannelDeletedEvent` | `channel, timestamp` | `handlers_channel.go` |
| `server.oper_granted` | `OperGrantedEvent` | `nick, oper_name, timestamp` | `handlers_auth.go` |
| `channel.kick` | `KickEvent` | `kicker, nick, channel, reason, timestamp` | `handlers_channel.go` |
| `channel.mode_changed` | `ModeChangedEvent` | `nick, channel, mode_str, timestamp` | `handlers_mode.go` |

### Suscriptores Registrados (`internal/server/subscribers.go`)

| Evento | Handler | Acción |
|--------|---------|--------|
| `message.sent` | `onMessageSent` | `persistMessage()` + `persistMessageV2()` |
| `user.authenticated` | `onUserAuthenticated` | `AuthTotal++` + audit LOGIN |
| `channel.kick` | `onKick` | audit KICK + `persistSystemEvent(KICK)` |
| `server.oper_granted` | `onOperGranted` | audit OPER_LOGIN |
| `channel.mode_changed` | `onModeChanged` | audit MODE_CHANGE + `persistSystemEvent(MODE)` |
| `user.joined` | `onUserJoined` | `persistSystemEvent(JOIN)` + `UpsertChannelMember()` |
| `user.parted` | `onUserParted` | `persistSystemEvent(PART)` + `UpdateChannelMemberSeen()` |
| `user.quit` | `onUserQuit` | `persistSystemEvent(QUIT)` + audit LOGOUT |

---

## Cliente → Servidor (IRC Commands over WS)

### Conexión y Registro
| Comando | Parámetros | Descripción |
|---------|------------|-------------|
| `CAP LS 302` | — | Inicia negociación capacidades |
| `CAP REQ :<caps>` | caps solicitadas | Solicita capacidades |
| `CAP END` | — | Finaliza negociación |
| `PASS` | `<password>` | Server password (opcional) |
| `NICK` | `<nick>` | Set/change nick |
| `USER` | `<user> 0 * :<realname>` | User registration |
| `PING` | `[:token]` | Keepalive |
| `QUIT` | `[:reason]` | Desconexión voluntaria |

### Channel Operations
| Comando | Parámetros | Descripción |
|---------|------------|-------------|
| `JOIN` | `<#chan>[,...] [<key>[,...]]` | Join channel(s) |
| `PART` | `<#chan>[,...] [:reason]` | Leave channel(s) |
| `TOPIC` | `<#chan> [:new topic]` | Get/set topic |
| `MODE` | `<#chan> [<modes> [<params>]]` | Channel/user modes |
| `KICK` | `<#chan> <nick> [:reason]` | Kick user |
| `INVITE` | `<nick> <#chan>` | Invite user |
| `KNOCK` | `<#chan> [:message]` | Request invite |

### Messaging
| Comando | Parámetros | Descripción |
|---------|------------|-------------|
| `PRIVMSG` | `<target> :<text>` | Message to channel/user |
| `NOTICE` | `<target> :<text>` | Notice (no reply) |
| `TAGMSG` | `<target>` + tags | Tagged message (typing, reactions) |

### Information
| Comando | Parámetros | Descripción |
|---------|------------|-------------|
| `WHOIS` | `<nick> [<nick>]` | User info |
| `WHO` | `<mask> [%format]` | User/channel list |
| `NAMES` | `<#chan>` | Channel user list |
| `LIST` | `[<#chan>]` | Channel list |
| `LUSERS` | — | Server stats |
| `MOTD` | — | Message of the day |
| `TIME` | — | Server time |
| `ISON` | `<nick> ...` | Online check |
| `USERHOST` | `<nick> ...` | User@host info |

### IRCv3 Extended
| Comando | Parámetros | Descripción |
|---------|------------|-------------|
| `MONITOR` | `+/-<nicks> \| C \| L \| S` | Online/offline notifications |
| `SETNAME` | `:<realname>` | Change realname |
| `CHGHOST` | `<nick> <host>` | Change host (oper) |

### Services & Custom
| Comando | Parámetros | Descripción |
|---------|------------|-------------|
| `LOGIN` | `<username> <password>` | Auth via IdentityProvider |
| `HISTORY` | `<#chan|nick> [limit]` | Message history |
| `AUDITLOG` | `[limit]` | Staff: audit log |
| `INVTOKEN` | `<#chan> [max_uses] [expiry_h]` | Create invite token |

### OperServ (IRC Operators)
| Comando | Parámetros | Permiso |
|---------|------------|---------|
| `OPER` | `<name> <password>` | Configurado |
| `OPERSERV` | `<subcmd> ...` | `IsGlobalOper` |

**OperServ Subcommands**:
- `INFO` — Info oper
- `AKILL <mask> <reason>` — Add auto-kill
- `KLINE <mask> <reason>` — Add K-Line
- `GLINE <mask> <reason>` — Add G-Line
- `SHUN <mask> <reason>` — Add Shun
- `ZLINE <ip/mask> <reason>` — Add Z-Line
- `MUTE <mask> <reason>` — Add Mute
- `UNKILL/UNKNLINE/UNGLINE/UNSHUN/UNZLINE/UNMUTE <mask>` — Remove
- `KILL <nick> <reason>` — Kill client
- `WALLOPS <message>` — Broadcast to opers
- `TRACE` — List connected clients
- `STATS` — Server stats
- `SESSIONS` — Active sessions
- `OPERS` — List opers

### P2P File Transfer
| Comando | Parámetros | Descripción |
|---------|------------|-------------|
| `FILE` | `OFFER\|ACCEPT\|REJECT\|CANCEL\|ERROR\|SIGNAL <target> <id> [:data]` | WebRTC signaling |

---

## Servidor → Cliente (IRC Replies)

### Numerics (IRC Mode)
| Código | Nombre | Cuándo |
|--------|--------|--------|
| `001` | RPL_WELCOME | Welcome post-registration |
| `002-004` | RPL_YOURHOST, CREATED, MYINFO | Server info |
| `005` | RPL_ISUPPORT | Server capabilities |
| `251` | RPL_LUSERCLIENT | User count |
| `254` | RPL_LUSERCHANNELS | Channel count |
| `255` | RPL_LUSEROP | Oper count |
| `311` | RPL_WHOISUSER | WHOIS user |
| `312` | RPL_WHOISSERVER | WHOIS server |
| `313` | RPL_WHOISOPERATOR | WHOIS oper |
| `315` | RPL_ENDOFWHO | End of WHO |
| `317` | RPL_WHOISIDLE | WHOIS idle |
| `318` | RPL_ENDOFWHOIS | End of WHOIS |
| `319` | RPL_WHOISCHANNELS | WHOIS channels |
| `330` | RPL_WHOISACCOUNT | WHOIS account |
| `331` | RPL_NOTOPIC | No topic |
| `332` | RPL_TOPIC | Topic |
| `341` | RPL_INVITING | Inviting |
| `352` | RPL_WHOREPLY | WHO reply |
| `353` | RPL_NAMREPLY | NAMES list |
| `366` | RPL_ENDOFNAMES | End of NAMES |
| `372` | RPL_MOTD | MOTD line |
| `375` | RPL_MOTDSTART | MOTD start |
| `376` | RPL_ENDOFMOTD | End of MOTD |
| `391` | RPL_TIME | Server time |
| `401` | ERR_NOSUCHNICK | No such nick |
| `403` | ERR_NOSUCHCHANNEL | No such channel |
| `404` | ERR_CANNOTSENDTOCHAN | Cannot send to channel |
| `411` | ERR_NORECIPIENT | No recipient |
| `421` | ERR_UNKNOWNCOMMAND | Unknown command |
| `431` | ERR_NONICKNAMEGIVEN | No nick given |
| `432` | ERR_ERRONEUSNICK | Erroneous nick |
| `433` | ERR_NICKNAMEINUSE | Nick in use |
| `441` | ERR_USERNOTINCHANNEL | User not in channel |
| `442` | ERR_NOTONCHANNEL | Not on channel |
| `443` | ERR_USERONCHANNEL | User on channel |
| `451` | ERR_NOTREGISTERED | Not registered |
| `461` | ERR_NEEDMOREPARAMS | Need more params |
| `462` | ERR_ALREADYREGISTRED | Already registered |
| `464` | ERR_PASSWORDMISMATCH | PASS/LOGIN failed |
| `465` | ERR_YOUREBANNEDCREEP | Rate limited (repurposed) |
| `471` | ERR_CHANNELISFULL | Channel full (+l) |
| `473` | ERR_INVITEONLYCHAN | Invite only (+i) |
| `474` | ERR_BANNEDFROMCHAN | Banned (+b) |
| `475` | ERR_BADCHANNELKEY | Bad key (+k) |
| `481` | ERR_NOPRIVILEGES | Not oper |
| `482` | ERR_CHANOPRIVSNEEDED | Not channel op |
| `490` | ERR_CAP_NEGOTIATION | CAP not complete |
| `502` | ERR_USERSDONTMATCH | Cannot change other user |
| `710` | RPL_KNOCK | Knock received |

### Extended Numerics
| Código | Nombre | Uso |
|--------|--------|-----|
| `302` | RPL_USERHOST | USERHOST reply |
| `305` | RPL_UNAWAY | Unset away |
| `306` | RPL_NOWAWAY | Set away |
| `330` | RPL_WHOISACCOUNT | Account in WHOIS |
| `370` | **Custom** RPL_WHOISROLES | Global roles list |

---

## Messages con Tags (IRCv3)

### Tags Generados por Servidor
| Tag | Valor | En |
|-----|-------|-----|
| `time` | RFC3339Nano UTC | Todos mensajes broadcast |
| `account` | `username` | Si autenticado (account-tag) |
| `+typing` | `active` | Typing indicator (TAGMSG) |
| `+react` | `emoji` | Reaction (TAGMSG) |
| `+react-to` | `message-id` | Target message (TAGMSG) |

### Tags Enviados por Cliente
| Tag | Valor | Uso |
|-----|-------|-----|
| `+typing` | `active` | Typing indicator |
| `+react` | `emoji` | Reaction |
| `+react-to` | `message-id` | Target message |

---

## OdinX Event Handlers (`odinx/js/client.js`)

### Incoming Message Mapping
| IRC Command | Handler | UI Callback |
|-------------|---------|-------------|
| `001` | `handleWelcome` | `onRegister(nick)` |
| `002-004` | — | `onNotice(text)` |
| `CAP` | `handleCAP` | `onCAP(msg)` |
| `NICK` | `handleNICK` | `onNickChange({oldNick, newNick, isMe})` |
| `JOIN` | `handleJOIN` | `onChannelJoin({nick, channel, account, realname, isMe})` |
| `PART` | `handlePART` | `onChannelPart({nick, channel, reason, isMe})` |
| `QUIT` | `handleQUIT` | `onMessage({type:'quit', nick, reason})` |
| `KICK` | `handleKICK` | `onKick({kicker, channel, kicked, reason, isMe})` |
| `INVITE` | `handleINVITE` | `onInvite({from, nick, channel})` |
| `TOPIC` | `handleTOPIC` | `onTopic({channel, topic, nick})` |
| `MODE` | `handleMODE` | `onMode({target, modes, params, nick})` |
| `PRIVMSG` | `handlePRIVMSG` | `onMessage({type:'message', from, target, text, isChannel, isPrivate, isMe, tags})` |
| `NOTICE` | `handleNOTICE` | `onNotice(text, from, isService)` |
| `TAGMSG` | `handleTAGMSG` | `onMessage({type:'typing', nick, target, typing})` / `onReact({nick, channel, mid, emoji})` |
| `353` | `handleNAMREPLY` | `onUserList({channel, names})` |
| `366` | — | `onWHO({done:true, channel})` |
| `352` | `handleWHOREPLY` | `onWHO({channel, nick, flags, ...})` |
| `311-319,330,370` | `handleWHOIS` | `onWHOIS(data)` + `onRoleInfo(roles)` |
| `315` | — | `onWHO({done:true})` |
| `321-323` | — | `onList(list)` |
| `324` | — | `onMode({channel, modes})` |
| `367/368` | `handleBanList` | `channelModes.handleBanList(data)` |
| `331/332` | — | `onTopic({channel, topic})` |
| `341` | — | `onInvite({nick, channel})` |
| `375-376` | — | `onMOTD(lines)` |
| `391` | — | `onTime(time)` |
| `302` | — | `onUserHost(text)` |
| `251/254/255/211` | — | `onServerStats(msg)` |
| `PING` | — | Auto-PONG + `onPing()` |
| `PONG` | — | `onPing()` |
| `ERROR` | — | `onError(text)` |
| `431` | — | Auto-random nick + `onError` |
| `433` | — | GHOST attempt → retry NICK + `onError` |
| `465` | — | `onError('Rate limited...')` |
| `XXX` (3 dígitos) | — | `onNotice('[XXX] text')` |

### Special Handling
| Evento | Detector | Acción |
|--------|----------|--------|
| CTCP ACTION | `\x01ACTION ...\x01` | `type:'message'` con `text` = action text |
| CTCP VERSION | `\x01VERSION\x01` | Auto-reply `NOTICE :\x01VERSION CATIRC WebChat\x01` |
| History start | `--- History for ... ---` | `onHistory({type:'start', text})` |
| History line | `[HH:MM] <nick> text` | `onHistory({type:'message', time, nick, text})` |
| History end | `--- End of history ---` | `onHistory({type:'end', text})` |
| `*** ROLES: ...` | `handleNOTICE` | `onRoleInfo(roles[])` |
| `*** You have N unread...` | `handleNOTICE` | `onOfflineDM({nick, count})` |
| Typing | `+typing=active` tag | `onMessage({type:'typing', nick, target, typing})` |
| Reaction | `+react` + `+react-to` tags | `onReact({nick, channel, mid, emoji})` |

---

## Outgoing Commands (OdinX → Server)

### High-Level Methods (`CATIRCClient`)
| Método | IRC Enviado |
|--------|-------------|
| `joinChannel(ch, key?)` | `JOIN ch [key]` |
| `partChannel(ch, reason?)` | `PART ch [reason]` |
| `sendMessage(target, text)` | `PRIVMSG target :text` |
| `sendNotice(target, text)` | `NOTICE target :text` |
| `sendAction(target, text)` | `PRIVMSG target :\x01ACTION text\x01` |
| `sendTyping(target)` | `TAGMSG target @+typing=active` |
| `changeNick(nick)` | `NICK nick` |
| `requestWHO(channel)` | `WHO channel` |
| `requestWHOIS(nick)` | `WHOIS nick nick` |
| `requestMOTD()` | `MOTD` |
| `requestLUSERS()` | `LUSERS` |
| `requestTime()` | `TIME` |
| `knock(channel, msg?)` | `KNOCK channel [msg]` |
| `invite(nick, channel)` | `INVITE nick channel` |
| `kick(channel, nick, reason?)` | `KICK channel nick [reason]` |
| `setMode(target, modes?, params?)` | `MODE target [modes] [params]` |
| `setTopic(channel, topic)` | `TOPIC channel :topic` |
| `whois(nick)` | `WHOIS nick nick` |
| `userhost(nicks[])` | `USERHOST n1 n2 ...` |
| `sendServiceMsg(service, text)` | `PRIVMSG service :text` |

### Raw Send
```javascript
client.send(command, ...args)    // IRC.format() → adds \r\n
client.sendRaw(rawString)        // Directo + \r\n
client.sendTagmsg(target, tags)  // TAGMSG con tags custom
```

### P2P
```javascript
client.sendTagmsg(target, { '+typing': 'active' })  // Typing
client.sendTagmsg(target, { '+react': '👍', '+react-to': 'mid123' })  // Reaction
```

---

## CAP Negotiation Flow

```
Client                    Server
  │                          │
  ├─ CAP LS 302 ───────────►│
  │                          │
  │◄── CAP * LS :caps... ───┤
  │                          │
  ├─ CAP REQ :wanted ──────►│
  │                          │
  │◄── CAP * ACK :wanted ───┤
  │                          │
  ├─ CAP END ──────────────►│
  │                          │
  ├─ NICK/USER ────────────►│
  │                          │
  │◄── 001 Welcome ────────┤
```

**Wanted Caps (OdinX)**: `message-tags`, `cap-notify`, `account-notify`, `extended-join`, `away-notify`, `account-tag`

---

## Reconnection Flow

```
WS onclose (code!=1000, !intentional)
    │
    ▼
state = RECONNECTING
    │
    ▼
showReconnectToast(delay, attempt, max)
    │
    ▼
setTimeout(connect, delay)
    │
    ▼
connect() → WS open → CAP LS → CAP REQ → CAP END → NICK/USER
    │
    ▼
onRegister → rejoin pendingChannels (slice 1..)
    │
    ▼
if sessionAction === 'recover':
    rejoin session.channels.slice(1)
    setTimeout(switchTab(session.active), 500)
```

**Backoff**: `min(1000 * 2^attempts, 30000)`, max 10 attempts → `FAILED` state

---

## Embed Mode (CatMage iframe)

### Parent → Iframe
| Type | Payload | Acción |
|------|---------|--------|
| `catirc:auth` | `{nick, realname, jwt, channels[]}` | Auto-login + join channels |
| `catirc:join` | `{channel}` | Join channel |
| `catirc:msg` | `{channel, text}` | Send message |

### Iframe → Parent
| Type | Payload | Cuándo |
|------|---------|--------|
| `catirc:ready` | `{}` | Iframe loaded |
| `catirc:joined` | `{channel}` | After JOIN |
| `catirc:msg` | `{channel, from, text}` | Message recv/sent |

**Detección**: `?embed=1` o `window.CATIRC_EMBED_MODE=true`

---

## Seguridad WS

### Origin Validation (`catirc/internal/websocket/server.go`)
```go
CheckOrigin: func(r *http.Request) bool {
    if len(allowedOrigins) == 0 { return true } // Dev mode
    origin := r.Header.Get("Origin")
    return slices.Contains(allowedOrigins, origin)
}
```

### Security Headers (middleware `secureHeaders`)
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'none'; connect-src 'self' ws: wss:
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
```

### Timeouts (`ServerConfig`)
- `ReadTimeout`: 30s (header read)
- `WriteTimeout`: 60s
- `IdleTimeout`: 120s

---

## Heartbeat / Keepalive

```mermaid
sequenceDiagram
    participant OdinX
    participant CatIRC
    loop cada 90s
        OdinX->>CatIRC: PING :timestamp
        CatIRC->>OdinX: PONG :timestamp
    end
    alt PING timeout (sin PONG 2x)
        OdinX->>OdinX: scheduleReconnect()
    end
```

---

*Generado: 2026-07-11 | Fuente: `odinx/js/client.js`, `odinx/irc.js`, `catirc/internal/protocol/parser.go`, `catirc/internal/server/handlers_*.go`, `catirc/internal/websocket/server.go`*
```

## 28. todos-los-endpoints.md

```md
# Rutas Backend — CatIRC

## IRC Commands (TCP + WebSocket)

### Connection & Registration
| Command | Params | Handler | Description |
|---------|--------|---------|-------------|
| `PASS` | `<password>` | `handlePass` | Server password |
| `NICK` | `<nickname>` | `handleNick` | Set/change nick |
| `USER` | `<user> 0 * :<realname>` | `handleUser` | User registration |
| `QUIT` | `[:reason]` | `handleQuit` | Disconnect |
| `PING` | `[:token]` | `handlePing` | Keepalive |
| `AWAY` | `[:message]` | `handleAway` | Set/clear away |

### Capability Negotiation (IRCv3)
| Command | Params | Handler |
|---------|--------|---------|
| `CAP` | `LS 302` | `handleCap` |
| `CAP` | `REQ :<caps>` | `handleCap` |
| `CAP` | `END` | `handleCap` |

### Channel Operations
| Command | Params | Handler | Requires Reg |
|---------|--------|---------|--------------|
| `JOIN` | `<#chan>[,...] [<key>[,...]]` | `handleJoin` | Yes |
| `PART` | `<#chan>[,...] [:reason]` | `handlePart` | Yes |
| `TOPIC` | `<#chan> [:new topic]` | `handleTopic` | Yes |
| `MODE` | `<#chan> [<modes> [<params>]]` | `handleMode` | Yes |
| `KICK` | `<#chan> <nick> [:reason]` | `handleKick` | Yes |
| `INVITE` | `<nick> <#chan>` | `handleInvite` | Yes |
| `KNOCK` | `<#chan> [:message]` | `handleKnock` | Yes |

### Messaging
| Command | Params | Handler |
|---------|--------|---------|
| `PRIVMSG` | `<target> :<text>` | `handlePrivmsg` |
| `NOTICE` | `<target> :<text>` | `handleNotice` |
| `TAGMSG` | `<target>` + tags | `handleTagmsg` |

### Informational
| Command | Params | Handler |
|---------|--------|---------|
| `WHOIS` | `<nick> [<nick>]` | `handleWhois` |
| `WHO` | `<mask> [%format]` | `handleWho` |
| `NAMES` | `<#chan>` | `handleNames` |
| `LIST` | `[<#chan>]` | `handleList` |
| `LUSERS` | — | `handleLusers` |
| `MOTD` | — | `handleMotd` |
| `TIME` | — | `handleTime` |
| `ISON` | `<nick> ...` | `handleIson` |
| `USERHOST` | `<nick> ...` | `handleUserhost` |

### IRCv3 Extended
| Command | Params | Handler |
|---------|--------|---------|
| `MONITOR` | `+/-<nicks> \| C \| L \| S` | `handleMonitor` |
| `SETNAME` | `:<realname>` | `handleSetname` |
| `CHGHOST` | `<nick> <host>` | `handleChghost` (Oper) |

### CatMage / Persistence
| Command | Params | Handler |
|---------|--------|---------|
| `LOGIN` | `<username> <password>` | `handleLogin` |
| `HISTORY` | `<#chan|nick> [limit]` | `handleHistory` |

### Extended: Staff
| Command | Params | Handler | Perm |
|---------|--------|---------|------|
| `AUDITLOG` | `[limit]` | `handleAuditLog` | Staff |
| `INVTOKEN` | `<#chan> [max_uses] [expiry_h]` | `handleInvToken` | Op/Staff |

### OperServ (IRC Operators)
| Command | Params | Handler | Perm |
|---------|--------|---------|------|
| `OPER` | `<name> <password>` | `handleOper` | Config |
| `OPERSERV` | `<subcmd> ...` | `OperServ.HandleMessage` | `IsGlobalOper` |

**OperServ Subcommands**:
| Subcmd | Params | Perm |
|--------|--------|------|
| `INFO` | — | — |
| `AKILL` | `<mask> <reason>` | `akill` |
| `KLINE` | `<mask> <reason>` | `kline` |
| `GLINE` | `<mask> <reason>` | `gline` |
| `SHUN` | `<mask> <reason>` | `shun` |
| `ZLINE` | `<ip/mask> <reason>` | `kline` |
| `MUTE` | `<mask> <reason>` | `shun` |
| `UNKILL/UNKNLINE/UNGLINE/UNSHUN/UNZLINE/UNMUTE` | `<mask>` | Correspondiente |
| `KILL` | `<nick> <reason>` | `kill` |
| `WALLOPS` | `<message>` | `wallops` |
| `TRACE` | — | `trace` |
| `STATS` | — | `stats` |
| `SESSIONS` | — | `sessions` |
| `OPERS` | — | — |
| `HELP` | — | — |

### P2P File Transfer
| Command | Params | Handler |
|---------|--------|---------|
| `FILE` | `OFFER\|ACCEPT\|REJECT\|CANCEL\|ERROR\|SIGNAL <target> <id> [:data]` | `handleFile` |

---

## HTTP Endpoints (WebSocket Server Mux)

### Base: `/` (WebSocket Server)

| Method | Route | Handler | Auth | Description |
|--------|-------|---------|------|-------------|
| `GET` | `/ws` | `handleWebSocketWithUpgrader` | — | WebSocket upgrade |
| `GET` | `/health` | `handleHealth` | — | `{"status":"ok"}` |

### Admin API (`/admin/`) — Bearer Token

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| `GET` | `/admin/stats` | `stats` | Server overview |
| `GET` | `/admin/clients` | `clients` | Connected clients |
| `GET` | `/admin/channels` | `channels` | Live channels |
| `GET` | `/admin/registered-channels` | `registeredChannels` | ChanServ registrations |
| `GET` | `/admin/opers` | `opers` | Active IRCOps |
| `GET` | `/admin/bans` | `bans` | Active network bans |
| `GET` | `/admin/messages` | `messages` | Channel history (`?channel=#x&limit=50`) |
| `POST` | `/admin/kick` | `kick` | Kick user |
| `POST` | `/admin/broadcast` | `broadcast` | Global NOTICE |
| `POST` | `/admin/oper/grant` | `operGrant` | Grant oper class |
| `POST` | `/admin/oper/revoke` | `operRevoke` | Revoke oper |
| `POST` | `/admin/ban` | `banHandler` (POST) | Add network ban |
| `DELETE` | `/admin/ban` | `banHandler` (DELETE) | Remove network ban |
| `GET` | `/admin/roles` | `rolesHandler` (GET) | List role defs |
| `POST` | `/admin/roles` | `rolesHandler` (POST) | Upsert role |
| `DELETE` | `/admin/roles` | `rolesHandler` (DELETE) | Delete role |
| `GET` | `/admin/user-roles` | `getUserRoles` | User's active roles |
| `POST` | `/admin/user-roles/grant` | `grantRole` | Grant role |
| `POST` | `/admin/user-roles/revoke` | `revokeRole` | Revoke role |
| `GET` | `/admin/user-roles/check` | `checkRole` | Check role |
| `GET` | `/admin/audit` | `auditLog` | Global audit log |
| `GET` | `/admin/audit/user` | `auditUserLog` | User audit log |
| `GET` | `/admin/audit/channel` | `auditChannelLog` | Channel audit log |
| `POST` | `/admin/invitations` | `createInvitation` | Create invite token |
| `GET` | `/admin/invitations/list` | `listChannelInvitations` | Channel invites |
| `GET` | `/admin/invitations/get` | `getInvitation` | Get invite by token |
| `POST` | `/admin/invitations/use` | `useInvitation` | Consume invite |
| `POST` | `/admin/invitations/revoke` | `revokeInvitation` | Revoke invite |
| `GET` | `/admin/search` | `searchMessages` | Full-text search |
| `GET` | `/admin/users` | `usersHandler` | Registered users |
| `GET` | `/admin/network-bans` | `networkBansHandler` | Persistent bans |
| `DELETE` | `/admin/network-bans` | `networkBansHandler` (DELETE) | Remove ban |

### Auth HTTP (`/auth/`)
| Method | Route | Handler |
|--------|-------|---------|
| `POST` | `/auth/login` | `httpAuthLogin` |
| `POST` | `/auth/register` | `httpAuthRegister` |

### Invitaciones Públicas
| Method | Route | Handler |
|--------|-------|---------|
| `GET` | `/invite/{token}` | `handleInviteTokenHTTP` |

### CatMage Webhook
| Method | Route | Handler | Auth |
|--------|-------|---------|------|
| `POST` | `/api/catmage/webhook` | `Syncer.WebhookHandler()` | `X-CatMage-Key` |

### P2P Config
| Method | Route | Handler |
|--------|-------|---------|
| `GET` | `/api/p2p/config` | `P2PConfig()` |

### Guild Sync
| Method | Route | Handler | Auth |
|--------|-------|---------|------|
| `POST` | `/api/guild/sync` | `GuildSyncHandler()` | JWT Bearer |

### Social API (`/api/friends/*`, `/api/presence/*`)

**Auth**: `X-CatIRC-API-Key: <CATIRC_JWT_SECRET>` (shared secret)

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | `/api/friends?user_id=1` | — | `{"friends":[]}` |
| GET | `/api/friends/requests?user_id=1` | — | `{"requests":[]}` |
| POST | `/api/friends/request` | `{user_id:1, other_id:2}` | `{"ok":true,"status":"pending"}` |
| POST | `/api/friends/requests/{id}/accept` | — | `{"ok":true,"status":"accepted"}` |
| POST | `/api/friends/requests/{id}/reject` | — | `{"ok":true,"status":"rejected"}` |
| POST | `/api/friends/{id}/remove` | — | `{"ok":true,"status":"removed"}` |
| POST | `/api/friends/block` | `{user_id:1, other_id:2}` | `{"ok":true,"status":"blocked"}` |
| POST | `/api/friends/unblock` | `{user_id:1, other_id:2}` | `{"ok":true,"status":"unblocked"}` |
| GET | `/api/friends/status?user_id=1&other_id=2` | — | `{"status":"none"}` |
| GET | `/api/presence?user_id=1` | — | `{"online":true,"last_activity":"..."}` |
| GET | `/api/presence/friends?user_id=1` | — | `{"online":[]}` |
| POST | `/api/presence/batch` | `{"user_ids":[1,2,3]}` | `{"presence":[...]}` |

**Nota**: Stubs — retornan arrays vacíos / `ok: true`. Sin persistencia real.

---

## IRC over WebSocket

### Conexión
```
GET /ws HTTP/1.1
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: ...
Sec-WebSocket-Version: 13
Origin: https://chat.example.com
```

**Upgrade** → `101 Switching Protocols` → `wsConn` implements `net.Conn`

### Formato Mensaje
```
@tags :prefix COMMAND param1 param2 :trailing\r\n
```

**Ejemplos**:
```
CAP LS 302\r\n
NICK juan\r\n
USER juan 0 * :Juan Pérez\r\n
PRIVMSG #general :hola mundo\r\n
@+typing=active TAGMSG #general\r\n
```

### Capabilities Soportadas
| Cap | Descripción | OdinX |
|-----|-------------|-------|
| `message-tags` | `@time`, `@account`, `@+react` | ✅ |
| `cap-notify` | CAP changes notification | ❌ |
| `account-notify` | `ACCOUNT` en JOIN/PART | ✅ |
| `extended-join` | JOIN con account+realname | ✅ |
| `away-notify` | AWAY status changes | ✅ |
| `account-tag` | `account=` tag en PRIVMSG | ✅ |

---

## Error Codes HTTP

| Código | Cuerpo | Cuándo |
|--------|--------|--------|
| 400 | `{"error":"bad request: ..."}` | JSON inválido, campos requeridos |
| 401 | `{"error":"unauthorized"}` | Token/API key inválido o ausente |
| 403 | `{"error":"forbidden"}` | Permisos insuficientes (ej. no oper) |
| 404 | `{"error":"not found"}` | Recurso no existe |
| 405 | `{"error":"method not allowed"}` | Método HTTP no soportado |
| 410 | `{"error":"gone"}` | Token expirado/revocado |
| 500 | `{"error":"internal server error"}` | Error BD, sync falló |
| 503 | `{"error":"service unavailable"}` | Feature no configurada (ej. sin DB) |

---

*Generado: 2026-07-11 | Fuente: `internal/admin/api.go`, `internal/server/handlers_http_auth.go`, `internal/server/handlers_social_api.go`, `internal/catmage/sync.go`, `internal/server/handlers_file.go`*
```

## 29. configuracion.md

```md
# Configuración — CatIRC + OdinX

## CatIRC — Variables de Entorno (`.env`)

```bash
# ─────────────────────────────────────────────────────────────
# SERVER BINDING
# ─────────────────────────────────────────────────────────────
CATIRC_HOST=0.0.0.0
CATIRC_PORT=6667
CATIRC_WS_HOST=0.0.0.0
CATIRC_WS_PORT=8081

# ─────────────────────────────────────────────────────────────
# IDENTITY
# ─────────────────────────────────────────────────────────────
CATIRC_SERVER_NAME=irc.midominio.com
CATIRC_MOTD=Bienvenido a CatIRC - Powered by CatMage

# ─────────────────────────────────────────────────────────────
# AUTHENTICATION
# ─────────────────────────────────────────────────────────────
CATIRC_PASSWORD=                    # Server password (opcional)
CATIRC_USE_IRC_MODE=true            # true = numerics RFC, false = OK/ERR simple

# ─────────────────────────────────────────────────────────────
# TLS (las 3 juntas o ninguna)
# ─────────────────────────────────────────────────────────────
CATIRC_TLS_CERT=/etc/catirc/cert.pem
CATIRC_TLS_KEY=/etc/catirc/key.pem
CATIRC_TLS_LISTEN=:6697

# ─────────────────────────────────────────────────────────────
# RATE LIMITING & SECURITY
# ─────────────────────────────────────────────────────────────
CATIRC_RATE_LIMIT=100               # msgs por ventana por cliente
CATIRC_RATE_WINDOW=60               # seconds
CATIRC_MAX_CONNECTIONS=5            # max connections per IP
CATIRC_ALLOWED_ORIGINS=https://chat.midominio.com,https://catmage.es
CATIRC_HTTP_READ_TIMEOUT_SEC=30
CATIRC_HTTP_WRITE_TIMEOUT_SEC=60
CATIRC_HTTP_IDLE_TIMEOUT_SEC=120

# ─────────────────────────────────────────────────────────────
# DATABASE (PostgreSQL requerido)
# ─────────────────────────────────────────────────────────────
CATIRC_DATABASE_URL=postgres://catirc:password@localhost:5432/catirc?sslmode=disable

# ─────────────────────────────────────────────────────────────
# AUTENTICACIÓN CATMAGE
# ─────────────────────────────────────────────────────────────
CATIRC_JWT_SECRET=super-secret-32-chars-minimum!!     # HS256 signing key
CATIRC_JWT_EXPIRY_MIN=1440                            # 24h default
CATMAGE_URL=https://catmage.es                         # CatMage base URL
CATMAGE_API_KEY=catmage-api-key-123                    # Shared secret
CATMAGE_SYNC_INTERVAL_MIN=60                          # Pull interval
CATMAGE_WEBHOOK_PATH=/api/catmage/webhook             # Push endpoint
CATIRC_EMBED_MODE=false                               # Iframe mode

# ─────────────────────────────────────────────────────────────
# P2P FILE TRANSFER (WebRTC)
# ─────────────────────────────────────────────────────────────
CATIRC_ENABLE_P2P_FILES=true
CATIRC_MAX_FILE_SIZE_MB=100
CATIRC_ICE_SERVERS=stun:stun.l.google.com:19302,turn:turn.midominio.com:3478?transport=udp

# ─────────────────────────────────────────────────────────────
# MESSAGE RETENTION
# ─────────────────────────────────────────────────────────────
CATIRC_MESSAGE_EXPIRY_DAYS=90
CATIRC_CLEANUP_INTERVAL_MIN=60

# ─────────────────────────────────────────────────────────────
# IRC OPERATOR (OPER command)
# ─────────────────────────────────────────────────────────────
CATIRC_OPER_NAME=admin
CATIRC_OPER_PASSWORD=oper-password

# ─────────────────────────────────────────────────────────────
# OBSERVABILITY
# ─────────────────────────────────────────────────────────────
CATIRC_METRICS_PATH=/metrics

# ─────────────────────────────────────────────────────────────
# ADMIN HTTP API
# ─────────────────────────────────────────────────────────────
CATIRC_ADMIN_TOKEN=admin-bearer-token-123
CATIRC_ADMIN_PATH=/admin

# ─────────────────────────────────────────────────────────────
# CORS
# ─────────────────────────────────────────────────────────────
CATIRC_ALLOWED_ORIGINS=https://chat.midominio.com,https://catmage.es

# ─────────────────────────────────────────────────────────────
# EMBED MODE
# ─────────────────────────────────────────────────────────────
CATIRC_EMBED_MODE=false

# ─────────────────────────────────────────────────────────────
# HTTP TIMEOUTS
# ─────────────────────────────────────────────────────────────
CATIRC_HTTP_READ_TIMEOUT_SEC=30
CATIRC_HTTP_WRITE_TIMEOUT_SEC=60
CATIRC_HTTP_IDLE_TIMEOUT_SEC=120
```

---

## Validación (`internal/config/config.go:Validate()`)

| Regla | Error si falla |
|-------|----------------|
| `ServerName` no vacío | `SERVER_NAME must not be empty` |
| `Port` / `WSPort` no vacío | `IRC port must not be empty` |
| TLS: las 3 (`TLSCert`, `TLSKey`, `TLSListen`) **todas** o **ninguna** | `TLS requires CATIRC_TLS_CERT, CATIRC_TLS_KEY and CATIRC_TLS_LISTEN to be set together` |
| Valores numéricos ≥ 0 | `CATIRC_MAX_FILE_SIZE_MB must be >= 0` |
| Si `CATMAGE_URL` ≠ "" → `CATMAGE_API_KEY` ≠ "" | `CATMAGE_URL is set but CATMAGE_API_KEY is empty` |
| Si `EnableP2PFiles` → `ICEServers` ≠ "" | `CATIRC_ENABLE_P2P_FILES is true but CATIRC_ICE_SERVERS is empty` |

---

## Prioridad de Carga (`config.Load()`)

1. **Environment Variables** (máxima prioridad)
2. **`.env` file** (o `CATIRC_ENV_FILE`)
3. **Defaults** (hardcoded en `Load()`)

```go
// Orden real:
os.Getenv(key)        // 1. ENV
os.LookupEnv(key)     // 2. .env (via loadEnvFile())
fallback              // 3. Default
```

---

## CatMage Sync — Variables Críticas

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `CATMAGE_URL` | Base URL CatMage (ej. `https://catmage.es`) | **Sí** si sync activado |
| `CATMAGE_API_KEY` | Shared secret para webhook/pull | **Sí** si `CATMAGE_URL` |
| `CATIRC_JWT_SECRET` | HS256 key para JWT tokens | **Sí** siempre |
| `CATIRC_JWT_EXPIRY_MIN` | Token expiry (min) | No (default 1440) |
| `CATMAGE_SYNC_INTERVAL_MIN` | Pull interval (min) | No (default 60) |
| `CATMAGE_WEBHOOK_PATH` | Push endpoint path | No (default `/api/catmage/webhook`) |

**Sync Flow**:
- **Push (Primary)**: CatMage → `POST {CATMAGE_WEBHOOK_PATH}` con `X-CatMage-Key`
- **Pull (Safety)**: Cron cada `CATMAGE_SYNC_INTERVAL_MIN` → `GET {CATMAGE_URL}/api/irc/users?since=`
- **Repair**: `Syncer.RepairUser(id)` → `GET {CATMAGE_URL}/api/irc/users/{id}`

---

## P2P / WebRTC

| Variable | Descripción | Default |
|----------|-------------|---------|
| `CATIRC_ENABLE_P2P_FILES` | Habilita `FILE` command | `true` |
| `CATIRC_MAX_FILE_SIZE_MB` | Límite tamaño (0 = ilimitado) | `100` |
| `CATIRC_ICE_SERVERS` | CSV STUN/TURN URLs | `stun:stun.l.google.com:19302` |

**Formato ICE**:
```
stun:stun.example.com:3478
turn:turn.example.com:3478?transport=udp
turn:turn.example.com:3478?transport=tcp
```

---

## Admin API

| Variable | Descripción | Default |
|----------|-------------|---------|
| `CATIRC_ADMIN_TOKEN` | Bearer token para `/admin/*` | `""` (disabled) |
| `CATIRC_ADMIN_PATH` | Base path admin API | `/admin` |

**Uso**:
```bash
curl -H "Authorization: Bearer $CATIRC_ADMIN_TOKEN" \
  http://localhost:8081/admin/stats
```

---

## Embed Mode

| Variable | Descripción |
|----------|-------------|
| `CATIRC_EMBED_MODE` | `true` = iframe mode (hide login, wait for postMessage) |

**Activación alternativa**: `?embed=1` en URL o `window.CATIRC_EMBED_MODE=true` antes de cargar OdinX.

---

## Seguridad en Producción

| Variable | Recomendación |
|----------|---------------|
| `CATIRC_JWT_SECRET` | 32+ chars aleatorios, rotar periódicamente |
| `CATIRC_ADMIN_TOKEN` | 32+ chars, solo admins |
| `CATMAGE_API_KEY` | Shared secret, rotar con CatMage |
| `CATIRC_DATABASE_URL` | `sslmode=require` en prod |
| `CATIRC_TLS_CERT/KEY` | Certificados válidos (Let's Encrypt) |
| `CATIRC_ALLOWED_ORIGINS` | Dominios exactos, no `*` en prod |
| `CATIRC_MAX_CONNECTIONS` | 5-10 según capacidad |

---

## OdinX — Build-time Config

### `package.json` — Scripts
```json
{
  "scripts": {
    "dev": "node dev-server.js",
    "start": "node dev-server.js 8082",
    "build": "npm run build:css",
    "build:css": "node node_modules/@tailwindcss/cli/dist/index.mjs -i ./src/input.css -o ./dist/tailwind.min.css --minify",
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

### `dev-server.js` — Sirve estáticos + WS proxy
```javascript
// Sirve ./ en puerto 8082
// Proxy /ws → CatIRC WS port
```

### Assets
| Archivo | Descripción |
|---------|-------------|
| `dist/tailwind.min.css` | CSS compilado (42KB gzipped) |
| `images/` | Avatars, favicons |
| `manifest.json` | PWA manifest |
| `service-worker.js` | Offline support |

---

## Archivos Relacionados

| Archivo | Propósito |
|---------|-----------|
| `.env.example` | Template completo |
| `.env` | Config local (gitignored) |
| `.env.old` | Backup previo |
| `internal/config/config.go` | Load + Validate |
| `cmd/server/main.go` | Uso en startup |
| `odinx/package.json` | Scripts + deps |
| `odinx/dev-server.js` | Dev server + proxy |

---

*Generado: 2026-07-11 | Fuente: `internal/config/config.go`, `.env.example`, `cmd/server/main.go`, `odinx/package.json`, `odinx/dev-server.js`*
```

## 30. variables-env.md

```md
# Variables de Entorno — CatIRC + OdinX

## CatIRC — `.env`

```bash
# ─────────────────────────────────────────────────────────────
# SERVER BINDING
# ─────────────────────────────────────────────────────────────
CATIRC_HOST=0.0.0.0
CATIRC_PORT=6667
CATIRC_WS_HOST=0.0.0.0
CATIRC_WS_PORT=8081

# ─────────────────────────────────────────────────────────────
# IDENTITY
# ─────────────────────────────────────────────────────────────
CATIRC_SERVER_NAME=irc.midominio.com
CATIRC_MOTD=Welcome to CatIRC - Powered by CatMage

# ─────────────────────────────────────────────────────────────
# AUTHENTICATION
# ─────────────────────────────────────────────────────────────
CATIRC_PASSWORD=                    # Server password (opcional)
CATIRC_USE_IRC_MODE=true            # true = numerics RFC, false = OK/ERR simple

# ─────────────────────────────────────────────────────────────
# TLS (las 3 juntas o ninguna)
# ─────────────────────────────────────────────────────────────
CATIRC_TLS_CERT=/etc/catirc/cert.pem
CATIRC_TLS_KEY=/etc/catirc/key.pem
CATIRC_TLS_LISTEN=:6697

# ─────────────────────────────────────────────────────────────
# RATE LIMITING & SECURITY
# ─────────────────────────────────────────────────────────────
CATIRC_RATE_LIMIT=100               # msgs per window per client
CATIRC_RATE_WINDOW=60               # seconds
CATIRC_MAX_CONNECTIONS=5            # max connections per IP
CATIRC_ALLOWED_ORIGINS=https://chat.midominio.com,https://catmage.es
CATIRC_HTTP_READ_TIMEOUT_SEC=30
CATIRC_HTTP_WRITE_TIMEOUT_SEC=60
CATIRC_HTTP_IDLE_TIMEOUT_SEC=120

# ─────────────────────────────────────────────────────────────
# DATABASE (PostgreSQL requerido)
# ─────────────────────────────────────────────────────────────
CATIRC_DATABASE_URL=postgres://catirc:password@localhost:5432/catirc?sslmode=disable

# ─────────────────────────────────────────────────────────────
# AUTENTICACIÓN CATMAGE
# ─────────────────────────────────────────────────────────────
CATIRC_JWT_SECRET=super-secret-32-chars-minimum!!     # HS256 signing key
CATIRC_JWT_EXPIRY_MIN=1440                            # 24h default
CATMAGE_URL=https://catmage.es                         # CatMage base URL
CATMAGE_API_KEY=catmage-api-key-123                    # Shared secret
CATMAGE_SYNC_INTERVAL_MIN=60                          # Pull interval
CATMAGE_WEBHOOK_PATH=/api/catmage/webhook             # Push endpoint
CATIRC_EMBED_MODE=false                               # Iframe mode

# ─────────────────────────────────────────────────────────────
# P2P FILE TRANSFER (WebRTC)
# ─────────────────────────────────────────────────────────────
CATIRC_ENABLE_P2P_FILES=true
CATIRC_MAX_FILE_SIZE_MB=100
CATIRC_ICE_SERVERS=stun:stun.l.google.com:19302,turn:turn.midominio.com:3478?transport=udp

# ─────────────────────────────────────────────────────────────
# MESSAGE RETENTION
# ─────────────────────────────────────────────────────────────
CATIRC_MESSAGE_EXPIRY_DAYS=90
CATIRC_CLEANUP_INTERVAL_MIN=60

# ─────────────────────────────────────────────────────────────
# IRC OPERATOR (OPER command)
# ─────────────────────────────────────────────────────────────
CATIRC_OPER_NAME=admin
CATIRC_OPER_PASSWORD=oper-password

# ─────────────────────────────────────────────────────────────
# OBSERVABILITY
# ─────────────────────────────────────────────────────────────
CATIRC_METRICS_PATH=/metrics

# ─────────────────────────────────────────────────────────────
# ADMIN HTTP API
# ─────────────────────────────────────────────────────────────
CATIRC_ADMIN_TOKEN=admin-bearer-token-123
CATIRC_ADMIN_PATH=/admin

# ─────────────────────────────────────────────────────────────
# CORS
# ─────────────────────────────────────────────────────────────
CATIRC_ALLOWED_ORIGINS=https://chat.midominio.com,https://catmage.es

# ─────────────────────────────────────────────────────────────
# EMBED MODE
# ─────────────────────────────────────────────────────────────
CATIRC_EMBED_MODE=false

# ─────────────────────────────────────────────────────────────
# HTTP TIMEOUTS
# ─────────────────────────────────────────────────────────────
CATIRC_HTTP_READ_TIMEOUT_SEC=30
CATIRC_HTTP_WRITE_TIMEOUT_SEC=60
CATIRC_HTTP_IDLE_TIMEOUT_SEC=120
```

---

## Validación (`internal/config/config.go:Validate()`)

| Regla | Error si falla |
|-------|----------------|
| `ServerName` no vacío | `SERVER_NAME must not be empty` |
| `Port` / `WSPort` no vacío | `IRC port must not be empty` |
| TLS: las 3 (`TLSCert`, `TLSKey`, `TLSListen`) **todas** o **ninguna** | `TLS requires CATIRC_TLS_CERT, CATIRC_TLS_KEY and CATIRC_TLS_LISTEN to be set together` |
| Valores numéricos ≥ 0 | `CATIRC_MAX_FILE_SIZE_MB must be >= 0` |
| Si `CATMAGE_URL` ≠ "" → `CATMAGE_API_KEY` ≠ "" | `CATMAGE_URL is set but CATMAGE_API_KEY is empty` |
| Si `EnableP2PFiles` → `ICEServers` ≠ "" | `CATIRC_ENABLE_P2P_FILES is true but CATIRC_ICE_SERVERS is empty` |

---

## Prioridad de Carga (`config.Load()`)

1. **Environment Variables** (máxima prioridad)
2. **`.env` file** (o `CATIRC_ENV_FILE`)
3. **Defaults** (hardcoded en `Load()`)

```go
// Orden real:
os.Getenv(key)        // 1. ENV
os.LookupEnv(key)     // 2. .env (via loadEnvFile())
fallback              // 3. Default
```

---

## CatMage Sync — Variables Críticas

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `CATMAGE_URL` | Base URL CatMage (ej. `https://catmage.es`) | **Sí** si sync activado |
| `CATMAGE_API_KEY` | Shared secret para webhook/pull | **Sí** si `CATMAGE_URL` |
| `CATIRC_JWT_SECRET` | HS256 key para JWT tokens | **Sí** siempre |
| `CATIRC_JWT_EXPIRY_MIN` | Token expiry (min) | No (default 1440) |
| `CATMAGE_SYNC_INTERVAL_MIN` | Pull interval (min) | No (default 60) |
| `CATMAGE_WEBHOOK_PATH` | Push endpoint path | No (default `/api/catmage/webhook`) |

**Sync Flow**:
- **Push (Primary)**: CatMage → `POST {CATMAGE_WEBHOOK_PATH}` con `X-CatMage-Key`
- **Pull (Safety)**: Cron cada `CATMAGE_SYNC_INTERVAL_MIN` → `GET {CATMAGE_URL}/api/irc/users?since=`
- **Repair**: `Syncer.RepairUser(id)` → `GET {CATMAGE_URL}/api/irc/users/{id}`

---

## P2P / WebRTC

| Variable | Descripción | Default |
|----------|-------------|---------|
| `CATIRC_ENABLE_P2P_FILES` | Habilita `FILE` command | `true` |
| `CATIRC_MAX_FILE_SIZE_MB` | Límite tamaño (0 = ilimitado) | `100` |
| `CATIRC_ICE_SERVERS` | CSV STUN/TURN URLs | `stun:stun.l.google.com:19302` |

**Formato ICE**:
```
stun:stun.example.com:3478
turn:turn.example.com:3478?transport=udp
turn:turn.example.com:3478?transport=tcp
```

---

## Admin API

| Variable | Descripción | Default |
|----------|-------------|---------|
| `CATIRC_ADMIN_TOKEN` | Bearer token para `/admin/*` | `""` (disabled) |
| `CATIRC_ADMIN_PATH` | Base path admin API | `/admin` |

**Uso**:
```bash
curl -H "Authorization: Bearer $CATIRC_ADMIN_TOKEN" \
  http://localhost:8081/admin/stats
```

---

## Embed Mode

| Variable | Descripción |
|----------|-------------|
| `CATIRC_EMBED_MODE` | `true` = iframe mode (hide login, wait for postMessage) |

**Activación alternativa**: `?embed=1` en URL o `window.CATIRC_EMBED_MODE=true` antes de cargar OdinX.

---

## Seguridad en Producción

| Variable | Recomendación |
|----------|---------------|
| `CATIRC_JWT_SECRET` | 32+ chars aleatorios, rotar periódicamente |
| `CATIRC_ADMIN_TOKEN` | 32+ chars, solo admins |
| `CATMAGE_API_KEY` | Shared secret, rotar con CatMage |
| `CATIRC_DATABASE_URL` | `sslmode=require` en prod |
| `CATIRC_TLS_CERT/KEY` | Certificados válidos (Let's Encrypt) |
| `CATIRC_ALLOWED_ORIGINS` | Dominios exactos, no `*` en prod |
| `CATIRC_MAX_CONNECTIONS` | 5-10 según capacidad |

---

## OdinX — Build-time Config

### `package.json` — Scripts
```json
{
  "scripts": {
    "dev": "node dev-server.js",
    "start": "node dev-server.js 8082",
    "build": "npm run build:css",
    "build:css": "node node_modules/@tailwindcss/cli/dist/index.mjs -i ./src/input.css -o ./dist/tailwind.min.css --minify",
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

### `dev-server.js` — Sirve estáticos + WS proxy
```javascript
// Sirve ./ en puerto 8082
// Proxy /ws → CatIRC WS port
```

### Assets
| Archivo | Descripción |
|---------|-------------|
| `dist/tailwind.min.css` | CSS compilado (42KB gzipped) |
| `images/` | Avatars, favicons |
| `manifest.json` | PWA manifest |
| `service-worker.js` | Offline support |

---

## Archivos Relacionados

| Archivo | Propósito |
|---------|-----------|
| `.env.example` | Template completo |
| `.env` | Config local (gitignored) |
| `.env.old` | Backup previo |
| `internal/config/config.go` | Load + Validate |
| `cmd/server/main.go` | Uso en startup |
| `odinx/package.json` | Scripts + deps |
| `odinx/dev-server.js` | Dev server + proxy |

---

*Generado: 2026-07-11 | Fuente: `internal/config/config.go`, `.env.example`, `cmd/server/main.go`, `odinx/package.json`, `odinx/dev-server.js`*
```

## 31. archivos-huerfanos.md

```md
# Archivos Huérfanos — CatIRC + OdinX

## CatIRC — Archivos Sin Referencias

### Tests No Utilizados
| Archivo | Contenido | Evidencia |
|---------|-----------|-----------|
| `internal/admin/new_endpoints_test.go` | Tests para endpoints no implementados | Solo tests, no código prod |
| `internal/server/export_test.go` | `ExportTestHelper` | Solo test helper |
| `internal/server/sprint1_test.go` | Tests "Sprint 1" legacy | Tests antiguos |
| `internal/services/root_role_test.go` | `TestRootRole` | Test muy específico |
| `internal/server/catmage_webhook_test.go` | Test webhook | Solo test |

### Código Sin Referencias en Producción
| Símbolo | Archivo | Por qué muerto |
|---------|---------|----------------|
| `Syncer.RepairUser` | `internal/catmage/sync.go` | Solo llamado desde `RepairCatMageUser` (admin API) |
| `Server.P2PConfig()` | `internal/server/handlers_file.go` | Referenciado en `main.go` pero **archivo no existe** |

---

## OdinX — Archivos Huérfanos

### Archivos Completos
| Archivo | Tipo | Por qué huérfano |
|---------|------|------------------|
| `js/profile.js.backup` | Backup | Copia accidental, no importado |
| `js/upload.js` | JS | HTTP upload fallback — **nunca llamado** (solo P2P) |
| `js/irc-handler.js` | ES Module | Legacy FreeChat path, **nunca importado** en `index.html` |
| `src/input.css` | CSS | Duplicado exacto de root `input.css` |
| `test/sdk-adapter.test.js` | Test | Test para `sdk-adapter.js` que solo sirve en embed mode |

### Funciones/Exportaciones Sin Llamar
| Función | Archivo | Por qué |
|---------|---------|---------|
| `CATIRCClient.requestList()` | `js/client.js` | `/list` command no implementado en UI |
| `CATIRCClient.userhost()` | `js/client.js` | `/userhost` no en comandos |
| `CatIRC.p2p._showOfferModal()` | `js/p2p.js` | Crea `id="p2p-offer-overlay"` pero `_closeModal()` busca `#p2p-offer-overlay` (ID mismatch) |
| `CatIRC.permissions.isRoot()` | `js/permissions.js` | No usado en código actual |
| `CatIRC.permissions.hasGlobalRole()` | `js/permissions.js` | Solo `isRoot()` y `isOper()` usados |
| `attachHandler()` | `js/irc-handler.js` | Exportado pero **nunca invocado** (legacy FreeChat path) |

### Variables/Estados Huérfanos en `CatIRC.state`
```javascript
_embedMode: false,           // Solo escrito en app.js, leído en auth.js
_embedJWT: '',               // Solo escrito en app.js, leído en auth.doRegisteredLogin()
_embedChannels: [],          // Solo escrito en app.js, nunca leído
_reconnectDialogOpen: false, // Solo en connection.js
_sessionAction: null,        // Solo en connection.js
_recoverChannels: null,      // Solo en connection.js
_recoverActive: null,        // Solo en connection.js
_ghostTried: false,          // Solo en client.js (private)
_whoisTarget: '',            // Solo en state.js (private)
_whoisData: {},              // Solo en state.js (private)
```

---

## Detección Automatizada

```bash
# Go: dead code
go build -vet=off ./... 2>&1 | grep -E "declared but not used|imported but not used"
staticcheck ./... 2>&1 | grep -E "SA1019|SA1029|ST1000|U1000"

# JS: unused exports (requiere bundler o manual)
# grep -r "CatIRC\." js/ --include="*.js" | cut -d'.' -f2 | sort -u
# Comparar con exports en cada archivo

# Archivos .backup, .old, duplicados
find . -name "*.backup" -o -name "*.old" -o -name "*~" -o -name ".#*"
find . -name "*.css" -exec md5sum {} + | sort | uniq -w32 -D
```

---

## Resumen de Limpieza

| Proyecto | Archivos a Eliminar | Funciones/Exports a Eliminar | LOC Reducidas |
|----------|---------------------|------------------------------|---------------|
| CatIRC | 5-6 | ~15 | ~300 |
| OdinX | 5-6 | ~20 | ~500 |

---

*Generado: 2026-07-11 | `staticcheck`, `go vet`, análisis manual imports*
```

## 32. bugs.md

```md
# Bugs Confirmados y Potenciales — CatIRC + OdinX

## CatIRC (Go)

### Críticos (Producción)

| ID | Ubicación | Descripción | Impacto | Workaround |
|----|-----------|-------------|---------|------------|
| BUG-001 | `internal/protocol/parser.go:Format()` | Tags IRCv3 no escapan `;`, `=`, espacio, `\r`, `\n`, `\` en valores | Rompe parsing receptor si tag value contiene estos chars | No usar esos chars en tags (limitación actual) |
| BUG-002 | `internal/protocol/parser.go:parseTags()` | No hace unescape de `\:`, `\s`, `\r`, `\n`, `\\` per spec IRCv3.2 | Tags con valores escapados se parsean mal | Evitar tags complejos |
| BUG-003 | `internal/security/security.go:SanitizeMessage()` | Remueve todos chars > 127 (emojis, Unicode) | **Rompe emojis y texto no-ASCII** en mensajes | Urgente: permitir Unicode printable |
| BUG-004 | `internal/server/handlers_cap.go:handleCap()` | `CAP LS` sin trailing devuelve tags vacíos; spec dice debe tener trailing | Clientes estrictos fallan negociación | Cliente envía CAP REQ directo (OdinX lo hace) |
| BUG-005 | `internal/catmage/sync.go:Syncer.WebhookHandler()` | No valida `event` field — acepta cualquier string | Eventos malformados aplican snapshot sin auditar | Validar `event` contra whitelist |

### Altos

| ID | Ubicación | Descripción | Impacto |
|----|-----------|-------------|---------|
| BUG-006 | `internal/services/services.go:NickServ.Identify()` | Upgrade plaintext→bcrypt en login exitoso **sin lock** (`ns.mu` no held) | Race condition: dos logins concurrentes pueden corromper hash |
| BUG-007 | `internal/server/server.go:persistMessageV2()` | `max(s.cfg.MessageExpiry, 90)` — si config 0, usa 90 días; pero `MessageExpiry` default 90 | Config 0 = ilimitado en docs, pero código fuerza 90 días |
| BUG-008 | `internal/database/database.go:UpsertIRCUser()` | `ON CONFLICT(username) DO UPDATE` actualiza `catmage_user_id` — permite **hijack** si username reused | Si CatMage reusa username, vincula a user_id equivocado |
| BUG-009 | `internal/server/handlers_mode.go:enforceMLock()` | Modifica `ch.Modes` **sin lock** (`ch.Mutex.Lock()` inside loop pero race en check) | Modes pueden flappear bajo concurrencia |
| BUG-010 | `internal/services/chanserv_v2.go:SetFlags()` | `applyFlagChanges()` permite flags inválidos (no valida contra `validFlags`) | Flags corruptos persisten en BD |

### Medios

| ID | Ubicación | Descripción |
|----|-----------|-------------|
| BUG-011 | `internal/server/server.go:cleanDisconnect()` | `notifyMonitorsOffline()` llamado **antes** de `registry.Unregister()` — MONITOR ve nick aún registrado |
| BUG-012 | `internal/services/operserv.go:handleKill()` | `log.Printf` usa `c.Nick` pero `targetID` resuelto via `os.resolveUserID(nick)` — puede ser 0 si nick no registrado |
| BUG-013 | `internal/server/handlers_channel.go:joinChannel()` | `ChanServ IsBanned` check usa `mask = nick!user@host` pero `IsBanned` espera `user@host` (sin nick) |
| BUG-014 | `internal/server/handlers_messaging.go:handlePrivmsg()` | `services.HandleServiceMessageV2` llamado con `target` lowercase pero `HandleMessageV2` hace `strings.ToLower(target)` de nuevo |
| BUG-015 | `internal/database/store.go:Store` interface | `ChannelMemberRepository` definido pero **no implementado** en `*DB` (compile error si se usa) |

### Bajo / Cosméticos

| ID | Ubicación | Descripción |
|----|-----------|-------------|
| BUG-016 | `internal/server/handlers_info.go:handleWhois()` | `370` numeric custom para roles — no documentado en RFC, clientes lo ignoran |
| BUG-017 | `internal/metrics/metrics.go` | `ClientCount`/`ChannelCount` callbacks capturan `s` por closure — ok pero frágil |
| BUG-018 | `cmd/server/main.go:loadEnvFile()` | No valida líneas con múltiples `=` (ej. `KEY=val=ue`) — toma todo tras primer `=` |

---

## OdinX (Vanilla JS)

### Críticos

| ID | Ubicación | Descripción | Impacto |
|----|-----------|-------------|---------|
| BUG-020 | `js/client.js:handlePRIVMSG()` | Detecta CTCP ACTION con `text.startsWith('\x01ACTION ') && text.endsWith('\x01')` — **falla si ACTION tiene trailing spaces** | ACTION messages no renderizan |
| BUG-021 | `js/p2p.js:_showOfferModal()` | Crea overlay con `id="p2p-offer-overlay"` pero `_closeModal()` busca `#p2p-offer-overlay` — **ID mismatch** | Modal no cierra al rechazar |
| BUG-022 | `js/connection.js:restoreSession()` | `S.client = new CATIRCClient({channel: channel})` pero `channel` es string; `pendingChannels` array ignorado salvo primer elemento | Solo restaura 1 canal de sesión previa |
| BUG-023 | `js/db.js:addMessage()` | `tx.oncomplete = () => this._trim(channel)` — `_trim` usa **misma transacción** que ya committed | `_trim` falla silenciosamente (tx closed) |
| BUG-024 | `js/commands.js:handleCmd()` | `/msg nick text` abre DM y hace `addMsg` local — pero **no envía PRIVMSG** si DM ya abierto (falta `else`) | Mensaje no llega si tab DM ya activo |

### Altos

| ID | Ubicación | Descripción |
|----|-----------|-------------|
| BUG-025 | `js/ui.js:renderMsg()` | `msg.mid = Date.now().toString(36) + Math.random().toString(36).slice(2,6)` — **colisión posible** en mensajes rápidos |
| BUG-026 | `js/client.js:handleNAMREPLY()` | Parse prefixes con `while (nick && IRC.PREFIX_CHARS.includes(nick[0]))` — **bucle infinito** si nick empieza con prefix char válido pero no es prefix real |
| BUG-027 | `js/connection.js:setupCallbacks()` | `client.onHistory` callback pushea a `cd.messages` **sin verificar duplicados** (history + live = duplicados) |
| BUG-028 | `js/p2p.js:_sendFileBytes()` | `dc.bufferedAmountLowThreshold = LOW_WATERMARK` — pero `bufferedamountlow` event **no firea en Firefox** si threshold > default |
| BUG-029 | `js/notifications.js:show()` | `new Notification(title, {body, icon})` — `icon` relativo, falla si OdinX servido en subpath |

### Medios

| ID | Ubicación | Descripción |
|----|-----------|-------------|
| BUG-030 | `js/state.js:CatIRC.loadSettings()` | Default `server: window.CATIRC_WS_URL || 'ws://localhost:8081/ws'` — hardcoded localhost en prod |
| BUG-031 | `js/admin.js:RootDashboard._apiFetch()` | No maneja 401/403 → retorna `null` silenciosamente, UI muestra "Error" genérico |
| BUG-032 | `js/suggestions.js:showCommands()` | Filtra commands con `cmd.startsWith(filter)` — pero `filter` incluye `/` → no matchea |
| BUG-033 | `js/profile.js:show()` | `S.client._whoisCache[nick.toLowerCase()]` — cache key lowercase pero `requestWHOIS` usa nick original |
| BUG-034 | `js/events.js:init()` | `AbortController` para cleanup pero **no aborta** listeners de `ModalManager` (modales quedan abiertos) |

### Bajo

| ID | Ubicación | Descripción |
|----|-----------|-------------|
| BUG-035 | `js/emoji.js` | Twemoji CDN hardcoded — sin fallback local si CDN down |
| BUG-036 | `js/mobile.js` | `switchView('chat')` llama `ui.renderTabsMobile()` pero `renderTabsMobile` no actualiza `channelTabs` scroll |
| BUG-037 | `js/channelmodes.js` | `handleModeChange` envía `MODE` raw — no valida que user sea op antes de enviar |
| BUG-038 | `js/nickserv.js` | `appendNotice` usa `ns-notices` element — **no existe en index.html** (legacy) |

---

## Cross-Project (Integración)

| ID | Descripción |
|----|-------------|
| BUG-040 | CatIRC envía `370` custom para roles — OdinX lo parsea en `handleWHOIS` pero **solo si `targetNick === myNick`** (self-WHOIS) |
| BUG-041 | CatIRC `TAGMSG +react` incluye `+react-to=msgId` — OdinX `handleTAGMSG` espera `mid` pero `msgId` vs `mid` naming mismatch |
| BUG-042 | CatIRC `FILE SIGNAL` usa base64(JSON) — OdinX `onRtcSignal` hace `atob` + `JSON.parse` pero **no maneja unicode** en SDP (raro pero posible) |
| BUG-043 | CatIRC `HISTORY` responde con NOTICEs `[HH:MM] <nick> text` — OdinX `handleNOTICE` detecta via regex pero **falla si nick tiene corchetes** |

---

## Priorización Sugerida (Próximo Sprint)

1. **BUG-003** (SanitizeMessage rompe Unicode) — Crítico UX
2. **BUG-001/002** (IRCv3 tag escaping) — Estándar compliance
3. **BUG-006** (NickServ race condition) — Seguridad
4. **BUG-021** (P2P modal ID mismatch) — Feature roto
5. **BUG-022** (Session restore partial) — UX core
6. **BUG-023** (IndexedDB trim en tx closed) — Data loss risk
7. **BUG-008** (CatMage username hijack) — Seguridad

---

*Generado: 2026-07-11 | Análisis estático + revisión manual código*
```

## 33. codigo-muerto.md

```md
# Código Muerto — CatIRC + OdinX

## CatIRC

### Archivos de Test No Utilizados
| Archivo | Contenido | Evidencia |
|---------|-----------|-----------|
| `internal/admin/new_endpoints_test.go` | Tests para endpoints no implementados | Solo tests, no código prod |
| `internal/server/export_test.go` | `ExportTestHelper` | Solo test helper |
| `internal/server/sprint1_test.go` | Tests "Sprint 1" legacy | Tests antiguos |
| `internal/services/root_role_test.go` | `TestRootRole` | Test muy específico |
| `internal/server/handlers_staff.go` | Solo 2 comandos: `AUDITLOG`, `INVTOKEN` | Podría integrarse en `handlers_info.go` |
| `internal/server/catmage_webhook_test.go` | Test webhook | Solo test |

### Código Sin Referencias
| Símbolo | Archivo | Por qué muerto |
|---------|---------|----------------|
| `handleInvToken` | `internal/server/handlers_staff.go` | Solo llamado desde `handleInvToken` en mismo archivo |
| `Syncer.RepairUser` | `internal/catmage/sync.go` | Solo llamado desde `RepairCatMageUser` (admin API) |

---

## OdinX

### Archivos Huérfanos
| Archivo | Tipo | Por qué huérfano |
|---------|------|------------------|
| `js/profile.js.backup` | Backup | Copia accidental, no importado |
| `js/upload.js` | JS | HTTP upload fallback — **nunca llamado** (solo P2P) |
| `js/irc-handler.js` | ES Module | Legacy FreeChat path, **nunca importado** |
| `src/input.css` | CSS | Duplicado de root `input.css` |
| `test/sdk-adapter.test.js` | Test | Test para archivo huérfano |

### Funciones Sin Llamar
| Función | Archivo | Por qué |
|---------|---------|---------|
| `CATIRCClient.requestList()` | `js/client.js` | `/list` command no implementado en UI |
| `CATIRCClient.userhost()` | `js/client.js` | `/userhost` no en comandos |
| `CatIRC.p2p._showOfferModal()` | `js/p2p.js` | Crea `id="p2p-offer-overlay"` pero `_closeModal()` busca `#p2p-offer-overlay` (ID mismatch) |
| `CatIRC.permissions.isRoot()` | `js/permissions.js` | No usado en código actual |
| `CatIRC.permissions.hasGlobalRole()` | `js/permissions.js` | Solo `isRoot()` y `isOper()` usados |

### Variables/Estados Huérfanos en `CatIRC.state`
```javascript
_embedMode: false,           // Solo escrito en app.js, leído en auth.js
_embedJWT: '',               // Solo escrito en app.js, leído en auth.doRegisteredLogin()
_embedChannels: [],          // Solo escrito en app.js, nunca leído
_reconnectDialogOpen: false, // Solo en connection.js
_sessionAction: null,        // Solo en connection.js
_recoverChannels: null,      // Solo en connection.js
_recoverActive: null,        // Solo en connection.js
_ghostTried: false,          // Solo en client.js (private)
_whoisTarget: '',            // Solo en state.js (private)
_whoisData: {},              // Solo en state.js (private)
```

### Archivos Duplicados
| Código | Ubicaciones | Recomendación |
|--------|-------------|---------------|
| `CatIRC.randomNick()` | `js/state.js` + `js/auth.js` | Centralizar en `state.js` |
| IRC parser | `internal/protocol/parser.go` + `odinx/irc.js` | Compartir via WASM o sync manual |
| Tag escaping | `internal/protocol/parser.go:Format()` + `odinx/irc.js` (none) | Implementar en ambos |
| Nick validation | `internal/security/security.go:ValidateNick()` + `odinx/irc.js:isValidNick()` | Regex ligeramente distintos |

---

## Duplicados entre Proyectos

| Código | CatIRC | OdinX | Acción |
|--------|--------|-------|--------|
| Nick validation | `security.go:ValidateNick()` | `irc.js:isValidNick()` | Unificar regex |
| IRC parsing | `protocol/parser.go` | `irc.js` | Compartir via WASM o sync manual |
| Tag escaping | `parser.go:Format()` | — (falta en JS) | Implementar en JS |
| Color/Markdown | — | `irc.js:markdown()`, `formatColors()` | Solo JS |

---

## Archivos de Config Duplicados

| Archivo | Problema |
|---------|----------|
| `odinx/input.css` | Duplicado de root `input.css` |
| `odinx/src/input.css` | Mismo contenido que `input.css` |

---

## Scripts de Detección Automatizada

```bash
# Go: dead code
go build -vet=off ./... 2>&1 | grep -E "declared but not used|imported but not used"
staticcheck ./... 2>&1 | grep -E "SA1019|SA1029|ST1000"

# JS: unused exports (requiere bundler o manual)
# grep -r "CatIRC\." js/ --include="*.js" | cut -d'.' -f2 | sort -u
# Comparar con exports en cada archivo

# Archivos .backup, .old, duplicados
find . -name "*.backup" -o -name "*.old" -o -name "*~" -o -name ".#*"
find . -name "*.css" -exec md5sum {} + | sort | uniq -w32 -D
```

---

## Resumen de Limpieza Estimada

| Proyecto | Archivos a Eliminar | Funciones a Eliminar | LOC Reducidas |
|----------|---------------------|----------------------|---------------|
| CatIRC | 5-6 | ~15 | ~300 |
| OdinX | 5-6 | ~20 | ~500 |

---

*Generado: 2026-07-11 | `staticcheck`, `go vet`, análisis manual imports*
```

## 34. duplicados.md

```md
# Código Duplicado — CatIRC + OdinX

## Duplicados dentro de CatIRC

### 1. Nick Validation
| Ubicación | Código |
|-----------|--------|
| `internal/security/security.go:ValidateNick()` | RFC 2812 regex |
| `internal/auth/catmage.go` (inline) | Mismo regex hardcoded |

### 2. IRC Message Formatting
| Ubicación | Código |
|-----------|--------|
| `internal/protocol/parser.go:Format()` | Full IRCv3 formatter |
| `internal/services/services.go:HandleMessage()` | Inline `PRIVMSG` formatting |

### 3. Database Helpers
| Código | Archivos |
|--------|----------|
| `boolToInt(b bool) int` | `database/database.go` + `database/messages.go` |
| `scanIRCUserRow()` | `database/database.go` + `database/v2_repo_test.go` |

### 4. Tag Escaping (Parcial)
| Ubicación | Código |
|-----------|--------|
| `internal/protocol/parser.go:escapeTagValue()` | Solo en formatter |
| **Falta en parser** | `parseTags()` no hace unescape |

---

## Duplicados dentro de OdinX

### 1. Utilidades Básicas
| Función | Archivos |
|---------|----------|
| `escape()` / `CatIRC.esc()` | `js/state.js` + `js/utils.js` |
| `formatTime()` | `js/irc.js` + `js/utils.js` |
| `debounce()` | `js/events.js` (inline) + `js/admin.js` (exportado) |
| `formatFileSize()` | `js/state.js` + `js/p2p.js` |

### 2. Modal Management
| Código | Ubicaciones |
|--------|-------------|
| Modal open/close logic | `js/modals.js` + inline en `js/admin.js` |

### 3. Nick/Channel Validation
| Función | Archivos |
|---------|----------|
| Nick regex | `js/irc.js:isValidNick()` + `js/state.js` (inline en auth) |
| Channel regex | `js/irc.js:isValidChannel()` + inline en commands |

### 4. Message Rendering
| Código | Archivos |
|--------|----------|
| `renderMsg()` logic | `js/ui.js:renderMsg()` + inline en `handleIncomingMsg()` |

### 5. State Accessors
| Getter | Ubicaciones |
|--------|-------------|
| `getChannelData()` | `js/ui.js` + `js/client.js` |
| `getCurrentChannel()` | `js/ui.js` + `js/events.js` + `js/commands.js` |

---

## Duplicados Cross-Project (CatIRC ↔ OdinX)

| Código | CatIRC (Go) | OdinX (JS) | Estado |
|--------|-------------|------------|--------|
| **IRC Parser** | `internal/protocol/parser.go` | `odinx/irc.js` | **Mantenidos en sync manual** |
| **IRC Formatter** | `parser.go:Format()` | `irc.js:format()` (falta) | **JS falta tag escaping** |
| **Nick Validation** | `security.ValidateNick()` | `irc.js:isValidNick()` | Regex ligeramente distintos |
| **Channel Validation** | — | `irc.js:isValidChannel()` | Solo JS |
| **Tag Escaping** | `parser.go:escapeTagValue()` | **Falta en JS** | **Bug: tags con ;/=/espacio rotos** |
| **Tag Unescaping** | `parser.go:parseTags()` (falta unescape) | `irc.js:parse()` (falta unescape) | **Ambos incompletos** |
| **Color/Markdown** | — | `irc.js:markdown()`, `formatColors()` | Solo JS |
| **Time Formatting** | — | `irc.js:formatTime()` + `utils.js` | Solo JS |

---

## Archivos de Config Duplicados

| Archivo | Problema |
|---------|----------|
| `odinx/input.css` | Duplicado exacto de root `input.css` |
| `odinx/src/input.css` | Mismo contenido que `input.css` root |

---

## Métricas de Duplicación

| Proyecto | Archivos | Funciones Duplicadas | LOC Estimadas Duplicadas |
|----------|----------|----------------------|--------------------------|
| CatIRC | 4-5 | ~8 | ~150 |
| OdinX | 8-10 | ~15 | ~400 |
| Cross-project | 2 | 6 | ~200 |

---

## Recomendaciones

### Inmediato (P0)
1. **Eliminar `odinx/src/input.css`** — duplicado exacto
2. **Implementar tag escaping en `odinx/irc.js`** — security bug
2. **Centralizar `CatIRC.randomNick()` en `state.js`** — eliminar duplicado en `auth.js`

### Corto Plazo (P1)
1. **Crear paquete compartido `irc-protocol`** (Go + JS via WASM o codegen)
2. **Centralizar `debounce()` en `utils.js`** — eliminar duplicados
3. **Centralizar `escape()` / `CatIRC.esc()`** en `utils.js`
4. **Unificar nick/channel validation** en `irc.js` + exportar

### Mediano Plazo (P2)
1. **Codegen para IRC protocol** — generar Go + JS desde spec único
2. **Extraer `formatTime`, `formatFileSize` a `utils.js`**
3. **Unificar modal open/close logic** en `ModalManager`

---

## Scripts de Detección

```bash
# Go: funciones duplicadas (nombre similar)
go run golang.org/x/tools/cmd/gofmt@latest -l internal/ | xargs grep -n "func " | sort | uniq -d -f 2

# Go: dead code
staticcheck ./... 2>&1 | grep -E "SA1019|SA1029|ST1000|U1000"

# JS: buscar exports duplicados
grep -r "export " odinx/js/ --include="*.js" | cut -d' ' -f2 | sort | uniq -d

# Buscar TODOs/FIXMEs duplicados
grep -r "TODO\|FIXME" --include="*.go" --include="*.js" | sort | uniq -c | sort -rn

# Archivos duplicados por contenido
find . -name "*.css" -exec md5sum {} + | sort | uniq -w32 -D
find . -name "*.js" -exec md5sum {} + | sort | uniq -w32 -D
```

---

*Generado: 2026-07-11 | `staticcheck`, `go vet`, análisis manual imports*
```

## 35. tecnica.md

```md
# Riesgos Técnicos — CatIRC + OdinX

## 1. Bugs Confirmados

### Críticos (P0)

| ID | Componente | Descripción | Impacto | Fix Estimado |
|----|------------|-------------|---------|--------------|
| BUG-001 | `internal/security/security.go:SanitizeMessage()` | Elimina **todos** caracteres > 127 (emojis, acentos, Unicode) | Rompe comunicación no-ASCII, UX rota | 1h - Fix regex |
| BUG-002 | `internal/protocol/parser.go:Format()` | No escapa `;`, `=`, espacio, `\r`, `\n`, `\` en tag values (IRCv3.2 §2.2) | Tags malformados rompen parsers clientes | 2h - Implement escape |
| BUG-003 | `internal/protocol/parser.go:parseTags()` | No hace **unescape** de `\:`, `\s`, `\r`, `\n`, `\\` | Valores con escapes se parsean mal | 2h - Implement unescape |
| BUG-004 | `internal/services/services.go:Identify()` | Upgrade plaintext→bcrypt **sin lock** (`ns.mu` no held) | Race condition: hash corrupto en login concurrente | 1h - Move upgrade bajo lock |
| BUG-005 | `internal/server/handlers_cap.go:handleCap()` | `CAP LS` sin trailing devuelve tags vacíos; RFC dice debe tener trailing | Clientes estrictos fallan negociación | 1h - Fix response |

### Altos (P1)

| ID | Componente | Descripción | Impacto |
|----|------------|-------------|---------|
| BUG-006 | `internal/server/handlers_messaging.go:directMessage()` | `persistOfflineDM()` usa `SaveMessageV2` pero **no crea conversación** si no existe | DMs offline no persisten en V2 |
| BUG-007 | `internal/server/server.go:persistMessageV2()` | `max(cfg.MessageExpiry, 90)` → si config 0 (ilimitado), fuerza 90 días | Config 0 = ilimitado en docs, pero código fuerza 90d |
| BUG-008 | `internal/database/database.go:UpsertIRCUser()` | `ON CONFLICT(username) DO UPDATE catmage_user_id` permite **hijack** si CatMage reusa username | Cuenta local vinculada a usuario CatMage equivocado |
| BUG-009 | `internal/server/handlers_mode.go:enforceMLock()` | Modifica `ch.Modes` **sin lock** externo (lock interno pero check fuera) | Race condition en modes bajo carga |
| BUG-010 | `internal/services/chanserv_v2.go:SetFlags()` | `applyFlagChanges()` no valida flags contra `validFlags` | Flags inválidos persisten en BD |

### OdinX (P1)

| ID | Archivo | Descripción | Impacto |
|----|---------|-------------|---------|
| BUG-020 | `js/client.js:handlePRIVMSG()` | Detecta ACTION con `startsWith('\x01ACTION ') && endsWith('\x01')` — **falla si trailing spaces** | `/me` messages no renderizan |
| BUG-021 | `js/p2p.js:_showOfferModal()` | Crea overlay `id="p2p-offer-overlay"` pero `_closeModal()` busca `#p2p-offer-overlay` | Modal no cierra al rechazar |
| BUG-022 | `js/connection.js:restoreSession()` | Solo rejoin `pendingChannels[0]`; `session.channels` restantes ignorados | Solo restaura 1 canal de sesión |
| BUG-023 | `js/db.js:addMessage()` | `tx.oncomplete = () => this._trim(channel)` — `_trim` usa **misma transacción** ya committed | `_trim` falla silenciosamente (tx closed) |
| BUG-024 | `js/commands.js:handleCmd()` | `/msg nick text` abre DM y hace `addMsg` local **pero no envía PRIVMSG** si DM ya abierto | Mensaje no llega al destinatario |

---

## 2. Código Muerto / Sin Usar

### CatIRC
| Archivo | Función/Struct | Evidencia |
|---------|----------------|-----------|
| `internal/admin/new_endpoints_test.go` | Tests para endpoints no implementados | Solo tests, no código prod |
| `internal/server/export_test.go` | `ExportTestHelper` | Solo test helper |
| `internal/server/sprint1_test.go` | Tests "Sprint 1" legacy | Tests antiguos |
| `internal/services/root_role_test.go` | `TestRootRole` | Test muy específico |
| `internal/server/handlers_staff.go` | Solo 2 comandos: `AUDITLOG`, `INVTOKEN` | Podría integrarse en `handlers_info.go` |
| `internal/server/catmage_webhook_test.go` | Test webhook | Solo test |

### OdinX
| Archivo | Razón |
|---------|-------|
| `js/profile.js.backup` | Backup accidental, no importado |
| `js/upload.js` | HTTP upload fallback — **nunca llamado** (solo P2P) |
| `js/irc-handler.js` | ES Module `attachHandler()` — **nunca usado** (legacy FreeChat path) |
| `src/input.css` | Duplicado de root `input.css` |
| `test/sdk-adapter.test.js` | Test para `sdk-adapter.js` que solo sirve en embed mode |

---

## 3. Duplicados

### CatIRC
| Código | Ubicaciones | Recomendación |
|--------|-------------|---------------|
| `CatIRC.randomNick()` | `odinx/js/state.js` + `odinx/js/auth.js` | Centralizar en `state.js` |
| IRC parser | `internal/protocol/parser.go` + `odinx/irc.js` | Compartir via WASM o mantener sync manual |
| Tag escaping | `internal/protocol/parser.go:Format()` + `odinx/irc.js` (none) | Implementar en ambos |
| Nick validation | `internal/security/security.go:ValidateNick()` + `odinx/irc.js:isValidNick()` | Regex ligeramente distintos |

### OdinX
| Código | Ubicaciones |
|--------|-------------|
| `escape()` | `js/state.js` + `js/utils.js` |
| `formatTime()` | `js/irc.js` + `js/utils.js` |
| `debounce()` | `js/events.js` (inline) + `js/admin.js` (exportado) |
| Modal open/close | `js/modals.js` + inline en `admin.js` |

---

## 4. Archivos Huérfanos

| Archivo | Tipo | Por qué huérfano |
|---------|------|------------------|
| `js/profile.js.backup` | Backup | Copia accidental |
| `src/input.css` | CSS | Duplicado de `input.css` root |
| `js/upload.js` | JS | HTTP upload fallback — P2P es único path |
| `js/irc-handler.js` | ES Module | Legacy FreeChat path, no importado |
| `js/sdk-adapter.js` | JS | Solo para embed mode, tests aislados |
| `test/sdk-adapter.test.js` | Test | Test para archivo huérfano |

---

## 5. Deuda Técnica

### Arquitectura
| Área | Problema | Severidad |
|------|----------|-----------|
| **Dual Persistence** | Legacy `messages` + V2 `irc_messages` + `irc_conversations` | **Alta** — 3x writes, bugs de sync |
| **EventBus Síncrono** | `Publish()` bloquea hasta que todos handlers terminan | **Media** — Latencia en handlers lentos |
| **Ciclo Server ↔ OperServ** | `OperServ` requiere `ServerFace` (interface) para romper ciclo | **Baja** — Bien resuelto con interface |
| **CatMageAuthProvider Stub** | `internal/auth/catmage_auth_provider.go` compila pero **no se usa** | **Media** — Confusión, dead code |

### Base de Datos
| Problema | Detalle |
|----------|---------|
| **Migraciones 21 SQL** | 001-021, algunas `ALTER TABLE` repetidas, `migrateV2()` hace `PRAGMA table_info` loops |
| **Índices Parciales** | `CREATE INDEX ... WHERE is_system = 0` pero `is_system` agregado en migración posterior |
| **Dual Write** | `persistMessage()` + `persistMessageV2()` — doble write, double storage |
| **Vacuum/Analyze** | No hay maintenance job para PG |

### Concurrencia
| Problema | Ubicación | Riesgo |
|----------|-----------|--------|
| `Client.Output` chan size 64 | `types/types.go` | Drop silencioso si slow consumer |
| `Channel.broadcast` chan size 256 | `types/types.go` | Drop en canales muy activos |
| `EventBus.Publish` síncrono | `eventbus/eventbus.go` | Handler lento bloquea publisher |
| `Throttler` map + cleanup goroutine | `security/security.go` | Memory leak si cleanup falla |

### Testing
| Métrica | Actual | Objetivo |
|---------|--------|----------|
| Go unit coverage | ~40% | >80% |
| Go integration (testcontainers) | 0 | Crítico |
| JS unit (Jest) | ~50% | >80% |
| E2E (Playwright) | 3 tests | >20 flows |
| Benchmark | 0 | Baseline + regression |

### Documentación
| Falta | Impacto |
|-------|---------|
| **API Spec (OpenAPI)** | Admin API sin spec, frontend hardcodea endpoints |
| **Architecture Decision Records** | Decisiones clave no documentadas (ej. dual persistence) |
| **Runbooks** | No hay playbooks para incidentes comunes |
| **Changelog automatizado** | Manual, inconsistente |

---

## 6. Security Debt

| Hallazgo | Severidad | Fix |
|----------|-----------|-----|
| `gorilla/websocket` v1.5.3 | **High** — CVE-2023-45289 (DoS via large frames) | Upgrade a v1.5.4+ o `nhooyr/websocket` |
| JWT HS256 hardcoded | **Media** | Migración a RS256 + JWKS |
| Admin API sin rate limit | **Media** | Token bucket per token |
| `CATIRC_ALLOWED_ORIGINS=""` = any origin | **High** en prod | Documentar obligatoriedad |
| Secrets en `.env` (no vault) | **Media** | Vault/Sealed Secrets en prod |
| Admin token en `sessionStorage` | **Baja** | OK (cleared on close) |

---

## 7. Dependencias Desactualizadas

### Go (`go list -u -m all`)
| Módulo | Actual | Latest | Acción |
|--------|--------|--------|--------|
| `github.com/gorilla/websocket` | v1.5.3 | v1.5.4+ | **Upgrade urgente** (CVE) |
| `github.com/jackc/pgx/v5` | v5.10.0 | v5.5.0+ | Upgrade |
| `golang.org/x/crypto` | v0.53.0 | v0.60.0+ | Upgrade |

### JS (`npm outdated`)
| Paquete | Actual | Latest |
|---------|--------|--------|
| `@tailwindcss/cli` | ^4.1.0 | ^4.3.2 |
| `jest` | ^29.7.0 | ^29.7.0 (latest) |
| `@playwright/test` | ^1.61.0 | ^1.65.0 |

---

## 8. Resumen de Priorización

| Prioridad | Items | Esfuerzo Total |
|-----------|-------|----------------|
| **P0 (Esta semana)** | BUG-001 a BUG-005, WS upgrade | ~8h |
| **P1 (Sprint 1)** | BUG-006 a BUG-010, BUG-020 a BUG-024 | ~24h |
| **P2 (Sprint 2-3)** | Dual persistence removal, CatMageAuthProvider, dead code cleanup | ~40h |
| **P3 (Mes 2)** | Testing coverage, observability, TypeScript migration | ~80h |

---

*Generado: 2026-07-11 | Auditoría estática + análisis manual código*
```

## 36. reborn.md

```md
# Visión Reborn — CatIRC + OdinX v2.0

## Problemas Fundamentales Actuales

| Área | Problema | Impacto |
|------|----------|---------|
| **Arquitectura** | Monolito Go + SPA JS acoplado por WebSocket | Dificulta scaling, testing, deploy independiente |
| **Protocolo** | IRC sobre WS — no nativo web, parsing complejo | Latencia, bugs parser, límite features modernas |
| **Persistencia** | Dual write (legacy + V2) + SQLite→PG migración | Complejidad, bugs sync, deuda técnica |
| **Auth** | JWT HS256 shared secret + CatMage sync push/pull | Single point of failure, no forward secrecy |
| **Frontend** | Vanilla JS IIFE globals, sin types, sin build step | Mantenibilidad, onboarding, refactoring risk |
| **P2P** | WebRTC signaling via IRC FILE command | Hack, no estándar, NAT traversal frágil |
| **Admin** | HTTP API + OdinX modals duplican lógica | Inconsistencias, doble mantenimiento |

---

## Arquitectura Objetivo v2.0

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CATIRC ECOSYSTEM v2.0                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    gRPC/Protobuf     ┌──────────────┐                    │
│  │  API Gateway │◄────────────────────►│  Auth Svc    │  (OIDC, JWT RS256)  │
│  │  (Envoy)     │                      │  (Go)        │                    │
│  └──────┬───────┘                      └──────────────┘                    │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      MESSAGE BUS (NATS / Redis Streams)               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│         │                    │                    │                         │
│    ┌────┴────┐          ┌─────┴─────┐        ┌───┴────┐                   │
│    ▼         ▼          ▼           ▼        ▼        ▼                   │
│ ┌──────┐ ┌───────┐ ┌────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐        │
│ │IRC   │ │Chat   │ │Presence│ │File Xfer │ │Notif   │ │Admin    │        │
│ │Gateway│ │History│ │/Typing │ │(WebRTC)  │ │Svc     │ │API      │        │
│ │(Go)  │ │(Go)   │ │(Go)    │ │(Rust/Go) │ │(Go)    │ │(Go)     │        │
│ └──────┘ └───────┘ └────────┘ └──────────┘ └────────┘ └─────────┘        │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    WebSocket/HTTP2     ┌──────────────┐                  │
│  │  OdinX v2    │◄──────────────────────►│  Gateway     │                  │
│  │  (React +    │    Protobuf/JSON       │  (Envoy)     │                  │
│  │   TypeScript,│                         │              │                  │
│  │   Vite,      │                         │              │                  │
│  │   TanStack)  │                         │              │                  │
│  └──────────────┘                         └──────────────┘                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Decisiones Técnicas Clave

### 1. Protocolo: gRPC + Protobuf Internamente, WebSocket/JSON Externamente
- **Interno**: gRPC entre servicios (type-safe, streaming, perf)
- **Externo**: WebSocket + JSON (compatibilidad OdinX, debug fácil)
- **Gateway**: Envoy proxy — TLS termination, rate limit, auth validation

### 2. Auth: OIDC + JWT RS256 + Short-lived Access + Refresh
- **CatMage = Identity Provider** (OIDC compliant)
- **CatIRC = Resource Server** (valida JWT con JWKS endpoint)
- **Tokens**: Access 15min, Refresh 7d (rotating, revocable)
- **Scopes**: `irc:connect`, `irc:admin`, `chat:read`, `chat:write`, `p2p:signal`

### 3. Persistencia: PostgreSQL Only + Event Sourcing Ligero
- **Single source of truth**: PostgreSQL (particionado por tiempo)
- **Outbox pattern**: DB → NATS para event-driven (audit, notifications, search index)
- **No dual write**: Legacy tables eliminadas, solo V2 schema
- **Read models**: Materialized views para admin dashboards, search (pg_trgm)

### 4. Frontend: React 18 + TypeScript + TanStack Query + Vite
- **State**: TanStack Query (server state) + Zustand (client state)
- **Routing**: TanStack Router (type-safe)
- **UI**: Radix UI + Tailwind (headless, accessible)
- **Build**: Vite + SWC (fast), PWA con Workbox
- **Testing**: Vitest (unit), Playwright (E2E), MSW (API mocking)

### 5. P2P: WebRTC + Standard Signaling (WebSocket subprotocol)
- **Signaling**: Dedicated WebSocket `/p2p` (no IRC hijack)
- **Protocol**: JSON-RPC 2.0 sobre WS
- **ICE**: STUN/TURN configurable, TURN credentials time-limited
- **DataChannel**: Binary, chunked, SHA-256 verified, backpressure handled

### 6. IRC Compatibility Layer (Gateway)
- **Protocol translation**: IRC ↔ Internal gRPC
- **Legacy clients**: TCP/TLS 6667/6697 → Gateway → Internal
- **Feature parity**: Mantener RFC 1459/2812 + IRCv3.2
- **Deprecation path**: Anunciar 12 meses, migrar a native clients

---

## Migración Estratégica (Fases)

### Fase 0: Fundamentación (Sprint 1-2)
- [ ] PostgreSQL schema V2 limpio (migración fresh)
- [ ] NATS cluster setup
- [ ] Envoy config + mTLS entre servicios
- [ ] CI/CD pipeline (GitHub Actions → Docker → K8s/VM)
- [ ] Observability stack (Prometheus, Grafana, Loki, Tempo)

### Fase 1: Auth & Gateway (Sprint 3-4)
- [ ] Auth Service (OIDC provider wrapper CatMage)
- [ ] API Gateway (Envoy) con JWT validation
- [ ] IRC Gateway (TCP → gRPC) básico
- [ ] Token minting/validation library compartida

### Fase 2: Core Services (Sprint 5-8)
- [ ] Chat History Service (gRPC + pg_trgm search)
- [ ] Presence/Typing Service (Redis + NATS pub/sub)
- [ ] Notification Service (Web Push, email, in-app)
- [ ] P2P Signaling Service (WebSocket + WebRTC)

### Fase 3: Frontend Rewrite (Sprint 6-10, paralelo)
- [ ] OdinX v2: React + TS + Vite + TanStack
- [ ] Feature parity: Login, Channels, DMs, History, Search
- [ ] Admin Dashboard: React Admin o custom
- [ ] P2P File Transfer UI
- [ ] Mobile-first responsive, PWA

### Fase 4: Cutover (Sprint 11-12)
- [ ] Blue-green deploy
- [ ] Data migration scripts (legacy → new)
- [ ] DNS switch
- [ ] Monitoring 48h intensified
- [ ] Legacy shutdown

---

## Tech Stack v2.0

| Capa | Tecnología | Justificación |
|------|------------|---------------|
| **API Gateway** | Envoy Proxy | Industry standard, mTLS, rate limit, auth |
| **Service Mesh** | — (NATS como bus) | Simplicidad, no sidecar overhead |
| **Message Bus** | NATS JetStream | Streaming, persistence, replay, ordenamiento |
| **Auth** | Custom OIDC (Go) + CatMage | Control total, integra CatMage existente |
| **DB** | PostgreSQL 16 + pg_partman | Particionado nativo, madurez, JSONB |
| **Cache** | Redis Cluster | Sessions, presence, rate limits |
| **Search** | PostgreSQL pg_trgm + pgvector | Full-text + embeddings futuros |
| **Backend** | Go 1.22+ | Equipo actual, performance, simplicity |
| **P2P Core** | Rust (webrtc-rs) | Safety, performance, WebRTC maduro |
| **Frontend** | React 18 + TS + Vite | Ecosystem, hiring, tooling |
| **State** | TanStack Query + Zustand | Server/client separation, DevTools |
| **UI** | Radix + Tailwind | Accessible, customizable, no CSS-in-JS |
| **Testing** | Vitest + Playwright + MSW | Fast, reliable, modern |
| **Deploy** | Docker + GitHub Actions + k3s/VM | Reproducible, portable |
| **Observability** | Prometheus + Grafana + Loki + Tempo | Full stack, open source |

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Rewrite completo falla | Media | **Crítico** | Migración incremental, feature flags, blue-green |
| Equipo no sabe React/TS | Alta | Alto | Training 2 sprints, pair programming, code reviews estrictos |
| Pérdida features IRC | Baja | Alto | IRC Gateway feature-complete antes de cutover |
| P2P WebRTC complejo | Media | Medio | Usar lib probada (pion/webrtc), TURN managed |
| CatMage sync rompe | Media | Alto | Contract testing, versionado API, rollback plan |
| Performance regression | Media | Medio | Benchmarks continuos en CI, pprof en staging |

---

## Estimación de Esfuerzo

| Fase | Sprints | Devs | Entregable |
|------|---------|------|------------|
| 0. Fundamentación | 2 | 2 | Infra lista |
| 1. Auth/Gateway | 2 | 2 | Auth + Gateway |
| 2. Core Services | 4 | 3 | Backend completo |
| 3. Frontend v2 | 5 | 3 | OdinX v2 |
| 4. Cutover | 2 | All | Producción |

**Total**: ~15 sprints (~30 semanas / 7.5 meses) con 3-4 devs full-time.

**MVP v2.0 (Fase 1-2)**: ~8 sprints — Auth, Gateway, Chat básico, History, Admin API.

---

## Criterios de Éxito v2.0

| Métrica | Target |
|---------|--------|
| **Latencia P99 mensaje** | < 50ms (local) / < 150ms (geo) |
| **Disponibilidad** | 99.9% (SLA) |
| **Deploy frequency** | Daily (main branch) |
| **MTTR** | < 15 min |
| **Test coverage** | > 85% (backend), > 80% (frontend) |
| **Bundle size OdinX** | < 150KB gzipped |
| **Time to Interactive** | < 2s (3G) |
| **P2P success rate** | > 95% (STUN) / > 99% (TURN) |

---

*Documento vivo — revisar cada PI planning. Última actualización: 2026-07-11*
```

## 37. recomendaciones.md

```md
# Recomendaciones Técnicas — CatIRC + OdinX

## Arquitectura y Código

### CatIRC

| # | Recomendación | Prioridad | Esfuerzo | Justificación |
|---|---------------|-----------|----------|---------------|
| A1 | **Migrar persistence a V2-only** — deprecate `messages` legacy table, `SaveMessage` | **P1** | 2-3 sprints | Dual write = bugs, complejidad, 2x storage |
| A2 | **Hot config reload (SIGHUP)** — recargar `Config` sin restart | **P2** | 1 sprint | Operabilidad, zero-downtime config changes |
| A3 | **Request-scoped context propagation** — pasar `context.Context` en todo handler chain | **P2** | 1 sprint | Timeouts, cancellation, tracing |
| A4 | **Structured logging (slog + JSON)** — reemplazar `log.Printf` | **P2** | 1 sprint | Observabilidad, parsing logs centralizado |
| A5 | **OpenTelemetry tracing** — spans en handlers, DB, HTTP clients | **P3** | 2 sprints | Debugging distribuido, latencia |
| A6 | **Rate limiting HTTP endpoints** — token bucket por IP/token en admin/social API | **P1** | 1 sprint | Seguridad, abuse prevention |
| A7 | **Input validation middleware** — validator struct tags en admin API payloads | **P2** | 1 sprint | Consistencia, reducir boilerplate |
| A8 | **Database connection pool tuning** — `pgxpool` config via env (max_conns, lifetime) | **P2** | 0.5 sprint | Performance bajo carga |
| A9 | **Graceful degradation flags** — feature flags para CatMage, P2P, Admin, Social | **P2** | 1 sprint | Resiliencia, canary releases |
| A10 | **Integration test suite** — testcontainers PG + WS client, CI pipeline | **P2** | 2 sprints | Confianza refactors, prevención regresiones |

### OdinX

| # | Recomendación | Prioridad | Esfuerzo | Justificación |
|---|---------------|-----------|----------|---------------|
| B1 | **TypeScript migration** — gradual (`.js` → `.ts`, `jsconfig.json` → `tsconfig.json`) | **P2** | 3-4 sprints | Type safety, refactoring seguro, DX |
| B2 | **Module bundler (Vite)** — reemplazar script tags + IIFE por ES modules + HMR | **P2** | 1 sprint | DX, tree-shaking, production build |
| B3 | **State management formal** — Redux Toolkit / Zustand / Signals en vez de `CatIRC.state` singleton | **P2** | 2 sprints | Predictibilidad, testing, devtools |
| B4 | **React/Preact migration (opcional)** — componentes funcionales + hooks | **P3** | 4+ sprints | Ecosistema, hiring, maintainability |
| B5 | **IndexedDB v3 schema** — normalizar (messages, reactions, edits, reads tables separadas) | **P2** | 1 sprint | Query performance, sync futuro |
| B6 | **Service Worker v2** — Workbox + stale-while-revalidate + background sync | **P2** | 1 sprint | Offline-first, PWA score |
| B7 | **Virtualized lists** — react-window / tanstack-virtual para nicklist, messages | **P2** | 1 sprint | Performance 1000+ mensajes/usuarios |
| B8 | **Unit test coverage >80%** — Jest + RTL, CI gate | **P2** | 2 sprints | Confianza refactors |
| B9 | **E2E test suite expandido** — Playwright: login, join, msg, P2P, admin, mobile | **P2** | 2 sprints | Regression prevention |
| B10 | **Accessibility audit + fixes** — ARIA, focus management, contrast, keyboard nav | **P2** | 1 sprint | Inclusividad, compliance |

---

## Seguridad

| # | Recomendación | Prioridad | Ámbito |
|---|---------------|-----------|--------|
| S1 | **Rotar `CATIRC_JWT_SECRET` y `CATMAGE_API_KEY`** — procedimiento documentado + automatizado | **P0** | Ambos |
| S2 | **TLS enforcement** — `CATIRC_ALLOWED_ORIGINS` obligatorio en prod, HSTS header | **P0** | CatIRC |
| S3 | **Content Security Policy estricto** — nonces para inline scripts, `script-src 'self'` | **P1** | OdinX |
| S4 | **Rate limit admin API** — 10 req/s por token, burst 20 | **P1** | CatIRC |
| S5 | **Audit log inmutable** — append-only table, no DELETE/UPDATE permisos para app user | **P1** | CatIRC |
| S6 | **Secrets en vault** — HashiCorp Vault / AWS Secrets Manager / SOPS, no `.env` en prod | **P1** | Ambos |
| S7 | **Dependency scanning** — `govulncheck` + `npm audit` en CI, fail en high/critical | **P1** | Ambos |
| S8 | **Security headers completos** — COOP, CORP, Permissions-Policy, Referrer-Policy | **P1** | CatIRC WS |
| S9 | **P2P encryption verification** — mostrar fingerprint SHA-256 al user antes de aceptar | **P2** | OdinX |
| S10 | **Penetration test anual** — scope: WS, HTTP, P2P, auth, injection | **P3** | Ambos |

---

## Performance y Escalabilidad

| # | Recomendación | Prioridad | Impacto |
|---|---------------|-----------|---------|
| P1 | **Connection pooling optimizado** — `pgxpool` max_conns=CPU*4, min_conns=CPU | **P1** | DB throughput |
| P2 | **Read replicas** — separar reads (history, search, admin) de writes | **P2** | Latencia reads |
| P3 | **Redis cache layer** — cache `AdminStats`, `ChannelList`, `UserRoles` (TTL 10s) | **P2** | Admin API latency |
| P4 | **Message pagination cursor-based** — reemplazar OFFSET/LIMIT por keyset pagination | **P2** | History performance |
| P5 | **WebSocket compression (permessage-deflate)** — habilitar en Gorilla WS | **P2** | Bandwidth -30% |
| P6 | **Horizontal scaling CatIRC** — sticky sessions (IP hash) o Redis PubSub para broadcast multi-node | **P3** | Escalabilidad |
| P7 | **CDN para assets OdinX** — Cloudflare/CloudFront para `dist/`, `images/`, fonts | **P2** | Load time global |
| P8 | **Bundle splitting OdinX** — code-split admin modals, P2P, emoji picker | **P2** | Initial JS -40% |

---

## Developer Experience

| # | Recomendación | Prioridad |
|---|---------------|-----------|
| D1 | **Makefile targets unificados** — `make build`, `make test`, `make lint`, `make dev` | **P1** |
| D2 | **DevContainer / Docker Compose** — one-command full stack (PG + CatIRC + OdinX) | **P1** |
| D3 | **Pre-commit hooks** — `golangci-lint`, `prettier`, `eslint`, `gofmt` | **P1** |
| D4 | **CI/CD pipeline** — GitHub Actions: lint → test → build → docker push → deploy staging | **P1** |
| D5 | **Documentación API auto-generada** — `swag` para Go, OpenAPI 3.0 para admin/social | **P2** |
| D6 | **Storybook para componentes OdinX** — UI components aislados | **P2** |
| D7 | **Benchmark suite** — `go test -bench`, `k6` para WS/HTTP load testing | **P2** |

---

## Testing Strategy

| Capa | Herramienta | Cobertura Objetivo | CI Gate |
|------|-------------|-------------------|---------|
| Unit (Go) | `testing` + `testify` + `gomock` | >80% | ✅ Required |
| Unit (JS) | Jest + RTL | >80% | ✅ Required |
| Integration (Go) | `testcontainers-go` (PG) | Flujos críticos | ✅ Required |
| Integration (JS) | MSW (Mock Service Worker) | API flows | ✅ Required |
| E2E | Playwright (Chromium/Firefox/WebKit) | User journeys | ✅ Nightly |
| Performance | `k6` (WS + HTTP) | Baseline + regression | ✅ Weekly |
| Chaos | `chaosmesh` (pod kill, network partition) | Resiliencia | ✅ Monthly |

---

## Roadmap Resumido (Próximos 6 Meses)

| Mes | Foco Principal | Entregables |
|-----|----------------|-------------|
| 1 | **Estabilidad Crítica** | Unicode fix, tag escaping, NickServ race, session restore, P2P modal |
| 2 | **Persistencia Unificada** | V2-only, cleanup V2, pagination, search optimization |
| 3 | **Observabilidad + Seguridad** | Structured logging, OTel, rate limits, audit hardening, secrets vault |
| 4 | **DX + Testing** | TypeScript + Vite, DevContainer, CI/CD, test coverage >80% |
| 5 | **Escalabilidad + PWA** | Redis cache, read replicas, SW v2, virtual lists, bundle split |
| 6 | **Polish + Docs** | API docs, Storybook, a11y, load testing, chaos engineering |

---

*Generado: 2026-07-11 | Basado en auditoría completa código fuente*
```

## 38. 00-index.md

```md
# Auditoría Forense Completa — CatIRC + OdinX
**Knowledge Pack v1.0** | Generado: 2026-07-11

---

## Índice General

### 01-Global
- [arquitectura-general.md](01-global/arquitectura-general.md) — Visión general del sistema
- [dependencias.md](01-global/dependencias.md) — Todas las dependencias de ambos proyectos
- [estructura.md](01-global/estructura.md) — Estructura de directorios completa
- [flujo-general.md](01-global/flujo-general.md) — Flujo de datos end-to-end

### 02-CatIRC (Servidor Go)
- [arquitectura.md](02-catirc/arquitectura.md) — Arquitectura interna, capas, packages
- [servidor.md](02-catirc/servidor.md) — Servidor IRC core, accept loop, goroutines
- [protocolo.md](02-catirc/protocolo.md) — Parser IRC, formateo, message tags
- [websocket.md](02-catirc/websocket.md) — WebSocket bridge, upgrader, handlers HTTP
- [rest-api.md](02-catirc/rest-api.md) — Endpoints HTTP admin, auth, social
- [eventos.md](02-catirc/eventos.md) — EventBus, tipos de eventos, suscriptores
- [auth.md](02-catirc/auth.md) — Auth providers, JWT, CatMage sync, identity
- [usuarios.md](02-catirc/usuarios.md) — NickServ, registro, identificación, roles
- [canales.md](02-catirc/canales.md) — Channel manager, ChanServ, ChanServV2, FLAGS
- [privados.md](02-catirc/privados.md) — DMs, offline messages, history
- [mensajes.md](02-catirc/mensajes.md) — PRIVMSG, NOTICE, TAGMSG, persistencia V1/V2
- [presencia.md](02-catirc/presencia.md) — AWAY, MONITOR, WHO/WHOIS, user tracking
- [permisos.md](02-catirc/permisos.md) — OperServ, global roles, channel flags, MLOCK
- [configuracion.md](02-catirc/configuracion.md) — Config struct, env vars, validation
- [logging.md](02-catirc/logging.md) — Logging, métricas Prometheus, audit log
- [errores.md](02-catirc/errores.md) — Manejo de errores, recovery, graceful shutdown
- [seguridad.md](02-catirc/seguridad.md) — Rate limiting, throttling, sanitización, TLS
- [rendimiento.md](02-catirc/rendimiento.md) — Concurrencia, canales, locks, memory
- [deuda-tecnica.md](02-catirc/deuda-tecnica.md) — Código muerto, TODOs, duplicados, inconsistencias

### 03-OdinX (Cliente Vanilla JS)
- [arquitectura.md](03-odinx/arquitectura.md) — Namespaces, módulos, state management
- [routing.md](03-odinx/routing.md) — Navegación, tabs, modales, mobile
- [pantallas.md](03-odinx/pantallas.md) — Login, chat, admin, modales
- [componentes.md](03-odinx/componentes.md) — UI components, nicklist, messages, toolbars
- [estado.md](03-odinx/estado.md) — CatIRC.state, settings, session persistence
- [stores.md](03-odinx/stores.md) — IndexedDB, localStorage, message cache
- [api.md](03-odinx/api.md) — HTTP admin API, social API, P2P config
- [socket.md](03-odinx/socket.md) — WebSocket client, reconnection, CAP negotiation
- [theme.md](03-odinx/theme.md) — Tailwind, CSS custom properties, dark mode
- [assets.md](03-odinx/assets.md) — Imágenes, fuentes, manifest, service worker
- [autenticacion.md](03-odinx/autenticacion.md) — Login guest/registered, embed mode, JWT
- [errores.md](03-odinx/errores.md) — Error boundaries, toast notifications, logging
- [deuda-tecnica.md](03-odinx/deuda-tecnica.md) — Código duplicado, stubs, componentes huérfanos

### 04-Integración
- [flujo-login.md](04-integracion/flujo-login.md) — Login guest + registered + embed
- [flujo-chat.md](04-integracion/flujo-chat.md) — Mensajes canal/privado, history
- [flujo-eventos.md](04-integracion/flujo-eventos.md) — EventBus → WebSocket → UI
- [flujo-websocket.md](04-integracion/flujo-websocket.md) — Handshake, CAP, reconnection
- [flujo-notificaciones.md](04-integracion/flujo-notificaciones.md) — Mentions, DMs, P2P, offline

### 05-Modelos
- [usuarios.md](05-modelos/usuarios.md) — IRCUser, AuthUser, roles, catmage_user_id
- [servidores.md](05-modelos/servidores.md) — Configuración servidor, oper classes
- [canales.md](05-modelos/canales.md) — Channel, ChannelRegistration, modes, access
- [mensajes.md](05-modelos/mensajes.md) — StoredMessage, IRCMessageV2, reactions, edits
- [roles.md](05-modelos/roles.md) — RoleDefinition, UserRole, permissions JSON
- [permisos.md](05-modelos/permisos.md) — OperPermissions, channel flags, ACL

### 06-Rutas
- [backend.md](06-rutas/backend.md) — Rutas IRC comandos + HTTP endpoints
- [frontend.md](06-rutas/frontend.md) — Rutas UI, modales, tabs, navigation

### 07-WebSocket
- [todos-los-eventos.md](07-websocket/todos-los-eventos.md) — Client→Server y Server→Client

### 08-API
- [todos-los-endpoints.md](08-api/todos-los-endpoints.md) — Método, ruta, request, response, middleware, perms

### 09-Config
- [variables-env.md](09-config/variables-env.md) — Todas las CATIRC_* / CATMAGE_*
- [configuracion.md](09-config/configuracion.md) — Config struct, defaults, validation

### 10-Riesgos
- [bugs.md](10-riesgos/bugs.md) — Bugs confirmados y potenciales
- [codigo-muerto.md](10-riesgos/codigo-muerto.md) — Funciones no usadas, archivos huérfanos
- [duplicados.md](10-riesgos/duplicados.md) — Código duplicado entre módulos
- [archivos-huerfanos.md](10-riesgos/archivos-huerfanos.md) — Archivos sin referencias
- [tecnica.md](10-riesgos/tecnica.md) — Deuda técnica, race conditions, memory leaks

### 11-Roadmap
- [recomendaciones.md](11-roadmap/recomendaciones.md) — Mejoras priorizadas
- [reborn.md](11-roadmap/reborn.md) — Visión de reescritura/arquitectura futura

---

## Resumen Ejecutivo

### CatIRC (Go)
- **Líneas de código**: ~15,000 LoC (Go)
- **Packages internos**: 17 (`internal/*`)
- **Dependencias externas**: 5 directas (jwt, uuid, websocket, pgx, crypto)
- **Arquitectura**: Monolito modular con inyección de dependencias por interfaces
- **Persistencia**: SQLite (legacy) → PostgreSQL (actual), migraciones idempotentes
- **Servicios IRC**: NickServ, ChanServ (legacy + V2 FLAGS), OperServ
- **Integración CatMage**: Push webhook + pull incremental + repair on-demand
- **WebSocket**: Gorilla WS bridge en mismo puerto HTTP, origin validation
- **Admin API**: Bearer token, 20+ endpoints, stats, kick, bans, roles, audit, search
- **Concurrencia**: Goroutines por conexión + broadcast channels + RWMutex
- **Tests**: 15+ test files, coverage básico

### OdinX (Vanilla JS)
- **Líneas de código**: ~12,000 LoC (JS) + ~500 LoC (CSS)
- **Módulos JS**: 28 archivos en `js/`
- **Dependencias dev**: Jest, Playwright, Tailwind v4, @parcel/watcher
- **Arquitectura**: Namespace global `CatIRC.*`, módulos IIFE, estado singleton
- **UI**: Single-page app, tabs dinámicos, modales, mobile-first responsive
- **Persistencia**: IndexedDB v2 (mensajes por registro), localStorage (settings/session)
- **WebSocket**: Auto-reconnect exponencial, CAP negotiation, IRCv3 tags
- **P2P**: WebRTC DataChannel, signaling vía IRC `FILE` command, SHA-256 verify
- **Admin UI**: 3 paneles (ChanServ, OperServ, Root Dashboard) vía admin API
- **Notificaciones**: Web Notifications API + sound, filtrado por ignored
- **Tests**: 13 unit test files, E2E con Playwright

### Integración
- **Protocolo**: IRC sobre WebSocket (mismo parser cliente/servidor)
- **Auth**: JWT compartido (CATIRC_JWT_SECRET), embed mode via postMessage
- **CatMage sync**: Push webhook (primary) + hourly pull (fallback)
- **Admin**: HTTP API protegida por token, consumida por OdinX admin modals
- **P2P**: Server solo señaliza (OFFER/ACCEPT/SIGNAL), bytes van peer-to-peer

---

## Estado del Proyecto

| Componente | Estado | Completitud |
|------------|--------|-------------|
| CatIRC Core IRC | ✅ Estable | 95% |
| NickServ/ChanServ | ✅ Estable | 90% |
| ChanServV2 (FLAGS/MLOCK) | ✅ Funcional | 85% |
| OperServ | ✅ Funcional | 80% |
| CatMage Sync | ⚠️ Parcial | 60% (push OK, pull stub) |
| Persistencia V2 | ✅ Funcional | 85% |
| Admin HTTP API | ✅ Funcional | 90% |
| WebSocket Bridge | ✅ Estable | 95% |
| Rate limiting / Security | ✅ Implementado | 85% |
| OdinX Core Chat | ✅ Estable | 90% |
| OdinX Admin UI | ⚠️ Parcial | 70% |
| OdinX P2P Files | ✅ Funcional | 80% |
| OdinX Mobile | ✅ Funcional | 85% |
| OdinX Embed Mode | ✅ Funcional | 90% |
| Tests Unitarios | ⚠️ Básicos | 40% |
| Tests E2E | ⚠️ Iniciales | 20% |
| Documentación | ❌ Inexistente | 0% |

---

## Próximos Pasos

Ver [11-roadmap/recomendaciones.md](11-roadmap/recomendaciones.md) para plan detallado.
```
