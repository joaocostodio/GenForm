import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

export interface OpcaoEndereco {
  base: string;
  rotulo: string;
}

const CHAVE = 'genform.enderecoLink';
const HOSTS_LOCAIS = ['localhost', '127.0.0.1', '[::1]', '::1'];

/**
 * Decide o endereço usado no link e no QR code.
 *
 * Publicado na internet, é o próprio endereço do site. Rodando no seu PC
 * (http://localhost:4200), "localhost" não funciona em outro aparelho, então
 * usamos o IP do computador na rede local (ex: http://10.5.131.18:4200).
 */
@Injectable({ providedIn: 'root' })
export class EnderecoService {
  private readonly http = inject(HttpClient);

  /** true quando o site foi aberto como localhost */
  readonly emLocalhost = HOSTS_LOCAIS.includes(location.hostname);
  readonly opcoes = signal<OpcaoEndereco[]>([]);
  readonly base = signal(location.origin);
  private carregado = false;

  carregar() {
    if (!this.emLocalhost || this.carregado) return;
    this.carregado = true;
    this.http.get<{ enderecos: { ip: string; interface: string }[] }>('/api/rede').subscribe({
      next: ({ enderecos }) => {
        const porta = location.port ? `:${location.port}` : '';
        const opcoes = enderecos.map((e) => ({ base: `${location.protocol}//${e.ip}${porta}`, rotulo: `${e.ip} (${e.interface})` }));
        opcoes.push({ base: location.origin, rotulo: `${location.host} (só funciona neste computador)` });
        this.opcoes.set(opcoes);
        const salvo = lerSalvo();
        this.base.set(opcoes.find((o) => o.base === salvo)?.base ?? opcoes[0].base);
      },
      error: () => (this.carregado = false),
    });
  }

  escolher(base: string) {
    this.base.set(base);
    try {
      localStorage.setItem(CHAVE, base);
    } catch {
      // navegador sem localStorage: só não lembra a escolha
    }
  }

  link(formId: string) {
    return `${this.base()}/f/${formId}`;
  }
}

function lerSalvo() {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}
