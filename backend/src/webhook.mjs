// Aviso automático a cada resposta: o servidor faz um POST na URL que o dono
// configurou (webhook do Discord, do Slack ou de qualquer outro sistema).

/** Só https e só endereços públicos: o servidor não pode ser usado para acessar a rede interna. */
export function urlWebhookValida(valor) {
  if (typeof valor !== 'string' || valor.length > 500) return false;
  let url;
  try {
    url = new URL(valor.trim());
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (/^[\d.]+$/.test(host)) return !ipv4Privado(host);
  if (host.includes(':')) return false; // IPv6 literal: bloqueia por segurança
  return true;
}

function ipv4Privado(ip) {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

const curto = (t, max) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);

function formatar(v) {
  if (v === undefined || v === null) return '—';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return Object.entries(v).map(([l, c]) => `${l}: ${c}`).join('; ');
  return String(v);
}

/** Mensagem legível + os dados crus, para quem quiser integrar com outro sistema. */
export function montarAviso(form, resposta, total) {
  const perguntas = form.secoes.flatMap((s) => s.perguntas);
  const linhas = perguntas
    .filter((p) => p.id in resposta.valores)
    .slice(0, 8)
    .map((p) => `• **${curto(p.titulo || 'Pergunta', 80)}:** ${curto(formatar(resposta.valores[p.id]), 200)}`);
  const quem = resposta.respondente ? ` por ${resposta.respondente.nome}` : '';
  const nota = resposta.nota ? `\nNota: **${resposta.nota.pontos}/${resposta.nota.total}**` : '';
  const texto = curto(`📬 Nova resposta${quem} em **${form.titulo}** (total: ${total})${nota}\n${linhas.join('\n')}`, 1900);
  return {
    content: texto, // Discord
    text: texto, // Slack
    formulario: { id: form.id, titulo: form.titulo },
    resposta,
  };
}

/** Envia sem travar a resposta de quem está respondendo. Devolve o status HTTP (ou lança erro). */
export async function enviarWebhook(url, corpo) {
  if (!urlWebhookValida(url)) throw new Error('URL de webhook inválida');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'GenForm-Webhook' },
    body: JSON.stringify(corpo),
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  return res.status;
}
