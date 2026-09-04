/**
 * Live Combat Tracker Helper // Guilda LANCER
 * Gerencia persistência local (localStorage), estado dos sistemas/armas
 * e mapeamento de larguras de barra de progresso em classes CSS puras (zero inline styles).
 */

export type WeaponCombatState = 'OPERATIONAL' | 'UNLOADED' | 'DESTROYED';
export type SystemCombatState = 'OPERATIONAL' | 'DESTROYED';

export interface IMechCombatState {
  currentHp: number;
  currentStructure: number;
  currentHeat: number;
  currentStress: number;
  currentRepairs: number;
  corePowerUsed: boolean;
  weaponsState: Record<number, WeaponCombatState>;
  systemsState: Record<number, SystemCombatState>;
}

export interface ICombatDefaults {
  maxHp: number;
  maxRepairs: number;
}

const STORAGE_PREFIX = 'lancer_combat_';

export function getStoredCombatState(pilotId: string, defaults: ICombatDefaults): IMechCombatState {
  const defaultState: IMechCombatState = {
    currentHp: Math.max(0, defaults.maxHp),
    currentStructure: 4,
    currentHeat: 0,
    currentStress: 4,
    currentRepairs: Math.max(0, defaults.maxRepairs),
    corePowerUsed: false,
    weaponsState: {},
    systemsState: {}
  };

  if (!pilotId) return defaultState;

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${pilotId}`);
    if (!raw) return defaultState;

    const parsed = JSON.parse(raw);
    return {
      currentHp: typeof parsed.currentHp === 'number' ? Math.max(0, Math.min(defaults.maxHp, parsed.currentHp)) : defaultState.currentHp,
      currentStructure: typeof parsed.currentStructure === 'number' ? Math.max(0, Math.min(4, parsed.currentStructure)) : 4,
      currentHeat: typeof parsed.currentHeat === 'number' ? Math.max(0, parsed.currentHeat) : 0,
      currentStress: typeof parsed.currentStress === 'number' ? Math.max(0, Math.min(4, parsed.currentStress)) : 4,
      currentRepairs: typeof parsed.currentRepairs === 'number' ? Math.max(0, Math.min(defaults.maxRepairs, parsed.currentRepairs)) : defaultState.currentRepairs,
      corePowerUsed: Boolean(parsed.corePowerUsed),
      weaponsState: typeof parsed.weaponsState === 'object' && parsed.weaponsState !== null ? parsed.weaponsState : {},
      systemsState: typeof parsed.systemsState === 'object' && parsed.systemsState !== null ? parsed.systemsState : {}
    };
  } catch (err) {
    console.warn('[!] Erro ao restaurar estado de combate do mecha:', err);
    return defaultState;
  }
}

export function saveCombatState(pilotId: string, state: IMechCombatState): void {
  if (!pilotId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${pilotId}`, JSON.stringify(state));
  } catch (err) {
    console.error('[!] Erro ao salvar estado de combate:', err);
  }
}

export function resetCombatState(pilotId: string, defaults: ICombatDefaults): IMechCombatState {
  const freshState: IMechCombatState = {
    currentHp: Math.max(0, defaults.maxHp),
    currentStructure: 4,
    currentHeat: 0,
    currentStress: 4,
    currentRepairs: Math.max(0, defaults.maxRepairs),
    corePowerUsed: false,
    weaponsState: {},
    systemsState: {}
  };
  saveCombatState(pilotId, freshState);
  return freshState;
}

/**
 * Retorna classe utilitária de largura CSS (vital-fill-w-0 até vital-fill-w-100 em passos de 5%).
 * Respeita a regra de proibição de CSS inline.
 */
export function getVitalWidthClass(current: number, max: number): string {
  if (max <= 0) return 'vital-fill-w-0';
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const rounded = Math.round(pct / 5) * 5;
  return `vital-fill-w-${rounded}`;
}
