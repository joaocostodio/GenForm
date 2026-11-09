import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AvisoService } from './shared/aviso.service';
import { PaletaComandos } from './shared/paleta-comandos';
import { RodapeMarca } from './shared/rodape-marca';

@Component({
  imports: [RouterOutlet, RodapeMarca, PaletaComandos],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  protected readonly aviso = inject(AvisoService);
}
