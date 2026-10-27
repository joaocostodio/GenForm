import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AvisoService } from './shared/aviso.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  protected readonly aviso = inject(AvisoService);
}
