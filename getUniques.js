/************
*This file 
*
*
*
*
*
**************/


const util = require("util");
const mongo = require("mongodb").MongoClient;
const url = "mongodb://192.168.1.201:27017";
const dbName = "RBPKMN_sets";
const v8 = require("v8");

//********************************************************************
//global.toId = require("./Pokemon-Showdown-master/.sim-dist/dex-data").Tools.getId;
const rt = require("./pokemon-showdown/data/random-teams.js");
const RT = new rt('gen7randombattle');

var errorPKMN = new Set();
errorPKMN.add("melmetal");

//const allowedNFE = ['Chansey', 'Doublade', 'Gligar', 'Porygon2', 'Scyther', 'Togetic'];
const allowedNFE = [
  "chansey",
  "doublade",
  "gligar",
  "porygon2",
  "scyther",
  "togetic",
  "typenull"
];
const excludedTiers = [
  "NFE",
  "LC Uber",
  "LC",
  "CAP",
  "CAP LC",
  "CAP NFE",
  "Illegal"
];

const FORMATSDATA = require("./pokemon-showdown/data/formats-data.js")
  .BattleFormatsData;

var RndBtlPkmn = Object.keys(FORMATSDATA)
  .filter(PKMN => {
    if (
      (excludedTiers.includes(FORMATSDATA[PKMN].tier) &&
        !allowedNFE.includes(PKMN)) ||
      !FORMATSDATA[PKMN].randomBattleMoves
    ) {
      return;
    }
    else {
      return PKMN;
    }
  })
  .sort();

var PKMN2Update = new Set();

/*
mongo.connect(url, { useNewUrlParser: true }, (err,client)=>{
	let db = client.db("RBPKMN_sets");
	let entries = db.listCollections();
	entries.forEach((x)=>{
		let template = RT.getTemplate(x.name);
		db.collection(template.name).updateMany({}, {$rename:{'total':'iterations'}})

		if((excludedTiers.includes(template.tier) && !allowedNFE.includes(template.species) || !template.randomBattleMoves))
		{
			db.collection(x.name).drop(x);
			console.log(x.name+" dropped!");
		}
	});
});
*/

/*
	Should store all useable pkmn from formats-data.js into an array by just using filter, and then use that array for this instead.
*/

class PkmnError extends Error {
  constructor(name) {
      super(`${name} is currently not supported`)
  }
}

(async () => {
  while (1) {
    if (process.argv[3]) {
//      if (errorPKMN.has(process.argv[3])) { console.log(`errorPKMN: ${{errorPKMN}}`); return; };
      let template = RT.dex.getTemplate(process.argv[3]);
      await main(template.name, process.argv[2]).catch(err =>
        console.log(`

        Template: ${template}
        Error: ${err}
        
        `)
      );
    } else {
      for (var x of RndBtlPkmn) {
        if (errorPKMN.has(x)) { console.log(`errorPKMN: ${util.inspect(errorPKMN)}`); continue; };
        let template = RT.dex.getTemplate(x);
        await main(template.name, process.argv[2]).catch(err => {
          console.log(`

          Template: ${template.id}
          x: ${x}
          Error: ${err}
          
          `);
          errorPKMN.add(x);
        });
      }
    }

    while (PKMN2Update.size > 0) {
      console.log(`TESTING~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      PKMN2Update.size:
      ${PKMN2Update.size}
      errorPKMN:
      ${util.inspect(errorPKMN)}
      `
      );
      for (var x of PKMN2Update) {
        if (errorPKMN.has(x)) { console.log(`errorPKMN: ${util.inspect(errorPKMN)}`); continue; };
        let template = RT.dex.getTemplate(x);
        await main(template.name, process.argv[2] * 10).catch(err => {
          console.log(`

          Template: ${template}
          x: ${x}
          Error: ${err}
          
          `);
          errorPKMN.add(x);
        });
      }
    }
  }
})();

