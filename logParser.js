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

class PkmnError extends Error{
    constructor(name)    {
        super(`This replay includes ${name}, which is currently not supported`)
    }
}

class logParser {
    constructor(log, ID, player = 'winner', team1, team2) {
        this.noAction = new Set;
        this.ID = ID;
        this.battle = new Battle();
        this.heading = new Heading(ID);
        this.choices = [];
        this.winner = '';
        this.log = { full: log, p1: [], p2: [] };
    }

    cleanTeam(team) {
        for (let pkmn of team) {
            pkmn.curHP = pkmn.maxHP;
            pkmn.boosts = {
                atk: 0, def: 0, evasion: 0, spa: 0, spd: 0, spe: 0, accuracy: 0
            }
            pkmn.fainted = false;
            pkmn.lastMove = undefined;
            pkmn.status = undefined;
            pkmn.volatiles = new Set();
            pkmn.isActive = false;
        }
    }

    async init(player = 'winner', team1, team2) {
        if (this.log.full.includes('Zoroark')) {
            throw new PkmnError('Zoroark');
        }
        if (this.log.full.includes('Unown\|')) {
            throw new PkmnError('Unown');
        }
        
        this.log.full.split('\n').forEach((x, n) => {
            this.lineParse(x, this.battle);
            this.headingParse(x, this.heading);
        });

        if (player = 'winner') {
            player = this.heading.winner;
        }

        if (!team1 && player == 'p1') {
            let regex = new RegExp('(\\|move\\|p1.*|\\|switch\\|p1.*)', 'gm');
            this.log.p1 = await this.log.full.split(regex);
            this.cleanTeam(this.battle.p1.pokemon);
            team1 = this.battle.p1.pokemon;
            this.battle = new Battle;
            this.battle.p1.pokemon = team1;
            this.battle.p2.pokemon = [];
        }

        if (!team2 && player == 'p2') {
            let regex = new RegExp('(\\|move\\|p2.*|\\|switch\\|p2.*)', 'gm');
            this.log.p2 = await this.log.full.split(regex);
            this.cleanTeam(this.battle.p2.pokemon);
            team2 = this.battle.p2.pokemon;
            this.battle = new Battle;
            this.battle.p1.pokemon = [];
            this.battle.p2.pokemon = team2;
            this.battle[player].pokemon = team2;
        }


        try {
            let regex = new RegExp(`(\\|move\\|${player}.*|\\|switch\\|${player}.*)`, 'gm');

            this.log[player].forEach((data, dataNum) => {
                if (regex.test(data)) {
                    if (dataNum > 1) {
                        this.log[player][dataNum - 2].split('\n').forEach((x, n) => {
                            this.lineParse(x, this.battle);
                        });
                    }
                    this.log[player][dataNum - 1].split('\n').forEach((x, n) => {
                        this.lineParse(x, this.battle);
                    });
                    let state = clonedeep(this.battle);
                    let part = data.split('\|');
                    let choice = { data: state, decision: [] };

                    if (data.includes(`|move|${player}`)) {
                        let mega = this.log[player][dataNum - 1].includes(`|-mega|${player}`);
                        choice.decision = ['move', part[3], mega];
                    }
                    if (data.includes(`|switch|${player}`)) {
                        choice.decision = ['switch', part[2].slice(5)];
                    }
                    this.choices.push(choice);
                }
            });
            this.choices;
        } catch (e) { console.log("ERROR: in " + this.ID + "\n" + e.stack + "\n\n\n"); }
        //console.log("Missing Actions: " + util.inspect(this.noAction));

        /*        try {
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
                */
    }

    async toJSON() {
        return await JSON.stringify({ heading: this.heading, choices: this.choices }, Set_toJSON);
    }

