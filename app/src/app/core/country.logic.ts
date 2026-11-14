// Países na pesquisa de sítios: lógica pura, sem Angular nem rede, para se testar facilmente.

/** O que se percebeu do que foi escrito: o sítio, o país (se vinha escrito) e se só se escreveu o país. */
export interface ParsedSearch {
  city: string;
  countryCode: string | null;
  countryOnly: boolean;
}

/** As capitais, em inglês (a pesquisa encontra-as em qualquer língua), para "escrevi só o país". */
export const CAPITALS: Readonly<Record<string, string>> = {
  AF: 'Kabul', AL: 'Tirana', DZ: 'Algiers', AD: 'Andorra la Vella', AO: 'Luanda', AG: "Saint John's", AR: 'Buenos Aires',
  AM: 'Yerevan', AU: 'Canberra', AT: 'Vienna', AZ: 'Baku', BS: 'Nassau', BH: 'Manama', BD: 'Dhaka', BB: 'Bridgetown',
  BY: 'Minsk', BE: 'Brussels', BZ: 'Belmopan', BJ: 'Porto-Novo', BT: 'Thimphu', BO: 'Sucre', BA: 'Sarajevo', BW: 'Gaborone',
  BR: 'Brasília', BN: 'Bandar Seri Begawan', BG: 'Sofia', BF: 'Ouagadougou', BI: 'Gitega', CV: 'Praia', KH: 'Phnom Penh',
  CM: 'Yaoundé', CA: 'Ottawa', CF: 'Bangui', TD: "N'Djamena", CL: 'Santiago', CN: 'Beijing', CO: 'Bogotá', KM: 'Moroni',
  CG: 'Brazzaville', CD: 'Kinshasa', CR: 'San José', CI: 'Yamoussoukro', HR: 'Zagreb', CU: 'Havana', CY: 'Nicosia',
  CZ: 'Prague', DK: 'Copenhagen', DJ: 'Djibouti', DM: 'Roseau', DO: 'Santo Domingo', EC: 'Quito', EG: 'Cairo',
  SV: 'San Salvador', GQ: 'Malabo', ER: 'Asmara', EE: 'Tallinn', SZ: 'Mbabane', ET: 'Addis Ababa', FJ: 'Suva',
  FI: 'Helsinki', FR: 'Paris', GA: 'Libreville', GM: 'Banjul', GE: 'Tbilisi', DE: 'Berlin', GH: 'Accra', GR: 'Athens',
  GD: "Saint George's", GT: 'Guatemala City', GN: 'Conakry', GW: 'Bissau', GY: 'Georgetown', HT: 'Port-au-Prince',
  HN: 'Tegucigalpa', HU: 'Budapest', IS: 'Reykjavik', IN: 'New Delhi', ID: 'Jakarta', IR: 'Tehran', IQ: 'Baghdad',
  IE: 'Dublin', IL: 'Jerusalem', IT: 'Rome', JM: 'Kingston', JP: 'Tokyo', JO: 'Amman', KZ: 'Astana', KE: 'Nairobi',
  KI: 'Tarawa', KP: 'Pyongyang', KR: 'Seoul', XK: 'Pristina', KW: 'Kuwait City', KG: 'Bishkek', LA: 'Vientiane',
  LV: 'Riga', LB: 'Beirut', LS: 'Maseru', LR: 'Monrovia', LY: 'Tripoli', LI: 'Vaduz', LT: 'Vilnius', LU: 'Luxembourg',
  MG: 'Antananarivo', MW: 'Lilongwe', MY: 'Kuala Lumpur', MV: 'Male', ML: 'Bamako', MT: 'Valletta', MH: 'Majuro',
  MR: 'Nouakchott', MU: 'Port Louis', MX: 'Mexico City', FM: 'Palikir', MD: 'Chisinau', MC: 'Monaco', MN: 'Ulaanbaatar',
  ME: 'Podgorica', MA: 'Rabat', MZ: 'Maputo', MM: 'Naypyidaw', NA: 'Windhoek', NR: 'Yaren', NP: 'Kathmandu',
  NL: 'Amsterdam', NZ: 'Wellington', NI: 'Managua', NE: 'Niamey', NG: 'Abuja', MK: 'Skopje', NO: 'Oslo', OM: 'Muscat',
  PK: 'Islamabad', PW: 'Ngerulmud', PA: 'Panama City', PG: 'Port Moresby', PY: 'Asunción', PE: 'Lima', PH: 'Manila',
  PL: 'Warsaw', PT: 'Lisbon', QA: 'Doha', RO: 'Bucharest', RU: 'Moscow', RW: 'Kigali', KN: 'Basseterre', LC: 'Castries',
  VC: 'Kingstown', WS: 'Apia', SM: 'San Marino', ST: 'São Tomé', SA: 'Riyadh', SN: 'Dakar', RS: 'Belgrade', SC: 'Victoria',
  SL: 'Freetown', SG: 'Singapore', SK: 'Bratislava', SI: 'Ljubljana', SB: 'Honiara', SO: 'Mogadishu', ZA: 'Pretoria',
  SS: 'Juba', ES: 'Madrid', LK: 'Colombo', SD: 'Khartoum', SR: 'Paramaribo', SE: 'Stockholm', CH: 'Bern', SY: 'Damascus',
  TW: 'Taipei', TJ: 'Dushanbe', TZ: 'Dodoma', TH: 'Bangkok', TL: 'Dili', TG: 'Lomé', TO: "Nuku'alofa", TT: 'Port of Spain',
  TN: 'Tunis', TR: 'Ankara', TM: 'Ashgabat', TV: 'Funafuti', UG: 'Kampala', UA: 'Kyiv', AE: 'Abu Dhabi', GB: 'London',
  US: 'Washington', UY: 'Montevideo', UZ: 'Tashkent', VU: 'Port Vila', VA: 'Vatican City', VE: 'Caracas', VN: 'Hanoi',
  YE: "Sana'a", ZM: 'Lusaka', ZW: 'Harare',
};

