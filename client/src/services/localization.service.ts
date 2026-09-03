import compconLocales from '../locales/compcon-pt-br.json';

const locales: Record<string, string> = compconLocales as Record<string, string>;

/**
 * Serviço de Localização Oficial do COMP/CON para LANCER
 * Baseado no repositório oficial https://github.com/massif-press/compcon-locales (pt_BR)
 */
class LocalizationService {
  /**
   * Traduz uma chave arbitrária do compcon-locales
   */
  t(key: string, fallback?: string): string {
    if (locales[key]) {
      return locales[key];
    }
    return fallback !== undefined ? fallback : key;
  }

  /**
   * Traduz o nome de um item pelo seu ID do COMP/CON
   * Ex: mw_assault_rifle -> "Fuzil de Assalto"
   * Ex: mw_hammer_u_rpl -> "Martelo LU-PR"
   * Ex: ms_ferrous_lash -> "Chicote Ferroso"
   */
  translateItemName(id?: string, fallback?: string): string {
    if (!id) return fallback || '';

    // Procura chave id.name
    const nameKey = `${id}.name`;
    if (locales[nameKey]) return locales[nameKey];

    // Procura id sem prefixo ou variações
    for (const prefix of ['', 'mw_', 'ms_', 'mf_', 'ta_', 'sk_', 'wm_']) {
      const k = `${prefix}${id}.name`;
      if (locales[k]) return locales[k];
    }

    return fallback || id;
  }

  /**
   * Traduz a descrição ou efeito de um item pelo seu ID
   */
  translateItemDesc(id?: string, fallback?: string): string {
    if (!id) return fallback || '';

    const descKeys = [
      `${id}.description`,
      `${id}.effect`,
      `${id}.detail`,
      `${id}.terse`
    ];

    for (const k of descKeys) {
      if (locales[k]) return locales[k];
    }

    return fallback || '';
  }

  /**
   * Traduz o Sistema de Núcleo (Core System) do Chassi
   */
  translateCoreSystem(frameId?: string, core?: any): {
    name: string;
    description: string;
    activeName: string;
    activeEffect: string;
    passiveName: string;
    passiveEffect: string;
  } {
    if (!frameId && !core) {
      return {
        name: 'Sistema de Núcleo',
        description: '',
        activeName: 'Sobrecarga de Núcleo',
        activeEffect: '',
        passiveName: '',
        passiveEffect: ''
      };
    }

    const fid = frameId || '';
    const name = locales[`${fid}.core_system.name`] || core?.name || 'Sistema de Núcleo';
    const description = locales[`${fid}.core_system.description`] || core?.description || '';
    const activeName = locales[`${fid}.core_system.active_name`] || core?.active_name || 'Sobrecarga de Núcleo';
    const activeEffect = locales[`${fid}.core_system.active_effect`] || core?.active_effect || core?.active_actions?.[0]?.detail || '';
    const passiveName = locales[`${fid}.core_system.passive_name`] || core?.passive_name || '';
    const passiveEffect = locales[`${fid}.core_system.passive_effect`] || core?.passive_effect || '';

    return {
      name,
      description,
      activeName,
      activeEffect,
      passiveName,
      passiveEffect
    };
  }

