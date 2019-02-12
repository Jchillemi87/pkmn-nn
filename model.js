const Damage = require('leftovers-again/src/game/damage');
const express = require('express');
const util = require('leftovers-again/src/pokeutil.js');
const formats = require('leftovers-again/src/data/formats.json');
const chalk = require('chalk');

const app = express();

var test = [];

app.all('/', (req, res) => res.send(test));

app.listen(3000, () => console.log('Example app listening on port 3000!'))

var temp;

function status2Binary(status) {
    switch (status) {
        case "brn":
            return [0, 0, 1];
        case "frz":
            return [0, 1, 0];
        case "par":
            return [0, 1, 1];
        case "psn":
            return [1, 0, 0];
        case "slp":
            return [1, 0, 1];
        case "tox":
            return [1, 1, 0];
        default:
            return [0, 0, 0];
    }
}

module.exports.model = class model {

    constructor(state) {
        try {
            this.self = state.self;
            this.opponent = state.opponent;

            //temp = state.self.reserve.filter(mon => mon.active);
            this.myActive = state.self.active;

            //temp = state.opponent.reserve.filter(mon => mon.active);
            this.opponentActive = state.opponent.active;
            this.opponentActive.maxhp = calcHP(this.opponentActive);
            this.opponentActive.hp *= this.opponentActive.maxhp / 100;

            console.log("Opponent's HP: ", this.opponentActive.hp, "/", this.opponentActive.maxhp);

            //            console.log("getFinalSpeed(this.opponentActive,state.weather): ", getFinalSpeed(this.opponentActive, state.weather));

            this.myTeam = state.self.reserve;
            this.opponentTeam = state.opponent.reserve;

            if (state.self.reserve != null) {
                this.myRemaining = state.self.reserve.filter((mon) => {
                    if (mon.condition === '0 fnt') return false;
                    if (mon.active) return false;
                    if (mon.dead) return false;
                    if (mon.disabled) return false;
                    return true;
                });
            }

            if (state.opponent.reserve != null) {
                this.opponentRemaining = state.opponent.reserve.filter((mon) => {
                    if (mon.condition === '0 fnt') return false;
                    if (mon.active) return false;
                    if (mon.dead) return false;
                    if (mon.disabled) return false;
                    return true;
                });
            }

            //            console.log(this.opponentActive);


            if (this.myActive != 0 && this.myActive.boostedStats === undefined) {
                console.log(chalk.red("----"), this.myActive);
                this.myActive.boostedStats = {};
                this.myActive.boostedStats.spe = 1;
                this.myActive.boostedStats.spe = getFinalSpeed(this.myActive, state.weather);
            }

            if (this.opponentActive != 0 && this.opponentActive.boostedStats === undefined) {
                this.opponentActive.boostedStats = {};
                this.opponentActive.boostedStats.spe = 1;
                this.opponentActive.boostedStats.spe = getFinalSpeed(this.opponentActive, state.weather);
            }

            if (this.opponentActive) {

                this.opponentActive.preMoves = formats[this.opponentActive.id].randomBattleMoves;

                console.log("\nGetting Opponent's Best Damage Move");
                this.opponentActive.bestDamage = bestDamage(state, this.opponentActive, this.myActive, this.opponentActive.preMoves);
            }

            if (this.myActive != 0 && this.opponentActive) {

                if (this.myActive.boostedStats !== undefined && this.opponentActive.boostedStats !== undefined) {
                    this.isFaster = this.myActive.boostedStats.spe > this.opponentActive.boostedStats.spe;
                    console.log("We are faster: ", this.isFaster);
                }

                console.log("\nGetting My Best Damage Move");
                this.myActive.bestDamage = bestDamage(state, this.myActive, this.opponentActive);
                if (this.myActive.bestDamage !== undefined) {
                    console.log(this.myActive.bestDamage.id);
                }
                console.log("\nGetting All Possible Damage Moves for Opponent: ", this.opponentActive.id, ":\n", formats[this.opponentActive.id].randomBattleMoves);

                //                console.log(duelSim(state, this.myActive, this.opponentActive, this.opponent.preMoves));

                /*console.log("this.myActive.perfAcc: ",this.myActive.perfAcc);
                console.log("this.opponentActive.perfAcc: ",this.opponentActive.perfAcc);*/

                console.log("\nAfter Best Damages\n");
            }
            if (this.myRemaining.length > 0) {
                this.myDefSwitch = null;
                console.log("\n");
                this.myDefSwitch = bestDefSwitch(state, this.myRemaining, this.opponentActive, this.opponentActive.preMoves);

                this.myOffSwitch = null;
                console.log("\n");
                this.myOffSwitch = bestOffSwitch(state, this.myRemaining, this.opponentActive, this.opponentActive.preMoves);
            }

        } catch (e) { console.log("ERROR: ", e); }
    }

    print() {
        test.push("My Active: ", this.myActive, "\n");
        test.push("Opponent's Active: ", this.opponentActive, "\n");

        //        test.push("Opponent's Active: ",this.opponentActive, "\n");
    }

    getData(state) {
        var prioMovesDmg;

        if (this.myActive.prioMoves === undefined) {
            this.myActive.prioMoves = {};
            this.myActive.prioMoves.totalDamage = 0;
        }

        if (this.myActive.bestDamage === undefined) {
            this.myActive.bestDamage = {};
            this.myActive.bestDamage.totalDamage = 0;
        }

        if (this.opponentActive.bestDamage === undefined) {
            this.opponentActive.bestDamage = {};
        }

        if (this.opponentActive.bestDamage.totalDamage === undefined) {

            this.opponentActive.bestDamage.totalDamage = [];
            this.opponentActive.bestDamage.totalDamage[14] = 0;
        }
        
        if (isNaN(this.myActive.prioMoves.totalDamage / this.opponentActive.hp)) {
            prioMovesDmg = 0;
        } else {
            prioMovesDmg = this.myActive.prioMoves.totalDamage / this.opponentActive.hp;
        }

//        console.log(this.myActive);

        var data = [this.myActive.hp];
        data = data.concat(status2Binary(this.myActive.statuses));
        data = data.concat([this.isFaster,
            this.myActive.bestDamage.totalDamage[0] / this.opponentActive.hp,
            prioMovesDmg,
            this.opponentActive.bestDamage.totalDamage[14] / this.myActive.hp
        ]);

        return data;
    }
};



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

