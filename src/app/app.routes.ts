import { Routes } from '@angular/router'
import { authGuard } from './core/guards/auth.guard'

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'chat',
    loadComponent: () => import('./features/chat/chat-shell.component').then(m => m.ChatShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/chat/chat-page.component').then(m => m.ChatPageComponent),
        children: [
          {
            path: ':id',
            loadComponent: () => import('./features/chat/chat-window.component').then(m => m.ChatWindowComponent)
          },
          {
            path: '',
            loadComponent: () => import('./features/chat/chat-window.component').then(m => m.ChatWindowComponent)
          }
        ]
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'channels',
        loadComponent: () => import('./features/chat/channels.component').then(m => m.ChannelsComponent)
      },
      {
        path: 'agents',
        loadComponent: () => import('./features/chat/agents.component').then(m => m.AgentsComponent)
      }
    ]
  },
  { path: '', redirectTo: '/chat', pathMatch: 'full' },
  { path: '**', redirectTo: '/chat' }
]
