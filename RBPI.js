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
    this.sets = [];
  }

  async init() {
    let response = await this.getSets(this.pkmn);
    for (let { set, iterations } of response) {
      this.sets.push({ ...set, iterations });
    }
    this.summary = await this.getSummary(this.sets);
    //    this.certain = await this.getCertain();
    return new Promise(resolve => resolve("******DONE********"));
  }

  getTotalIterations(acc, x) {
    return acc + x.iterations;
  }

  moveProb(move) {
    //the probability of the pokemon having this move
    return this.moves.get(move) / this.iterations;
  }
  /*
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
  */
  async getCertain() {
    let certain = { moves: [] };
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
    let summary = { abilities: {}, items: {}, moves: {} };
    let totalIterations = 0;

    for (let x of sets) {
      totalIterations += x.iterations;

      summary.abilities[x.ability] ? summary.abilities[x.ability] += x.iterations : summary.abilities[x.ability] = x.iterations;
      summary.items[x.item] ? summary.items[x.item] += x.iterations : summary.items[x.item] = x.iterations;

      for (let move of x.moves) {
        summary.moves[move] ? summary.moves[move] += x.iterations : summary.moves[move] = x.iterations;
      }
    }

    for (let property of Object.keys(summary)) {
      for (let x in summary[property]) {
        summary[property][x] = summary[property][x] / totalIterations;
      }
    }
    summary.totalIterations = totalIterations;

    return summary;


    /*    summary.iterations = await sets.reduce(this.getTotalIterations, 0);
    
    
    
        let moves = this.getMoves(sets);
        let abilities = this.getAbilities(sets);
        let items = this.getItems(sets);
    
        moves.forEach((value, key, map) => {
          summary.moves.push({
            move: key,
            prob: value / summary.iterations
          });
        });
    
        summary.moves.sort(function (a, b) {
          return b.prob - a.prob;
        });
    
        abilities.forEach((value, key, map) => {
          summary.abilities.push({
            ability: key,
            prob: value / summary.iterations
          });
        });
    
        summary.abilities.sort(function (a, b) {
          return b.prob - a.prob;
        });
    
        items.forEach((value, key, map) => {
          summary.items.push({
            item: key,
            prob: value / summary.iterations
          });
        });
    
        summary.items.sort(function (a, b) {
          return b.prob - a.prob;
        });
    
        summary.length = sets.length;*/
  }

  async getProbModel({ ability, item, moves }) {
    //    console.log(this);
    let final = { moves: [], ability: "", item: "" };
    let summary;

    let newSets = [];
    var test = true;
    for (let set of this.sets) {
      if (ability && set.ability != ability) {
        continue;
      }
      if (item && set.item != item) {
        continue;
      }
      if (moves) {
        test = moves.reduce((acc, x) => {
          let temp = getId(x);
          return acc && set.moves.includes(temp);
        }, true);
        if (test != true) { continue; }
      }
      newSets.push(set);
    }
    //    console.log(`oldsets: ${this.sets.length}, newsets: ${newSets.length}`);
    //    console.log(this.getSummary(newSets));
    return await this.getSummary(newSets);
    /*
        if (data.moves) {
          data.moves = data.moves.map(x => {
            return getId(x);
          });
        }
    
        //        console.log(data);
        //        console.log(this.sets.length);
        let matchingSets = this.sets.filter(workingSet => {
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
    */
    /*  console.log("RESULTS: " + util.inspect(results.map(x => { return x.set })));
            this.getSummary(results).then((x) => console.log("SUMMARY: " + util.inspect(x)));

            console.log("RESULTS: " + util.inspect(results.length));
            console.log("COMPLETE: " + util.inspect(final));*/
  }

  async getSets(pkmn) {
    let client, db;
    try {
      client = await mongo.connect(url, { useNewUrlParser: true });
      db = client.db("RBPKMN_sets");
      let unique = await db
        .collection(pkmn)
        .find({})
        .toArray();

      return unique;
    } catch (err) {
      console.log(`COULD NOT FIND: ${pkmn}
      Error: 
      ${err}`);
      return;
    } finally {
      try {
        client.close();
      }
      catch(err){
        console.log(`Error with client.close:
        ${err}`);
      }
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
  console.log(
    "\n----------------------------\n" +
    util.inspect(result) +
    "\n----------------------------\n"
  );
}

//main('Exeggutor-Alola');

module.exports.RB_set = RB_set;
module.exports.main = main;