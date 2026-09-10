/**
 * Utilitário de segurança frontend para sanitização de dados e prevenção contra Stored/Reflected XSS.
 * Escapa com alta performance os 5 caracteres fundamentais de HTML (&, <, >, ", ').
 */
export function escapeHtml(text: any): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
