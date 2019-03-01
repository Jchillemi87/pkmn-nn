const util = require('util');

util.inspect.defaultOptions.depth = Infinity;
util.inspect.defaultOptions.colors = true;

const fetch = require('node-fetch');
const fs = require('fs');
const readFile = util.promisify(fs.readFile);

const clonedeep = require('lodash.clonedeep')

const RBPI = require('./RBPI.js');

//var url; = 'https://replay.pokemonshowdown.com/gen7randombattle-857327353.log';
//var url = 'https://replay.pokemonshowdown.com/gen7randombattle-725927610.log';

class logParser {
    constructor(log, name) {
        this.noAction = new Set;
        this.ID = name;
        this.battle = new Battle();
        this.turns = [];
        this.log = { full: log, turns: [] };
        console.log(this.log);
        this.init();
    }

    async init() {
        this.log.turns = await this.log.full.split(/\|turn\|\d*/gm);

        try {
            await this.log.turns.forEach((turn, turnNum) => {
                try {
                    this.battle.turn = turnNum;
                    turn.split('\n').forEach((x, n) => {
                        this.lineParse(x, this.battle);
                    });
                    this.turns.push(clonedeep(this.battle));

                } catch (e) { console.log("ERROR on turn: " + turnNum + "\nTurn Info:" + turn + "\nERROR: " + e.stack); }
            });
        } catch (e) { console.log("ERROR: " + e.stack + "\n\n\n"); }

        //        console.log(this.turns[7]);
        console.log(this.turns[this.turns.length - 1]);
        console.log("Missing Actions: " + util.inspect(this.noAction));
    }

    async toJSON() {
        return await JSON.stringify(this.turns, Set_toJSON);
    }

    lineParse(line, battle = new Battle) {
        let part = line.split('\|');
        let details, temp, pkmn, inParty, health, plyr, ability, partWithAbility, field;

        if (line.includes('\|[from] ability: ')) {
            partWithAbility = part.findIndex((x, n) => {
                return x.includes('[from] ability: ');
            });
            ability = part[partWithAbility].replace('[from] ability: ', '');
            if (!line.includes('\|[of] ')) {
                plyr = part[2].slice(0, 2);
                battle[plyr].pokemon[this.findPkmn(battle, part[2])].ability = ability;
            } else {
                pkmn = part[partWithAbility + 1].replace(/\[of\]\sp\d\a\:\s/, '');
                plyr = part[partWithAbility + 1].replace(/\[of\]\s/, '');
                plyr = plyr.slice(0, 2); //plyr contains p1 or p2
                battle[plyr].pokemon[this.findPkmn(battle, plyr + "a: " + pkmn)].ability = ability;
            }
        }

        if (line.includes('\|[from] item: ')) {
            battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].item = line.split('\|[from] item: ')[1];
        }

