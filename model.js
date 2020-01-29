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

const { BattlePokedex } = require('./pokemon-showdown/data/pokedex.js');
const { BattleMovedex } = require('./pokemon-showdown/data/moves.js');
const { BattleItems } = require('./pokemon-showdown/data/items.js');

const tools = require('./Tools.js');

const { RB_set } = require('./RBPI.js');

class Model {
  constructor(json, fileName, hero) {
    this.ID = fileName;
    this.parse = JSON.parse(json);
    this.summary = this.parse.summary;
    this.data = this.parse.data;
    this.trainingData = [];
    //this.simplified = [];
    this.states = [];

    this.hero = {
      id: hero ? hero : this.summary.winner,
    }
    this.hero.pokemon = this.summary[this.hero.id].pokemon;


    this.foe = {
      id: this.hero.id == 'p1' ? 'p2' : 'p1',
      info: {},
    };
  }

  async init() {

    for (let pkmn of this.hero.pokemon) {
      pkmn = await getPKMNInfo(pkmn).catch(e => {
        console.log(util.inspect(e));
      });
    }

    for (let turnStates of this.data) {
      for (let state of turnStates.states) {
        if (state.turn == 0) { continue; }

        for (let pkmn in this.hero.pokemon) {
          let statePKMN = state[this.hero.id].pokemon.find((({ name }) => { return name == this.hero.pokemon[pkmn].name }));
          if (!statePKMN) {
            state[this.hero.id].pokemon[pkmn] = this.hero.pokemon[pkmn];
          }
        }

        for (let pkmn of state[this.hero.id].pokemon) {
          let fullData = this.hero.pokemon.find((({ name }) => { return name == pkmn.name }));
          pkmn.moves = fullData.moves;
          if (!pkmn.item && fullData.item) { pkmn.item = fullData.item; }
          if (!pkmn.ability && fullData.ability) { pkmn.ability = fullData.ability; }
        }

        (this.foe = { ...this.foe, ...state[this.foe.id], });

        for (let pkmn of this.foe.pokemon) {
          if (!this.foe.info[pkmn.name]) {
            this.foe.info[pkmn.name] = await getPKMNInfo(pkmn);
          }
        }
        let test = await this.getNewMovesDmgs(this.getActive(state, this.hero.id), this.getActive(state, this.foe.id));
        state[this.hero.id].reward = 0.5 + state.turn / this.summary.turns / 2;
        state[this.foe.id].reward = 0.5 - state.turn / this.summary.turns / 2;
/*        console.log(`
        P1 Reward: ${state['p1'].reward}
        P2 Reward: ${state['p2'].reward}
        `);*/
        //        console.log(util.inspect(test));
      }
    }

    //    console.log(util.inspect(this));

    for await (const data of this.data) {
      for await (const state of data.states) {
        if (state.turn == 0) continue;
        let normalized = await this.normalize(this.hero.id, state);
        if (normalized != -1) {
          this.trainingData.push(normalized);
        }
      }
    }

    return this.trainingData;
  }

  getActive(state, player) {
    return state[player].pokemon.find(pkmn => {
      return pkmn.isActive == true;
    });
  }

  async isFaster(state) {
    const p1 = this.foe.id == "p1" ? "foe" : "hero";
    const p2 = p1 == "foe" ? "hero" : "foe";

    const p1check = tools.getFinalSpeed(state.p1.active || 'none', state.weather ? state.weather.name : "none");
    const p2check = tools.getFinalSpeed(state.p2.active || 'none', state.weather ? state.weather.name : "none");

    let result;

    if (p1check == p2check) result = 0.5;
    if (p1check > p2check) result = "p1";
    if (p1check < p2check) result = "p2";

    return new Promise(resolve => resolve(result));
  }

  simplify(turn) {
    this.moveFirst = tools.getFinalSpeed(this.active || 'none', this.weather[0] || 'none') > tools.getFinalSpeed(this.foe.active || 'none', this.weather[0] || 'none'); //Check if winner moves 1st next turn
  }

  getRemaining(team) {
    return team.filter(pkmn => {
      return pkmn.fainted != true;
    });
  }

  getFainted(team) {
    return team.filter(pkmn => {
      return pkmn.fainted == true;
    });
  }

