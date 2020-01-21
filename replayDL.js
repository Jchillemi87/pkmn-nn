const fetch = require('node-fetch');
const fs = require('fs');
const util = require('util');
util.inspect.defaultOptions.depth = Infinity;
util.inspect.defaultOptions.colors = true;

const readDir = util.promisify(fs.readdir);
const Read = util.promisify(fs.readFile);
const Move = util.promisify(fs.rename);

let home = process.env['HOME']
let absPath = process.mainModule.path;

const replaysFolder = `${absPath}/replays`;
const replaysPath = `${absPath}/replays/logs/`;
const replaysErrors = `${absPath}/replays/errors/`;
const inactivity = `${absPath}/replays/inactivity/`;
const forfeited = `${absPath}/replays/forfeited/`;
const REGEX = /(?<=\<a\shref=\"\/).*\d(?=\")/g;
const url = 'https://replay.pokemonshowdown.com/search?user=&format=gen7randombattle&output=html&page='; //25
//const url = 'https://replay.pokemonshowdown.com/search?user=&format=gen7randombattle&rating&page=25&output=html';

async function getLog(url) {
    try {
        let response = await fetch(url);
        return response.text();
    } catch (err) {
        console.log("\n\nERROR: " + err); // TypeError: failed to fetch
    }
}

async function findReplays(location, str) {
    try {
        let files = await readDir(location, 'utf8');
        let replays = [];
        for await (file of files) {
            let log = await Read(location + file,'utf8');
            if (log.includes(str)) {
                replays.push({ location: location, file: file })
            }
        }
        return replays;
    }
    catch (e) {
        console.log(e);
    }
}

async function moveReplays(logFiles, dest) {
    try {
        for (log of logFiles) {
            await Move(log.location + log.file, dest + log.file);
            console.log(`${file} moved to ${dest}`);
        }
    } catch (e) {
        console.log(e);
    }
}

async function main() {
//    console.log(util.inspect(process));
    console.log(util.inspect(process.mainModule.path));

    if (!fs.existsSync(replaysFolder)) fs.mkdirSync(replaysFolder);
    if (!fs.existsSync(replaysPath)) fs.mkdirSync(replaysPath);
    if (!fs.existsSync(replaysErrors)) fs.mkdirSync(replaysErrors);
    if (!fs.existsSync(inactivity)) fs.mkdirSync(inactivity);
    if (!fs.existsSync(forfeited)) fs.mkdirSync(forfeited);

    var localReplays = await readDir(replaysPath, 'utf8');
    let excludeReplays = [];
    const localReplaysErrors = await readDir(replaysErrors, 'utf8');
    const localReplaysForfeited = await readDir(forfeited, 'utf8');
    const localReplaysInactivity = await readDir(inactivity, 'utf8');

    excludeReplays.push(...localReplaysErrors, ...localReplaysForfeited, ...localReplaysInactivity);

    let total = 0;
    console.log(`URL: ${url}`);
    for (let i = 1; i <= 25; i++) {
        console.log(`Page: ${i}`);
        let res = await getLog(url + i);
        res = res.match(REGEX);
        res.forEach(async (x, n) => {
            let test1 = localReplays.includes(x + '.log');
            let test2 = excludeReplays.includes(x + '.log');
            if (test1 || test2) {return;}
            let response = await getLog('https://replay.pokemonshowdown.com/' + x + '.log');
            fs.writeFile(replaysPath + x + '.log', response, () => {
                total++;
                //console.log("wrote " + x + ".log to FS.");
            });
        });
    }

    console.log(`Downloaded ${total} new replays`);

    let forfeitedReplays = await findReplays(replaysPath, 'forfeited');
    await moveReplays(forfeitedReplays, forfeited);

    let inactivityReplays = await findReplays(replaysPath, 'inactivity');
    await moveReplays(inactivityReplays, inactivity);

    console.log("Done");
}

main();