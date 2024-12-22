const fs = require('fs');

const changelog = fs.readFileSync('CHANGELOG.md', 'utf-8');
const releaseChangelog = changelog.match(
  /##\s+\d\.\d\.\d\s+\(\d{4}-\d{2}-\d{2}\)([\s\S]+?)(?=##\s+\d\.\d\.\d\s+\(\d{4}-\d{2}-\d{2}\))/g,
)[0];

fs.writeFileSync('CHANGELOG.temp', releaseChangelog.trim());
console.log(releaseChangelog.trim());
