/////////////////////////////////
//Random Battle PKMN Info
/////////////////////////////////

const mongo = require("mongodb").MongoClient;
const url = "mongodb://192.168.1.201:27017";
const v8 = require("v8");

const util = require("util");
util.inspect.defaultOptions.depth = Infinity;
util.inspect.defaultOptions.colors = true;

const { getId } = require("./Tools.js");

class RB_set {
  constructor(PKMN) {
    this.pkmn = PKMN;
    this.summary = {
      moves: new Array(),
      abilities: new Array(),
      items: new Array()
    };
  }

  async init() {
    this.sets = await this.getSets(this.pkmn);
    this.summary = await this.getSummary(this.sets);
    this.certain = await this.getCertain();
    return new Promise(resolve => resolve("******DONE********"));
  }

  getTotalIterations(acc, x) {
    //      console.log("acc: "+ acc+"\nx: "+util.inspect(x.iterations));
    return acc + x.iterations;
  }

  getMoves(sets) {
    let moves = new Map();
    sets.forEach((x, n) => {
      x.set.moves.forEach(move => {
        if (moves.has(move)) {
          moves.set(move, moves.get(move) + x.iterations);
        } else {
          moves.set(move, x.iterations);
        }
      });
    });
    return moves;
  }

  moveProb(move) {
    //the probability of the pokemon having this move
    return this.moves.get(move) / this.iterations;
  }

  getAbilities(sets) {
    let abilities = new Map();
    sets.forEach((x, n) => {
      if (abilities.has(x.set.ability)) {
        abilities.set(
          x.set.ability,
          abilities.get(x.set.ability) + x.iterations
        );
      } else {
        abilities.set(x.set.ability, x.iterations);
      }
    });
    return abilities;
  }

  getItems(sets) {
    let items = new Map();
    sets.forEach((x, n) => {
      if (items.has(x.set.item)) {
        items.set(x.set.item, items.get(x.set.item) + x.iterations);
      } else {
        items.set(x.set.item, x.iterations);
      }
    });
    return items;
  }

  getCertain() {
    let certain = { moves: new Array() };
    this.summary.moves.forEach((x, n) => {
      if (x.prob == 1) {
        certain.moves.push(x.move);
      }
    });

    this.summary.abilities.forEach((x, n) => {
      if (x.prob == 1) {
        certain.ability = x.ability;
      }
    });

    this.summary.items.forEach((x, n) => {
      if (x.prob == 1) {
        certain.item = x.item;
      }
    });
    return certain;
  }

  async getSummary(sets) {
    let summary = {
      moves: new Array(),
      abilities: new Array(),
      items: new Array()
    };
    summary.iterations = await sets.reduce(this.getTotalIterations, 0);

    let moves = await this.getMoves(sets);
    let abilities = await this.getAbilities(sets);
    let items = await this.getItems(sets);

    moves.forEach((value, key, map) => {
      summary.moves.push({
        move: key,
        prob: value / summary.iterations
      });
    });

    summary.moves.sort(function(a, b) {
      return b.prob - a.prob;
    });

    abilities.forEach((value, key, map) => {
      summary.abilities.push({
        ability: key,
        prob: value / summary.iterations
      });
    });

    summary.abilities.sort(function(a, b) {
      return b.prob - a.prob;
    });

    items.forEach((value, key, map) => {
      summary.items.push({
        item: key,
        prob: value / summary.iterations
      });
    });

    summary.items.sort(function(a, b) {
      return b.prob - a.prob;
    });

    summary.length = sets.length;
    return summary;
  }

  async getProbModel(data) {
    let final = { moves: [], ability: "", item: "" };
    let summary;

    if (data.moves) {
      data.moves = data.moves.map(x => {
        return getId(x);
      });
    }

    //        console.log(data);
    //        console.log(this.sets.length);
    let matchingSets = await this.sets.filter(workingSet => {
      //            console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~')
      //workingSet.property == data.property;

      //console.log(workingSet);
      let test = Object.keys(data).reduce((acc, property) => {
        //              console.log("\nacc: "+acc);
        if (typeof data[property] === "string") {
          //if there is only one ability or item a single string is returned, otherwise it will be an Array
          //                    console.log(workingSet.set[property] + " = " + data[property] + ": " + (workingSet.set[property] == data[property]))
          return acc && workingSet.set[property] == data[property];
        } else {
          //                    console.log(data[property] + " in " + workingSet.set[property]);
          if (data[property]) {
            return (
              acc &&
              data[property].every(move => {
                return workingSet.set[property].includes(move);
              })
            );
          } else {
            return acc;
          }
        }
      }, true);
      if (test == true) return test;
    });
    summary = await this.getSummary(matchingSets);
    //        console.log(util.inspect(results));
    return new Promise(resolve => {
      resolve(summary);
    });

    /*  console.log("RESULTS: " + util.inspect(results.map(x => { return x.set })));
            this.getSummary(results).then((x) => console.log("SUMMARY: " + util.inspect(x)));

            console.log("RESULTS: " + util.inspect(results.length));
            console.log("COMPLETE: " + util.inspect(final));*/
  }

  async getSets(pkmn) {
    let client, db;
    try {
      client = await mongo.connect(url, { useNewUrlParser: true });
      db = await client.db("RBPKMN_sets");
      let unique = await db
        .collection(pkmn)
        .find({})
        .toArray();

      return unique;
    } catch (err) {
      console.log("COULD NOT FIND: " + pkmn + "\n" + err);
      return;
      //    console.log("New " + process.argv[2] + " Collection Created!");
    } finally {
      client.close();
    }
  }
}
/*
function getId(text) {
    if (text && text.id) {
        text = text.id;
    } else if (text && text.userid) {
        text = text.userid;
    }
    if (typeof text !== 'string' && typeof text !== 'number') return '';
    return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '');
}
*/
async function main(x = process.argv[2]) {
  var test = new RB_set(x);
  console.log(await test.init());
  //    console.log(await util.inspect(test.summary));

  let result = await test.getProbModel({
    moves: ["Leaf Storm", "Dragon Hammer", "Flamethrower"]
  });
  await console.log(
    "\n----------------------------\n" +
      util.inspect(result) +
      "\n----------------------------\n"
  );
}

//main('Exeggutor-Alola');

module.exports.RB_set = RB_set;
module.exports.main = main;