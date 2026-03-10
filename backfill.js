const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const USERNAME = 'om051105';
const TOKEN    = process.env.GH_PAT; // Reuse the secret

// List of target repos to spread the backfill across
const TARGET_REPOS = [
  'AlphaForge',
  'BloodLink',
  'CampusNest',
  'Food-Ordering-app',
  'Concentration-Tracker'
];

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'pipe' }).toString().trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Generates a random time on a specific date
 */
function getRandomTimeOnDate(dateStr) {
  const hours = Math.floor(Math.random() * 12) + 9; // 9 AM to 9 PM
  const mins = Math.floor(Math.random() * 60);
  const secs = Math.floor(Math.random() * 60);
  return `${dateStr}T${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
}

/**
 * Backfills a specific repo for a range of dates
 */
async function backfillRepo(repoName, startDate, endDate, density = 0.5) {
  const tmpDir = path.join(os.tmpdir(), `backfill-${repoName}-${Date.now()}`);
  const repoUrl = `https://${TOKEN}@github.com/${USERNAME}/${repoName}.git`;
  
  console.log(`\n🚀 Backfilling: ${repoName}`);

  try {
    run(`git clone "${repoUrl}" "${tmpDir}"`);
    run(`git config user.name "${USERNAME}"`, tmpDir);
    run(`git config user.email "${USERNAME}@users.noreply.github.com"`, tmpDir);

    let current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      // Only commmit with a certain probability (density)
      if (Math.random() < density) {
        const dateStr = current.toISOString().split('T')[0];
        const timestamp = getRandomTimeOnDate(dateStr);
        
        // Random number of commits per day (1-3)
        const commitsToday = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < commitsToday; i++) {
          const fileName = `backfill_log_${dateStr.replace(/-/g,'_')}_${i}.md`;
          const filePath = path.join(tmpDir, fileName);
          
          fs.writeFileSync(filePath, `# Backfill Entry\nDate: ${timestamp}\nAuto-generated for history maintenance.\n`);
          
          process.env.GIT_AUTHOR_DATE = timestamp;
          process.env.GIT_COMMITTER_DATE = timestamp;
          
          run(`git add "${fileName}"`, tmpDir);
          run(`git commit -m "chore: historical maintenance update [${dateStr}]"`, tmpDir);
          console.log(`  ✅ Committed for ${timestamp}`);
          
          delete process.env.GIT_AUTHOR_DATE;
          delete process.env.GIT_COMMITTER_DATE;
        }
      }
      current.setDate(current.getDate() + 1);
    }

    run(`git push origin main`, tmpDir);
    console.log(`\n🎉 Successfully pushed all backdated commits for ${repoName}`);

  } catch (err) {
    console.error(`  ❌ Failed: ${err.message}`);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

async function start() {
  if (!TOKEN) {
    console.error("❌ GH_PAT environment variable missing!");
    return;
  }

  // Example: Fill gaps in 2025
  // You can adjust these dates
  const start2025 = '2025-01-01';
  const end2025 = '2025-12-31';

  for (const repo of TARGET_REPOS) {
    await backfillRepo(repo, start2025, end2025, 0.2); // 20% density across 5 repos = very full graph
    await sleep(2000);
  }
}

start();
