const fs = require('fs');
const https = require('https');

const url = 'https://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=1';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        // Simple Regex Parse to avoid heavy xml2js dependency for a simple bot
        const entryMatch = data.match(/<entry>([\s\S]*?)<\/entry>/);

        if (entryMatch) {
            const entryData = entryMatch[1];
            const titleMatch = entryData.match(/<title>([\s\S]*?)<\/title>/);
            const linkMatch = entryData.match(/<id>([\s\S]*?)<\/id>/);
            const summaryMatch = entryData.match(/<summary>([\s\S]*?)<\/summary>/);

            if (titleMatch && linkMatch) {
                const title = titleMatch[1].replace('arxiv:', '').replace(/\n/g, ' ').trim();
                const link = linkMatch[1];
                const date = new Date().toISOString().split('T')[0];

                const entry = `| ${date} | [${title}](${link}) | AI/ML |\n`;

                // Append to PAPERS.md
                if (!fs.existsSync('PAPERS.md')) {
                    fs.writeFileSync('PAPERS.md', '| Date | Title | Category |\n|---|---|---|\n');
                }
                fs.appendFileSync('PAPERS.md', entry);
                console.log('Added paper:', title);

                // Also update README to show latest
                const readmeContent = `# Daily AI Research Tracker

I automatically track the latest papers submitted to ArXiv (cs.AI).

### 🔥 Latest Discovery (${date})
**${title}**
[Read Paper](${link})

[View Full Archive](PAPERS.md)
`;
                fs.writeFileSync('README.md', readmeContent);
            }
        }
    });
});