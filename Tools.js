const fs = require('fs');
const logParser = require('./logParser.js');
const replaysFolder = './replays/';
var localReplay;

//test.parse('./replays/gen7randombattle-857323060.log');
//let temp = test.parse('https://replay.pokemonshowdown.com/gen7randombattle-857327353.log');

async function main(file) {
    console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~" + replaysFolder + file);
    await logParser.getLogLocal(replaysFolder + file).then((res => {
        localReplay = new logParser.logParser(res);
        console.log(res);
    }));
    //    console.log(localReplay);
    localReplay.toJSON().then((res) => {
        let jsonName = file.replace('.log', '.json');
        fs.writeFile('./replays.json/' + jsonName, res, () => {
            //console.log('wrote ' + jsonName + ' to FS.');
        });
    })
}

function getId(text) {
    if (text && text.id) {
        text = text.id;
    } else if (text && text.userid) {
        text = text.userid;
    }
    if (typeof text !== 'string' && typeof text !== 'number') return '';
    return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

//console.log(replaysFolder+'gen7randombattle-857323771.log'.match(/\/.*\.log/gi));

//    main(fs.readdirSync(replaysFolder)[0]);
/*
fs.readdirSync(replaysFolder).forEach(file => {
    console.log(file);
    main(file);
});
*/

//HP = ((Base * 2 + IV + EV/4) * Level / 100) + Level + 10 **MAX IS BLISSY AT 714**
function calcHP(mon, ev = 84, iv = 31) {
    //console.log(mon.baseStats.hp + " " + ev + " " + iv + " " + mon.level);
    return Math.floor((((mon.baseStats.hp * 2) + iv + (ev / 4)) * mon.level) / 100) + mon.level + 10;
}

function calcStat(base, lvl = 100, ev = 84, iv = 31, nature = 1) {
    return Math.floor(Math.floor(((((2 * base) + iv + (ev / 4)) * lvl) / 100) + 5) * nature);
}

function getModifiedStat(stat, mod) {
    return mod > 0 ? Math.floor(stat * (2 + mod) / 2) :
        mod < 0 ? Math.floor(stat * 2 / (2 - mod)) :
        stat;
}

function getFinalSpeed(pokemon, weather) {
    var speed = calcStat(pokemon.baseStats.spe, pokemon.level);
    var boostedSpeed;

    try {
        if (!pokemon.boosts) { boostedSpeed = 0; } else { boostedSpeed = pokemon.boosts.spe; }
        speed = getModifiedStat(speed, boostedSpeed);

        if (pokemon.item === 'Choice Scarf') {
            speed = Math.floor(speed * 1.5);
        } else if (pokemon.item === 'Macho Brace' || pokemon.item === 'Iron Ball') {
            speed = Math.floor(speed / 2);
        }
        if ((pokemon.ability === 'Chlorophyll' && weather.indexOf('Sun') !== -1) ||
            (pokemon.ability === 'Sand Rush' && weather === 'Sand') ||
            (pokemon.ability === 'Swift Swim' && weather.indexOf('Rain') !== -1)) {
            speed *= 2;
        }

        return speed;
    } catch (e) {
        console.log("error in getFinalSpeed", e);
        console.dir(state);
    }
}

module.exports.getId = getId;
module.exports.calcHP = calcHP;
module.exports.getFinalSpeed = getFinalSpeed;