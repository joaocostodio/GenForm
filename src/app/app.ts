import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('Projeto Aula Angular');
  protected readonly cliques = signal(0);

  protected incrementar() {
    this.cliques.update((n) => n + 1);
  }
}
