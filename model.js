const util = require('util');

util.inspect.defaultOptions.depth = Infinity;
util.inspect.defaultOptions.colors = true;

const fs = require('fs');
const readFile = util.promisify(fs.readFile);

const clonedeep = require('lodash.clonedeep')

const { sulcalc } = require('./sulcalc.js');
const { Pokemon } = require('./sulcalc.js');
const { Move } = require('./sulcalc.js');
const { Field } = require('./sulcalc.js');
const { Weathers } = require('./sulcalc.js');
const { Gens } = require('./sulcalc.js');

const { getLogLocal } = require('./logParser.js');

const { BattlePokedex } = require('./Pokemon-Showdown/data/pokedex.js');
const { BattleMovedex } = require('./Pokemon-Showdown/data/moves.js');
const { BattleItems } = require('./Pokemon-Showdown/data/items.js');

const tools = require('./Tools.js');

const { RB_set } = require('./RBPI.js');

class Model {
  constructor(json) {
    this.game = json;
    this.heading = JSON.parse(this.game).heading;
    this.choices = JSON.parse(this.game).choices;
    this.winner = {
      player: this.heading.winner,
      pokemon: [],
      active: {}
    }
    this.foe = {
      player: this.winner.player == 'p1' ? 'p2' : 'p1'
    };

    this.init();
  }

  async init() {
    //retreave all known data from the last turn and let the winner know his team.
    //this is obsolete
    this.choices[0].data[this.winner.player].pokemon.forEach(pkmn => {
      getPKMNInfo(pkmn);
      pkmn.curHP = 100;
      this.winner.pokemon.push(pkmn);
    });

    //  console.log(util.inspect(this.winner));

    for await (const [choiceNum, choice] of this.choices.entries()) {
      if (choiceNum == 0 || choiceNum == this.choices.length - 1) {
        continue;
      }
      await this.getState(choice.data);
      this.winner.choice = choice.decision;
      //        console.log(util.inspect(this, { depth: 3 }));
      console.log(await this.normalize());
      console.log('+++++++++++++++++++++++++++++++++++');
    }
  }

  async getState(turn) {
    this.active = turn[this.winner.player].pokemon.find(pkmn => {
      return pkmn.isActive == true;
    });

    this.foe = {...this.foe , ...turn[this.foe.player]};

    this.foe.active = turn[this.foe.player].pokemon.find(pkmn => {
      return pkmn.isActive == true;
    });

    this.active = await getPKMNInfo(this.active);
    this.winner.active = this.active;
    this.foe.active = await getPKMNInfo(this.foe.active);

    this.active.moves = this.winner.pokemon.find(pkmn => {
      return pkmn.species == this.active.species;
    }).moves;

    this.pseudoWeather = turn.pseudoWeather || {};
    this.terrain = turn.terrain || [];
    this.weather = turn.weather || [];

    for (let x = turn[this.foe.player].teamsize - turn[this.foe.player].pokemon.length; x > 0; x--) {
      turn[this.foe.player].pokemon.push({
        curHP: undefined,
        fainted: false
      });
    }

    this.winner.remaining = this.getRemaining(turn[this.winner.player].pokemon);

    this.winner.pokemon.filter(pkmn => {
      let x = this.winner.remaining.find(missingPKMN => missingPKMN.species == pkmn.species);
      if (x === undefined) { this.winner.remaining.push(pkmn) };

    });

    this.foe.remaining = this.getRemaining(turn[this.foe.player].pokemon);

    if (!this.foe.remaining.length) {
      return;
    }

    try {
      this.simplify();
    } catch (error) {
      console.log(turn.turn);
      console.error(error);
    }

    return new Promise(resolve => resolve());
  }

  simplify(turn) {
    this.moveFirst = tools.getFinalSpeed(this.active || 'none', this.weather[0] || 'none') > tools.getFinalSpeed(this.foe.active || 'none', this.weather[0] || 'none'); //Check if winner moves 1st next turn
  }

  getRemaining(team) {
    return team.filter(pkmn => {
      return pkmn.fainted != true;
    });
  }

