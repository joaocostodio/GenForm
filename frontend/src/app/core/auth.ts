// Guards de rota e interceptor HTTP ligados ao login.
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Só deixa entrar quem está logado; senão manda para /entrar e volta depois. */
export const exigeLogin: CanActivateFn = (_rota, estado) => {
  if (inject(AuthService).logado()) return true;
  return inject(Router).createUrlTree(['/entrar'], { queryParams: { voltar: estado.url } });
};

/** Telas de entrar/criar conta: quem já está logado vai direto para o painel. */
export const soVisitante: CanActivateFn = () => {
  return inject(AuthService).logado() ? inject(Router).createUrlTree(['/']) : true;
};

/** Se a API responder 401 (sessão expirou), limpa o usuário e leva para o login. */
export const sessaoExpiradaInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req).pipe(
    catchError((erro: HttpErrorResponse) => {
      if (erro.status === 401 && req.url.startsWith('/api/forms')) {
        auth.esquecer();
        router.navigate(['/entrar'], { queryParams: { voltar: router.url } });
      }
      return throwError(() => erro);
    }),
  );
};

/** Lê a URL de retorno com segurança (só caminhos internos, nada de //site-externo). */
export function caminhoInterno(voltar: string | null | undefined): string {
  return voltar && voltar.startsWith('/') && !voltar.startsWith('//') ? voltar : '/';
}