/** Maneiras comuns de dizer o país que os nomes oficiais não cobrem. */
const ALIASES: Readonly<Record<string, string>> = {
  eua: 'US', usa: 'US', 'u.s.a.': 'US', uk: 'GB', holanda: 'NL', 'paises baixos': 'NL', inglaterra: 'GB', escocia: 'GB',
  'republica checa': 'CZ', 'coreia do sul': 'KR', 'coreia do norte': 'KP', suica: 'CH',
};

/** Sem acentos, sem maiúsculas e sem espaços a mais: "Espanha" e "españa" comparam-se com "espanha". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

let countryNames: Map<string, string> | null = null;

/** Todos os nomes de países (em português, espanhol e inglês) para o código. Constrói-se uma vez. */
function names(): Map<string, string> {
  if (countryNames) return countryNames;
  const map = new Map<string, string>();
  const display = ['pt', 'es', 'en'].map((lang) => new Intl.DisplayNames([lang], { type: 'region', fallback: 'none' }));
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      if (!(code in CAPITALS)) continue;
      for (const names of display) {
        const name = names.of(code);
        if (name) map.set(normalize(name), code);
      }
    }
  }
  for (const [alias, code] of Object.entries(ALIASES)) map.set(alias, code);
  countryNames = map;
  return map;
}

/** O código do país se `text` for exatamente o nome de um país ("Espanha", "spain", "EUA"). */
export function countryOf(text: string): string | null {
  return names().get(normalize(text)) ?? null;
}

/**
 * Percebe o que se escreveu: "Madrid, Espanha", "Madrid Espanha" e "Espanha, Madrid" dão a cidade e o país;
 * "Espanha" sozinho dá só o país (a pesquisa mostra-lhe a capital).
 */
export function parseSearch(text: string): ParsedSearch {
  const clean = text.trim().replace(/\s+/g, ' ');
  const plain = (city: string, countryCode: string | null): ParsedSearch => ({ city, countryCode, countryOnly: false });
  const only = (code: string): ParsedSearch => ({ city: clean, countryCode: code, countryOnly: true });

  const parts = clean.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    const last = countryOf(parts[parts.length - 1]);
    if (last) return plain(parts.slice(0, -1).join(', '), last);
    const first = countryOf(parts[0]);
    if (first) return plain(parts.slice(1).join(', '), first);
    return plain(clean, null);
  }

  const whole = countryOf(clean);
  if (whole) return only(whole);

  const words = clean.split(' ');
  for (let n = Math.min(3, words.length - 1); n >= 1; n--) {
    const tail = countryOf(words.slice(-n).join(' '));
    const rest = words.slice(0, -n).join(' ');
    if (tail && rest.length >= 2) return plain(rest, tail);
    const head = countryOf(words.slice(0, n).join(' '));
    const after = words.slice(n).join(' ');
    if (head && after.length >= 2) return plain(after, head);
  }
  return plain(clean, null);
}
