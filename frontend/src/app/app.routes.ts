import { Routes } from '@angular/router';
import { exigeLogin, soVisitante } from './core/auth';

export const routes: Routes = [
  // Públicas
  { path: 'entrar', title: 'Entrar', canActivate: [soVisitante], data: { modo: 'entrar' },
    loadComponent: () => import('./pages/entrar/entrar').then((m) => m.Entrar) },
  { path: 'criar-conta', title: 'Criar conta', canActivate: [soVisitante], data: { modo: 'cadastro' },
    loadComponent: () => import('./pages/entrar/entrar').then((m) => m.Entrar) },
  { path: 'f/:id', title: 'Responder',
    loadComponent: () => import('./pages/responder/responder').then((m) => m.Responder) },

  // Precisam de login
  { path: '', title: 'Formulários', canActivate: [exigeLogin],
    loadComponent: () => import('./pages/painel/painel').then((m) => m.Painel) },
  { path: 'conta', title: 'Minha conta', canActivate: [exigeLogin],
    loadComponent: () => import('./pages/conta/conta').then((m) => m.Conta) },
  { path: 'forms/:id/editar', title: 'Editar formulário', canActivate: [exigeLogin],
    loadComponent: () => import('./pages/editor/editor').then((m) => m.Editor) },
  { path: 'forms/:id/respostas', title: 'Respostas', canActivate: [exigeLogin],
    loadComponent: () => import('./pages/respostas/respostas').then((m) => m.Respostas) },
  { path: 'forms/:id/configuracoes', title: 'Configurações', canActivate: [exigeLogin],
    loadComponent: () => import('./pages/configuracoes/configuracoes').then((m) => m.Configuracoes) },

  { path: '**', redirectTo: '' },
];
