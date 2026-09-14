/**
 * Utilitário para verificação e diagnóstico de cookies de sessão no navegador do Operador.
 * Essencial para garantir que cookies HttpOnly e sessões de autenticação funcionem corretamente
 * antes de disparar o fluxo de login OAuth2 com o Discord.
 */
export function areCookiesEnabled(): boolean {
  try {
    // 1. Verificação primária da API padrão do navegador
    if (typeof navigator !== 'undefined' && navigator.cookieEnabled === false) {
      return false;
    }

    if (typeof document === 'undefined') {
      return false;
    }

    // 2. Teste prático de gravação e leitura de cookie de sessão
    const testKey = '__omninet_cookie_diag__';
    const testVal = 'diag_' + Date.now();
    document.cookie = `${testKey}=${testVal}; path=/; SameSite=Lax`;

    const isCookieSaved = document.cookie.indexOf(`${testKey}=${testVal}`) !== -1;

    // 3. Limpeza preventiva do cookie de diagnóstico
    if (isCookieSaved) {
      document.cookie = `${testKey}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    }

    return isCookieSaved;
  } catch (err) {
    console.warn('[!] Falha ao verificar cookies no navegador:', err);
    return false;
  }
}