  async getNewMovesDmgs(atk, def, MOVES = atk.moves) {
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
    try {

      for await (let move of MOVES) {
        if (BattleMovedex[tools.getId(move)].basePower) {
          newMove = { name: move, dmgs: [] };
          temp = await sulcalc(atkr, defr, { name: move }).damage._data;
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
      }

      return moves;

    } catch (e) {

      throw new Error(`Error in getNewMovesDmgs function:
      ${util.inspect(MOVES)}
      ${e}
      `);
    }
  }

  async normalize(player, state) {
    //two variables are used to make debugging easier. The values in data are labeled using an object.
    if (!state[player].choice) return -1;

    state.p1.id = "p1";
    state.p2.id = "p2";

    state.p1.active = await getPKMNInfo(state.p1.pokemon.filter(pkmn => { if (pkmn.isActive == true) return true; })[0]);
    state.p2.active = await getPKMNInfo(state.p2.pokemon.filter(pkmn => { if (pkmn.isActive == true) return true; })[0]);

    state.hero = player === "p1" ? state.p1 : state.p2;
    state.foe = player === "p1" ? state.p2 : state.p1;

    const faster = await this.isFaster(state);

    let data = {
      field: (field2Binary(state) || new Array(6).fill(0)),
      terrain: terrain2Binary(state) || new Array(4).fill(0),
      weather: weather2Binary(state) || new Array(4).fill(0),
      moveFirst: faster == 0.5 ? 0.5 : state.hero.id == faster,
    };

    data.foeHP = state.foe.active.curHP == -1 ? 1 : state.foe.active.curHP / state.foe.active.maxHP;
    data.foeStatus = status2Binary(state.foe.active.status || new Array(6).fill(0));
    data.foeBoosts = boosts2Binary(state.foe.active.boosts || new Array(7).fill(0));
    data.foeVolatile = volatile2Binary(state.foe.active.volatiles || new Array(14).fill(0));
    data.foeSideCond = sideConditions2Binary(state.foe.sideConditions || new Array(4).fill(0));

    const foeTeamSize = this.summary[state.foe.id].teamsize
    data.foeRemaining = (foeTeamSize - this.getFainted(state.foe.pokemon).length) / foeTeamSize;

    let moveList = state.foe.active.moves;

    try {
      if (state.foe.active.moves.length < 4) {
        moveList = Object.keys(state.foe.active.RBData.probModel.moves);
      }

      state.hero.active.movesDmgs = await this.getNewMovesDmgs(
        state.hero.active,
        state.foe.active,
        state.hero.active.moves
      ).catch(e => { console.log(e + 'testing'); });

      state.foe.active.movesDmgs = await this.getNewMovesDmgs(
        state.foe.active,
        state.hero.active,
        state.foe.active.moves
      ).catch(e => { console.log(e + 'testing'); });

      data.foeBestDmg = Math.min(
        ((getBestDmg(state.foe.active.movesDmgs).avgDmg / state.hero.active.maxHP) * 100) /
        state.hero.active.curHP) || 0;

      data.bestDmg = Math.min( //movesDmgs 
        ((getBestDmg(state.hero.active.movesDmgs).avgDmg / state.foe.active.maxHP) * 100) /
        state.hero.active.curHP) || 0;

      data.curHP = state.hero.active.curHP == -1 ? 1 : state.hero.active.curHP / state.hero.active.maxHP;
      data.status = status2Binary(state.hero.active.status || new Array(6).fill(0));
      data.boosts = boosts2Binary(state.hero.active.boosts || new Array(7).fill(0));
      data.volatile = volatile2Binary(state.hero.active.volatiles || new Array(14).fill(0));
      data.sideCond = sideConditions2Binary(state.hero.sideConditions || new Array(4).fill(0));

      //if (state.turn == 10)
      //console.log(state.turn);

      if (!state.hero.choice) {
        state.hero.choice = { choice: "none" }
      }

      if (!state.foe.choice) {
        state.foe.choice = { choice: "none" }
      }

      let choices = {
        hero: {
          moveChoice: state.hero.choice.choiceType === "move" || false,
          switchChoice: state.hero.choice.choiceType === "switch" || false,
          faintSwitchChoice: state.hero.choice.choiceType === "faint" || false,
        },
        foe: {
          moveChoice: state.foe.choice.choiceType === "move" || false,
          switchChoice: state.foe.choice.choiceType === "switch" || false,
          faintSwitchChoice: state.foe.choice.choiceType === "faint" || false,
        }
      }

      //    data.foeSwitched = this.foe.choice.switch != 0 ? 1: 0;

      const heroTeamSize = this.summary[state.hero.id].teamsize;
      data.remaining = heroTeamSize - this.getFainted(state.hero.pokemon).length / heroTeamSize;

      //this.normalized = {data:{...data}}
      //      this.normalized = { data: [data.field, data.terrain, data.weather, data.moveFirst, data.foeHP, data.foeStatus, data.foeBoosts, data.foeVolatile, data.foeSideCond, data.foeRemaining, data.foeBestDmg, data.bestDmg, data.curHP, data.status, data.boosts, data.volatile, data.sideCond, data.remaining], choice: [data.moveChoice, data.switchChoice] };
      return { data: { ...data }, choices: { ...choices } };
    }
    catch (e) {
      console.log(`${e}
      STATE:
      ${util.inspect(state)}
      TURN: ${util.inspect(state.turn)}
      `);
      throw e;
    }
  }
}

async function main(json) {
  let file = await getLogLocal(json);
  let model = new Model(file);
}

function getBestDmg(ref) {
  moves = Array.isArray(ref) ? ref : ref.moves;
  if (!moves.length) return 0;
  return moves.reduce((maxDmg, dmg) => {
    return (maxDmg.avgDmg < dmg.avgDmg) | 0 ? dmg : maxDmg;
  });
}

async function getPKMNInfo(pkmn) {
  //pkmn.name = isMega(pkmn);
  pkmn.baseStats = BattlePokedex[tools.getId(pkmn.name)].baseStats;
  if (!pkmn.evs) {
    pkmn.evs = [85, 85, 85, 85, 85, 85];
  }
  pkmn.maxHP = tools.calcHP(pkmn);
  let RBData = new RB_set(pkmn.name);
  await RBData.init();
  //  combinedData(pkmn, RBData.certain);
  pkmn.RBData = RBData;

  RBData.probModel = await RBData.getProbModel(pkmn);

  //pkmn = await RBTidy(pkmn);
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

function switchChoice2Binary(plyr) {
  let result = [];
  if (plyr.choice[0] == 'switch') {
    let pkmnNum = plyr.pokemon.findIndex(pkmn => {
      return plyr.choice[1] == pkmn.species;
    });
    switch (pkmnNum) {
      case 0:
        result = [0, 0, 0, 0, 0, 1];
        break;
      case 1:
        result = [0, 0, 0, 0, 1, 0];
        break;
      case 2:
        result = [0, 0, 0, 1, 0, 0];
        break;
      case 3:
        result = [0, 0, 1, 0, 0, 0];
        break;
      case 4:
        result = [0, 1, 0, 0, 0, 0];
        break;
      case 5:
        result = [1, 0, 0, 0, 0, 0];
        break;
    }
  }
  else {
    result = [0, 0, 0, 0, 0, 0];
  }
  return result;
}

function moveChoice2Binary(plyr) {
  let result = [];
  if (plyr.choice[0] == 'move') {
    let moveNum = plyr.active.moves.indexOf(plyr.choice[1]);
    switch (moveNum) {
      case 0:
        result = [0, 0, 0, 1];
        break;
      case 1:
        result = [0, 0, 1, 0];
        break;
      case 2:
        result = [0, 1, 0, 0];
        break;
      case 3:
        result = [1, 0, 0, 0];
        break;
    }
  }
  else {
    result = [0, 0, 0, 0];
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
  let result = [];
  for (var boost of Object.values(boosts)) {
    result.push((boost + 6) / 12);
  }
  return result;
}

function volatile2Binary(condition) {
  let result = new Array(14).fill(0);
  if (condition.includes('Substitute')) { //TODO: replace later maybe with the remaining HP of the sub
    result[0] = 1;
  }
  if (condition.includes('confusion')) {
    result[1] = 1;
  }
  if (condition.includes('move: Leech Seed')) {
    result[2] = 1;
  }
  if (condition.includes('move: Focus Energy')) {
    result[3] = 1;
  }
  if (condition.includes('Magnet Rise')) {
    result[4] = 1;
  }
  if (condition.includes('Smack Down')) {
    result[5] = 1;
  }
  if (condition.includes('move: Taunt')) {
    result[6] = 1;
  }
  if (condition.includes('move: Yawn')) {
    result[7] = 1;
  }
  if (condition.includes('Attract')) {
    result[8] = 1;
  }
  if (condition.includes('perish3')) {
    result[9] = 1;
  }
  if (condition.includes('Encore')) {
    result[10] = 1;
  }
  if (condition.includes('Autotomize')) {
    result[11] = 1;
  }
  if (condition.includes('mustrecharge')) {
    result[12] = 1;
  }
  if (condition.includes('trapped')) {
    result[13] = 1;
  }

  return result;
}

function field2Binary(state) {
  let fieldCon = [0, 0, 0, 0, 0, 0];

  if (!state.pseudoWeather) return fieldCon;
  Object.keys(state.pseudoWeather).forEach((x, n) => {
    switch (x) {
      case "move: Trick Room":
        fieldCon[0] = 1 - ((state.turn - state.pseudoWeather[x].turn) + 1) / 5;
        break;
      case "move: Water Sport":
        fieldCon[1] = 1 - ((state.turn - state.pseudoWeather[x].turn) + 1) / 5;
        break;
      case "move: Wonder Room":
        fieldCon[2] = 1 - ((state.turn - state.pseudoWeather[x].turn) + 1) / 5;
        break;
      case "move: Gravity":
        fieldCon[3] = 1 - ((state.turn - state.pseudoWeather[x].turn) + 1) / 5;
        break;
      case "move: Magic Room":
        fieldCon[4] = 1 - ((state.turn - state.pseudoWeather[x].turn) + 1) / 5;
        break;
      case "move: Mud Sport":
        fieldCon[5] = 1 - ((state.turn - state.pseudoWeather[x].turn) + 1) / 5;
        break;
    }
  });

  return fieldCon;
}

function terrain2Binary(state) {
  let terrain = [0, 0, 0, 0];
  if (!state.terrain) return terrain;
  switch (state.terrain.name) {
    case "move: Psychic Terrain":
      terrain[0] = 1 - ((state.turn - state.terrain.turn) + 1) / 5;
      break;
    case "move: Grassy Terrain":
      terrain[1] = 1 - ((state.turn - state.terrain.turn) + 1) / 5;
      break;
    case "move: Misty Terrain":
      terrain[2] = 1 - ((state.turn - state.terrain.turn) + 1) / 5;
      break;
    case "move: Electric Terrain":
      terrain[3] = 1 - ((state.turn - state.terrain.turn) + 1) / 5;
      break;
  }

  return terrain;
}

function weather2Binary(state) {
  let weather = [0, 0, 0, 0];
  if (!state.weather) return weather;
  switch (state.weather[0]) {
    case "RainDance":
      weather[0] = 1 - ((state.turn - state.weather.turn) + 1) / 8;
      break;
    case "SunnyDay":
      weather[1] = 1 - ((state.turn - state.weather.turn) + 1) / 8;
      break;
    case "SandStorm":
      weather[2] = 1 - ((state.turn - state.weather.turn) + 1) / 8;
      break;
    case "Hail":
      weather[3] = 1 - ((state.turn - state.weather.turn) + 1) / 8;
      break;
  }

  return weather;
}



function matchupSummary(hero,foe){

}

function teamSummary(team) {
  let analysis = {
    moves: new Set(),
    items: new Set(),
    abilities: new Set(),
    statuses: new Set(),
    summary: { status: {}, weather: {}, pseudoWeather: {}, terrain: {}, volatileStatus: {}, sideCondition: {} }
  }

  const ATTRIBUTES = ['status', 'weather', 'pseudoWeather', 'terrain', 'volatileStatus', 'sideCondition'];
  let secondaryAttributes;
  //,'secondary','chance'

  for (pkmn of team) {
    for (move of pkmn.moves) { analysis.moves.add(move); }
    pkmn.item ? analysis.items.add(pkmn.item) : null;
    pkmn.ability ? analysis.abilities.add(pkmn.ability) : null;
    pkmn.statuses ? analysis.statuses.add(pkmn.status) : null;
  }

  for (move of analysis.moves) {
    moveData = BattleMovedex[tools.getId(move)];
    moveAttributes = Object.keys(moveData);

    for (attribute of moveAttributes) {
      if (ATTRIBUTES.includes(attribute)) {
        if (!analysis.summary[attribute][[moveData[attribute]]])
          analysis.summary[attribute][moveData[attribute]] = moveData.accuracy;
        else {
          analysis.summary[attribute][[moveData[attribute]]] = Math.max(moveData.accuracy, analysis.summary[attribute][[moveData[attribute]]]);
        }
      }
      if (attribute == 'secondary') {
        if (moveData[attribute] == null || moveData[attribute] == typeof undefined) continue;
        secondaryAttributes = Object.keys(moveData[attribute]);
        for (secondary of secondaryAttributes) {
          if (ATTRIBUTES.includes(secondary)) {
            if (!analysis.summary[secondary][[moveData.secondary[secondary]]])
              analysis.summary[secondary][[moveData.secondary[secondary]]] = moveData.accuracy / 100 * moveData.secondary.chance / 100 * 100;
            else {
              analysis.summary[secondary][[moveData.secondary[secondary]]] = Math.max(moveData.accuracy, analysis.summary[secondary][moveData.secondary[secondary]]);
            }
          }
        }

      }
    }
  }


  return analysis;
}

module.exports.Model = Model;
module.exports.teamSummary = teamSummary;