        switch (part[1]) {
            case 'player':
                battle[part[2]].name = part[3];
                break;

            case 'teamsize':
                battle[part[2]].teamsize = parseInt(part[3]);
                break;

            case 'gametype':
                battle.gametype = part[2];
                break;

            case 'gen':
                battle.tier = parseInt(part[2]);
                break;

            case 'tier':
                battle.tier = part[2];
                break;

            case 'seed':
                battle.seed = part[2].split(','); //CURRENTLY AN ARRAY OF STRINGS. Might need to be an array of numbers
                break;

            case 'drag':
            case 'switch':

                details = part[3].split(', ');
                health = part[4].split('/');

                battle[part[2].slice(0, 2)].pokemon.forEach((x) => {
                    x.isActive = false;
                });

                inParty = this.findPkmn(battle, part[2]);

                if (inParty == -1) {
                    pkmn = new Pokemon();
                    pkmn.name = part[2].slice(5);
                    pkmn.species = details[0];
                    pkmn.level = parseInt(details[1].slice(1));
                    pkmn.gender = details[2];
                    pkmn.curHP = parseInt(health[0]);
                    pkmn.maxHP = parseInt(health[1].split(' ')[0]);
                    pkmn.status = health[1].split(' ')[1];

                    inParty = battle[part[2].slice(0, 2)].pokemon.push(pkmn) - 1;
                }

                battle[part[2].slice(0, 2)].pokemon[inParty].isActive = true;
                break;

            case 'move':
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].moves.add(part[3]);
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].lastMove = part[3];
                break;

            case '-status':
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].status = part[3];
                break;

            case '-curestatus':
                //giant mess because -curestatus uses p1: pokemon instead of p1a: pokemon
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2], part[2][0] + part[2][1])].status = undefined;
                break;

            case '-item':
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].item = part[3];
                break;

            case '-enditem':
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].prevItem = part[3];
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].item = undefined;
                break;

            case '-ability':
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].ability = part[3];
                break;

            case '-boost':
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].boosts[part[3]] += parseInt(part[4]);
                break;

            case '-unboost':
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].boosts[part[3]] -= parseInt(part[4]);
                break;

            case '-mega':
                console.log(util.inspect(part));
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].item = part[4];
                console.log(util.inspect(battle));
                break;

            case '-heal':
            case '-damage':

                temp = this.findPkmn(battle, part[2])

                health = part[3].split('/');

                if (health[0][0] == '0') {
                    battle[part[2].slice(0, 2)].pokemon[temp].curHP = 0;
                    battle[part[2].slice(0, 2)].pokemon[temp].fainted = true;
                } else {
                    battle[part[2].slice(0, 2)].pokemon[temp].curHP = parseInt(health[0]);
                    if (health[1]) { battle[part[2].slice(0, 2)].pokemon[temp].maxHP = parseInt(health[1].split(' ')[0]); }
                    battle[part[2].slice(0, 2)].pokemon[temp].status = health[1].split(' ')[1];
                }

                break;

            case '-start':
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].volatiles.add(part[3]);
                break;

            case '-end':
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].volatiles.delete(part[3]);
                break;

            case 'faint':
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].fainted = true
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].curHP = 0;
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].status = undefined;
                break;

            case '-weather':
                battle.weather = part[2];
                break;

            case '-sidestart':
                part[3] = part[3].replace(/move:\s/gi, '');
                battle[part[2].slice(0, 2)].sideConditions.push(part[3]);
                break;

            case '-sideend':
                temp = battle[part[2].slice(0, 2)].sideConditions.indexOf(part[3]);
                if (temp != -1) {
                    battle[part[2].slice(0, 2)].sideConditions.splice(temp, 1);
                }

                break;

            case '-fieldstart':
                field = part[2].slice(6);

                if (field.includes('Terrain')) {
                    battle.terrain = [field, battle.turn];
                } else {
                    battle.pseudoWeather[field] = [field, battle.turn];
                }
                break;

            case '-fieldend':
                field = part[2].slice(6);
                if (field.includes('Terrain')) {
                    delete battle.terrain;
                } else {
                    delete battle.pseudoWeather[field];
                }
                break;
            case 'win':
                battle.p1.name == part[2] ? battle.winner = 'p1' : battle.winner = 'p2';
                //console.log(battle[battle.winner].name);
                break;
            default:
                this.noAction.add(part[1]);
                break;
        }

        return battle;
    }

    findPkmn(battle, plyrpkmn, plyr) {
        if (!plyr) { plyr = plyrpkmn.slice(0, 2); }
        return battle[plyr].pokemon.findIndex((x) => {
            return x.name == plyrpkmn.replace(/p\d.*\:\s/gi, '');
        })
    }
}

async function getLogURL(url) {
    try {
        let response = await fetch(url);
        return await response.text();
    } catch (err) {
        console.log("\n\nerror: " + err); // TypeError: failed to fetch
    }
}

async function getLogLocal(path) {
    try {
        //console.log(path);
        let temp = await readFile(path, 'utf8');
        return temp;
    } catch (err) {
        console.log("\n\nerror: " + err); // TypeError: failed to fetch
    }

}

async function parse(log = process.argv[2]) {
    console.log(log);

    if (log) {
        if (log.includes('http')) {
            getLogURL(log).then((res) => { return new logParser(res); });

        } else {
            getLogLocal(log).then((res) => { return new logParser(res); });
        }
    } else {
        throw 'PATH TO FILE MISSING';
    }
}

class Battle {
    constructor() {
        this.pseudoWeather = {};
        this.p1 = { name: '', pokemon: [], sideConditions: [] };
        this.p2 = { name: '', pokemon: [], sideConditions: [] };
    }
}

class Pokemon {
    constructor() {
        this.name = '';
        this.species = '';
        this.moves = new Set();
        this.volatiles = new Set();
        this.item;
        this.ability;
        this.level;
        this.curHP;
        this.maxHP;
        this.gender;
        this.boosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 };

    }
}

function Set_toJSON(key, value) {
    if (typeof value === 'object' && value instanceof Set) {
        return [...value];
    }
    return value;
}

module.exports.getLogLocal = getLogLocal;
module.exports.getLogURL = getLogURL;
module.exports.parse = parse;
module.exports.logParser = logParser;