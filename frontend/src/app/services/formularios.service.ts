import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  ConfigForm,
  ConteudoForm,
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

  // ---------- Quem responde (link público) ----------

  abrirPublico(id: string) {
    return this.http.get<FormularioPublico>(`/api/publico/${id}`);
  }

  responder(id: string, valores: Record<string, ValorResposta>) {
    return this.http.post<ResultadoEnvio>(`/api/publico/${id}/respostas`, { valores });
  }
}
