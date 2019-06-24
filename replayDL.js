const fetch = require('node-fetch');
const fs = require('fs');
const util = require('util');
util.inspect.defaultOptions.depth = Infinity;
util.inspect.defaultOptions.colors = true;

const readDir = util.promisify(fs.readdir);

const replaysPath = './replays/logs/';
const REGEX = /(?<=\<a\shref=\"\/).*\d(?=\")/g;
const url = 'https://replay.pokemonshowdown.com/search?user=&format=gen7randombattle&rating&output=html&page='; //25
//var url = 'https://replay.pokemonshowdown.com/search?user=&format=gen7randombattle&rating&page=25&output=html';

async function getLog(url) {
    try {
        let response = await fetch(url);
        return await response.text();
    } catch (err) {
        console.log("\n\nERROR: " + err); // TypeError: failed to fetch
    }
}

async function main() {
    const localReplays = await readDir(replaysPath, 'utf8');
    let total = 0;
    for (let i = 1; i <= 25; i++) {
        let res = await getLog(url + i);
        res = res.match(REGEX);
        res.forEach(async (x, n) => {
            if (localReplays.includes(x + '.log')) return;
            let response = await getLog('https://replay.pokemonshowdown.com/' + x + '.log');
            fs.writeFile(replaysPath + x + '.log', response, () => {
                total++;
                console.log("wrote " + x + ".log to FS.");
            });
        });
    }
    console.log(`Downloaded ${total} new replays`);
}

main();