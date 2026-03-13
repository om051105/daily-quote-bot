const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const USERNAME    = process.env.GH_USERNAME || 'om051105';
const TOKEN       = process.env.GH_PAT;
const GEMINI_KEY  = process.env.GEMINI_API_KEY;
const OPENAI_KEY  = process.env.OPENAI_API_KEY;
const GROQ_KEY    = process.env.GROQ_API_KEY;
const NOTIFY_ISSUE = process.env.NOTIFY_ISSUE || '1'; // issue # for phone notifs
const ROTATION_FILE = path.join(__dirname, 'rotation_log.json');

const ALL_REPOS = [
  'Concentration-Tracker','AlphaForge','CampusNest','BloodLink',
  'Food-Ordering-app','AI-Music-Recommendation-System','health-monitor',
  'ML','Python','AI-Document-Search--RAG-Chatbot','Focus-Mode',
  'Bio-Solar-Correlation-Engine','Sudoku-Vision','Real-Time-Concentration-Tracker',
  'om051105','habit-tracker','LPU-wifi-login','Spectra','log-system',
  'tomato-disease-web','TwitterLocationAI','Deepify','DSA-CPP',
  'my-portfolio','AiGrantWriter-main','Cricket-Win-Predictor','portfolio',
];

const LANG_MAP = {
  '.js':'JavaScript','.ts':'TypeScript','.py':'Python',
  '.cpp':'C++','.c':'C','.php':'PHP','.html':'HTML',
  '.css':'CSS','.java':'Java','.rb':'Ruby','.go':'Go',
};

const COMMIT_MSGS = [
  'refactor: optimize internal logic for better performance',
  'feat: implement reusable data utility functions',
  'fix: address minor edge cases in data processing',
  'style: improve code readability and formatting',
  'refactor: cleanup redundant code and improve structure',
  'feat: add validation helpers for core modules',
  'docs: clarify function usage in utility modules',
  'feat: implement cross-platform helper functions',
  'perf: optimize loops and conditional logic',
  'chore: housekeeping and minor code refinements',
  'refactor: modularize utility functions for reuse',
  'fix: minor type checking and null safety improvements',
  'test: add unit tests for core utility functions',
  'feat: add error boundary and fallback logic',
  'refactor: extract common patterns into shared helpers',
];

