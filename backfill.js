const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const USERNAME     = process.env.GH_USERNAME || 'om051105';
const TOKEN        = process.env.GH_PAT;
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

// ─── LOCAL CODE TEMPLATES ─────────────────────────────────────────────────────
const CODE_TEMPLATES = {
  JavaScript: [
    (id) => `// Utility functions - module ${id}\n\nfunction clamp(val, min, max) {\n  return Math.min(Math.max(val, min), max);\n}\n\nfunction unique(arr) {\n  return [...new Set(arr)];\n}\n\nfunction flatten(arr) {\n  return arr.reduce((a, v) => a.concat(v), []);\n}\n\nmodule.exports = { clamp, unique, flatten };`,
    (id) => `// String helpers - module ${id}\n\nfunction capitalize(str) {\n  if (!str) return '';\n  return str.charAt(0).toUpperCase() + str.slice(1);\n}\n\nfunction truncate(str, len) {\n  if (str.length <= len) return str;\n  return str.slice(0, len - 3) + '...';\n}\n\nmodule.exports = { capitalize, truncate };`,
  ],
  Python: [
    (id) => `# Utility functions - module ${id}\n\ndef clamp(value, min_val, max_val):\n    return max(min_val, min(value, max_val))\n\ndef flatten(lst):\n    result = []\n    for item in lst:\n        if isinstance(item, list):\n            result.extend(item)\n        else:\n            result.append(item)\n    return result\n\ndef unique(items):\n    seen = set()\n    result = []\n    for x in items:\n        if x not in seen:\n            seen.add(x)\n            result.append(x)\n    return result`,
    (id) => `# String helpers - module ${id}\n\ndef capitalize_words(text):\n    return ' '.join(w.capitalize() for w in text.split())\n\ndef is_palindrome(text):\n    cleaned = text.lower().replace(' ', '')\n    return cleaned == cleaned[::-1]`,
  ],
};

function generateCode(lang, id) {
  const templates = CODE_TEMPLATES[lang];
  if (templates && templates.length > 0) {
    return pick(templates)(id);
  }
  const comment = lang === 'Python' ? '#' : '//';
  return `${comment} Auto-generated utility module ${id}\n${comment} Language: ${lang}\n${comment} Generated: ${new Date().toISOString()}`;
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
        const id = `${repoName}-${dateStr}`;
        const code = generateCode(lang, id);
        
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
  console.log(`📡 AI Backfill: ${START_DATE} to ${END_DATE} (Density: ${FILL_DENSITY})`);

  for (const repo of TARGET_REPOS) {
    await backfillRepo(repo, START_DATE, END_DATE, FILL_DENSITY / TARGET_REPOS.length);
    await new Promise(r => setTimeout(r, 2000));
  }
}

main();
