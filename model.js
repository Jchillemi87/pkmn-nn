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
const tools = require('./Tools.js');

const { RB_set } = require('./RBPI.js');

function status2Binary(status) {
  switch (status) {
    case "brn":
      return [0, 0, 0, 0, 0, 1];
    case "frz":
      return [0, 0, 0, 0, 1, 0];
    case "par":
      return [0, 0, 0, 1, 0, 0];
    case "psn":
      return [0, 0, 1, 0, 0, 0];
    case "slp":
      return [0, 1, 0, 0, 0, 0];
    case "tox":
      return [1, 0, 0, 0, 0, 0];
    default:
      return [0, 0, 0, 0, 0, 0];
  }
}

function status2Binary(status) {
  switch (status) {
    case "brn":
      return [0, 0, 0, 0, 0, 1];
    case "frz":
      return [0, 0, 0, 0, 1, 0];
    case "par":
      return [0, 0, 0, 1, 0, 0];
    case "psn":
      return [0, 0, 1, 0, 0, 0];
    case "slp":
      return [0, 1, 0, 0, 0, 0];
    case "tox":
      return [1, 0, 0, 0, 0, 0];
    default:
      return [0, 0, 0, 0, 0, 0];
  }
}

function volatile2Binary(condition) {
  switch (condition) {
    case "Substitute":
      return;
    case "confusion":
      return (2).toString(2);

    case "":
    case "":
    case "":

    default:
  }
}

async function main(json) {
  let temp = await getLogLocal(json);
  this.turns = await JSON.parse(temp);
  this.winner = await getWinner(this.turns[this.turns.length - 1]);

  this.currentTurn = 0;
  this.foe =
    this.turns[currentTurn].p1 == this.winner
      ? this.turns[currentTurn].p2
      : this.turns[currentTurn].p1;
  this.active = this.winner.pokemon.find(pkmn => {
    return pkmn.isActive == true;
  });
  this.foe.active = await getPKMNInfo(
    this.foe.pokemon.find(pkmn => {
      return pkmn.isActive == true;
    })
  );

  //console.log(this.foe.active);

  for (let x = this.foe.teamsize - this.foe.pokemon.length; x > 0; x--) {
    this.foe.pokemon.push({
      curHP: 100,
      fainted: false
    });
  }

  this.model = new Model(this);
}

function getWinner(turn) {
  let winner = turn.winner;
  winner = turn[winner];
  //console.log(winner);
  winner.pokemon.forEach(pkmn => {
    getPKMNInfo(pkmn);
    pkmn.curHP = 100;
  });
  return winner;
}

async function getPKMNInfo(pkmn) {
  pkmn.name = isMega(pkmn);
  pkmn.baseStats = BattlePokedex[tools.getId(pkmn.name)].baseStats;
  if (!pkmn.evs) {
    pkmn.evs = [85, 85, 85, 85, 85, 85];
  }
  pkmn.maxHP = tools.calcHP(pkmn);
  let RBData = new RB_set(pkmn.name);
  await RBData.init();
  combinedData(pkmn, RBData.certain);
  pkmn.RBData = RBData;

  RBData.probModel = await RBData.getProbModel({
    name: pkmn.name,
    moves: pkmn.moves,
    item: pkmn.item,
    ability: pkmn.ability
  });

  pkmn = await RBTidy(pkmn);
  pkmn.fainted = false;
  pkmn.lastMove = null;
  delete pkmn.boosts;
  delete pkmn.status;
  return pkmn;
}

function RBTidy(pkmn) {
  if (pkmn.item) {
    delete pkmn.RBData.summary.items;
  }

  if (pkmn.ability) {
    delete pkmn.RBData.summary.abilities;
  }

  if (pkmn.moves.length == 4) {
    delete pkmn.RBData.summary.moves;
  } else if (pkmn.RBData.summary.moves) {
    let temp;
    pkmn.RBData.summary.moves.forEach((x, n) => {
      x.move = BattleMovedex[x.move].name;
      temp = pkmn.moves.indexOf(x.move);
      if (temp != -1) {
        pkmn.RBData.summary.moves[n] = null;
      }
    });
    for (let i = pkmn.RBData.summary.moves.length; i >= 0; i--) {
      if (pkmn.RBData.summary.moves[i] === null)
        pkmn.RBData.summary.moves.splice(i, 1);
    }
  }
  return pkmn;
}

