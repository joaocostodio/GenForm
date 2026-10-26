import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Formulario, FormularioEntrada, FormularioResumo, Resposta, ValorResposta } from '../models/formulario';

/** Todas as chamadas para a API Node (server/server.mjs). */
@Injectable({ providedIn: 'root' })
export class FormulariosService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/forms';

  listar() {
    return this.http.get<FormularioResumo[]>(this.base);
  }

  buscar(id: string) {
    return this.http.get<Formulario>(`${this.base}/${id}`);
  }

  criar(dados: Partial<FormularioEntrada> = {}) {
    return this.http.post<Formulario>(this.base, dados);
  }

  salvar(id: string, dados: FormularioEntrada) {
    return this.http.put<Formulario>(`${this.base}/${id}`, dados);
  }

  excluir(id: string) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  listarRespostas(id: string) {
    return this.http.get<Resposta[]>(`${this.base}/${id}/respostas`);
  }

  responder(id: string, valores: Record<string, ValorResposta>) {
    return this.http.post<Resposta>(`${this.base}/${id}/respostas`, { valores });
  }

  excluirResposta(id: string, respostaId: string) {
    return this.http.delete<void>(`${this.base}/${id}/respostas/${respostaId}`);
  }

  excluirTodasRespostas(id: string) {
    return this.http.delete<void>(`${this.base}/${id}/respostas`);
  }
}
