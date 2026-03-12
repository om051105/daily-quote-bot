const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const USERNAME     = process.env.GH_USERNAME || 'om051105';
const TOKEN        = process.env.GH_PAT;
const GEMINI_KEY   = process.env.GEMINI_API_KEY;
const OPENAI_KEY   = process.env.OPENAI_API_KEY;
const START_DATE   = process.env.START_DATE   || '2025-01-01';
const END_DATE     = process.env.END_DATE     || '2025-12-31';
const FILL_DENSITY = parseFloat(process.env.FILL_DENSITY || '0.3');

const TARGET_REPOS = [
  'AlphaForge', 'BloodLink', 'CampusNest', 'Food-Ordering-app', 'Concentration-Tracker'
];

const LANG_MAP = {
  '.js':'JavaScript','.ts':'TypeScript','.py':'Python',
  '.cpp':'C++','.c':'C','.php':'PHP','.html':'HTML','.css':'CSS',
};

const COMMIT_MSGS = [
  'refactor: optimize internal logic',
  'feat: implement data utility functions',
  'fix: address minor edge cases',
  'style: improve code readability',
  'feat: add validation helpers',
  'docs: clarify function usage',
  'perf: optimize loops',
  'chore: minor code refinements',
  'test: add unit coverage',
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const ri = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[ri(0, arr.length - 1)];
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio:'pipe' }).toString().trim();
const safe = (cmd, cwd) => { try { return run(cmd, cwd); } catch(_) { return ''; } };

function detectLang(dir) {
  const counts = {};
  for (const f of fs.readdirSync(dir)) {
    const ext = path.extname(f).toLowerCase();
    if (LANG_MAP[ext]) counts[ext] = (counts[ext]||0) + 1;
  }
  if (!Object.keys(counts).length) return { lang:'Python', ext:'.py' };
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
  return { lang: LANG_MAP[top], ext: top };
}

function gemini(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 500 }
    });
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let out = ''; res.on('data', c => out += c);
      res.on('end', () => {
        try {
          const t = JSON.parse(out)?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          resolve(t.replace(/```[\w]*\n?/g,'').replace(/```$/,'').trim());
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// ─── OPENAI API ──────────────────────────────────────────────────────────────
function openai(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.9
    });
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
    }, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => {
        try {
          const t = JSON.parse(out)?.choices?.[0]?.message?.content || '';
          resolve(t.replace(/```[\w]*\n?/g,'').replace(/```$/,'').trim());
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

async function askAI(prompt) {
  if (OPENAI_KEY) {
    console.log('    🤖 Using OpenAI API...');
    return openai(prompt);
  } else if (GEMINI_KEY) {
    console.log('    🤖 Using Gemini API...');
    return gemini(prompt);
  } else {
    throw new Error('No AI API key found (GEMINI_API_KEY or OPENAI_API_KEY)');
  }
}

function newFileName(ext) {
  const prefixes = ['archived','legacy','history','bkp','v1','old'];
  const mids     = ['utils','helpers','logic','tools','internal'];
  return `${pick(prefixes)}_${pick(mids)}_${Date.now().toString().slice(-4)}${ext}`;
}

// ─── BACKFILL ENGINE ─────────────────────────────────────────────────────────
async function backfillRepo(repoName, startDate, endDate, density) {
  const tmpDir = path.join(os.tmpdir(), `bf-${repoName}-${Date.now()}`);
  const repoUrl = `https://${TOKEN}@github.com/${USERNAME}/${repoName}.git`;
  
  console.log(`\n🚀 Backfilling: ${repoName}`);

  try {
    run(`git clone "${repoUrl}" "${tmpDir}"`);
    run(`git config user.name "${USERNAME}"`, tmpDir);
    run(`git config user.email "${USERNAME}@users.noreply.github.com"`, tmpDir);

    const { lang, ext } = detectLang(tmpDir);

    let current = new Date(startDate);
    const end = new Date(endDate);
    let commitsInRepo = 0;

    while (current <= end) {
      if (Math.random() < density) {
        const dateStr = current.toISOString().split('T')[0];
        const timestamp = `${dateStr}T${ri(9,20).toString().padStart(2,'0')}:${ri(10,59).toString().padStart(2,'0')}:00`;
        
        console.log(`  🤖 generating code for ${dateStr}...`);
        const code = await askAI(`Write a standalone ${lang} utility file with 3 functions. Max 45 lines. ONLY CODE.`);
        
        if (code && code.length > 50) {
          const file = newFileName(ext);
          fs.writeFileSync(path.join(tmpDir, file), code + '\n');
          
          process.env.GIT_AUTHOR_DATE = timestamp;
          process.env.GIT_COMMITTER_DATE = timestamp;
          
          run(`git add "${file}"`, tmpDir);
          run(`git commit -m "${pick(COMMIT_MSGS)} [history]"`, tmpDir);
          
          delete process.env.GIT_AUTHOR_DATE;
          delete process.env.GIT_COMMITTER_DATE;
          commitsInRepo++;
        }
      }
      current.setDate(current.getDate() + 1);
    }

    if (commitsInRepo > 0) {
      run(`git push origin main`, tmpDir);
      console.log(`  ✅ Pushed ${commitsInRepo} commits to ${repoName}`);
    } else {
      console.log(`  ⚠️ No commits generated for ${repoName}`);
    }

  } catch (err) {
    console.error(`  ❌ Failed: ${err.message}`);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

async function main() {
  if (!TOKEN) {
    console.error("❌ Missing GH_PAT env var!");
    return;
  }
  if (!GEMINI_KEY && !OPENAI_KEY) {
    console.error("❌ Missing both GEMINI_API_KEY and OPENAI_API_KEY! At least one is required.");
    return;
  }
  console.log(`📡 AI Backfill: ${START_DATE} to ${END_DATE} (Density: ${FILL_DENSITY})`);

  for (const repo of TARGET_REPOS) {
    await backfillRepo(repo, START_DATE, END_DATE, FILL_DENSITY / TARGET_REPOS.length);
    await new Promise(r => setTimeout(r, 2000));
  }
}

main();
