import { IPilot } from '../types/pilot.types.js';

/**
 * Gerador do Modelo Oficial de Relatório de Missão (AAR / Recesso)
 * Formatado conforme o padrão operacional da Guilda Lancer.
 */
export function buildMissionReportText(pilot?: IPilot | any | null, activeMechData?: any): string {
  const pilotName = pilot?.name || '';
  const pilotCallsign = pilot?.callsign || '';
  const pilotDisplay = pilotCallsign
    ? (pilotName ? `${pilotName} / ${pilotCallsign}` : pilotCallsign)
    : '[Nome do Piloto/Codinome]';

  const pilotHpMax = 6 + (pilot?.grit || 0);
  const pilotHpText = pilot ? `[${pilotHpMax}/${pilotHpMax}]` : '[Pv atual/Pv total]';

  // Itens Limitados do Piloto
  let limitedItemsLines: string[] = [];
  const raw = pilot?.compcon_raw || {};
  const gearList = raw?.loadout?.gear || raw?.gear || [];
  if (Array.isArray(gearList) && gearList.length > 0) {
    gearList.forEach((g: any) => {
      const name = typeof g === 'string' ? g : (g?.name || g?.id || 'Item');
      limitedItemsLines.push(`[${name} - Usos restantes/Usos totais]`);
    });
  }

  if (limitedItemsLines.length === 0) {
    limitedItemsLines = [
      '[Nome do item - Usos restantes/Usos totais]',
      '[Nome do item - Usos restantes/Usos totais]',
      '[Nome do item - Usos restantes/Usos totais]'
    ];
  }

  // Dados do Mecha
  const rawMechs = raw?.mechs || pilot?.mechs || [];
  const activeMech = activeMechData || rawMechs.find((m: any) => m.active) || rawMechs[0] || null;
  const mechName = activeMech?.name || pilot?.active_mech_name || pilot?.active_mech_frame || '[Nome do Mecha]';

  // Verifica se há estado de combate ao vivo salvo localmente para o piloto
  let storedCombat: any = null;
  if (pilot?._id) {
    try {
      const rawStored = localStorage.getItem(`lancer_combat_${pilot._id}`);
      if (rawStored) storedCombat = JSON.parse(rawStored);
    } catch {}
  }

  // Cálculos de máximos
  const frameStats = activeMech?.frameData?.stats || activeMech?.stats?.max || {};
  const baseHp = typeof frameStats.hp === 'number' ? frameStats.hp : 10;
  const baseRepairs = typeof frameStats.repcap === 'number' ? frameStats.repcap : 4;
  const hullBonus = pilot?.hull || 0;
  const gritBonus = pilot?.grit || 0;
  const maxHpCalc = baseHp + hullBonus * 2 + gritBonus;
  const maxRepairsCalc = baseRepairs + Math.floor(hullBonus / 2);

  // Estrutura
  const structure = storedCombat?.currentStructure !== undefined ? `[${storedCombat.currentStructure}/4]` : '[Estrutura atual/4]';
  // PV Mecha
  const mechHp = storedCombat?.currentHp !== undefined ? `[${storedCombat.currentHp}/${maxHpCalc}]` : '[Pv atual/Pv total]';
  // Estresse
  const stress = storedCombat?.currentStress !== undefined ? `[${storedCombat.currentStress}/4]` : '[Estresse atual/4]';
  // Capacidade de Reparo
  const repairs = storedCombat?.currentRepairs !== undefined ? `[${storedCombat.currentRepairs}/${maxRepairsCalc}]` : '[Cap. de reparo atual/Cap. de reparo total]';

  // Encaixes de Armas
  const mountTypeTranslations: Record<string, string> = {
    'Main': 'Principal',
    'Heavy': 'Pesado',
    'Aux': 'Auxiliar',
    'Aux/Aux': 'Auxiliar / Auxiliar',
    'Flex': 'Flexível',
    'Main/Aux': 'Principal / Auxiliar',
    'Integrated': 'Integrado',
    'Superheavy': 'Superpesado'
  };

  const mountsList: string[] = [];
  const rawMounts = activeMech?.loadouts?.[0]?.mounts || [];
  if (Array.isArray(rawMounts) && rawMounts.length > 0) {
    rawMounts.forEach((m: any, idx: number) => {
      const type = mountTypeTranslations[m.mount_type] || m.mount_type || 'Geral';
      const slots = m.slots || [];
      const weaponNames = slots
        .map((s: any) => s.weapon?.name || s.name || s.id)
        .filter(Boolean)
        .join(' / ');
      const state = storedCombat?.weaponsState?.[idx];
      const stateSuffix = state === 'DESTROYED' ? ' (DESTRUÍDA)' : state === 'UNLOADED' ? ' (DESCARREGADA)' : '';
      mountsList.push(`Encaixe [${type}]: [${(weaponNames || 'Vazio') + stateSuffix}]`);
    });
  }

  if (mountsList.length === 0) {
    mountsList.push('Encaixe [Tipo do encaixe]: [Nome do Item no encaixe]');
    mountsList.push('Encaixe [Tipo do encaixe]: [Nome do Item no encaixe]');
    mountsList.push('Encaixe [Tipo do encaixe]: [Nome do Item no encaixe]');
  }

  // Ponto de Núcleo
  const corePower = storedCombat?.corePowerUsed ? '[0/1]' : '[1/1]';

  // Sistemas
  const systemsList: string[] = [];
  const rawSystems = activeMech?.loadouts?.[0]?.systems || [];
  if (Array.isArray(rawSystems) && rawSystems.length > 0) {
    rawSystems.forEach((s: any, idx: number) => {
      const sysName = s.system?.name || s.name || s.id || 'Sistema';
      const sysState = storedCombat?.systemsState?.[idx];
      const stateSuffix = sysState === 'DESTROYED' ? ' (DESTRUÍDO)' : '';
      systemsList.push(`[${sysName + stateSuffix} - Usos restantes/Usos totais]`);
    });
  }

  if (systemsList.length === 0) {
    systemsList.push('[Nome do sistema - Usos restantes/Usos totais]');
    systemsList.push('[Nome do sistema - Usos restantes/Usos totais]');
    systemsList.push('[Nome do sistema - Usos restantes/Usos totais]');
    systemsList.push('[Nome do sistema - Usos restantes/Usos totais]');
    systemsList.push('[Nome do sistema - Usos restantes/Usos totais]');
  }

  let obsText = '[Descreva que itens foram usados ou destruídos na missão, e se utilizou da capacidade de reparo para reparar seu mecha.]';
  if (storedCombat) {
    const damagedNotes: string[] = [];
    if (storedCombat.weaponsState) {
      Object.entries(storedCombat.weaponsState).forEach(([idx, st]) => {
        if (st === 'DESTROYED') damagedNotes.push(`Arma #${Number(idx) + 1} destruída`);
        else if (st === 'UNLOADED') damagedNotes.push(`Arma #${Number(idx) + 1} descarregada`);
      });
    }
    if (storedCombat.systemsState) {
      Object.entries(storedCombat.systemsState).forEach(([idx, st]) => {
        if (st === 'DESTROYED') damagedNotes.push(`Sistema #${Number(idx) + 1} inoperante`);
      });
    }
    if (damagedNotes.length > 0) {
      obsText = `[Avarias na operação: ${damagedNotes.join('; ')}. Reparos de campo restantes: ${storedCombat.currentRepairs || 0}.]`;
    }
  }

  return `Relatório de Missão
Nome do Piloto/Codinome: ${pilotDisplay}
PV: ${pilotHpText}
Itens Limitados: 
${limitedItemsLines.join('\n')}

Nome do Mecha: ${mechName}
Estrutura: ${structure}
PV: ${mechHp}
Estresse: ${stress}
Capacidade de reparo: ${repairs}
${mountsList.join('\n')}
Ponto de Núcleo: ${corePower}
Sistemas: 
${systemsList.join('\n')}

Ação de Recesso Escolhida: [Nome da tabela escolhida em desconhecido]
Resultado da ação de recesso: [Caso tenha tido sucesso, escreva o nome do Recurso obtido na tabela]

Obs: ${obsText}`;
}
