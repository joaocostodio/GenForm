// /api/rede — endereços desta máquina na rede local (só em desenvolvimento).
//
// Por quê: rodando no seu PC, o site abre como http://localhost:4200, e "localhost"
// só existe no próprio computador. Para o link e o QR code funcionarem no celular
// ou no PC de um colega (na mesma rede Wi-Fi), o frontend usa um destes IPs.
import { Router } from 'express';
import { networkInterfaces } from 'node:os';

export const rotasRede = Router();

// Placas virtuais (WSL, VirtualBox, VPN...) quase nunca são a rede que os colegas usam.
const VIRTUAL = /vethernet|virtual|vbox|vmware|hyper-v|wsl|docker|vpn|radmin|hamachi|zerotier|tailscale|loopback/i;

function prioridade(nome, ip) {
  if (VIRTUAL.test(nome) || ip.startsWith('192.168.56.')) return 0; // 192.168.56.x = VirtualBox
  if (/wi-?fi|wlan|wireless/i.test(nome)) return 3;
  if (/^(ethernet|eth|en)/i.test(nome)) return 2;
  return 1;
}

rotasRede.get('/', (_req, res) => {
  if (process.env.NODE_ENV === 'production') return res.json({ enderecos: [] });

  const enderecos = Object.entries(networkInterfaces())
    .flatMap(([nome, lista]) =>
      (lista ?? [])
        .filter((e) => e.family === 'IPv4' && !e.internal && !e.address.startsWith('169.254.'))
        .map((e) => ({ ip: e.address, interface: nome, prioridade: prioridade(nome, e.address) })),
    )
    .sort((a, b) => b.prioridade - a.prioridade);

  res.json({ enderecos });
});
