const util = require('util');

util.inspect.defaultOptions.depth = Infinity;
util.inspect.defaultOptions.colors = true;

const fs = require("fs");
const { logParser } = require("./logParser.js");
const { Model } = require("./model.js");
const { getLogLocal } = require("./logParser.js");
const { PkmnError } = require("./logParser.js");
const replaysFolder = './replays/logs/';
const replaysErrors = './replays/errors/';
const replaysJSON = './replays/json/';
const replaysData = './replays/data/';
const errorFiles = { logs: [], jsons: [], data: [] };

//test.parse('./replays/gen7randombattle-857323060.log');
//let temp = test.parse('https://replay.pokemonshowdown.com/gen7randombattle-857327353.log');

var noAction = new Set();

async function logsToJSON(fileName) {
  try {
    const result = await getLogLocal(replaysFolder + fileName);
    const localReplay = new logParser(result, fileName);
    await localReplay.init();
    const parse = await localReplay.toJSON();
    const jsonName = fileName.replace(".log", ".json");
    fs.writeFile(replaysJSON + jsonName, parse, () => {
      //console.log("wrote " + jsonName + " to FS.");
    });
  }
  catch (e) {
    errorFiles.logs.push(fileName);
    console.log(`Error in replay ${fileName}: `);
    console.log(e);
    if (e instanceof PkmnError) {
      fs.rename(replaysFolder + fileName, replaysErrors + fileName, (err) => {
        if (err) throw err;
        else console.log(`Moved ${fileName} to ${replaysErrors}`);
      });
    }
    return;
  }
}

async function normalizeJSON(fileName) {
  const result = await getLogLocal(replaysJSON + fileName);
  const modelData = new Model(result, fileName);
  try {
    await modelData.init();
    fs.writeFile(replaysData + fileName, JSON.stringify(modelData.trainingData), () => {
    });
  }
  catch (e) {
    errorFiles.jsons.push(fileName); write
    console.log(`Error in replay ${fileName}: `);
    console.log(e);
  }
}

async function logsToData(fileName) {
  try {
    const result = await getLogLocal(replaysFolder + fileName);
    const localReplay = new logParser(result, fileName);
    await localReplay.init();
    const parse = await localReplay.toJSON();
    const jsonName = fileName.replace(".log", ".json");
    await fs.writeFile(replaysJSON + jsonName, parse, () => { });
    const modelData = new Model(parse, fileName);
    await modelData.init();
    await fs.writeFile(replaysData + jsonName, JSON.stringify(modelData.trainingData), () => { });

  } catch (e) {
    errorFiles.data.push(fileName);
    console.log(`Error in replay ${fileName}: `);
    console.log(e);
    if (e instanceof PkmnError) {
      fs.rename(replaysFolder + fileName, replaysErrors + fileName, (err) => {
        if (err) throw err;
        else console.log(`Moved ${fileName} to ${replaysErrors}`);
      });
    }
  }
}

//console.log(replaysFolder+'gen7randombattle-857323771.log'.match(/\/.*\.log/gi));
async function start() {
  console.log(process.argv);
  if (!process.argv[2]) {
    for (const file of fs.readdirSync(replaysFolder)) {
      await console.log(`parsing: ${file}`);
      //await logsToJSON(file);
      await logsToData(file);
      //await console.log('logsToJSON ended');
    }
    /*    for (file of fs.readdirSync(replaysJSON)) {
          await console.log('normalizeJSON started');
          await normalizeJSON(file);
          await console.log('normalizeJSON ended');
        };*/
    console.log('LIST OF FILES WITH ERRORS:');
    console.log(util.inspect(errorFiles));
  } else {
    const replay = process.argv[2].includes('.log') ? process.argv[2].replace('.log', '') : process.argv[2];
    await logsToJSON(`${replay}.log`);
    await normalizeJSON(`${replay}.json`);
  }
}
start();