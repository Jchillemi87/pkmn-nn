const fetch = require('node-fetch');
const util = require('util');
/*
var reg = /(.*\n){12}\|teampreview/gm;
var reg2 = /ability: ([^ ])(?!=p).*?(?=[(,|)])/;
*/
//var url = 'https://replay.pokemonshowdown.com/gen7randombattle-832046044.log';
var url = 'https://replay.pokemonshowdown.com/gen7randombattle-725927610.log';

class logParser {
    constructor(log) {
        this.battle = { p1: { name: '' }, p2: { name: '' } };

        this.log = log;
        this.init();
    }

    async init() {
        this.turns = await this.log.split(/\|turn\|\d*/gm);

        this.turns.forEach((x, n) => {
            //    console.log("Turn " + n + " :" + x);
        });

        this.battle.p1.name = this.turns[0].match(/(?<=\|player\|p1\|)(.*)(?=\|)/gm).toString();
        this.battle.p2.name = this.turns[0].match(/(?<=\|player\|p2\|)(.*)(?=\|)/gm).toString();

        /*BROKEN DOESNT WORK CORRECTLY. FIX REG EXP!!
                this.battle.p1.totalPokemon = this.turns[0].match(/(?<=\|teamsize\|p1\|)(.*)(?=\|)/gm);
                this.battle.p2.totalPokemon = this.turns[0].match(/(?<=\|teamsize\|p2\|)(.*)(?=\|)/gm);

                console.log("PLAYER ONE: "+this.battle.p1.totalPokemon);
                console.log("PLAYER TWO: "+this.battle.p2.totalPokemon);
        */

        this.battle.gen = this.turns[0].match(/(?<=\|gen\|)(\d*)/gm)[0];
        this.battle.tier = this.turns[0].match(/(?<=\|tier\|)(\d*)/gm);
        this.battle.seed = this.turns[0].match(/(?<=\|seed\|)(\d*)/gm);

        this.battle.p1.pokemon = [];
        this.battle.p2.pokemon = [];

        //console.log(this.battle);
        this.turns.forEach((x, n) => {
            //            if (n < 7) /////////////////////////////////////REMOVE THIS LATER!
            this.turnParse(x, n);
        });

    }

    turnParse(line, turnNum) {
        console.log("turnParse: \n" + util.inspect(line) + "\n\n~~~~~~~~~~~~~~~~~~~~~~~~~~[Turn " + turnNum + "]~~~~~~~~~~~~~~~~~~~~~~~~~~");

        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~this.battle: \n" + util.inspect(this.battle, { depth: Infinity }) + "~~~~~~~~~~~~~~~\n");

        let temp = line.split('\n');
        temp.forEach((x, n) => {
            console.log(x);

            let pkmn = { set: { moves: new Set } };

            let action = x.match(/\|.*?\|(?=p\d)/);
            let player = x.match(/p\d/);

            let temp = x.match(/(?<=\:).*?(?=\|)/);
            if (temp) {
                pkmn.name = temp[0];
            }

            temp = x.match(/(?<=\:.+\|).*?(?=, L)/);
            if (temp) {
                pkmn.species = temp[0];
            }

            temp = x.match(/(?<=\|switch\|p\d.*\|.*, L).*?(?=,)/);
            if (temp) {
                pkmn.level = parseInt(temp[0]);
            }

            //            if (action && player) console.log("ACTION: " + action + "\nPLAYER: " + player); //can be removed after testing

            if (action) {
                switch (action[0]) {
                    case '\|drag\|':
                    case '\|switch\|':
                        pkmn.hp = parseInt(x.match(/(?<=\w\|)\d*(?=\/)/)[0]);
                        pkmn.maxhp = parseInt(x.match(/(?<=\w\|\d+\/)\d+(?=)/)[0]); //if this is Random Battle, maxHP should be calc from base stats
                        //                        console.log("NEW SWITCHED: " + pkmn);

                        this.updateInfo('newActive', player, pkmn);
                        break;

                    case '\|move\|':
                        //pkmn.moveLastTurnResult
                        pkmn.set.moves.add(x.match(/(?<=\: .*?\|).*(?=\|)/)[0]);
                        //                        console.log("~~pkmn.set.moves: " + util.inspect(pkmn.set.moves));

                        this.updateInfo('addMove', player, pkmn);

                        break;

                    case '\|-damage\|':
                        if (x.includes('\|0 fnt')) {
                            pkmn.hp = 0;
                        } else {
                            pkmn.hp = parseInt(x.match(/(?<=\w*\|)\d*(?=\/\d*)/)[0]);
                            this.updateInfo('takeDamage', player, pkmn);
                        }
                        break;

                    case '\|faint\|':
                        let temp = x.match(/(?<=\:).*?(?=$)/);
                        if (temp) {
                            pkmn.name = temp[0];
                        }

                        pkmn.fainted = true;
                        this.updateInfo('faint', player, pkmn);

                        break;
                    default:
                        console.log("NO MATCH IN turnParse: " + action);
                        break;
                }
            }
        });
    }
    updateInfo(action, player, pkmn) {

        console.log("updateInfo action/player/pkmn: " + action + '/' + player + '/' + util.inspect(pkmn, { depth: Infinity }));
        //        console.log("~~~~~~~~~~~~~~~PLAYER: " + util.inspect(this.battle[player].pokemon))
        let found;
        switch (action) {
            case 'newActive':
                found = this.battle[player].pokemon.findIndex((x, n) => {
                    return x.name == pkmn.name;
                });

                if (found == -1) {
                    found = this.battle[player].pokemon.push(pkmn) - 1;
                }

                this.battle[player].pokemon[found].isActive = true;

                this.battle[player].pokemon.forEach((x) => x.isActive = false);
                this.battle[player].active = this.battle[player].pokemon[found];

                break;

            case 'addMove':
                found = this.battle[player].pokemon.findIndex((x, n) => {
                    //                  console.log("FOUND: " + x.name + pkmn.name);
                    return x.name == pkmn.name;
                });

                console.log(util.inspect(found) + "~~~~~~~~~~~~~~~~~~~PKMN" + util.inspect(this.battle[player].pokemon, { depth: Infinity }) + "\n~~~~~\n");
                pkmn.set.moves.forEach((x) => {
                    this.battle[player].pokemon[found].set.moves.add(x);
                });

                break;

            case 'faint':
                found = this.battle[player].pokemon.findIndex((x, n) => {
                    //                  console.log("FOUND: " + x.name + pkmn.name);
                    return x.name == pkmn.name;
                });
                console.log(found);

                this.battle[player].pokemon[found].fainted = true;
                this.battle[player].pokemon[found].hp = 0;
                this.battle[player].pokemon[found].status = '';

                break;

            case 'takeDamage':
                found = this.battle[player].pokemon.findIndex((x, n) => {
                    //                  console.log("FOUND: " + x.name + pkmn.name);
                    return x.name == pkmn.name;
                });

                this.battle[player].pokemon[found].hp = pkmn.hp;

                break;

            default:
                console.log("NO MATCH IN updateInfo: " + action);
                break;
        }
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~this.battle: \n" + util.inspect(this.battle, { depth: Infinity }) + "~~~~~~~~~~~~~~~\n");

    }
}

async function getLog(url) {
    try {
        let response = await fetch(url);
        return await response.text();
    } catch (err) {
        console.log(err); // TypeError: failed to fetch
    }
}

getLog(url).then((res) => { new logParser(res); })