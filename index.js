const fs = require('fs');
const axios = require('axios');

async function getQuote() {
  try {
    // Fetch a random quote from a free API
    const response = await axios.get('https://api.quotable.io/random');
    const { content, author } = response.data;
    return `> "${content}"\n> — *${author}*\n`;
  } catch (error) {
    console.error('Error fetching quote:', error);
    return `> "Code is like humor. When you have to explain it, it’s bad."\n> — *Cory House*\n`; // Fallback quote
  }
}

async function updateReadme() {
  const quote = await getQuote();
  const date = new Date().toDateString();
  
  const entry = `\n### 📅 ${date}\n${quote}\n---`;
  
  // Append the new quote to the README
  fs.appendFileSync('README.md', entry);
  console.log('README.md updated with:', entry);
}

updateReadme();
