const util = require('util');

util.inspect.defaultOptions.depth = Infinity;
util.inspect.defaultOptions.colors = true;

const fs = require('fs');
const readFile = util.promisify(fs.readFile);

const { sulcalc } = require('./sulcalc.js');
const { Pokemon } = require('./sulcalc.js');
const { Move } = require('./sulcalc.js');
const { Field } = require('./sulcalc.js');
const { Weathers } = require('./sulcalc.js');
const { Gens } = require('./sulcalc.js');

const { getLogLocal } = require('./logParser.js');

const { BattlePokedex } = require('./Pokemon-Showdown/data/pokedex.js');
const { BattleMovedex } = require('./Pokemon-Showdown/data/moves.js');
const { getId } = require('./Tools.js');
const { calcHP } = require('./Tools.js');

const { RB_set } = require('./RBPI.js');

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

async function State(json) {
    let temp = await getLogLocal(json);
    this.turns = JSON.parse(temp);
    //    console.log(util.inspect(this.turns[0]));
    this.winner = getWinner(this.turns[this.turns.length - 1]);
    console.log(this.winner);

    /*    const pkmn1 = new Pokemon({
            name: this.turns[0].p1.pokemon[0].name,
            level: this.turns[0].p1.pokemon[0].level,
            evs: [85, 85, 85, 85, 85, 85]
        });*/
    //    pkmn1.baseStats = BattlePokedex[getId(this.turns[0].p1.pokemon[0].name)].baseStats;
    //    pkmn1._current
    //    console.log(pkmn1);
}

const { main } = require('./RBPI.js');

function getWinner(turn) {
    let winner = turn.winner;
    winner = turn[winner];
    //console.log(winner);
    winner.pokemon.forEach((pkmn) => {
        pkmn.baseStats = BattlePokedex[getId(pkmn.name)].baseStats;
        pkmn.maxHP = calcHP(pkmn);
        let RBData = new RB_set(pkmn.name);
        RBData.init().then(() => {
            combinedData(pkmn, RBData.certain);
        });
        pkmn.faint = false;
        pkmn.curHP = pkmn.maxHP;
        pkmn.lastMove = null;
        delete pkmn.boosts;
    });
    return winner;
}

State('./replays.json/gen7randombattle-603536613.json');

function combinedData(p1, p2) {
    p2.moves.forEach((x, n) => {
        let moveName = BattleMovedex[x].name;
        if (p1.moves.indexOf(moveName) == -1) p1.moves.push(moveName);
    });
    if (!p1.ability && p2.ability) p1.ability = p2.ability;
    if (!p1.item && p2.item) p1.item = p2.item;
}