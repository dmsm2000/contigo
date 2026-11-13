// Falha se o projeto puder puxar pacotes de fora do registo público do npm (por exemplo, de um Nexus de empresa).
// Corre em `npm run check:registry` e no deploy, antes de instalar.
import { readFileSync } from 'node:fs';

const PUBLIC_REGISTRY = 'https://registry.npmjs.org/';
const problems = [];

// 1) O .npmrc do projeto tem de apontar para o registo público.
let npmrc = '';
try {
  npmrc = readFileSync('.npmrc', 'utf8');
} catch {
  problems.push('Falta o ficheiro .npmrc na raiz do projeto.');
}
const registryLine = npmrc.split('\n').find((line) => /^\s*registry\s*=/.test(line));
if (registryLine && registryLine.split('=')[1].trim() !== PUBLIC_REGISTRY) {
  problems.push(`O .npmrc aponta para ${registryLine.split('=')[1].trim()} em vez de ${PUBLIC_REGISTRY}`);
} else if (!registryLine && npmrc) {
  problems.push(`O .npmrc não define "registry=${PUBLIC_REGISTRY}".`);
}
if (/_auth|_password|_authToken|\/\/[^\s]+:_/i.test(npmrc)) {
  problems.push('O .npmrc tem credenciais. Tira-as: este ficheiro vai para o repositório público.');
}

// 2) Todos os pacotes do package-lock.json têm de vir do registo público.
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const foreign = new Map();
for (const [path, info] of Object.entries(lock.packages ?? {})) {
  if (info.resolved && /^https?:\/\//.test(info.resolved) && !info.resolved.startsWith(PUBLIC_REGISTRY)) {
    const host = new URL(info.resolved).host;
    foreign.set(host, (foreign.get(host) ?? 0) + 1);
  }
}
for (const [host, count] of foreign) {
  problems.push(`${count} pacotes do package-lock.json vêm de ${host}, que não é o registo público.`);
}

if (problems.length) {
  console.error('Registo de pacotes: PROBLEMAS\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log(`Registo de pacotes: ok (${Object.keys(lock.packages ?? {}).length - 1} pacotes, todos de ${PUBLIC_REGISTRY})`);
