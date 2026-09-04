import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { connectMongoDB, disconnectMongoDB } from '../database/mongo.js';
import { UserModel } from '../database/models/User.model.js';
import { PilotModel } from '../database/models/Pilot.model.js';
import { MissionModel } from '../database/models/Mission.model.js';

async function seedTestPriority() {
  console.log('[*] Conectando ao MongoDB...');
  await connectMongoDB();
  console.log('[+] Conectado!');

  try {
    // 1. Localiza ou cria um usuário GM para ser dono da missão
    let gmUser = await UserModel.findOne({ role: { $in: ['GM', 'ADMIN'] } });
    if (!gmUser) {
      gmUser = await UserModel.findOne();
    }
    if (!gmUser) {
      console.log('[*] Criando usuário Mestre de Teste...');
      gmUser = await UserModel.create({
        discord_id: '999999999999999001',
        username: 'mestre_lancer',
        name: 'Mestre da Guilda',
        role: 'GM',
        avatar: 'https://cdn.discordapp.com/embed/avatars/0.png'
      });
    }
    console.log(`[+] Mestre da Missão: ${gmUser.name} (@${gmUser.username}) [${gmUser._id}]`);

    // 2. Localiza ou cria usuários para os 4 pilotos de teste
    const pilotDefinitions = [
      {
        callsign: 'VANGUARD',
        name: 'Arthur Vance',
        license_level: 0,
        active_mech_name: 'IRON CHERUB',
        active_mech_frame: 'GMS Everest',
        total_missions_played: 0,
        last_mission_date: null, // Nunca jogou
        daysDesc: 'Nunca jogou (60d máx)'
      },
      {
        callsign: 'NOMAD',
        name: 'Elena Rostova',
        license_level: 2,
        active_mech_name: 'NORTHSTAR VOYAGER',
        active_mech_frame: 'IPS-N Lancaster',
        total_missions_played: 2,
        last_mission_date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 dias sem jogar
        daysDesc: '35 dias sem jogar'
      },
      {
        callsign: 'STRIKER',
        name: 'Marcus Thorne',
        license_level: 4,
        active_mech_name: 'DUSK MONARCH',
        active_mech_frame: 'SSC Monarch',
        total_missions_played: 5,
        last_mission_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 dias sem jogar
        daysDesc: '10 dias sem jogar'
      },
      {
        callsign: 'APEX',
        name: 'Valeria Quinn',
        license_level: 6,
        active_mech_name: 'SOLARIS BARBAROSSA',
        active_mech_frame: 'HA Barbarossa',
        total_missions_played: 9,
        last_mission_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 dias atrás
        daysDesc: '2 dias sem jogar'
      }
    ];

    const createdPilots: any[] = [];

    for (let i = 0; i < pilotDefinitions.length; i++) {
      const def = pilotDefinitions[i];
      const discordId = `88888888888888800${i + 1}`;

      let user = await UserModel.findOne({ discord_id: discordId });
      if (!user) {
        user = await UserModel.create({
          discord_id: discordId,
          username: `piloto_${def.callsign.toLowerCase()}`,
          name: def.name,
          role: 'PILOT',
          avatar: `https://cdn.discordapp.com/embed/avatars/${(i + 1) % 5}.png`
        });
      }

      // Procura ou atualiza o piloto
      let pilot = await PilotModel.findOne({ callsign: def.callsign });
      if (!pilot) {
        pilot = await PilotModel.create({
          user_id: user._id,
          callsign: def.callsign,
          name: def.name,
          license_level: def.license_level,
          stars: 0,
          grit: Math.ceil(def.license_level / 2),
          hull: 2,
          agility: 1,
          systems: 1,
          engineering: 1,
          talents: [],
          skills: [],
          licenses: [],
          mechs: [
            {
              id: `mech-${def.callsign.toLowerCase()}`,
              name: def.active_mech_name,
              frame: def.active_mech_frame,
              active: true
            }
          ],
          active_mech_name: def.active_mech_name,
          active_mech_frame: def.active_mech_frame,
          is_active: true,
          status: 'APPROVED',
          total_missions_played: def.total_missions_played,
          last_mission_date: def.last_mission_date
        });
      } else {
        // Atualiza para garantir os parâmetros de teste de prioridade
        pilot.user_id = user._id;
        pilot.status = 'APPROVED';
        pilot.is_active = true;
        pilot.total_missions_played = def.total_missions_played;
        pilot.last_mission_date = def.last_mission_date;
        pilot.license_level = def.license_level;
        pilot.active_mech_name = def.active_mech_name;
        pilot.active_mech_frame = def.active_mech_frame;
        await pilot.save();
      }

      createdPilots.push({ pilot, def });
    }

    // 3. Remove missão de teste anterior se existir
    const testTitle = 'OPERAÇÃO PROTOCOLO ÍCARO // TESTE DE PRIORIDADE';
    await MissionModel.deleteMany({ title: testTitle });

    // 4. Cria a nova missão de teste
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    // Calcula scores esperados usando a mesma fórmula oficial
    const applications = createdPilots.map(({ pilot, def }) => {
      const daysSinceLastMission = pilot.last_mission_date
        ? Math.floor((Date.now() - new Date(pilot.last_mission_date).getTime()) / (1000 * 60 * 60 * 24))
        : 60;
      const priorityScore = Math.max(0, 100 - (pilot.total_missions_played * 10) + Math.min(50, daysSinceLastMission));

      return {
        pilot_id: pilot._id,
        applied_at: new Date(),
        priority_score: priorityScore,
        status: 'PENDING'
      };
    });

    const mission = await MissionModel.create({
      gm_id: gmUser._id,
      title: testTitle,
      contractor: 'HORUS',
      difficulty: '2',
      min_ll: 0,
      max_ll: 8,
      slots_total: 3, // 3 vagas para 4 inscritos (o último na prioridade deve ficar de fora)
      start_date: dateStr,
      start_time: '20:00',
      end_date: dateStr,
      voice_channel: '#operacoes-alfa',
      platform: 'Foundry VTT',
      briefing: 'Operação tática confidencial financiada pela HORUS para testar o protocolo de escalação e matchmaking por prioridade de esquadrão.',
      optional_rules: 'Regras padrão de engajamento LANCER COMP/CON v3.0.',
      status: 'OPEN',
      applications
    });

    console.log(`\n======================================================`);
    console.log(`[+] Missão de Teste Criada: "${mission.title}" [ID: ${mission._id}]`);
    console.log(`[+] Contratante: ${mission.contractor} | Vagas: ${mission.slots_total} | Status: ${mission.status}`);
    console.log(`======================================================\n`);

    console.log(`[+] RANKING DE PRIORIDADE CALCULADO:`);
    const sortedApps = [...applications].sort((a, b) => b.priority_score - a.priority_score);

    sortedApps.forEach((app, idx) => {
      const pData = createdPilots.find((cp) => cp.pilot._id.toString() === app.pilot_id.toString());
      const p = pData?.pilot;
      const def = pData?.def;
      const willBeSelected = idx < mission.slots_total ? 'ESQUADRÃO TITULAR' : 'LISTA DE ESPERA';
      console.log(
        ` #${idx + 1} [Score: ${app.priority_score} pts] [${willBeSelected}] -> Callsign: "${p.callsign}" (${p.name}) | LL: ${p.license_level} | Missões: ${p.total_missions_played} | Tempo: ${def?.daysDesc}`
      );
    });

    console.log(`\n[+] Tudo pronto para testes na interface!`);
  } catch (err) {
    console.error('[-] Erro ao executar seed de teste:', err);
  } finally {
    await disconnectMongoDB();
    console.log('[*] Desconectado do MongoDB.');
  }
}

seedTestPriority();
