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

  protected readonly form = this.fb.group({
    aceitandoRespostas: true,
    exigirLogin: false,
    umaRespostaPorPessoa: false,
    permitirOutraResposta: true,
    mensagemConfirmacao: '',
    dataLimite: '',
    limiteRespostas: this.fb.control<number | null>(null),
    embaralharPerguntas: false,
    barraProgresso: true,
    modoTeste: false,
    mostrarNota: true,
  });

  ngOnInit() {
    this.api.buscar(this.id()).subscribe({
      next: (f) => {
        this.dados.set(f);
        this.form.patchValue({ ...f.config, dataLimite: paraCampoLocal(f.config.dataLimite) }, { emitEvent: false });
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
      limiteRespostas: v.limiteRespostas && v.limiteRespostas > 0 ? v.limiteRespostas : null,
    };
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