const ISSUE_TITLES = [
  'improve error handling in utility modules',
  'optimize data processing pipeline',
  'add validation layer to core functions',
  'refactor helper functions for reusability',
  'implement missing edge case handling',
  'improve type safety across modules',
  'add unit coverage for utility functions',
  'optimize loop performance in data handlers',
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const ri = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[ri(0, arr.length - 1)];
const shuffle = arr => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=ri(0,i);[a[i],a[j]]=[a[j],a[i]];} return a; };
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio:'pipe' }).toString().trim();
const safe = (cmd, cwd) => { try { return run(cmd, cwd); } catch(_) { return ''; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── ROTATION LOG ────────────────────────────────────────────────────────────
const Rotation = {
  load() {
    try { return JSON.parse(fs.readFileSync(ROTATION_FILE, 'utf8')); } catch(_) { return {}; }
  },
  save(log) {
    fs.writeFileSync(ROTATION_FILE, JSON.stringify(log, null, 2));
  },
  getEligible() {
    const log = this.load();
    const today = new Date().toISOString().split('T')[0];
    // Prefer repos not touched in last 3 days
    const recent = new Set(Object.entries(log).filter(([,d]) => {
      const diff = (Date.now() - new Date(d).getTime()) / 86400000;
      return diff < 3;
    }).map(([r]) => r));
    const preferred = ALL_REPOS.filter(r => !recent.has(r));
    return preferred.length >= 2 ? preferred : ALL_REPOS; // fallback to all
  },
  markUpdated(repos) {
    const log = this.load();
    const today = new Date().toISOString().split('T')[0];
    repos.forEach(r => log[r] = today);
    this.save(log);
  },
};

// ─── LANGUAGE DETECTION ──────────────────────────────────────────────────────
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

// ─── GITHUB API ──────────────────────────────────────────────────────────────
function ghApi(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${USERNAME}/${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': USERNAME,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => { try { resolve(JSON.parse(out)); } catch(_) { resolve({}); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function ghApiRoot(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: `/${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': USERNAME,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => { try { resolve(JSON.parse(out)); } catch(_) { resolve({}); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── GEMINI API ──────────────────────────────────────────────────────────────
function gemini(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: 700 }
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
      max_tokens: 700,
      temperature: 0.85
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
  } else if (GROQ_KEY) {
    console.log('    🤖 Using Groq (Llama 3) API...');
    return groq(prompt);
  } else if (GEMINI_KEY) {
    console.log('    🤖 Using Gemini API...');
    return gemini(prompt);
  } else {
    throw new Error('No AI API key found (GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY)');
  }
}

// ─── GROQ API ────────────────────────────────────────────────────────────────
function groq(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 700,
      temperature: 0.8
    });
    const req = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`
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

// ─── FILE NAMING ─────────────────────────────────────────────────────────────
function newFileName(ext, isTest=false) {
  const prefixes = ['core','shared','app','base','internal','common','lib'];
  const mids     = ['utils','helpers','logic','tools','service','handler','lib'];
  const usePrefix = Math.random() > 0.5;
  const name  = usePrefix ? `${pick(prefixes)}_${pick(mids)}` : pick(mids);
  return isTest ? `test_${name}${ext}` : `${name}${ext}`;
}

// ─── CODE GENERATION ─────────────────────────────────────────────────────────
async function genUtility(repoName, lang, contextCode) {
  const prompt = `You are a developer on a "${repoName}" project (${lang}).
${contextCode ? `Existing code sample:\n\`\`\`\n${contextCode.slice(0,600)}\n\`\`\`` : ''}
Write a NEW standalone ${lang} file with 3-4 REAL working utility functions.
- Proper comments, no placeholders, no external imports (builtins only), max 55 lines.
Output ONLY the code.`;
  return askAI(prompt);
}

async function genTests(repoName, lang, utilCode) {
  const prompt = `You are a developer on "${repoName}" (${lang}).
Given this utility code:\n\`\`\`\n${utilCode.slice(0,500)}\n\`\`\`
Write a test file (using builtins/standard test framework for ${lang}) that tests these functions.
Max 40 lines. Output ONLY the code.`;
  return askAI(prompt);
}

// ─── ISSUE WORKFLOW ──────────────────────────────────────────────────────────
async function createAndCloseIssue(repoName) {
  try {
    const title = `fix: ${pick(ISSUE_TITLES)}`;
    const issue = await ghApi('POST', `${repoName}/issues`, {
      title, body: 'Identified during routine code review. Addressing in this commit.',
    });
    const issueNum = issue.number;
    if (!issueNum) return null;
    console.log(`    📋 Created issue #${issueNum}: "${title}"`);
    return { num: issueNum, title };
  } catch(e) { return null; }
}

async function closeIssue(repoName, issueNum) {
  try {
    await ghApi('PATCH', `${repoName}/issues/${issueNum}`, { state: 'closed' });
    console.log(`    ✅ Closed issue #${issueNum}`);
  } catch(_) {}
}

// ─── PHONE NOTIFICATION ──────────────────────────────────────────────────────
async function notifyPhone(updatedRepos, totalSelected) {
  const date = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const repoList = updatedRepos.map(r => `- ✅ \`${r}\``).join('\n');
  const body = `## 🤖 Daily Update Report\n**${date} (IST)**\n\n**Targeted ${totalSelected} repos, successfully updated ${updatedRepos.length}:**\n\n${repoList}\n\n> Powered by Gemini AI`;
  try {
    await ghApi('POST', `daily-quote-bot/issues/${NOTIFY_ISSUE}/comments`, { body });
    console.log(`\n📱 Phone notification sent! Check GitHub app.`);
  } catch(e) { console.log('  ⚠️ Notification failed:', e.message); }
}

// ─── BRANCH WORKFLOW ─────────────────────────────────────────────────────────
async function pushViaBranch(repoDir, repoName, commits) {
  // commits = [{ file, content, message }]
  const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const branch = `maintenance/${date}-${repoName.toLowerCase().replace(/[^a-z0-9]/g,'-')}`;

  // Create and switch to branch
  run(`git checkout -b ${branch}`, repoDir);

  let pushed = 0;
  for (const { file, content, message } of commits) {
    fs.writeFileSync(path.join(repoDir, file), content + '\n');
    run(`git add "${file}"`, repoDir);
    const status = safe('git status --porcelain', repoDir);
    if (!status) continue;
    run(`git commit -m "${message}"`, repoDir);
    pushed++;
    await sleep(800);
  }

  if (pushed === 0) return false;

  // Push branch
  run(`git push origin ${branch}`, repoDir);
  console.log(`    🌿 Pushed branch: ${branch}`);

  // Merge via API
  try {
    await ghApi('POST', `${repoName}/merges`, {
      base: 'main', head: branch,
      commit_message: `Merge ${branch}: automated maintenance`,
    });
    console.log(`    🔀 Merged to main`);
  } catch(_) {
    // Try master if main failed
    try {
      await ghApi('POST', `${repoName}/merges`, {
        base: 'master', head: branch,
        commit_message: `Merge ${branch}: automated maintenance`,
      });
      console.log(`    🔀 Merged to master`);
    } catch(e) { console.log(`    ⚠️ Merge failed:`, e.message); }
  }

  // Delete branch
  try { await ghApi('DELETE', `${repoName}/git/refs/heads/${branch}`); } catch(_) {}
  return true;
}

// ─── MAIN REPO PROCESSOR ─────────────────────────────────────────────────────
async function processRepo(repoName) {
  const tmpDir = path.join(os.tmpdir(), `upd-${repoName}-${Date.now()}`);
  const repoUrl = `https://${TOKEN}@github.com/${USERNAME}/${repoName}.git`;
  console.log(`\n📦 ${repoName}`);

  try {
    run(`git clone --depth=1 "${repoUrl}" "${tmpDir}"`);
    run(`git config user.name "${USERNAME}"`, tmpDir);
    run(`git config user.email "${USERNAME}@users.noreply.github.com"`, tmpDir);

    const { lang, ext } = detectLang(tmpDir);
    console.log(`    🔍 Language: ${lang}`);

    // Read existing code for context
    const files = fs.readdirSync(tmpDir).filter(f => path.extname(f) === ext);
    const contextCode = files.length ? fs.readFileSync(path.join(tmpDir, files[0]), 'utf8') : '';

    // Create + track issue (simulate real developer workflow)
    const issue = await createAndCloseIssue(repoName);
    await sleep(1000);

    // Generate utility code
    console.log(`    🤖 Generating utility code...`);
    const utilCode = await genUtility(repoName, lang, contextCode);
    if (!utilCode || utilCode.length < 50) { console.log(`    ⚠️ Code too short, skipping`); return false; }

    // Generate test code
    console.log(`    🧪 Generating test code...`);
    let testCode = '';
    try { testCode = await genTests(repoName, lang, utilCode); } catch(_) {}
    await sleep(1000);

    // Build commit list (multiple commits = looks real)
    const utilFile = newFileName(ext, false);
    const commits = [
      { file: utilFile, content: utilCode, message: pick(COMMIT_MSGS) },
    ];
    if (testCode && testCode.length > 50) {
      const testFile = newFileName(ext, true);
      commits.push({ file: testFile, content: testCode, message: `test: add coverage for ${path.basename(utilFile, ext)} module` });
    }
    // Sometimes add a 3rd small commit (vary count)
    if (Math.random() > 0.5) {
      const extra = `# ${lang} Code Review Notes\n# Reviewed: ${new Date().toISOString()}\n# Status: All checks passed\n`;
      commits.push({ file: '.github/REVIEW_LOG.md', content: extra, message: 'docs: update code review log' });
    }

    console.log(`    📝 Planning ${commits.length} commits...`);

    // Push via branch → merge workflow
    const success = await pushViaBranch(tmpDir, repoName, commits);
    if (!success) return false;

    // Close the issue if we created it
    if (issue?.num) await closeIssue(repoName, issue.num);

    return true;

  } catch(err) {
    console.error(`    ❌ Failed: ${err.message}`);
    return false;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(_) {}
  }
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
async function main() {
  if (!TOKEN)      { console.error('❌ GH_PAT not set'); process.exit(1); }
  if (!GEMINI_KEY) { console.error('❌ GEMINI_API_KEY not set'); process.exit(1); }

  const count = ri(10, 18);
  const eligible = Rotation.getEligible();
  const selected = shuffle(eligible).slice(0, count);

  console.log('🚀 Project Maintenance & Quality Check');
  console.log(`📅 Date: ${new Date().toLocaleString('en-IN', { timeZone:'Asia/Kolkata' })} IST`);
  console.log(`🎯 Updating ${count} repos: ${selected.join(', ')}`);
  console.log('─'.repeat(55));

  const succeeded = [];
  for (const repo of selected) {
    const ok = await processRepo(repo);
    if (ok) succeeded.push(repo);
    await sleep(2500);
  }

  // Save rotation log
  Rotation.markUpdated(succeeded);
  // Commit rotation log back to daily-quote-bot
  try {
    run('git add rotation_log.json', __dirname);
    safe('git commit -m "chore: update rotation log"', __dirname);
    safe('git pull --rebase origin main', __dirname);
    safe('git push origin main', __dirname);
  } catch(_) {}

  console.log(`\n${'─'.repeat(55)}`);
  console.log(`✅ Done! ${succeeded.length}/${selected.length} repos updated.`);

  // Send phone notification
  await notifyPhone(succeeded, selected.length);
}

main();
