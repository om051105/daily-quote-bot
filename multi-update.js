const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

// ─── REPO LIST (excluding tsi and daily-quote-bot) ───────────────────────────
const ALL_REPOS = [
  'Concentration-Tracker',
  'AlphaForge',
  'CampusNest',
  'BloodLink',
  'Food-Ordering-app',
  'AI-Music-Recommendation-System',
  'health-monitor',
  'ML',
  'Python',
  'AI-Document-Search--RAG-Chatbot',
  'Focus-Mode',
  'Bio-Solar-Correlation-Engine',
  'Sudoku-Vision',
  'Real-Time-Concentration-Tracker',
  'om051105',
  'habit-tracker',
  'LPU-wifi-login',
  'Spectra',
  'log-system',
  'tomato-disease-web',
  'TwitterLocationAI',
  'Deepify',
  'DSA-CPP',
  'my-portfolio',
  'AiGrantWriter-main',
  'Cricket-Win-Predictor',
  'portfolio',
];

// ─── LANGUAGE DETECTION ──────────────────────────────────────────────────────
const LANG_MAP = {
  '.js': 'JavaScript', '.ts': 'TypeScript', '.py': 'Python',
  '.cpp': 'C++', '.c': 'C', '.php': 'PHP', '.html': 'HTML/CSS',
  '.css': 'CSS', '.java': 'Java', '.rb': 'Ruby', '.go': 'Go',
};

const COMMIT_MESSAGES = [
  'feat: add utility helper function',
  'feat: implement new helper module',
  'refactor: improve code structure',
  'feat: add validation utility',
  'feat: add error handling helper',
  'feat: add data processing utility',
  'refactor: optimize common functions',
  'feat: add reusable component',
  'feat: add new utility module',
  'chore: improve code quality',
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function run(cmd, cwd) {
  return execSync(cmd, { cwd, stdio: 'pipe' }).toString().trim();
}
function runSafe(cmd, cwd) {
  try { return run(cmd, cwd); } catch (_) { return ''; }
}

// ─── DETECT REPO LANGUAGE ────────────────────────────────────────────────────
function detectLanguage(repoDir) {
  const files = fs.readdirSync(repoDir);
  const counts = {};
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (LANG_MAP[ext]) counts[ext] = (counts[ext] || 0) + 1;
  }
  if (Object.keys(counts).length === 0) return { lang: 'Python', ext: '.py' };
  const topExt = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  return { lang: LANG_MAP[topExt], ext: topExt };
}

// ─── GEMINI API CALL ─────────────────────────────────────────────────────────
function callGemini(prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 600 }
    });
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          resolve(text.trim());
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── EXTRACT CODE BLOCK ──────────────────────────────────────────────────────
function extractCode(text) {
  // Try to extract from markdown code block first
  const match = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
  if (match) return match[1].trim();
  // Otherwise return raw text but strip any leading/trailing markdown
  return text.replace(/^```\w*\n?/, '').replace(/```$/, '').trim();
}

// ─── GENERATE FILE NAME ──────────────────────────────────────────────────────
function generateFileName(repoName, ext) {
  const suffixes = ['utils', 'helpers', 'validators', 'formatter', 'converter', 'parser', 'handler', 'processor'];
  const suffix = suffixes[randomInt(0, suffixes.length - 1)];
  return `${suffix}${ext}`;
}

// ─── MAIN REPO PROCESSOR ─────────────────────────────────────────────────────
async function processRepo(repoName, token, username, geminiKey) {
  const tmpDir = path.join(os.tmpdir(), `auto-update-${repoName}-${Date.now()}`);
  const repoUrl = `https://${token}@github.com/${username}/${repoName}.git`;

  console.log(`\n📦 Processing: ${repoName}`);

  try {
    // Clone the repo (shallow)
    run(`git clone --depth=1 "${repoUrl}" "${tmpDir}"`);
    run('git config user.name "om051105"', tmpDir);
    run('git config user.email "om051105@users.noreply.github.com"', tmpDir);

    // Detect language
    const { lang, ext } = detectLanguage(tmpDir);
    console.log(`  🔍 Detected language: ${lang}`);

    // Find existing source files to get context
    let existingCode = '';
    const files = fs.readdirSync(tmpDir).filter(f => path.extname(f) === ext);
    if (files.length > 0) {
      const sampleFile = files[0];
      const content = fs.readFileSync(path.join(tmpDir, sampleFile), 'utf8');
      existingCode = content.slice(0, 800); // First 800 chars as context
    }

    // Build prompt for Gemini
    const prompt = `You are a developer working on a GitHub project called "${repoName}".
Language: ${lang}
${existingCode ? `Here is some existing code for context:\n\`\`\`${lang}\n${existingCode}\n\`\`\`` : ''}

Write a COMPLETE, WORKING, standalone ${lang} utility file with:
- 2-4 well-named functions that could be useful in a real project
- Proper comments explaining each function
- No placeholder code - everything must be working
- No imports for external libs that aren't standard (only use built-ins or standard library)
- Maximum 60 lines

Output ONLY the code, nothing else. No explanation.`;

    console.log(`  🤖 Calling Gemini API...`);
    const generatedCode = await callGemini(prompt, geminiKey);
    const cleanCode = extractCode(generatedCode);

    if (!cleanCode || cleanCode.length < 50) {
      console.log(`  ⚠️  Generated code too short, skipping`);
      return false;
    }

    // Write to a new file
    const newFileName = generateFileName(repoName, ext);
    const newFilePath = path.join(tmpDir, newFileName);
    fs.writeFileSync(newFilePath, cleanCode + '\n');
    console.log(`  📝 Created: ${newFileName}`);

    // Commit and push
    run(`git add "${newFileName}"`, tmpDir);
    const status = runSafe('git status --porcelain', tmpDir);
    if (!status) {
      console.log(`  ⚠️  Nothing to commit`);
      return false;
    }

    const msg = COMMIT_MESSAGES[randomInt(0, COMMIT_MESSAGES.length - 1)];
    run(`git commit -m "${msg}"`, tmpDir);
    run('git push', tmpDir);
    console.log(`  ✅ Pushed: "${msg}"`);
    return true;

  } catch (err) {
    console.error(`  ❌ Failed [${repoName}]:`, err.message);
    return false;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
async function main() {
  const token = process.env.GH_PAT;
  const geminiKey = process.env.GEMINI_API_KEY;
  const username = process.env.GH_USERNAME || 'om051105';

  if (!token) { console.error('❌ GH_PAT not set'); process.exit(1); }
  if (!geminiKey) { console.error('❌ GEMINI_API_KEY not set'); process.exit(1); }

  const count = randomInt(2, 10);
  const selected = shuffle(ALL_REPOS).slice(0, count);

  console.log(`🚀 Multi-Repo AI Code Updater`);
  console.log(`🎯 Today updating ${count} repos: ${selected.join(', ')}`);
  console.log('─'.repeat(50));

  let success = 0;
  for (const repo of selected) {
    const ok = await processRepo(repo, token, username, geminiKey);
    if (ok) success++;
    // Small delay between API calls
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ Done! ${success}/${selected.length} repos updated with AI-generated code.`);
}

main();
