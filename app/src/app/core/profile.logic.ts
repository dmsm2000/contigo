// Lógica pura do perfil: sem Angular nem rede, para se testar facilmente.

export const MAX_NAME_LENGTH = 40;

/** Prepara o nome que a pessoa escreveu: espaços arrumados; 'empty' se não sobrar nada; 'tooLong' se passar do limite. */
export function cleanName(input: string): string | 'empty' | 'tooLong' {
  const name = input.replace(/\s+/g, ' ').trim();
  if (!name) return 'empty';
  return name.length > MAX_NAME_LENGTH ? 'tooLong' : name;
}
