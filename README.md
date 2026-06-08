# ChatHub Frontend — Angular 17

Panel de atención multicanal: WhatsApp, Instagram, Email, WebChat.

## Requisitos

- Node.js 18+
- Angular CLI: `npm install -g @angular/cli`

## Instalación

```powershell
cd chathub-angular
npm install
```

## Correr en desarrollo

```powershell
ng serve
# Abre http://localhost:4200
```

## Credenciales de prueba

| Email | Password | Rol |
|---|---|---|
| admin@chathub.com | password | Admin |
| supervisor@chathub.com | password | Supervisor |
| agente.norte@chathub.com | password | Agente |

## Estructura

```
src/app/
├── core/
│   ├── guards/         auth.guard.ts
│   ├── interceptors/   auth.interceptor.ts (adjunta JWT a cada request)
│   └── services/
│       ├── auth.service.ts    (login, logout, usuario actual)
│       ├── api.service.ts     (todos los endpoints REST)
│       └── socket.service.ts  (Socket.io tiempo real)
├── features/
│   ├── auth/           login.component.ts
│   ├── chat/
│   │   ├── chat-shell.component.ts      (layout con sidebar)
│   │   ├── chat-page.component.ts       (lista + ventana)
│   │   ├── sidebar.component.ts
│   │   ├── conversation-list.component.ts
│   │   ├── chat-window.component.ts     (mensajes + envío)
│   │   ├── channels.component.ts        (gestión de canales)
│   │   └── agents.component.ts          (gestión de agentes)
│   └── dashboard/      dashboard.component.ts
└── app.routes.ts
```

## Cambiar URL de la API

Edita `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',    // URL del backend Node.js
  socketUrl: 'http://localhost:3000'
}
```