async function getSets(pkmn) {
  let client;
  try {
    client = await mongo.connect(url, { useNewUrlParser: true });
    db = await client.db(dbName);
    //console.log(db);
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

async function main(pkmn, iterations = 10000) {
  var oldDBTotal = 0;
  var abilities = [];
  var items = [];
  var initTeam = [];

  let db;
  let unique = await getSets(pkmn);

  oldDBTotal = unique.length;
  console.log("Total Sets for " + pkmn + " Already in Database: " + oldDBTotal);

  for (x = 0; x < iterations; x++) {
    // console.log('\033[2J');
    // let HeapUsed = Math.round(100*v8.getHeapStatistics().used_heap_size/v8.getHeapStatistics().heap_size_limit).toPrecision(3);
    // console.log("progress for " + pkmn + ": " + Number.parseFloat(x * 100 / iterations).toPrecision(3) + "%. Heap Used: " + (HeapUsed)+"%");
    try {
      var pkmnTemp = await RT.dex.getTemplate(pkmn);
    } catch (err) {
      console.log(`
      
      pkmn: ${pkmn}
      pkmnTemp: ${pkmnTemp}
      Error after RT.dex.getTemplate: ${err}
      
      `);
      errorPKMN.add('pkmnTemp');
    }
    try {
      var RndPkmnSet = RT.randomSet(pkmnTemp, 1, {
        ["megaStone"]: 1
      });
      delete RndPkmnSet.gender;
      delete RndPkmnSet.evs;
      delete RndPkmnSet.ivs;
      delete RndPkmnSet.species;
      delete RndPkmnSet.shiny;
    } catch (err) {
      console.log(`

      RndPkmnSet: ${RndPkmnSet}
      pkmnTemp: ${pkmnTemp}
      Error after RT.randomSet: ${util.inspect(err)}
      
      `);
      errorPKMN.add('pkmnTemp');
    }
    try {
      //            console.log(util.inspect(RndPkmnSet));
      initTeam.push(RndPkmnSet);
      initTeam[x].moves.sort();
    } catch (err) {
      console.log("error with ID prob????!!!: " + err);
    }
    //	console.log(util.inspect(initTeam[x])+"\n");
    //unique pkmn
    let temp = unique.findIndex(function (element) {
      return JSON.stringify(element.set) == JSON.stringify(initTeam[x]);
    });

    if (temp != -1) {
      unique[temp].iterations++;
    } else {
      unique.push({ set: initTeam[x], iterations: 1 });
    }

    //items
    temp = items.findIndex(function (element) {
      return element.name == initTeam[x].item;
    });

    if (temp != -1) {
      items[temp].counter++;
    } else {
      items.push({ name: initTeam[x].item, counter: 1 });
    }

    //abilities
    temp = abilities.findIndex(function (element) {
      return element.name == initTeam[x].ability;
    });

    if (temp != -1) {
      abilities[temp].counter++;
    } else {
      abilities.push({ name: initTeam[x].ability, counter: 1 });
    }
  }
  let client;
  try {
    client = await mongo.connect(url, { useNewUrlParser: true });
    db = client.db(dbName);
    if (oldDBTotal != 0) {
      await db.collection(pkmn).drop();
    }
    await db.createCollection(pkmn);
    await db.collection(pkmn).insertMany(unique);
  } catch (e) {
    console.log("ERROR AT THE END: \n" + e);
  } finally {
    client.close();
  }

  //    console.log(util.inspect(v8.getHeapStatistics()));
  let TESTER = RT.dex.getTemplate(pkmn);
  let moves = RT.dex.getTemplate(pkmn).randomBattleMoves;
  if (unique.length - oldDBTotal > 0) {
    console.log("\n");
    console.log("All moves: " + util.inspect(moves));
    let moveSets = [];
    console.log("abilities: " + util.inspect(abilities));
    console.log("items: " + util.inspect(items));
    console.log("Total Unique Sets: " + unique.length);
    console.log("\n");
    console.log(
      "Added " +
      (unique.length - oldDBTotal) +
      " New " +
      pkmn +
      " Sets to Database"
    );
    console.log(
      `\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      errorPKMN:
      ${util.inspect(errorPKMN)}
      `
    );
    PKMN2Update.add(pkmn);
  } else {
    PKMN2Update.delete(pkmn);
  }
}
