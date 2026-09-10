/**
 * Escapa caracteres especiais de expressões regulares para evitar ReDoS
 * e injeção de regex em consultas MongoDB ($regex).
 */
export function escapeRegex(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
