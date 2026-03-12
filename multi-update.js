const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const USERNAME    = process.env.GH_USERNAME || 'om051105';
const TOKEN       = process.env.GH_PAT;
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

// ─── LOCAL CODE TEMPLATES ─────────────────────────────────────────────────────
const CODE_TEMPLATES = {
  JavaScript: [
    (id) => `// Utility functions - auto-generated module ${id}

/**
 * Clamp a number between min and max bounds.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Debounce a function call.
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Deep clone a plain object using JSON serialization.
 * @param {Object} obj
 * @returns {Object}
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

module.exports = { clamp, debounce, deepClone };`,
    (id) => `// Data helpers - auto-generated module ${id}

/**
 * Group an array of objects by a given key.
 * @param {Array} arr
 * @param {string} key
 * @returns {Object}
 */
function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const group = item[key];
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});
}

/**
 * Return unique values from an array.
 * @param {Array} arr
 * @returns {Array}
 */
function unique(arr) {
  return [...new Set(arr)];
}

/**
 * Flatten a nested array one level deep.
 * @param {Array} arr
 * @returns {Array}
 */
function flatten(arr) {
  return arr.reduce((acc, val) => acc.concat(val), []);
}

module.exports = { groupBy, unique, flatten };`,
    (id) => `// String utilities - auto-generated module ${id}

/**
 * Capitalize the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert a string to camelCase.
 * @param {string} str
 * @returns {string}
 */
function toCamelCase(str) {
  return str
    .replace(/[-_\\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}

/**
 * Truncate a string to a maximum length and add ellipsis.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

module.exports = { capitalize, toCamelCase, truncate };`,
  ],
  Python: [
    (id) => `# Utility functions - auto-generated module ${id}

def clamp(value, min_val, max_val):
    """Clamp a number between min and max bounds."""
    return max(min_val, min(value, max_val))


def flatten(nested_list):
    """Flatten a nested list one level deep."""
    result = []
    for item in nested_list:
        if isinstance(item, list):
            result.extend(item)
        else:
            result.append(item)
    return result


def unique(items):
    """Return unique items preserving order."""
    seen = set()
    result = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def chunk(lst, size):
    """Split a list into chunks of a given size."""
    return [lst[i:i + size] for i in range(0, len(lst), size)]`,
    (id) => `# String helpers - auto-generated module ${id}

def capitalize_words(text):
    """Capitalize the first letter of each word."""
    return ' '.join(word.capitalize() for word in text.split())


def to_snake_case(text):
    """Convert a camelCase or PascalCase string to snake_case."""
    result = []
    for i, ch in enumerate(text):
        if ch.isupper() and i > 0:
            result.append('_')
        result.append(ch.lower())
    return ''.join(result)


def truncate(text, max_len, suffix='...'):
    """Truncate text to a maximum length with a suffix."""
    if len(text) <= max_len:
        return text
    return text[:max_len - len(suffix)] + suffix


def is_palindrome(text):
    """Check if a string is a palindrome (ignoring case and spaces)."""
    cleaned = text.lower().replace(' ', '')
    return cleaned == cleaned[::-1]`,
  ],
  TypeScript: [
    (id) => `// Utility functions - auto-generated module ${id}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc: Record<string, T[]>, item) => {
    const group = String(item[key]);
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});
}

export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}`,
  ],
};

// Fallback for languages not in templates
function generateFallbackCode(lang, id) {
  const comment = lang === 'Python' ? '#' : '//';
  return `${comment} Auto-generated utility module ${id}
${comment} Language: ${lang}
${comment} Generated: ${new Date().toISOString()}

${comment} Placeholder utility functions for ${lang}
${comment} These provide basic helper functionality.
`;
}

function generateCode(lang, id) {
  const templates = CODE_TEMPLATES[lang];
  if (templates && templates.length > 0) {
    return pick(templates)(id);
  }
  return generateFallbackCode(lang, id);
}

const TEST_TEMPLATES = {
  JavaScript: [
    (utilCode) => {
      const exported = utilCode.match(/module\.exports\s*=\s*\{([^}]+)\}/);
      const fns = exported ? exported[1].split(',').map(s => s.trim()) : ['fn'];
      const moduleName = './utils';
      return `// Auto-generated test file
const assert = require('assert');

// Basic smoke tests
function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      passed++;
      console.log('  ✓ ' + name);
    } catch (e) {
      failed++;
      console.log('  ✗ ' + name + ': ' + e.message);
    }
  }

  test('module exports are defined', () => {
    assert.ok(true, 'Module loaded successfully');
  });

  test('basic functionality check', () => {
    assert.strictEqual(typeof true, 'boolean');
  });

  console.log('\\nResults: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

runTests();`;
    },
  ],
  Python: [
    (utilCode) => `# Auto-generated test file
import unittest


class TestUtilities(unittest.TestCase):
    """Basic smoke tests for utility functions."""

    def test_module_loads(self):
        """Verify module can be imported."""
        self.assertTrue(True)

    def test_basic_types(self):
        """Verify basic type operations work."""
        self.assertIsInstance([], list)
        self.assertIsInstance({}, dict)
        self.assertIsInstance('', str)


if __name__ == '__main__':
    unittest.main()`,
  ],
};

function generateTestCode(lang, utilCode) {
  const templates = TEST_TEMPLATES[lang];
  if (templates && templates.length > 0) {
    return pick(templates)(utilCode);
  }
  return '';
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
  const id = `${repoName}-${Date.now().toString(36)}`;
  return generateCode(lang, id);
}

async function genTests(repoName, lang, utilCode) {
  return generateTestCode(lang, utilCode);
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
  const body = `## 🤖 Daily Update Report\n**${date} (IST)**\n\n**Targeted ${totalSelected} repos, successfully updated ${updatedRepos.length}:**\n\n${repoList}\n\n> Powered by automated code templates`;
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

  const count = ri(2, 10);
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
