import compconLocales from '../locales/compcon-pt-br.json';
import { i18n } from './i18n.service.js';

const locales: Record<string, string> = compconLocales as Record<string, string>;

export type SupportedLang = 'pt' | 'en';

/**
 * Serviço de Localização Oficial do COMP/CON para LANCER
 * Utiliza i18next exclusivamente para a interface e desativa a tradução de dados no modo inglês.
 */
class LocalizationService {
  private currentLanguage: SupportedLang = (localStorage.getItem('lancer_lang') as SupportedLang) || 'pt';
  private listeners: Array<(lang: SupportedLang) => void> = [];

  get isTranslationEnabled(): boolean {
    return this.currentLanguage === 'pt';
  }

  getLanguage(): SupportedLang {
    return this.currentLanguage;
  }

  setLanguage(lang: SupportedLang): void {
    if (this.currentLanguage === lang) return;
    this.currentLanguage = lang;
    try {
      localStorage.setItem('lancer_lang', lang);
      i18n.changeLanguage(lang);
    } catch {
      // ignore
    }
    this.notify();
  }

  toggleLanguage(): SupportedLang {
    const nextLang: SupportedLang = this.currentLanguage === 'pt' ? 'en' : 'pt';
    this.setLanguage(nextLang);
    return nextLang;
  }

  subscribe(cb: (lang: SupportedLang) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify(): void {
    this.listeners.forEach((cb) => {
      try {
        cb(this.currentLanguage);
      } catch (err) {
        console.error(err);
      }
    });
  }

  /**
   * Traduz a interface usando i18next, com fallback para compcon-locales (se PT)
   */
  t(key: string, fallback?: string): string {
    // 1. Traduz interface via i18next
    const i18nVal = i18n.t(key);
    if (i18nVal && i18nVal !== key) {
      return i18nVal;
    }

    // 2. Se tradução estiver ativa (PT), tenta compcon-pt-br.json
    if (this.isTranslationEnabled && locales[key]) {
      return locales[key];
    }

    return fallback !== undefined ? fallback : key;
  }

  /**
   * Traduz o nome de um item pelo seu ID do COMP/CON
   */
  translateItemName(id?: string, fallback?: string): string {
    if (!id) return fallback || '';
    if (!this.isTranslationEnabled) {
      return fallback || id;
    }

    // Procura chave id.name
    const nameKey = `${id}.name`;
    if (locales[nameKey]) return locales[nameKey];

    // Procura id sem prefixo ou variações
    for (const prefix of ['', 'cb_', 'mw_', 'ms_', 'mf_', 'ta_', 'sk_', 'wm_']) {
      const k = `${prefix}${id}.name`;
      if (locales[k]) return locales[k];
    }

    return fallback || id;
  }

  /**
   * Traduz especificamente o efeito tático de um Bônus de Núcleo (Core Bonus)
   */
  translateCoreBonusEffect(id?: string, fallback?: string): string {
    if (!id) return fallback || '';
    if (!this.isTranslationEnabled) return fallback || '';

    const effectKeys = [
      `${id}.effect`,
      `cb_${id}.effect`,
      id.startsWith('cb_') ? `${id.replace(/^cb_/, '')}.effect` : '',
      `${id}.mounted_effect`
    ];

    for (const k of effectKeys) {
      if (k && locales[k]) return locales[k];
    }

    return fallback || '';
  }

  /**
   * Traduz a descrição/lore de um Bônus de Núcleo (Core Bonus)
   */
  translateCoreBonusDescription(id?: string, fallback?: string): string {
    if (!id) return fallback || '';
    if (!this.isTranslationEnabled) return fallback || '';

    const descKeys = [
      `${id}.description`,
      `cb_${id}.description`,
      id.startsWith('cb_') ? `${id.replace(/^cb_/, '')}.description` : '',
      `${id}.detail`
    ];

    for (const k of descKeys) {
      if (k && locales[k]) return locales[k];
    }

    return fallback || '';
  }

  /**
   * Traduz a descrição ou efeito de um item pelo seu ID
   */
  translateItemDesc(id?: string, fallback?: string): string {
    if (!id) return fallback || '';
    if (!this.isTranslationEnabled) return fallback || '';

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
        name: this.isTranslationEnabled ? 'Sistema de Núcleo' : 'Core System',
        description: '',
        activeName: this.isTranslationEnabled ? 'Poder do Núcleo' : 'Core Active',
        activeEffect: '',
        passiveName: '',
        passiveEffect: ''
      };
    }