function moveLockCheck(moves) {
    //console.log("MOVES: ", moves.length);
    moves = moves.filter(move => {
        if (move.disabled == true) return false;
        else return true;
    });
    //        console.log("MOVES: ", moves.length);
    moves.forEach(function(x) {
        //            console.log("MOVE: ", x.id);
    });

    return moves;
}

function bestDamage(state, attacker, defender, preMoves) {
    if (attacker.id === undefined || attacker == null) {
        console.log("'attacker' undefined in bestDamage, skipped");
        return [null, null];
    }

    if (defender.id === undefined || defender == null) {
        console.log("'defender' undefined in bestDamage, skipped");
        return [null, null];
    }


    var highest = [0];
    var move;
    var moves = [];


    try {
        if (attacker.moves) {
            if (typeof attacker.volatileStatus === undefined && attacker.volatileStatus.filter(x => { if (x == "lockedmove") return true; }) && attacker.prevMoves.length > 0) {
                /*console.log("attacker.volatileStatus: ", attacker.volatileStatus);

                console.log(attacker.volatileStatus.filter(x => { if (x == "lockedmove") return true; }));
                console.log(attacker.prevMoves.length > 0);*/
                moves = util.researchMoveById(attacker.prevMoves);
            } else {
                moves = attacker.moves;
            }
        } else {
            if (attacker.seenMoves == 4) {
                //moves = attacker.seenMoves;
                attacker.seenMoves.forEach(function(x) {
                    moves.push(util.researchMoveById(x));
                });
            } else if (preMoves !== undefined) {
                preMoves.forEach(function(x) {
                    moves.push(util.researchMoveById(x));
                });
            }

        }
        //console.log(moves);
        moves = moveLockCheck(moves);


        if (!Array.isArray(moves) || !moves.length) { console.log("ERROR in bestDamage, Skipping. moves:", moves); return null; }


        if (!attacker.types) {
            //                console.log("attacker: " + attacker.id + " has no types, attempting to fix.");
            util.researchPokemonById(attacker.id).types.forEach(function(x, i) {
                attacker.types[i] = x;
            });
        }

        if (!defender.types) {
            //                console.log("defender: " + defender.id + " has no types, attempting to fix.");
            util.researchPokemonById(defender.id).types.forEach(function(x, i) {
                defender.types[i] = x;
            });
        }

        /////////////////fake out//////////////////////////
        var useFakeOut = false;
        moves.some(function(x) {
            if (x.name == 'Fake Out' && attacker.prevMoves.length === 0 && defender.types.indexOf('Ghost') === -1 && !checkForAbility(defender.abilities, "Inner Focus") && !checkForAbility(defender.abilities, "Shield Dust")) {
                useFakeOut = true;
                highest = Damage.getDamageResult(attacker, defender, x);
                move = x;
                return true;
            }
        });

        if (useFakeOut) {
            move.totalDamage = highest;
            return move;
        }
        ///////////////////////////////////////////////////

        attacker.prioMoves = [];
        attacker.perfAcc = [];
        attacker.flawedAcc = [];

        moves.forEach(function(x) {
            var damage = Damage.getDamageResult(attacker, defender, x);

            if (x.priority !== undefined && x.priority > 0) {
                x.totalDamage = damage;
                attacker.prioMoves.push(x);
            }

            if (x.accuracy === true || x.accuracy == 100) {
                x.totalDamage = damage;
                attacker.perfAcc.push(x);
            } else {
                x.totalDamage = damage;
                attacker.flawedAcc.push(x);
            }
				console.log(x.id," damage: ", damage[0]);
				if(move !== undefined)
				console.log(move.id," damage: ", highest[0],"\n");

            if (damage[0] > highest[0] && damage[0] > 0) {

                highest = damage;
                move = x;
            }
        });

        if (attacker.prioMoves.id !== undefined) {
            console.log("Priority Move: ", attacker.prioMoves.id, " Damage: ", attacker.prioMoves.totalDamage);
        }

        /*
                console.log("prioMoves: ", prioMoves);
                console.log("perfAcc: ", perfAcc);
                console.log("flawedAcc: ", flawedAcc);
        */

        if (attacker != 0 && attacker.boostedStats === undefined) {
            console.log(chalk.red("----"), attacker);
            attacker.boostedStats = {};
            attacker.boostedStats.spe = 1;
            attacker.boostedStats.spe = getFinalSpeed(attacker, state.weather);
        }

        if (defender != 0 && defender.boostedStats === undefined) {
            defender.boostedStats = {};
            defender.boostedStats.spe = 1;
            defender.boostedStats.spe = getFinalSpeed(defender, state.weather);
        }

        if (attacker.boostedStats.spe > defender.boostedStats.spe) {
            var bestOption;

            if (attacker.prioMoves !== undefined && attacker.prioMoves.length && defender.prioMoves !== undefined && defender.prioMoves.length) {
                attacker.prioMoves.forEach(function(x) {
                    if (x.totalDamage > defender.hp) {
                        console.log(chalk.blue(attacker.id, ": "), chalk.blue(x.id, "will KO ", defender.id, " HP myRemaining: ", defender.hp));
                        bestOption = x;
                    }
                });
            }

            if (attacker.perfAcc.length && bestOption == null) {
                attacker.perfAcc.forEach(function(x) {
                    if (x.totalDamage > defender.hp) {
                        console.log(chalk.blue(attacker.id, ": "), chalk.blue(x.id, "will KO ", defender.id, " HP myRemaining: ", defender.hp));
                        bestOption = x;
                    }
                });
            }

            if (attacker.flawedAcc.length && bestOption == null) {
                attacker.flawedAcc.forEach(function(x) {
                    if (x.totalDamage > defender.hp) {
                        console.log(chalk.blue(attacker.id, ": "), chalk.blue(x.id, "will KO ", defender.id, " HP myRemaining: ", defender.hp));
                        bestOption = x;
                    }
                });
            }
            if (bestOption != null) {
                console.log(chalk.cyan("BEST OPTION: "), chalk.cyan(bestOption.id), chalk.cyan(bestOption.totalDamage), "\n");
                return bestOption;
            }
        }

        if (move !== undefined) {
            move.totalDamage = highest;
            return move;
        }
    } catch (e) {
        console.log("Caught ERROR IN bestDamage(): ", e);
        console.dir(state);
    }
}

