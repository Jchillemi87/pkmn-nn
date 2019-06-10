const util = require('util');
util.inspect.defaultOptions.depth = Infinity;
util.inspect.defaultOptions.colors = true;

const {sulcalc} = require('./sulcalc.js');
const {Pokemon} = require('./sulcalc.js');
const {Move} = require('./sulcalc.js');
const {Field} = require('./sulcalc.js');
const {Weathers} = require('./sulcalc.js');
const {Gens} = require('./sulcalc.js');

const attacker = new Pokemon({
  name: "Moltres",
  item: "Charcoal",
  boosts: [1,1,1,1,1,1,1,1],
  evs: [85,85,85,85,85,85]
  //gen: Gens.GSC
});

const defender = new Pokemon({
  name: "Snorlax",
  item: "Leftovers",
  boosts: [1,1,1,1,2,1,1,1],
  evs: [85,85,85,85,85,85]
  //gen: Gens.GSC
});

const move = new Move({
  name: "Outrage",
  critical: "true"
  //gen: Gens.GSC
});

const field = new Field({
  weather: Weathers.SUN,
  //gen: Gens.GSC
});

console.log(util.inspect(sulcalc(attacker, defender, move, field)));
// 'Charcoal Moltres Fire Blast vs. Leftovers Snorlax in Sun: 237 - 279 (45.3 - 53.3%) -- 0.3% chance to 2HKO after Leftovers'