    if (!this.isTranslationEnabled) {
      return {
        name: core?.name || 'Core System',
        description: core?.description || '',
        activeName: core?.active_name || 'Core Active',
        activeEffect: core?.active_effect || core?.active_actions?.[0]?.detail || '',
        passiveName: core?.passive_name || '',
        passiveEffect: core?.passive_effect || ''
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
      return { name: this.isTranslationEnabled ? 'Sistema' : 'System', description: '', actions: [] };
    }

    if (!this.isTranslationEnabled) {
      const rawActions: any[] = data?.actions || [];
      const actions = rawActions.map((a: any) => ({
        name: a.name || 'Action',
        detail: a.detail || a.description || '',
        activation: a.activation || 'Action'
      }));
      return {
        name: data?.name || systemId || 'System',
        description: data?.effect || data?.description || '',
        actions
      };
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
    if (!trait) return { name: this.isTranslationEnabled ? 'Traço' : 'Trait', description: '' };

    if (!this.isTranslationEnabled) {
      return {
        name: trait.name || 'Trait',
        description: trait.description || trait.detail || ''
      };
    }

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
   * Traduz uma Tag de arma/sistema
   */
  translateTag(tagId?: string, val?: any): string {
    if (!tagId) return '';

    const cleanId = tagId.toLowerCase().replace(/^tg_/, '');

    if (!this.isTranslationEnabled) {
      const defaultTagMapEn: Record<string, string> = {
        loading: 'Loading',
        accurate: 'Accurate',
        inaccurate: 'Inaccurate',
        arcing: 'Arcing',
        knockback: 'Knockback {VAL}',
        overkill: 'Overkill',
        armor_piercing: 'Armor-Piercing',
        ap: 'AP',
        seeking: 'Seeking',
        smart: 'Smart',
        reliable: 'Reliable {VAL}',
        heat: 'Heat {VAL}',
        burn: 'Burn {VAL}',
        unique: 'Unique',
        limited: 'Limited {VAL}',
        ai: 'AI',
        no_cascade: 'No Cascade',
        gear: 'Gear',
        protocol: 'Protocol',
        reaction: 'Reaction',
        full_action: 'Full Action',
        quick_action: 'Quick Action',
        threat: 'Threat {VAL}',
        thrown: 'Thrown {VAL}',
        blast: 'Blast {VAL}',
        burst: 'Burst {VAL}',
        line: 'Line {VAL}',
        cone: 'Cone {VAL}'
      };

      let translated = defaultTagMapEn[cleanId] || cleanId.toUpperCase();
      if (val !== undefined && val !== null) {
        if (translated.includes('{VAL}')) return translated.replace('{VAL}', String(val));
        return `${translated} ${val}`;
      }
      return translated.replace(' {VAL}', '').replace('{VAL}', '');
    }

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
   * Retorna a etiqueta traduzida e a descrição oficial completa de uma Tag
   */
  translateTagInfo(tagId?: string, val?: any): { label: string; description: string } {
    if (!tagId) return { label: '', description: '' };

    const cleanId = tagId.toLowerCase().replace(/^tg_/, '');
    const label = this.translateTag(tagId, val);

    if (!this.isTranslationEnabled) {
      return { label, description: label };
    }

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
    if (!dmgType) return this.isTranslationEnabled ? 'Cinético' : 'Kinetic';
    const clean = dmgType.trim().toLowerCase();

    if (!this.isTranslationEnabled) {
      if (clean.includes('kin') || clean.includes('cin')) return 'Kinetic';
      if (clean.includes('exp')) return 'Explosive';
      if (clean.includes('ene')) return 'Energy';
      if (clean.includes('burn') || clean.includes('queim')) return 'Burn';
      if (clean.includes('heat') || clean.includes('calor')) return 'Heat';
      return dmgType;
    }

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
    if (!rangeType) return this.isTranslationEnabled ? 'Alcance' : 'Range';
    const clean = rangeType.trim().toLowerCase();

    if (!this.isTranslationEnabled) {
      if (clean.includes('range') || clean.includes('alcance')) return 'Range';
      if (clean.includes('threat') || clean.includes('ameaça')) return 'Threat';
      if (clean.includes('blast') || clean.includes('explosão')) return 'Blast';
      if (clean.includes('burst') || clean.includes('rajada')) return 'Burst';
      if (clean.includes('line') || clean.includes('linha')) return 'Line';
      if (clean.includes('cone')) return 'Cone';
      return rangeType;
    }

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
    if (!mountType) return this.isTranslationEnabled ? 'Encaixe' : 'Mount';
    const clean = mountType.trim();

    if (!this.isTranslationEnabled) {
      return clean;
    }

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
    if (!activation) return this.isTranslationEnabled ? 'Ação' : 'Action';
    const clean = activation.trim().toLowerCase();

    if (!this.isTranslationEnabled) {
      if (clean.includes('quick') || clean.includes('rápida') || clean.includes('rapida')) return 'Quick Action';
      if (clean.includes('full') || clean.includes('completa')) return 'Full Action';
      if (clean.includes('protocol')) return 'Protocol';
      if (clean.includes('reaction') || clean.includes('reação') || clean.includes('reacao')) return 'Reaction';
      if (clean.includes('free') || clean.includes('livre')) return 'Free Action';
      if (clean.includes('downtime') || clean.includes('intermissão') || clean.includes('intermissao')) return 'Downtime';
      return activation;
    }

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

    if (!this.isTranslationEnabled) {
      if (clean === 'EIP-EN' || clean === 'IPSN') return 'IPS-N';
      if (clean === 'AH') return 'HA';
      return clean;
    }

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
      actions: Array<{ name: string; detail: string; trigger: string; activation: string }>;
    }>;
  } {
    const tid = id || data?.id || '';
    const cleanId = tid.toLowerCase().replace(/^ta_/, '');

    if (!this.isTranslationEnabled) {
      const rawRanks: any[] = data?.ranks || [];
      const ranks = rawRanks.map((r: any, idx: number) => {
        const rawActions: any[] = r.actions || [];
        const actions = rawActions.map((a: any) => ({
          name: a.name || 'Action',
          detail: a.detail || a.description || '',
          trigger: a.trigger || '',
          activation: this.translateActivation(a.activation)
        }));
        return {
          rankLevel: idx + 1,
          name: r.name || `Rank ${idx + 1}`,
          description: r.description || r.detail || '',
          isActive: idx + 1 <= currentRank,
          actions
        };
      });

      return {
        id: tid,
        name: data?.name || tid || 'Talent',
        description: data?.description || '',
        terse: data?.terse || '',
        currentRank,
        ranks
      };
    }

    const prefixes = [`ta_${cleanId}`, cleanId, tid];

    let name = '';
    let description = '';
    let terse = '';

    // Nome e descrições base
    for (const pfx of prefixes) {
      if (!name && locales[`${pfx}.name`]) name = locales[`${pfx}.name`];
      if (!description && locales[`${pfx}.description`]) description = locales[`${pfx}.description`];
      if (!terse && locales[`${pfx}.terse`]) terse = locales[`${pfx}.terse`];
    }

    if (!name) name = data?.name || tid;
    if (!description) description = data?.description || '';
    if (!terse) terse = data?.terse || '';

    // Ranques (I, II, III)
    const rawRanks: any[] = data?.ranks || [];
    const ranks = rawRanks.map((r: any, idx: number) => {
      const rankNum = idx + 1;
      const cleanRank = rankNum === 1 ? 'i' : rankNum === 2 ? 'ii' : 'iii';

      let rName = '';
      let rDesc = '';

      for (const pfx of prefixes) {
        const candidateKeys = [
          `${pfx}.rank_${cleanRank}.name`,
          `${pfx}.rank_${rankNum}.name`,
          `${pfx}.${cleanRank}.name`,
          `rank_${cleanRank}.name`
        ];
        for (const k of candidateKeys) {
          if (locales[k]) {
            rName = locales[k];
            break;
          }
        }
        if (rName) break;
      }

      for (const pfx of prefixes) {
        const candidateDescKeys = [
          `${pfx}.rank_${cleanRank}.description`,
          `${pfx}.rank_${cleanRank}.detail`,
          `${pfx}.rank_${rankNum}.description`,
          `${pfx}.${cleanRank}.description`,
          `rank_${cleanRank}.description`
        ];
        for (const k of candidateDescKeys) {
          if (locales[k]) {
            rDesc = locales[k];
            break;
          }
        }
        if (rDesc) break;
      }

      if (!rName) rName = r.name || `Ranque ${cleanRank.toUpperCase()}`;
      if (!rDesc) rDesc = r.description || r.detail || '';

      // Sub-ações e poderes concedidos por este ranque
      const rawActions: any[] = r.actions || [];
      const actions = rawActions.map((a: any) => {
        const aid = (a.id || '').toLowerCase().replace(/^(act_|action_)/, '');
        const aname = (a.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_');

        let aName = '';
        let aDetail = '';
        let aTrigger = '';

        // 1. Testar chaves diretas e compostas do compcon-pt-br.json
        for (const pfx of prefixes) {
          const candidates = [
            `act_${aid}`,
            aid,
            `${pfx}.rank_${cleanRank}.action_${aname}`,
            `${pfx}.rank_${cleanRank}.action_${aid}`,
            `${pfx}.rank_${cleanRank}.action_${cleanRank}_${aname}`,
            `${pfx}.rank_${cleanRank}.action_${cleanRank}_${aid}`,
            `${pfx}.rank_${cleanRank}.active_effect_${aname}`,
            `${pfx}.rank_${cleanRank}.active_effect_${aid}`,
            `${pfx}.rank_${cleanRank}.active_effect_${cleanRank}`
          ];

          for (const c of candidates) {
            if (locales[`${c}.name`]) {
              aName = locales[`${c}.name`];
              aDetail = locales[`${c}.detail`] || locales[`${c}.description`] || '';
              aTrigger = locales[`${c}.trigger`] || '';
              break;
            }
          }
          if (aName) break;
        }

        // 2. Se não encontrou por correspondência direta, faz busca inteligente no ranque
        if (!aName) {
          for (const pfx of prefixes) {
            const rankPrefix = `${pfx}.rank_${cleanRank}.action_`;
            const rankKeys = Object.keys(locales).filter((k) => k.startsWith(rankPrefix) && k.endsWith('.name'));
            for (const rk of rankKeys) {
              const baseKey = rk.replace('.name', '');
              if ((aid && baseKey.includes(aid)) || (aname && baseKey.includes(aname))) {
                aName = locales[rk];
                aDetail = locales[`${baseKey}.detail`] || locales[`${baseKey}.description`] || '';
                aTrigger = locales[`${baseKey}.trigger`] || '';
                break;
              }
            }
            if (aName) break;
          }
        }

        // 3. Fallbacks caso não esteja no dicionário
        if (!aName) aName = a.name || 'Poder';
        if (!aDetail) aDetail = a.detail || a.description || '';
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
export const localizationService = localization;
