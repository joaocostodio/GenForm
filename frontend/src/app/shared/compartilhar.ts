import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { FormulariosService } from '../services/formularios.service';
import { AvisoService } from './aviso.service';
import { EnderecoService } from './endereco.service';

type Aba = 'link' | 'qr' | 'incorporar';

/** Janela "Enviar formulário": link, QR code e código para incorporar (iframe). */
@Component({
  selector: 'app-compartilhar',
  template: `
    <dialog #dialogo class="dialogo" (click)="fecharNoFundo($event)" aria-labelledby="titulo-compartilhar">
      <div class="conteudo">
        <div class="linha">
          <h2 id="titulo-compartilhar">Enviar formulário</h2>
          <span class="espaco"></span>
          <button type="button" class="btn-icone" (click)="fechar()" aria-label="Fechar">✕</button>
        </div>

        <nav class="abas-dialogo" role="tablist">
          <button type="button" role="tab" [class.ativa]="aba() === 'link'" [attr.aria-selected]="aba() === 'link'" (click)="aba.set('link')">🔗 Link</button>
          <button type="button" role="tab" [class.ativa]="aba() === 'qr'" [attr.aria-selected]="aba() === 'qr'" (click)="aba.set('qr')">▣ QR code</button>
          <button type="button" role="tab" [class.ativa]="aba() === 'incorporar'" [attr.aria-selected]="aba() === 'incorporar'" (click)="aba.set('incorporar')">&lt;/&gt; Incorporar</button>
        </nav>

        @if (endereco.emLocalhost) {
          <div class="aviso-rede">
            <p>
              <strong>O GenForm está rodando no seu computador.</strong> Para abrir em outro aparelho, o link usa o
              endereço do seu PC na rede, e o outro aparelho precisa estar <strong>no mesmo Wi-Fi</strong>.
            </p>
            @if (endereco.opcoes().length > 1) {
              <label class="linha">
                <span>Endereço:</span>
                <select class="campo-caixa flex" [value]="endereco.base()" (change)="endereco.escolher($any($event.target).value)">
                  @for (o of endereco.opcoes(); track o.base) {
                    <option [value]="o.base">{{ o.rotulo }}</option>
                  }
                </select>
              </label>
              <p class="suave">Se não abrir, tente outro endereço da lista (o do Wi-Fi costuma ser o certo).</p>
            }
          </div>
        }

        @switch (aba()) {
          @case ('link') {
            <label class="campo-rotulado">
              <span>Link para responder</span>
              <input class="campo-caixa" [value]="link()" readonly (focus)="selecionar($event)" />
            </label>
            <p class="suave">Qualquer pessoa com este link pode responder{{ exigeLogin() ? ' (depois de fazer login)' : '' }}.</p>
            <div class="linha fim">
              <button type="button" class="btn" (click)="copiar(link(), 'Link copiado')">Copiar link</button>
            </div>
          }
          @case ('qr') {
            <div class="qr">
              <img [src]="urlQr()" width="220" height="220" alt="QR code do link do formulário" />
            </div>
            <p class="suave centro">Aponte a câmera do celular para abrir o formulário.</p>
            <div class="linha fim">
              <a class="btn" [href]="urlQr()" download="qrcode-formulario.svg">Baixar QR code</a>
            </div>
          }
          @case ('incorporar') {
            <label class="campo-rotulado">
              <span>Código HTML</span>
              <textarea class="campo-caixa codigo" rows="4" readonly (focus)="selecionar($event)">{{ codigoIframe() }}</textarea>
            </label>
            <p class="suave">Cole em um site ou blog para mostrar o formulário dentro da página.</p>
            <div class="linha fim">
              <button type="button" class="btn" (click)="copiar(codigoIframe(), 'Código copiado')">Copiar código</button>
            </div>
          }
        }
      </div>
    </dialog>
  `,
  styles: `
    .abas-dialogo {
      display: flex;
      gap: 4px;
      margin: 8px 0 16px;
      border-bottom: 1px solid var(--borda);
    }
    .abas-dialogo button {
      padding: 10px 12px;
      border: 0;
      border-bottom: 3px solid transparent;
      background: none;
      color: var(--texto-suave);
      font-weight: 600;
      cursor: pointer;
    }
    .abas-dialogo .ativa {
      color: var(--cor);
      border-bottom-color: var(--cor);
    }
    .qr {
      display: grid;
      place-items: center;
      padding: 8px;
    }
    .codigo {
      width: 100%;
      font-family: Consolas, monospace;
      font-size: 13px;
      resize: none;
    }
    .centro {
      text-align: center;
    }
    .fim {
      justify-content: flex-end;
    }
    .aviso-rede {
      margin-bottom: 12px;
      padding: 10px 12px;
      border-radius: var(--raio);
      background: #fff8e1;
      border: 1px solid #f9e3a3;
      font-size: 13px;
    }
    .aviso-rede p {
      margin: 0 0 8px;
    }
    .aviso-rede p:last-child {
      margin: 6px 0 0;
    }
  `,
})
export class Compartilhar {
  private readonly api = inject(FormulariosService);
  private readonly aviso = inject(AvisoService);
  protected readonly endereco = inject(EnderecoService);
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  readonly formId = input.required<string>();
  readonly exigeLogin = input(false);

  protected readonly aba = signal<Aba>('link');
  protected readonly link = computed(() => this.endereco.link(this.formId()));
  protected readonly urlQr = computed(() => this.api.urlQrCode(this.formId(), this.link()));
  protected readonly codigoIframe = computed(
    () => `<iframe src="${this.link()}?incorporado=1" width="640" height="800" style="border:0" title="Formulário">Carregando…</iframe>`,
  );

  abrir() {
    this.endereco.carregar();
    this.aba.set('link');
    this.dialogo().nativeElement.showModal();
  }

  protected fechar() {
    this.dialogo().nativeElement.close();
  }

  /** Clique fora da caixa (no fundo escuro) fecha. */
  protected fecharNoFundo(evento: MouseEvent) {
    if (evento.target === this.dialogo().nativeElement) this.fechar();
  }

  protected selecionar(evento: FocusEvent) {
    (evento.target as HTMLInputElement | HTMLTextAreaElement).select();
  }

  protected copiar(texto: string, mensagem: string) {
    this.aviso.copiar(texto, mensagem);
  }
}
