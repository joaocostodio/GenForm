import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ConfigForm,
  ConteudoForm,
  EnvioExtras,
  EventoAoVivo,
  Formulario,
  FormularioPublico,
  FormularioResumo,
  NovoForm,
  Resposta,
  ResultadoEnvio,
  ValorResposta,
} from '../models/formulario';

/** Chamadas para a API de formulários do backend (backend/src/rotas/forms.mjs e publico.mjs). */
@Injectable({ providedIn: 'root' })
export class FormulariosService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/forms';

  // ---------- Dono (precisa estar logado) ----------

  listar() {
    return this.http.get<FormularioResumo[]>(this.base);
  }

  buscar(id: string) {
    return this.http.get<Formulario>(`${this.base}/${id}`);
  }

  criar(dados: NovoForm = {}) {
    return this.http.post<Formulario>(this.base, dados);
  }

  /** Salva o conteúdo (editor). */
  salvar(id: string, dados: ConteudoForm) {
    return this.http.put<Formulario>(`${this.base}/${id}`, dados);
  }

  /** Salva só as configurações. */
  salvarConfig(id: string, config: Partial<ConfigForm>) {
    return this.http.put<Formulario>(`${this.base}/${id}`, { config });
  }

  duplicar(id: string) {
    return this.http.post<Formulario>(`${this.base}/${id}/duplicar`, {});
  }

  excluir(id: string) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  urlQrCode(id: string, link: string) {
    return `${this.base}/${id}/qr?link=${encodeURIComponent(link)}`;
  }

  listarRespostas(id: string) {
    return this.http.get<Resposta[]>(`${this.base}/${id}/respostas`);
  }

  excluirResposta(id: string, respostaId: string) {
    return this.http.delete<void>(`${this.base}/${id}/respostas/${respostaId}`);
  }

  excluirTodasRespostas(id: string) {
    return this.http.delete<void>(`${this.base}/${id}/respostas`);
  }

  /**
   * Respostas chegando em tempo real (Server-Sent Events).
   * O EventSource reconecta sozinho; ao se inscrever abre a conexão e ao cancelar fecha.
   */
  aoVivo(id: string) {
    return new Observable<EventoAoVivo>((assinante) => {
      const fonte = new EventSource(`${this.base}/${id}/ao-vivo`);
      fonte.onmessage = (e) => assinante.next(JSON.parse(e.data) as EventoAoVivo);
      return () => fonte.close();
    });
  }

  /** Manda uma mensagem de teste para o webhook (Discord, Slack...). */
  testarWebhook(id: string, url: string) {
    return this.http.post<{ ok: boolean }>(`${this.base}/${id}/webhook/teste`, { url });
  }

  // ---------- Quem responde (link público) ----------

  /** O código de acesso vai no cabeçalho, nunca na URL. */
  private cabecalhoCodigo(codigo?: string) {
    return codigo ? new HttpHeaders({ 'x-codigo-acesso': codigo }) : undefined;
  }

  abrirPublico(id: string, codigo?: string) {
    return this.http.get<FormularioPublico>(`/api/publico/${id}`, { headers: this.cabecalhoCodigo(codigo) });
  }

  responder(id: string, valores: Record<string, ValorResposta>, extras: EnvioExtras = {}) {
    const { codigo, ...resto } = extras;
    return this.http.post<ResultadoEnvio>(`/api/publico/${id}/respostas`, { valores, ...resto }, { headers: this.cabecalhoCodigo(codigo) });
  }
}
