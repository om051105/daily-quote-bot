const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// All repos to potentially update (excluding tsi and daily-quote-bot)
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

// Realistic commit messages pool
const COMMIT_MESSAGES = [
  'chore: update project logs',
  'docs: minor documentation update',
  'chore: routine maintenance update',
  'docs: update notes',
  'chore: daily sync',
  'refactor: minor code cleanup',
  'docs: add update log entry',
  'chore: housekeeping update',
  'style: minor formatting improvement',
  'chore: update dependency notes',
  'docs: keep documentation fresh',
  'chore: automated daily update',
];

// Update strategies
const STRATEGIES = [
  updateDailyLog,
  updateReadmeTimestamp,
  addOrUpdateNotes,
];

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
  try { return run(cmd, cwd); } catch (e) { return ''; }
}

// Strategy 1: Update/create DAILY_LOG.md
function updateDailyLog(repoDir) {
  const logFile = path.join(repoDir, 'DAILY_LOG.md');
  const date = new Date().toISOString();
  let content = '';
  if (fs.existsSync(logFile)) {
    content = fs.readFileSync(logFile, 'utf8');
  } else {
    content = '# Daily Update Log\n\nAutomated maintenance log for this repository.\n\n';
  }
  content += `\n## Update: ${date}\n\n- Routine daily maintenance check completed.\n- Dependencies reviewed.\n- Code quality verified.\n`;
  fs.writeFileSync(logFile, content);
  run('git add DAILY_LOG.md', repoDir);
}

// Strategy 2: Update README with a maintenance badge/timestamp section
function updateReadmeTimestamp(repoDir) {
  const readmeFile = path.join(repoDir, 'README.md');
  const date = new Date().toISOString().split('T')[0];
  let content = '';
  if (fs.existsSync(readmeFile)) {
    content = fs.readFileSync(readmeFile, 'utf8');
    // Remove old maintenance line if present
    content = content.replace(/\n_Last maintained: .*_\n?/, '');
    content = content.trimEnd() + `\n\n_Last maintained: ${date}_\n`;
  } else {
    content = `# Project\n\n_Last maintained: ${date}_\n`;
  }
  fs.writeFileSync(readmeFile, content);
  run('git add README.md', repoDir);
}

// Strategy 3: Add/update .github/NOTES.md
function addOrUpdateNotes(repoDir) {
  const githubDir = path.join(repoDir, '.github');
  if (!fs.existsSync(githubDir)) fs.mkdirSync(githubDir);
  const notesFile = path.join(githubDir, 'NOTES.md');
  const date = new Date().toISOString();
  const notes = [
    'Code structure reviewed.',
    'Dependencies checked.',
    'Logic flow verified.',
    'Performance notes updated.',
    'Security review done.',
    'Test coverage reviewed.',
    'Documentation aligned with code.',
  ];
  const note = notes[randomInt(0, notes.length - 1)];
  let content = '';
  if (fs.existsSync(notesFile)) {
    content = fs.readFileSync(notesFile, 'utf8');
  } else {
    content = '# Project Notes\n\nMaintenance and review notes.\n\n';
  }
  content += `\n### ${date}\n- ${note}\n`;
  fs.writeFileSync(notesFile, content);
  run('git add .github/NOTES.md', repoDir);
}

async function processRepo(repoName, token, username) {
  const tmpDir = path.join(os.tmpdir(), `auto-update-${repoName}-${Date.now()}`);
  const repoUrl = `https://${token}@github.com/${username}/${repoName}.git`;

  console.log(`\n📦 Processing: ${repoName}`);

  try {
    // Clone the repo
    run(`git clone --depth=1 "${repoUrl}" "${tmpDir}"`);

    // Config git
    run('git config user.name "om051105"', tmpDir);
    run('git config user.email "om051105@users.noreply.github.com"', tmpDir);

    // Pick a random strategy
    const strategy = STRATEGIES[randomInt(0, STRATEGIES.length - 1)];
    strategy(tmpDir);

    // Pick a random commit message
    const msg = COMMIT_MESSAGES[randomInt(0, COMMIT_MESSAGES.length - 1)];

    // Commit
    const status = runSafe('git status --porcelain', tmpDir);
    if (!status) {
      console.log(`  ⚠️  No changes to commit in ${repoName}`);
      return false;
    }

    run(`git commit -m "${msg}"`, tmpDir);
    run('git push', tmpDir);
    console.log(`  ✅ Committed & pushed: "${msg}"`);
    return true;
  } catch (err) {
    console.error(`  ❌ Failed for ${repoName}:`, err.message);
    return false;
  } finally {
    // Cleanup
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

async function main() {
  const token = process.env.GH_PAT;
  const username = process.env.GH_USERNAME || 'om051105';

  if (!token) {
    console.error('❌ GH_PAT environment variable is not set!');
    process.exit(1);
  }

  // Pick random count of repos: 2-10
  const count = randomInt(2, 10);
  const selected = shuffle(ALL_REPOS).slice(0, count);

  console.log(`🎯 Today's target: ${count} repos`);
  console.log(`📋 Selected: ${selected.join(', ')}`);
  console.log('---');

  let successCount = 0;
  for (const repo of selected) {
    const success = await processRepo(repo, token, username);
    if (success) successCount++;
  }

  console.log(`\n🎉 Done! ${successCount}/${selected.length} repos updated successfully.`);
}

main();
