const fetch = require('node-fetch');
const fs = require('fs');
const util = require('util');
util.inspect.defaultOptions.depth = Infinity;
util.inspect.defaultOptions.colors = true;

const REGEX = /(?<=\<a\shref=\"\/).*\d(?=\")/g;
const url = 'https://replay.pokemonshowdown.com/search?user=&format=gen7randombattle&output=html&page='; //25
//var url = 'https://replay.pokemonshowdown.com/search?user=&format=gen7randombattle&rating&page=25&output=html';

async function getLog(url) {
    try {
        let response = await fetch(url);
        return await response.text();
    } catch (err) {
        console.log("\n\nERROR: " + err); // TypeError: failed to fetch
    }
}

for (let i = 1; i <= 25; i++) {
    getLog(url+i).then((res) => {
        res = res.match(REGEX);
        res.forEach((x, n) => {
            getLog('https://replay.pokemonshowdown.com/' + x + '.log').then((response) => {
                console.log("response: " + util.inspect(response));
                console.log("x: " + x);
                fs.writeFile('./replays_mixed_skill/' + x + '.log', response, () => {
                    console.log("wrote " + x + ".log to FS.");
                });
                /*fs.writeFile(x + '.log', res, () => {
                    console.log("wrote " + x + ".log to FS.");
                });*/
            });
        });
    });
}