const fs = require('fs');
const https = require('https');

const url = 'https://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=1';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        // Simple Regex Parse to avoid heavy xml2js dependency for a simple bot
        const titleMatch = data.match(/<title>(.*?)<\/title>/);
        const linkMatch = data.match(/<id>(.*?)<\/id>/);
        const summaryMatch = data.match(/<summary>(.*?)<\/summary>/s);

        if (titleMatch && linkMatch) {
            const title = titleMatch[1].replace('arxiv:', '').trim();
            const link = linkMatch[1];
            const date = new Date().toISOString().split('T')[0];

            const entry = \| \ | [\](\) | AI/ML |\n\;
            
            // Append to PAPERS.md
            if (!fs.existsSync('PAPERS.md')) {
                fs.writeFileSync('PAPERS.md', '| Date | Title | Category |\n|---|---|---|\n');
            }
            fs.appendFileSync('PAPERS.md', entry);
            console.log('Added paper:', title);
            
            // Also update README to show latest
            const readmeContent = \#  Daily AI Research Tracker\n\nI automatically track the latest papers submitted to ArXiv (cs.AI).\n\n### 🔥 Latest Discovery (\)\n**\**\n[Read Paper](\)\n\n[View Full Archive](PAPERS.md)\;
            fs.writeFileSync('README.md', readmeContent);
        }
    });
});