function checkForAbility(abilities, x) {
    if (abilities["0"] !== undefined && abilities["0"] === x)
        return true;

    if (abilities["1"] !== undefined && abilities["1"] === x)
        return true;

    if (abilities.H !== undefined && abilities.H === x)
        return true;
    return false;
}

function bestOffSwitch(state, my, opponent, preMoves) {
    var best = null;
    var maxDmg = 0;
    var damage = [];

    my.forEach(function(x) { //what about priority moves?
        console.log(x.id, ": ", x.boostedStats.spe, " < ", opponent.id, ": ", opponent.boostedStats.spe, " = ", x.boostedStats.spe < opponent.boostedStats.spe);
        if (x.boostedStats.spe < opponent.boostedStats.spe) { //what if we're speed tied?
            return;
        }

        damage = bestDamage(state, x, opponent, preMoves);
        if (damage !== undefined && damage.totalDamage != null) {
            console.log(x.id, ": ", damage.id, ": ", damage.totalDamage[0], "damage vs hp: ", opponent.hp);
            if (damage.totalDamage[0] >= opponent.hp && damage.totalDamage[0] > maxDmg[0]) {
                best = x;
                maxDmg = damage.totalDamage;
            }
        }
    });

    if (best != null) {
        console.log(chalk.green("best myOffSwitch: "), best.id, "damage: ", maxDmg);
        best.maxDmg = maxDmg;
        return (best);
    } else {
        return null;
    }

}


