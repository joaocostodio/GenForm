import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AvisoService } from './shared/aviso.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('cria o app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('mostra o aviso flutuante quando há mensagem', async () => {
    const fixture = TestBed.createComponent(App);
    TestBed.inject(AvisoService).mostrar('Link copiado');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.aviso-flutuante')?.textContent).toContain('Link copiado');
  });
});
