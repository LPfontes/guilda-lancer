import { describe, it, expect } from 'vitest';
import { CompconService } from '../src/services/compcon.service.js';

describe('CompconService - Parser & LANCER Rules Validation', () => {
  it('should clean and extract share codes from URLs or raw strings', () => {
    expect(CompconService.cleanShareCode('  ABC123XYZ  ')).toBe('ABC123XYZ');
    expect(CompconService.cleanShareCode('https://compcon.app/#/pilot/FIGHTER_01')).toBe('FIGHTER_01');
    expect(CompconService.cleanShareCode('https://compcon.app/vault/MECH_VANGUARD')).toBe('MECH_VANGUARD');
    expect(CompconService.cleanShareCode('')).toBe('');
  });

  it('should parse a standard LL0 COMP/CON pilot correctly', () => {
    const mockPilotLL0 = {
      callsign: 'Apex',
      name: 'Elena Rostova',
      level: 0,
      grit: 0,
      hase: [0, 0, 0, 0],
      talents: [
        { id: 't_skirmisher', name: 'Skirmisher', rank: 1 },
        { id: 't_brawler', name: 'Brawler', rank: 1 },
        { id: 't_infiltrator', name: 'Infiltrator', rank: 1 }
      ],
      skills: [
        { id: 's_spot', name: 'Spot', bonus: 2 },
        { id: 's_stay_cool', name: 'Stay Cool', bonus: 2 },
        { id: 's_hack', name: 'Hack/Fix', bonus: 2 },
        { id: 's_charm', name: 'Charm', bonus: 2 }
      ],
      mechs: [
        {
          id: 'mech_01',
          name: 'Apex Dawn',
          frame: 'GMS Standard Pattern I Everest',
          active: true
        }
      ]
    };

    const parsed = CompconService.parseCompconPilot(mockPilotLL0, 'ABC123');

    expect(parsed.callsign).toBe('APEX');
    expect(parsed.name).toBe('Elena Rostova');
    expect(parsed.license_level).toBe(0);
    expect(parsed.grit).toBe(0);
    expect(parsed.hull).toBe(0);
    expect(parsed.talents.length).toBe(3);
    expect(parsed.skills.length).toBe(4);
    expect(parsed.active_mech_name).toBe('Apex Dawn');
    expect(parsed.active_mech_frame).toBe('GMS Standard Pattern I Everest');
    expect(parsed.share_code).toBe('ABC123');
  });

  it('should parse a pilot from JSON string format', () => {
    const jsonStr = JSON.stringify({
      callSign: 'Viper',
      level: 1,
      stats: { hull: 2, agility: 0, systems: 0, engineering: 0 },
      talents: [
        { id: 't_gunslinger', name: 'Gunslinger', rank: 2 },
        { id: 't_crack_shot', name: 'Crack Shot', rank: 1 },
        { id: 't_vanguard', name: 'Vanguard', rank: 1 }
      ],
      mechs: [
        {
          name: 'Viper Fang',
          frame: 'IPS-N Raleigh',
          active: true
        }
      ]
    });

    const parsed = CompconService.parseCompconPilot(jsonStr);

    expect(parsed.callsign).toBe('VIPER');
    expect(parsed.license_level).toBe(1);
    expect(parsed.hull).toBe(2);
    expect(parsed.grit).toBe(1);
    expect(parsed.active_mech_name).toBe('Viper Fang');
    expect(parsed.active_mech_frame).toBe('IPS-N Raleigh');
    expect(parsed.is_valid).toBe(true);
  });

  it('should detect HASE overallocation warnings when points exceed LL allowance', () => {
    const invalidHASEPilot = {
      callsign: 'OVERLOAD',
      level: 0, // LL0 allows 0 HASE points
      hase: [2, 2, 0, 0], // Total 4 points allocated
      talents: [
        { id: 't1', name: 'T1', rank: 1 },
        { id: 't2', name: 'T2', rank: 1 },
        { id: 't3', name: 'T3', rank: 1 }
      ],
      mechs: [{ name: 'Overload Mech', frame: 'Everest', active: true }]
    };

    const parsed = CompconService.parseCompconPilot(invalidHASEPilot);
  });

  it('should detect Talents overallocation warnings when ranks exceed LL + 3', () => {
    const invalidTalentsPilot = {
      callsign: 'GREEDY_TALENTS',
      level: 0, // LL0 allows 3 ranks maximum
      hase: [0, 0, 0, 0],
      talents: [
        { id: 't1', name: 'T1', rank: 2 },
        { id: 't2', name: 'T2', rank: 2 } // Total ranks = 4
      ],
      mechs: [{ name: 'Test Mech', frame: 'Everest', active: true }]
    };

    const parsed = CompconService.parseCompconPilot(invalidTalentsPilot);

  });

  it('should generate an Omninet military tactical summary', () => {
    const summary = CompconService.generateTacticalSummary({
      callsign: 'GHOST',
      license_level: 3,
      grit: 2,
      hull: 2,
      agility: 4,
      systems: 0,
      engineering: 0,
      active_mech_name: 'Spectral Echo',
      active_mech_frame: 'SSC Mourning Cloak',
      status: 'APPROVED',
      talents: [{ id: 't_hunter', name: 'Hunter', rank: 2 }],
      skills: [{ id: 's_prowl', name: 'Prowl', bonus: 4 }]
    });

    expect(summary).toContain('OMNINET ARCHIVE RECORD // PILOT DOSSIER');
    expect(summary).toContain('INDICATIVO (CALLSIGN): GHOST');
    expect(summary).toContain('STATUS OPERACIONAL   : APPROVED');
    expect(summary).toContain('NÍVEL DE LICENÇA (LL): 3 | DETERMINAÇÃO (GRIT): +2');
    expect(summary).toContain('Spectral Echo [CHASSI: SSC Mourning Cloak]');
    expect(summary).toContain('Hunter (R2)');
    expect(summary).toContain('Prowl (+4)');
  });
});
