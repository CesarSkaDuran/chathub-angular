import { Routes } from '@angular/router'
import { authGuard } from './core/guards/auth.guard'

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'chat',
    loadComponent: () => import('./features/components/chat/chat-shell.component').then(m => m.ChatShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'channels',
        loadComponent: () => import('./features/components/channels/channels.component').then(m => m.ChannelsComponent)
      },
      {
        path: 'agents',
        loadComponent: () => import('./features/components/agents/agents.component').then(m => m.AgentsComponent)
      },
      {
        path: '',
        loadComponent: () => import('./features/components/chat/chat-page.component').then(m => m.ChatPageComponent),
        children: [
          {
            path: ':id',
            loadComponent: () => import('./features/components/chat/chat-window.component').then(m => m.ChatWindowComponent)
          },
          {
            path: '',
            loadComponent: () => import('./features/components/chat/chat-window.component').then(m => m.ChatWindowComponent)
          }
        ]
      }
    ]
  },
  { path: '', redirectTo: '/chat', pathMatch: 'full' },
  { path: '**', redirectTo: '/chat' }
]