    headingParse(line, heading = new Heading) {
        let part = line.split('\|');

        switch (part[1]) {
            case 'player':
                heading[part[2]].name = part[3];
                break;

            case 'teamsize':
                heading[part[2]].teamsize = parseInt(part[3]);
                break;

            case 'gametype':
                heading.gametype = part[2];
                break;

            case 'gen':
                heading.tier = parseInt(part[2]);
                break;

            case 'tier':
                heading.tier = part[2];
                break;

            case 'seed':
                heading.seed = part[2].split(','); //CURRENTLY AN ARRAY OF STRINGS. Might need to be an array of numbers
                break;

            case 'win':
                heading.p1.name == part[2] ? heading.winner = 'p1' : heading.winner = 'p2';
                //console.log(battle[battle.winner].name);
                break;
        }

        return heading;
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
            case 'turn':
                battle.turn = part[2];
                break;
            //TODO: Add a fix for Zoroark (add Zoroark to the player's list of pokemon)
            //started working on a Zoroark fix but realized it would take a long time, and decided to save it for later
            //for now I will just return an error if a Zoroark replay is entered
            /*            case 'replace':
                            if (part[2].includes('Zoroark')) {
                                battle[part[2].slice(0, 2)].pokemon.forEach((x) => {
                                    x.isActive = false;
                                    x.volatiles.clear();
                                });
            
                                inParty = this.findPkmn(battle, part[2]);
            
                                if (inParty == -1) {
            
                                    pkmn = new Pokemon(part);
                                    inParty = battle[part[2].slice(0, 2)].pokemon.push(pkmn) - 1;
                                }
            
                                battle[part[2].slice(0, 2)].pokemon[inParty].isActive = true;
                                break;
                            }
                            break;
            */
            case 'drag':
            case 'switch':
                battle[part[2].slice(0, 2)].pokemon.forEach((x) => {
                    x.isActive = false;
                    x.volatiles.clear();
                });

                inParty = this.findPkmn(battle, part[2]);

                if (inParty == -1) {

                    pkmn = new Pokemon(part);
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
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].status = undefined;
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
                //console.log(util.inspect(part));
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].item = part[4];
                //console.log(util.inspect(battle));
                break;

            case '-heal':
            case '-damage':

                temp = this.findPkmn(battle, part[2])

                health = part[3].split('/');

                if (health[0] == '0' || health[0] == '0 fnt') {
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
                /*                if (part[2].includes('Zoroark') == false) {//TODO: Add a fix for Zoroark (add Zoroark to the player's list of pokemon)
                                    battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].volatiles.delete(part[3]);
                                }*/
                break;

            case 'faint':
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].fainted = true
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].curHP = 0;
                battle[part[2].slice(0, 2)].pokemon[this.findPkmn(battle, part[2])].status = undefined;
                break;

            case '-weather':
                if (!battle.weather || battle.weather[0] == "none" || battle.weather[0] != part[2]) battle.weather = [part[2], battle.turn];
                break;

            case '-sidestart':
                //because sideend will search for /move: I think it's best to keep /move:
                //part[3] = part[3].replace(/move:\s/gi, '');
                battle[part[2].slice(0, 2)].sideConditions.push(part[3]);
                break;

            case '-sideend':
                temp = battle[part[2].slice(0, 2)].sideConditions.indexOf(part[3]);
                if (temp != -1) {
                    battle[part[2].slice(0, 2)].sideConditions.splice(temp, 1);
                }
                break;

            case '-fieldstart':
                field = part[2];

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

            default:
                this.noAction.add(part[1]);
                break;
        }

        return battle;
    }

    findPkmn(battle, plyrpkmn, plyr) {
        if (!plyr) { plyr = plyrpkmn.slice(0, 2); }
        return battle[plyr].pokemon.findIndex((x) => {
            return x.name == plyrpkmn.replace(/p\d.{0,1}\:\s/gi, '');
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
    //console.log(log);

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
        this.p1 = { pokemon: [], sideConditions: [] };
        this.p2 = { pokemon: [], sideConditions: [] };
    }
}

class Heading {
    constructor(ID) {
        this.ID = ID;
        this.p1 = { name: '' };
        this.p2 = { name: '' };
    }
}

class Pokemon {
    constructor(part) {
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

        let details = part[3].split(', ');
        let health = part[4] ? part[4].split('/') : ['100', '100'];

        this.name = part[2].slice(5);
        this.species = details[0];
        this.level = parseInt(details[1].slice(1));
        this.gender = details[2];
        this.curHP = parseInt(health[0]);
        this.maxHP = parseInt(health[1].split(' ')[0]);
        this.status = health[1].split(' ')[1];
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
module.exports.PkmnError = PkmnError;