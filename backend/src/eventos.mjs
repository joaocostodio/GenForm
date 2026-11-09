// Avisos em tempo real (modo ao vivo).
// Quando chega uma resposta, a rota pública chama avisar(); as telas abertas
// em /api/forms/:id/ao-vivo (Server-Sent Events) recebem na hora.
import { EventEmitter } from 'node:events';

const canal = new EventEmitter();
// Uma turma inteira pode estar com a tela aberta: sem aviso de "vazamento".
canal.setMaxListeners(0);

/** Manda um evento para todo mundo que está ouvindo este formulário. */
export function avisar(formId, evento) {
  canal.emit(formId, evento);
}

/** Começa a ouvir um formulário. Devolve a função que para de ouvir. */
export function ouvir(formId, funcao) {
  canal.on(formId, funcao);
  return () => canal.off(formId, funcao);
}
