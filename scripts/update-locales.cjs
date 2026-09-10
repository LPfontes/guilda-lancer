const https = require('https');
const fs = require('fs');
const path = require('path');

const sources = [
  'ui',
  'content/lancer-srd',
  'content/dustgrave-data',
  'content/ktb-data',
  'content/long-rim-data',
  'content/osr-data',
  'content/ows-data',
  'content/sotw-data',
  'content/ssmr-data',
  'content/wallflower-data',
  'content/lancer-data' // Base core book loaded last for standard keys
];

function fetchJson(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'GuildaLancer-Updater' } }, (res) => {
      if (res.statusCode !== 200) {
        console.log(`[-] ${url} -> Status ${res.statusCode} (ignoring)`);
        return resolve({});
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`[+] ${url} -> ${Object.keys(parsed).length} chaves`);
          resolve(parsed);
        } catch (e) {
          console.error(`[!] Erro ao parsear JSON de ${url}:`, e.message);
          resolve({});
        }
      });
    }).on('error', (err) => {
      console.error(`[!] Erro na requisição para ${url}:`, err.message);
      resolve({});
    });
  });
}

function flatten(obj, prefix = '') {
  const res = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(res, flatten(v, fullKey));
    } else if (v !== null && v !== undefined) {
      res[fullKey] = String(v);
    }
  }
  return res;
}

async function run() {
  console.log('[*] Sincronizando traduções com massif-press/compcon-locales...');
  const targetFile = path.join(__dirname, '..', 'client', 'src', 'locales', 'compcon-pt-br.json');

  let existing = {};
  if (fs.existsSync(targetFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
      existing = flatten(existing);
      console.log(`[*] Dicionário local atual possui ${Object.keys(existing).length} chaves.`);
    } catch (e) {
      console.warn('[!] Não foi possível ler o arquivo local existente:', e.message);
    }
  }

  const merged = { ...existing };

  for (const src of sources) {
    const url = `https://raw.githubusercontent.com/massif-press/compcon-locales/master/${src}/pt_BR.json`;
    const json = await fetchJson(url);
    const flat = flatten(json);
    Object.assign(merged, flat);
  }

  const totalKeys = Object.keys(merged).length;
  console.log(`[*] Total de chaves após mesclagem e achatamento: ${totalKeys}`);

  fs.writeFileSync(targetFile, JSON.stringify(merged), 'utf-8');
  console.log(`[✓] Arquivo salvo em: ${targetFile} (${(fs.statSync(targetFile).size / 1024 / 1024).toFixed(2)} MB)`);
}

run();