function bestDefSwitch(state, my, opponent, preMoves) {

    console.log("opp ID: ", opponent.id);
    console.log("opponent.seenMoves.length: ", opponent.seenMoves.length, "\n");

    var best = null;
    var minMaxDmg = 9999;
    var damage = [];

    my.forEach(function(x) {
        console.log("--------------\n", x.id, " vs ", opponent.id);
        //console.log("testing premoves: ", preMoves);
        damage = bestDamage(state, opponent, x, preMoves);
        //        console.log(chalk.blue("--------------------------------"));
        //console.log("damage: ", damage);
        if (damage !== undefined && damage.totalDamage != null) {
            //console.log(damage);
            /*  if (damage[1] == 0) {
                  return null;
              } //non damaging move?}
              else {*/
            //console.log("damage:", damage);
            //                console.log("Testing Move:", damage[0].id);
            //                console.log(x.id, "estimate of damage taken: ", damage[1], " - from:", damage[0].id);
            if (best == null) {
                //                    console.log(x.id);
                best = x;
                minMaxDmg = damage.totalDamage;
            } else if (damage.totalDamage[15] < minMaxDmg[15]) {
                best = x;
                minMaxDmg = damage.totalDamage;
            }
            //    }
        }
    });

    if (best != null) {
        best.minMaxDmg = minMaxDmg;
        console.log("best myDefSwitch: ", best.id, "minMaxDmg: ", best.minMaxDmg[0], " - " ,best.minMaxDmg[15]);
        return (best);
    } else {
        return null;
    }
}

function duelSim(state, my, opponent, preMoves) {

}

/*
        //TODO: My Active PKMN Value,
        state.self.active.hp,
        state.self.active.statuses,
        await getFinalSpeed(state.self.active) > await getFinalSpeed(state.opponent.active),
        //TODO: Active Opponent Value,
        calcHP(state.opponent.active),
        state.opponent.active.statuses,
        myBestDamage[0], //TODO: Only Check best move if we are not in a Forced Switched State
        myBestDamage[1],
        //TODO: non damage moves for my opponent and I + Accuracy
        //TODO: opponent's best switch
        myBestSwitch[0],
        myBestSwitch[1],

        state.weather,
*/