// "Banco de dados" em arquivo JSON. Simples de entender e suficiente para a aula.
// Estrutura: { forms: Form[], respostas: { [formId]: Resposta[] } }
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pasta = dirname(fileURLToPath(import.meta.url));
const arquivo = process.env.DB_FILE ?? join(pasta, 'data', 'db.json');

let cache = null;
let filaDeEscrita = Promise.resolve();

export async function ler() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(arquivo, 'utf8'));
  } catch (erro) {
    if (erro.code !== 'ENOENT') throw erro;
    cache = { forms: [], respostas: {} };
  }
  return cache;
}

// Grava em um arquivo temporário e renomeia, para não corromper o JSON
// se o processo cair no meio. A fila garante uma escrita por vez.
export function salvar() {
  filaDeEscrita = filaDeEscrita.then(async () => {
    await mkdir(dirname(arquivo), { recursive: true });
    const temp = `${arquivo}.tmp`;
    await writeFile(temp, JSON.stringify(cache, null, 2));
    await rename(temp, arquivo);
  });
  return filaDeEscrita;
}