main("./replays.json/gen7randombattle-603536613.json");

function combinedData(p1, p2) {
  p2.moves.forEach((x, n) => {
    let moveName = BattleMovedex[x].name;
    if (p1.moves.indexOf(moveName) == -1) p1.moves.push(moveName);
  });
  if (!p1.ability && p2.ability) p1.ability = p2.ability;
  if (!p1.item && p2.item) p1.item = p2.item;
}

class Model {
  constructor(state) {
    this.winner = state.winner;
    this.foe = state.foe;
    this.active = state.active;
    this.moveFirst =
      tools.getFinalSpeed(state.active) > tools.getFinalSpeed(state.foe.active); //Check if winner moves 1st next turn
    this.winner.remaining = this.getRemaining(this.winner);
    this.foe.remaining = this.getRemaining(this.foe);

    this.active.moves = this.getNewMovesDmgs(
      this.active,
      this.foe.active,
      this.active.moves
    );

    this.foe.active.moves = this.getNewMovesDmgs(
      this.foe.active,
      this.active,
      this.foe.active.moves
    );

    console.log(this.normalize());
  }

  getRemaining(plyr) {
    return plyr.pokemon.filter(pkmn => {
      return pkmn.fainted == false;
    });
  }

  getNewMovesDmgs(atk, def, MOVES) {
    let dmgs = new Map();
    let temp;
    let dmgsPerc = [];
    let moves = [];
    let newMove = { name: "", dmgs: [] };
    MOVES.forEach((x, n) => {
      if (BattleMovedex[tools.getId(MOVES[n])].basePower) {
        newMove = { name: x, dmgs: [] };
        temp = sulcalc(atk, def, { name: MOVES[n] }).damage._data;
        temp.forEach((x, y) => {
          for (let X = 0; X < x.value; X++) {
            newMove.dmgs.push(y);
          }
          //    console.log(y+'='+ Math.ceil((this.foe.active.curHP/100) / (y / this.foe.active.maxHP)) + " * "+x.value)
        });
        newMove.avgDmg =
          newMove.dmgs.reduce((a, b) => a + b, 0) / newMove.dmgs.length;
        moves.push(newMove);
      }
    });
    return moves;
  }

  normalize() {
    let data = [];
    data.push(this.moveFirst ? 1 : 0);
    data.push(this.foe.active.curHP / 100);
    data.push(status2Binary(this.foe.active.status));
    data.push(this.foe.remaining.length / 6);

    let moveList = this.foe.active.moves;

    if (this.foe.active.moves.length < 4) {
      moveList = this.foe.active.RBData.probModel.moves.reduce(
        (moves, move) => {
          moves.push(move.move);
          return moves;
        },
        []
      );
    }

    moveList = this.getNewMovesDmgs(this.foe.active, this.active, moveList);

    data.push(
      ((getBestDmg(moveList).avgDmg / this.active.maxHP) * 100) /
      this.active.curHP
    );

    /*best accurate and dmg attack here*/
    /*foe item data? or maybe passive heal or dmg or if move locked*/

    /*our best stab attack here*
    /*our item data? or maybe passive heal or dmg or if move locked*/

    data.push(
      ((getBestDmg(this.active.moves).avgDmg / this.active.maxHP) * 100) /
      this.active.curHP
    );

    data.push(this.active.curHP / 100);
    data.push(status2Binary(this.active.status));
    data.push(this.winner.remaining.length / 6);

    /*

Their Volitile Status
Our Volitile Status
*/
    /*field data here maybe?*/

    return flattenDeep(data);
  }
}

function getBestDmg(moves) {
  return moves.reduce((maxDmg, dmg) => {
    return (maxDmg < dmg.avgDmg) | 0 ? dmg : maxDmg;
  });
}

function isMega(pkmn) {
  const item = BattleItems[tools.getId(pkmn.item)];
  if (item) {
    return item.megaEvolves == pkmn.name ? item.megaStone : pkmn.name;
  }
  return pkmn.name;
}

/*********
+who goes first
+foe curHP %
+foe status
+foe remaining pkmn
foe best dmg attack
foe item

our best dmg
our best dmg stab attack

our item
our curHP %
our status
our remaining pkmn

our and foe's volatile state (taunted)
field data

Foe Volatile Status
Our Volatile Status

*/

function flattenDeep(arr1) {
  return arr1.reduce(
    (acc, val) =>
      Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val),
    []
  );
}