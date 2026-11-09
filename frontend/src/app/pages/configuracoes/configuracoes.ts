import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { concatMap, debounceTime, tap } from 'rxjs';
import { ConfigForm, Formulario } from '../../models/formulario';
import { FormulariosService } from '../../services/formularios.service';
import { CabecalhoForm } from '../../shared/cabecalho-form';

/** "2026-10-26T15:30:00.000Z" -> "2026-10-26T12:30" (formato do <input type="datetime-local">, hora local) */
function paraCampoLocal(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const doisDigitos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}T${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

@Component({
  selector: 'app-configuracoes',
  imports: [ReactiveFormsModule, CabecalhoForm],
  templateUrl: './configuracoes.html',
  styleUrl: './configuracoes.css',
})
export class Configuracoes implements OnInit {
  private readonly api = inject(FormulariosService);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);

  readonly id = input.required<string>();

  protected readonly dados = signal<Formulario | null>(null);
  protected readonly status = signal<'carregando' | 'pronto' | 'erro' | 'nao-encontrado'>('carregando');
  protected readonly salvo = signal('');

  protected readonly webhookStatus = signal<{ ok: boolean; texto: string } | null>(null);
  protected readonly testandoWebhook = signal(false);

  protected readonly form = this.fb.group({
    dataAbertura: '',
    codigoAcesso: '',
    tempoLimite: this.fb.control<number | null>(null),
    webhook: '',
    aceitandoRespostas: true,
    exigirLogin: false,
    umaRespostaPorPessoa: false,
    permitirOutraResposta: true,
    mensagemConfirmacao: '',
    dataLimite: '',
    limiteRespostas: this.fb.control<number | null>(null),
    embaralharPerguntas: false,
    barraProgresso: true,
    umaPorVez: false,
    modoTeste: false,
    mostrarNota: true,
  });

  ngOnInit() {
    this.api.buscar(this.id()).subscribe({
      next: (f) => {
        this.dados.set(f);
        this.form.patchValue(
          {
            ...f.config,
            dataLimite: paraCampoLocal(f.config.dataLimite),
            dataAbertura: paraCampoLocal(f.config.dataAbertura ?? null),
            codigoAcesso: f.config.codigoAcesso ?? '',
            webhook: f.config.webhook ?? '',
          },
          { emitEvent: false },
        );
        this.ajustarDependencias();
        this.status.set('pronto');
        this.ativarSalvamento();
      },
      error: () => this.status.set('nao-encontrado'),
    });
  }

  /** "1 resposta por pessoa" só faz sentido quando exige login. */
  private ajustarDependencias() {
    const c = this.form.controls;
    if (c.exigirLogin.value) c.umaRespostaPorPessoa.enable({ emitEvent: false });
    else c.umaRespostaPorPessoa.disable({ emitEvent: false });
  }

  private paraModelo(): Partial<ConfigForm> {
    const v = this.form.getRawValue();
    return {
      ...v,
      umaRespostaPorPessoa: v.exigirLogin && v.umaRespostaPorPessoa,
      dataLimite: v.dataLimite ? new Date(v.dataLimite).toISOString() : null,
      dataAbertura: v.dataAbertura ? new Date(v.dataAbertura).toISOString() : null,
      limiteRespostas: v.limiteRespostas && v.limiteRespostas > 0 ? v.limiteRespostas : null,
      tempoLimite: v.tempoLimite && v.tempoLimite > 0 ? v.tempoLimite : null,
      codigoAcesso: v.codigoAcesso.trim(),
      webhook: v.webhook.trim(),
    };
  }

  limparAbertura() {
    this.form.controls.dataAbertura.setValue('');
  }

  /** Manda uma mensagem de teste para o Discord/Slack. */
  testarWebhook() {
    const url = this.form.controls.webhook.value.trim();
    if (!url) return;
    this.testandoWebhook.set(true);
    this.webhookStatus.set(null);
    this.api.testarWebhook(this.id(), url).subscribe({
      next: () => {
        this.testandoWebhook.set(false);
        this.webhookStatus.set({ ok: true, texto: 'Mensagem de teste enviada! Confira o canal.' });
      },
      error: (erro) => {
        this.testandoWebhook.set(false);
        this.webhookStatus.set({ ok: false, texto: erro.error?.erro ?? 'Não foi possível enviar.' });
      },
    });
  }

  private ativarSalvamento() {
    this.form.valueChanges
      .pipe(
        tap(() => {
          this.ajustarDependencias();
          this.salvo.set('Salvando...');
        }),
        debounceTime(500),
        concatMap(() => this.api.salvarConfig(this.id(), this.paraModelo())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (f) => {
          this.dados.set(f);
          this.salvo.set('Configurações salvas');
        },
        error: () => {
          this.salvo.set('Erro ao salvar — verifique o servidor');
          this.ativarSalvamento();
        },
      });
  }

  limparPrazo() {
    this.form.controls.dataLimite.setValue('');
  }
}