  getNewMovesDmgs(atk, def, MOVES) {
    let temp;
    let moves = [];
    let newMove = { name: "", dmgs: [] };
    let atkr = {};
    let defr = {};

    for (var prop in atk) atkr[prop] = atk[prop];
    for (var prop in def) defr[prop] = def[prop];

    atkr.boosts = Object.values(atk.boosts);
    defr.boosts = Object.values(def.boosts);
    atkr.boosts.unshift(0);
    defr.boosts.unshift(0);

    MOVES.forEach((x, n) => {
      if (BattleMovedex[tools.getId(MOVES[n])].basePower) {
        newMove = { name: x, dmgs: [] };
        temp = sulcalc(atkr, defr, { name: MOVES[n] }).damage._data;
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
    return Promise.resolve(moves);
  }

  async normalize() {
    //two variables are used to make debugging easier. The values in data are labeled using an object.
    let data = {};
    let returnValue = [];

    data.field = (field2Binary(this) || new Array(6).fill(0));
    data.terrain = terrain2Binary(this) || new Array(4).fill(0);
    data.weather = weather2Binary(this) || new Array(4).fill(0);

    data.moveFirst = this.moveFirst ? 1 : 0;
    data.foeHP = this.foe.active.curHP == -1 ? 1 : this.foe.active.curHP / this.foe.active.maxHP;
    data.foeStatus = status2Binary(this.foe.active.status || new Array(6).fill(0));
    data.foeBoosts = boosts2Binary(this.foe.active.boosts || new Array(7).fill(0));
    data.foeVolatile = volatile2Binary(this.foe.active.volatiles || new Array(14).fill(0));
    data.foeSideCond = sideConditions2Binary(this.foe.sideConditions || new Array(4).fill(0));

    data.foeRemaining = this.foe.remaining.length / 6;

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

    this.active.movesDmgs = await this.getNewMovesDmgs(
      this.active,
      this.foe.active,
      this.active.moves
    );

    this.foe.active.movesDmgs = await this.getNewMovesDmgs(
      this.foe.active,
      this.active,
      this.foe.active.moves
    );

    data.foeBestDmg = Math.min(
      ((getBestDmg(this.foe.active.movesDmgs).avgDmg / this.active.maxHP) * 100) /
      this.active.curHP) || 0;

    data.bestDmg = Math.min( //movesDmgs 
      ((getBestDmg(this.active.movesDmgs).avgDmg / this.foe.active.maxHP) * 100) /
      this.active.curHP) || 0;

    data.curHP = this.active.curHP == -1 ? 1 : this.active.curHP / this.active.maxHP;
    data.status = status2Binary(this.active.status || new Array(6).fill(0));
    data.boosts = boosts2Binary(this.active.boosts || new Array(7).fill(0));
    data.volatile = volatile2Binary(this.active.volatiles || new Array(14).fill(0));
    data.sideCond = sideConditions2Binary(this.winner.sideConditions || new Array(4).fill(0));

    data.moveChoice = moveChoice2Binary(this.winner);
    data.switchChoice = switchChoice2Binary(this.winner);

//    data.foeSwitched = this.foe.choice.switch != 0 ? 1: 0;

    data.remaining = this.winner.remaining.length / 6;

    returnValue = [[data.field, data.terrain, data.weather, data.moveFirst, data.foeHP, data.foeStatus, data.foeBoosts, data.foeVolatile, data.foeSideCond, data.foeRemaining, data.foeBestDmg, data.bestDmg, data.curHP, data.status, data.boosts, data.volatile, data.sideCond, data.remaining],[...data.moveChoice,...data.switchChoice]];
    return new Promise((resolve) => resolve(returnValue));
  }
}

async function main(json) {
  let file = await getLogLocal(json);
  let model = new Model(file);
}

//main("./replays.json/gen7randombattle-843768871.json");
//main("./replays.json/gen7randombattle-826319449.json");
//main('./replays.json/gen7randombattle-832046044.json');
main('./replays.json/gen7randombattle-756028321.json');

function getBestDmg(moves) {
  if (!moves.length) return 0;
  return moves.reduce((maxDmg, dmg) => {
    return (maxDmg.avgDmg < dmg.avgDmg) | 0 ? dmg : maxDmg;
  });
}

function getWinner(turn) {
  let winningPlyr = turn.winner;
  winner = turn[winningPlyr];
  return winningPlyr;
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
  pkmn.fainted = pkmn.fainted ? true : false;
  pkmn.lastMove = null;
  //  delete pkmn.boosts;
  delete pkmn.status;
  return new Promise(resolve => resolve(pkmn));
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

function combinedData(p1, p2) {
  p2.moves.forEach((x, n) => {
    let moveName = BattleMovedex[x].name;
    if (p1.moves.indexOf(moveName) == -1) p1.moves.push(moveName);
  });
  if (!p1.ability && p2.ability) p1.ability = p2.ability;
  if (!p1.item && p2.item) p1.item = p2.item;
}

function isMega(pkmn) {
  const item = BattleItems[tools.getId(pkmn.item)];
  if (item) {
    return item.megaEvolves == pkmn.name ? item.megaStone : pkmn.name;
  }
  return pkmn.name;
}

/*********
foe best dmg attack
foe item

our best dmg
our best dmg stab attack

our item
*/

function switchChoice2Binary(plyr){
  let result = [];
  if (plyr.choice == 'switch') {
    let pkmnNum = plyr.pokemon.findIndex(pkmn => {
      return plyr.choice.switch[plyr.choice.switch.length - 1] == pkmn.species;
    });
    switch (pkmnNum) {
      case 0:
        result.push([0, 0, 0, 0, 0, 1]);
        break;
      case 1:
        result.push([0, 0, 0, 0, 1, 0]);
        break;
      case 2:
        result.push([0, 0, 0, 1, 0, 0]);
        break;
      case 3:
        result.push([0, 0, 1, 0, 0, 0]);
        break;
      case 4:
        result.push([0, 1, 0, 0, 0, 0]);
        break;
      case 5:
        result.push([1, 0, 0, 0, 0, 0]);
        break;
    }
  }
  else {
    result.push([0, 0, 0, 0, 0, 0]);
  }
  return result;
}

function moveChoice2Binary(plyr) {
  let result = [];
  if (plyr.choice.move) {
    let moveNum = plyr.active.moves.indexOf(plyr.choice.move);
    switch (moveNum) {
      case 0:
        result.push([0, 0, 0, 1]);
        break;
      case 1:
        result.push([0, 0, 1, 0]);
        break;
      case 2:
        result.push([0, 1, 0, 0]);
        break;
      case 3:
        result.push([1, 0, 0, 0]);
        break;
    }
  }
  else {
    result.push([0, 0, 0, 0]);
  }

  return result;
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
      return new Array(6).fill(0);
  }
}

function sideConditions2Binary(side) {
  let sideCon = [0, 0, 0, 0];

  side.forEach((x, n) => {
    switch (x) {
      case "move: Stealth Rock":
        sideCon[0] += 1;
        break;
      case "Spikes":
        sideCon[1] += 1;
        break;
      case "move: Toxic Spikes":
        sideCon[2] += 1;
        break;
      case "move: Sticky Web":
        sideCon[3] += 1;
        break;
    }
  })

  sideCon[1] /= 3;
  sideCon[2] /= 2;

  return sideCon;

}
/*
pursuit dmg while switching
sideCondition - healingwish, lunardance, wish ???? 
-sidestart - move: Light Screen, move: Lucky Chant, Mist, Reflect, move: Safeguard
move: Stealth Rock, move: Sticky Web, move: Tailwind, move: Toxic Spikes, 

-start (typechange, Doom Desire, typeadd, move: Future Sight, move: Throat Chop)
-activate (move: Guard Split ????, move: Lock-On)

partiallytrapped - Rapid Spin or Substitute, or user switched
lockedmove
stockpile - the -end is Stockpile //useful info: pokemon.volatiles['stockpile'].layers  //not used?
*/

function boosts2Binary(boosts) {
  var normalized = [];
  for (var boost of Object.values(boosts)) {
    normalized.push((boost + 6) / 12);
  }
  return normalized;
}

function volatile2Binary(condition) {
  switch (condition) {
    case "Substitute":
      return ([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]); //replace later maybe with the remaining HP of the sub

    case "confusion":
      return ([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);

    case "move: Leech Seed":
      return ([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]);

    case "move: Focus Energy ":
      return ([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);

    case "Magnet Rise":
      return ([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]);

    case "Smack Down":
      return ([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]);

    case "move: Taunt":
      return ([0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]);

    case "move: Yawn":
      return ([0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);

    case "Attract":
      return ([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]);

    case "perish3":
      return ([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    case "Encore":
      return ([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    case "Autotomize":
      return ([0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    case "mustrecharge": //-mustrecharge slaking
      return ([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    case "trapped": //-activate
      return ([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    default:
      return new Array(14).fill(0);
  }
}

function field2Binary(battle) {
  let fieldCon = [0, 0, 0, 0, 0, 0];

  if (!battle.pseudoWeather) return fieldCon;
  Object.keys(battle.pseudoWeather).forEach((x, n) => {
    switch (x) {
      case "move: Trick Room":
        fieldCon[0] = 1 - ((battle.currentTurn - battle.pseudoWeather[x][1]) + 1) / 5;
        break;
      case "move: Water Sport":
        fieldCon[1] = 1 - ((battle.currentTurn - battle.pseudoWeather[x][1]) + 1) / 5;
        break;
      case "move: Wonder Room":
        fieldCon[2] = 1 - ((battle.currentTurn - battle.pseudoWeather[x][1]) + 1) / 5;
        break;
      case "move: Gravity":
        fieldCon[3] = 1 - ((battle.currentTurn - battle.pseudoWeather[x][1]) + 1) / 5;
        break;
      case "move: Magic Room":
        fieldCon[4] = 1 - ((battle.currentTurn - battle.pseudoWeather[x][1]) + 1) / 5;
        break;
      case "move: Mud Sport":
        fieldCon[5] = 1 - ((battle.currentTurn - battle.pseudoWeather[x][1]) + 1) / 5;
        break;
    }
  });

  return fieldCon;
}

function terrain2Binary(battle) {
  let terrain = [0, 0, 0, 0];
  if (!battle.terrain) return terrain;
  switch (battle.terrain[0]) {
    case "move: Psychic Terrain":
      terrain[0] = 1 - ((battle.currentTurn - battle.terrain[1]) + 1) / 5;
      break;
    case "move: Grassy Terrain":
      terrain[1] = 1 - ((battle.currentTurn - battle.terrain[1]) + 1) / 5;
      break;
    case "move: Misty Terrain":
      terrain[2] = 1 - ((battle.currentTurn - battle.terrain[1]) + 1) / 5;
      break;
    case "move: Electric Terrain":
      terrain[3] = 1 - ((battle.currentTurn - battle.terrain[1]) + 1) / 5;
      break;
  }

  return terrain;
}

function weather2Binary(battle) {
  let weather = [0, 0, 0, 0];
  if (!battle.weather) return weather;
  switch (battle.weather[0]) {
    case "RainDance":
      weather[0] = 1 - ((battle.currentTurn - battle.weather[1]) + 1) / 8;
      break;
    case "SunnyDay":
      weather[1] = 1 - ((battle.currentTurn - battle.weather[1]) + 1) / 8;
      break;
    case "SandStorm":
      weather[2] = 1 - ((battle.currentTurn - battle.weather[1]) + 1) / 8;
      break;
    case "Hail":
      weather[3] = 1 - ((battle.currentTurn - battle.weather[1]) + 1) / 8;
      break;
  }

  return weather;
}

function flattenDeep(arr1) {
  return arr1.reduce(
    (acc, val) =>
      Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val),
    []
  );
}