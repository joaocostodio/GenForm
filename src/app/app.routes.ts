import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', title: 'Formulários', loadComponent: () => import('./pages/painel/painel').then((m) => m.Painel) },
  { path: 'forms/:id/editar', title: 'Editar formulário', loadComponent: () => import('./pages/editor/editor').then((m) => m.Editor) },
  { path: 'forms/:id/respostas', title: 'Respostas', loadComponent: () => import('./pages/respostas/respostas').then((m) => m.Respostas) },
  { path: 'f/:id', title: 'Responder', loadComponent: () => import('./pages/responder/responder').then((m) => m.Responder) },
  { path: '**', redirectTo: '' },
];