  /**
   * Traduz um Sistema embarcado (System) e suas Ações/Efeitos
   */
  translateSystem(systemId?: string, data?: any): {
    name: string;
    description: string;
    actions: Array<{ name: string; detail: string; activation: string }>;
  } {
    if (!systemId && !data) {
      return { name: 'Sistema', description: '', actions: [] };
    }

    const sid = systemId || data?.id || '';
    const name = locales[`${sid}.name`] || data?.name || sid;
    const description =
      locales[`${sid}.effect`] ||
      locales[`${sid}.description`] ||
      data?.effect ||
      data?.description ||
      '';

    const rawActions: any[] = data?.actions || [];
    const actions = rawActions.map((a: any, idx: number) => {
      const cleanName = (a.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const actionKey = `${sid}.action_${cleanName}`;
      const actionIndexedKey = `${sid}.action_${idx}`;

      const actName = locales[`${actionKey}.name`] || locales[`${actionIndexedKey}.name`] || a.name || 'Ação';
      const actDetail = locales[`${actionKey}.detail`] || locales[`${actionIndexedKey}.detail`] || a.detail || '';
      return {
        name: actName,
        detail: actDetail,
        activation: a.activation || 'Ação'
      };
    });

    // Se houver deployables (ex: Turret Drones)
    const rawDeployables: any[] = data?.deployables || [];
    for (const d of rawDeployables) {
      const cleanDName = (d.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const dKey = `${sid}.deployable_${cleanDName}`;
      const depDetail = locales[`${dKey}.detail`] || d.detail || '';
      if (depDetail && !actions.some(x => x.detail === depDetail)) {
        actions.push({
          name: locales[`${dKey}.name`] || d.name || 'Implantável',
          detail: depDetail,
          activation: 'Implantável'
        });
      }
    }

    return {
      name,
      description,
      actions
    };
  }

  /**
   * Traduz um Traço (Trait) nativo do Chassi
   */
  translateTrait(frameId?: string, trait?: any): { name: string; description: string } {
    if (!trait) return { name: 'Traço', description: '' };

    const rawName = trait.name || '';
    const cleanName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const fid = frameId || '';

    const traitKeys = [
      `${fid}.trait_${cleanName}.name`,
      `trait_${cleanName}.name`,
      `${cleanName}.name`
    ];
    let name = '';
    for (const k of traitKeys) {
      if (locales[k]) {
        name = locales[k];
        break;
      }
    }
    if (!name) name = rawName;

    const descKeys = [
      `${fid}.trait_${cleanName}.description`,
      `${fid}.trait_${cleanName}.detail`,
      `trait_${cleanName}.description`,
      `${cleanName}.description`
    ];
    let description = '';
    for (const k of descKeys) {
      if (locales[k]) {
        description = locales[k];
        break;
      }
    }
    if (!description) description = trait.description || trait.detail || '';

    return { name, description };
  }

  /**
   * Traduz uma Tag de arma/sistema (ex: tg_loading -> "Recarga", tg_knockback com val 2 -> "Repulsão 2")
   */
  translateTag(tagId?: string, val?: any): string {
    if (!tagId) return '';

    const cleanId = tagId.toLowerCase().replace(/^tg_/, '');
    const candidateKeys = [
      `tg_${cleanId}.name`,
      `tag_${cleanId}.name`,
      `${cleanId}.name`
    ];

    let translated = '';
    for (const k of candidateKeys) {
      if (locales[k]) {
        translated = locales[k];
        break;
      }
    }

    if (!translated) {
      const defaultTagMap: Record<string, string> = {
        loading: 'Recarga',
        accurate: 'Preciso',
        inaccurate: 'Impreciso',
        arcing: 'Arqueada',
        knockback: 'Repulsão {VAL}',
        overkill: 'Exagero',
        armor_piercing: 'Perfurante',
        ap: 'Perfurante',
        seeking: 'Teleguiada',
        smart: 'Inteligente',
        reliable: 'Confiável {VAL}',
        heat: 'Calor {VAL}',
        burn: 'Queimadura {VAL}',
        unique: 'Único',
        limited: 'Limitado {VAL}',
        ai: 'IA',
        no_cascade: 'Sem Cascata',
        gear: 'Equipamento',
        protocol: 'Protocolo',
        reaction: 'Reação',
        full_action: 'Ação Completa',
        quick_action: 'Ação Rápida',
        threat: 'Ameaça {VAL}',
        thrown: 'Arremesso {VAL}',
        blast: 'Explosão {VAL}',
        burst: 'Rajada {VAL}',
        line: 'Linha {VAL}',
        cone: 'Cone {VAL}'
      };

      translated = defaultTagMap[cleanId] || cleanId.toUpperCase();
    }

    if (val !== undefined && val !== null) {
      if (translated.includes('{VAL}')) {
        return translated.replace('{VAL}', String(val));
      }
      return `${translated} ${val}`;
    }

    return translated.replace(' {VAL}', '').replace('{VAL}', '');
  }

  /**
   * Retorna a etiqueta traduzida e a descrição oficial completa de uma Tag (para Tooltips/Toolbox)
   */
  translateTagInfo(tagId?: string, val?: any): { label: string; description: string } {
    if (!tagId) return { label: '', description: '' };

    const cleanId = tagId.toLowerCase().replace(/^tg_/, '');
    const label = this.translateTag(tagId, val);

    const descKeys = [
      `tg_${cleanId}.description`,
      `tag_${cleanId}.description`,
      `tg_${cleanId}.detail`,
      `${cleanId}.description`
    ];

    let description = '';
    for (const k of descKeys) {
      if (locales[k]) {
        description = locales[k];
        break;
      }
    }

    if (val !== undefined && val !== null && description.includes('{VAL}')) {
      description = description.replace(/\{VAL\}/g, String(val));
    }

    if (!description) {
      description = label;
    }

    return { label, description };
  }

  /**
   * Traduz o tipo de dano oficial do LANCER
   */
  translateDamageType(dmgType?: string): string {
    if (!dmgType) return 'Cinético';
    const clean = dmgType.trim().toLowerCase();

    if (clean.includes('kin') || clean.includes('cin')) return 'Cinético';
    if (clean.includes('exp')) return 'Explosivo';
    if (clean.includes('ene')) return 'Energia';
    if (clean.includes('burn') || clean.includes('queim')) return 'Queimadura';
    if (clean.includes('heat') || clean.includes('calor')) return 'Calor';

    return dmgType;
  }

  /**
   * Traduz o tipo de alcance oficial do LANCER
   */
  translateRangeType(rangeType?: string): string {
    if (!rangeType) return 'Alcance';
    const clean = rangeType.trim().toLowerCase();

    if (clean.includes('range') || clean.includes('alcance')) return 'Alcance';
    if (clean.includes('threat') || clean.includes('ameaça')) return 'Ameaça';
    if (clean.includes('blast') || clean.includes('explosão')) return 'Explosão';
    if (clean.includes('burst') || clean.includes('rajada')) return 'Rajada';
    if (clean.includes('line') || clean.includes('linha')) return 'Linha';
    if (clean.includes('cone')) return 'Cone';

    return rangeType;
  }

  /**
   * Traduz o tipo de montagem / encaixe oficial do LANCER
   */
  translateMountType(mountType?: string): string {
    if (!mountType) return 'Encaixe';
    const clean = mountType.trim();

    const mountMap: Record<string, string> = {
      'Aux/Aux': 'Auxiliar / Auxiliar',
      'Auxiliary': 'Auxiliar',
      'Main': 'Principal',
      'Flex': 'Flexível',
      'Heavy': 'Pesado',
      'Main/Aux': 'Principal / Auxiliar',
      'Integrated': 'Integrado'
    };

    return mountMap[clean] || clean;
  }

  /**
   * Traduz o tipo de ativação de ação
   */
  translateActivation(activation?: string): string {
    if (!activation) return 'Ação';
    const clean = activation.trim().toLowerCase();

    if (clean.includes('quick')) return 'Ação Rápida';
    if (clean.includes('full')) return 'Ação Completa';
    if (clean.includes('protocol')) return 'Protocolo';
    if (clean.includes('reaction')) return 'Reação';
    if (clean.includes('free')) return 'Ação Livre';
    if (clean.includes('downtime')) return 'Intermissão';

    return activation;
  }

  /**
   * Retorna a classe CSS correspondente ao tipo de ativação de ação
   */
  getActionClass(activation?: string): string {
    if (!activation) return 'action-quick';
    const clean = activation.trim().toLowerCase();

    if (clean.includes('protocol')) return 'action-protocol';
    if (clean.includes('quick') || clean.includes('rápida') || clean.includes('rapida')) return 'action-quick';
    if (clean.includes('full') || clean.includes('completa')) return 'action-full';
    if (clean.includes('reaction') || clean.includes('reação') || clean.includes('reacao')) return 'action-reaction';
    if (clean.includes('free') || clean.includes('livre')) return 'action-free';

    return 'action-quick';
  }

  /**
   * Traduz a fabricante (Corpro)
   */
  translateManufacturer(source?: string): string {
    if (!source) return 'GMS';
    const clean = source.trim().toUpperCase();

    if (clean === 'IPS-N' || clean === 'IPSN') return 'EIP-EN';
    if (clean === 'SSC') return 'SSC';
    if (clean === 'HORUS') return 'HORUS';
    if (clean === 'HA') return 'AH';
    if (clean === 'GMS') return 'GMS';

    return clean;
  }

  /**
   * Traduz um Talento de Piloto, seu lore, resumo e todos os seus ranques
   */
  translateTalent(id?: string, data?: any, currentRank: number = 1): {
    id: string;
    name: string;
    description: string;
    terse: string;
    currentRank: number;
    ranks: Array<{
      rankLevel: number;
      name: string;
      description: string;
      isActive: boolean;
    }>;
  } {
    if (!id && !data) {
      return {
        id: '',
        name: 'Talento',
        description: '',
        terse: '',
        currentRank,
        ranks: []
      };
    }

    const tid = id || data?.id || '';
    const cleanId = tid.replace(/^(t_|ta_|mf_)/, '');
    const prefixes = [tid, `t_${cleanId}`, `mf_${cleanId}`, `ta_${cleanId}`, cleanId];

    let name = '';
    for (const p of prefixes) {
      if (locales[`${p}.name`]) {
        name = locales[`${p}.name`];
        break;
      }
    }
    if (!name) name = data?.name || tid;

    let description = '';
    for (const p of prefixes) {
      if (locales[`${p}.description`]) {
        description = locales[`${p}.description`];
        break;
      }
    }
    if (!description) description = data?.description || '';

    let terse = '';
    for (const p of prefixes) {
      if (locales[`${p}.terse`]) {
        terse = locales[`${p}.terse`];
        break;
      }
    }
    if (!terse) terse = data?.terse || '';

    const rawRanks: any[] = data?.ranks || [];
    const ranks = rawRanks.map((r: any, idx: number) => {
      const cleanRank = (r.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
      let rName = '';
      for (const pfx of prefixes) {
        const k = `${pfx}.rank_${cleanRank}.name`;
        const ki = `${pfx}.rank_${idx}.name`;
        if (locales[k]) {
          rName = locales[k];
          break;
        }
        if (locales[ki]) {
          rName = locales[ki];
          break;
        }
      }
      if (!rName) rName = r.name || `Rank ${idx + 1}`;

      let rDesc = '';
      for (const pfx of prefixes) {
        const k = `${pfx}.rank_${cleanRank}.description`;
        const kd = `${pfx}.rank_${cleanRank}.detail`;
        const ki = `${pfx}.rank_${idx}.description`;
        if (locales[k]) {
          rDesc = locales[k];
          break;
        }
        if (locales[kd]) {
          rDesc = locales[kd];
          break;
        }
        if (locales[ki]) {
          rDesc = locales[ki];
          break;
        }
      }
      if (!rDesc) rDesc = r.description || r.detail || '';

      // Sub-ações e poderes concedidos por este ranque
      const rawActions: any[] = r.actions || [];
      const actions = rawActions.map((a: any) => {
        const cleanAct = (a.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
        let aName = '';
        for (const pfx of prefixes) {
          const k = `${pfx}.rank_${cleanRank}.action_${cleanAct}.name`;
          if (locales[k]) {
            aName = locales[k];
            break;
          }
        }
        if (!aName) aName = a.name || 'Poder';

        let aDetail = '';
        for (const pfx of prefixes) {
          const k = `${pfx}.rank_${cleanRank}.action_${cleanAct}.detail`;
          if (locales[k]) {
            aDetail = locales[k];
            break;
          }
        }
        if (!aDetail) aDetail = a.detail || '';

        let aTrigger = '';
        for (const pfx of prefixes) {
          const k = `${pfx}.rank_${cleanRank}.action_${cleanAct}.trigger`;
          if (locales[k]) {
            aTrigger = locales[k];
            break;
          }
        }
        if (!aTrigger) aTrigger = a.trigger || '';

        return {
          name: aName,
          detail: aDetail,
          trigger: aTrigger,
          activation: this.translateActivation(a.activation)
        };
      });

      return {
        rankLevel: idx + 1,
        name: rName,
        description: rDesc,
        isActive: idx + 1 <= currentRank,
        actions
      };
    });

    return {
      id: tid,
      name,
      description,
      terse,
      currentRank,
      ranks
    };
  }
}

export const localization = new LocalizationService();
