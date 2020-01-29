const util = require('util');

util.inspect.defaultOptions.depth = Infinity;
util.inspect.defaultOptions.colors = true;

const tf = require(`@tensorflow/tfjs-node${process.env.GPU === 'true' ? '-gpu' : ''}`);

const fs = require("fs");
const fsPromises = require("fs").promises;
const { Model, teamSummary } = require("./model.js");
const { logParser, logToJSON, PkmnError, getLogLocal } = require("./logParser.js");

const replaysFolder = './replays/logs/';
const JSONsFolder = './replays/jsons/';
const replaysNN = './replays/data/';

const replaysErrors = './replays/errors/';

const errorFiles = { logs: [], jsons: [], data: [] };

//test.parse('./replays/gen7randombattle-857323060.log');
//let temp = test.parse('https://replay.pokemonshowdown.com/gen7randombattle-857327353.log');

var noAction = new Set();

async function normalizeJSON(replayJSON, replayID) {
  const modelData = new Model(replayJSON, replayID);
  try {
    return await modelData.init();
  }
  catch (e) {
    errorFiles.jsons.push(replayID);
    console.log(`Error in replay ${replayID}: ${util.inspect(e)}`);
    throw e;
  }
}


async function makeJSON(replayFileName) {
  let replayID = replayFileName.replace(/\..*/, '');

  const replayLog = await getLogLocal(replaysFolder + replayID + '.log');
  let replayJSON = null;

  try {
    replayJSON = await logToJSON(replayLog, replayID);
    if (replayJSON) {
      await fsPromises.writeFile(`${JSONsFolder}${replayID}.json`, replayJSON, { flag: 'w' });
      console.log(`wrote ${replayID}.json to ${JSONsFolder}`);

      return replayJSON;
    }
    else {
      throw new Error(`ERROR: replayJSON == ${replayJSON}, returned from logToJSON, in function makeJSON`);
    }
  } catch (err) {
    console.log(`error in makeJSON
    ${util.inspect(err)}`);
  }
}

async function normalize(replayFileName) {
  const replayID = replayFileName.replace(/\..*/, '');
  const replayJSON = await fsPromises.readFile(`${JSONsFolder}${replayID}.json`);
  let replayNormalized = await normalizeJSON(replayJSON, replayID);
  if (replayNormalized != null) {
    fs.writeFile(`${replaysNN}${replayID}.json`, JSON.stringify(replayNormalized), options = { flag: 'w' }, (e) => {
      if (e) console.log(e);
      else
        console.log(`wrote normalized data for ${replayID}.json to ${replaysNN}`);
    });
  }

  return new Promise(resolve => resolve());
}

async function logsToNNData(replayFileName, settings = { flags: 'write' }) {
  const FLAG = settings.flags == 'write' ? 'wx' : 'w';
  try {


    //*~~~Check if writing flag and if JSON folder already contains this replay
    if (settings.flags == 'write') {
      replayJSON = await logToJSON(replayLog, replayID);
    }
    else {
      if (!replaysJSONs.includes(replayID + '.log')) {
        replayJSON = await logToJSON(replayLog, replayID);
      }
      else {
        replayJSON = fsPromises.readFile(`${JSONsFolder}${replayID}.json`);
      }
    }

    //if replayJSON is undefined, there must be an error with the replay, and there is no point in continuing
    if (replayJSON == undefined) { return; }

    if (replayJSON != null) {
      await fsPromises.writeFile(`${JSONsFolder}${replayID}.json`, replayJSON, { flag: 'w' });
      console.log(`wrote ${replayID}.json to ${JSONsFolder}`);
    }


    //*~~~Now check if data folder already contains this replay    
    if (settings.flags == 'write') {
      replayNormalized = await normalizeJSON(replayJSON, replayID);
    }
    else {
      if (!replaysJSONs.includes(replayID + '.log')) {
        replayJSON = await normalizeJSON(replayJSON, replayID);
      }
    }

    if (replayNormalized != null) {
      fs.writeFile(`${replaysNN}${replayID}.json`, JSON.stringify(replayNormalized), options = { flag: FLAG }, (e) => {
        if (e) console.log(e);
        else
          console.log(`wrote normalized data for ${replayID}.json to ${replaysNN}`);
      });
    }

  } catch (e) {
    if (e.code != 'EEXIST') {
      errorFiles.data.push(replayFileName);
      console.log(`Error in replay ${replayFileName}: `);
      console.log(`error in logsToNNData
    ${util.inspect(e)}`);
    }
    /*fs.rename(replaysFolder + replayFileName, replaysErrors + replayFileName, (err) => {
      //console.log(err);
      if (err) {
        console.log(`error in logsToNNData >> fs.rename:
        ${err}`);
        //        throw err;
      }
      else { console.log(`Moved ${replayFileName} to ${replaysErrors}`) };
    });*/

  }
}

var dataJSONs = [];
var replaysJSONs = [];
var replayFiles = [];


function checkFolders() {
  if (!fs.existsSync('./replays/')) fs.mkdirSync('./replays/');
  if (!fs.existsSync(replaysFolder)) fs.mkdirSync(replaysFolder);
  if (!fs.existsSync(replaysErrors)) fs.mkdirSync(replaysErrors);
  if (!fs.existsSync(JSONsFolder)) fs.mkdirSync(JSONsFolder);
  if (!fs.existsSync(replaysNN)) fs.mkdirSync(replaysNN);
}

//console.log(replaysFolder+'gen7randombattle-857323771.log'.match(/\/.*\.log/gi));
async function start(replayFileName = process.argv[3]) {
  checkFolders();

  if (replayFileName) {
    await logsToNNData(replayFileName, { settings: 'write' });
  }
  else {

    replaysJSONs = fs.readdirSync(JSONsFolder);
    replayFiles = fs.readdirSync(replaysFolder);
    let count = 0;

    for (const file of replayFiles) {
      console.log(`
      parsing ${++count}/${replayFiles.length}: ${file}`);
      logsToNNData(file);
    }

    console.log(`LIST OF FILES WITH ERRORS:
    ${util.inspect(errorFiles)}`);
  }

  return new Promise(resolve => resolve());
}

function onEpochEndCallback(epoch, logs) {
  console.log(`
Epoch: ${epoch}
Loss: ${logs.loss.toPrecision(4)}
Memory: ${util.inspect(tf.memory())}
`);
}

async function fetchData() {
  let dataObj = { data: [], choice: [] };
  for (const file of fs.readdirSync('./replays/data/')) {
    let dataJson = await getLogLocal('./replays/data/' + file);
    temp = await JSON.parse(dataJson);

    for (let data of temp) {
      dataObj.data.push(Object.values(data.data).flat());
      dataObj.choice.push(data.choices.foe.switchChoice);
    }
  }
  return dataObj;
}

async function train() {
  console.log("GO");
  console.time('timer1');
  let dataObj = await fetchData();
  //  let ds;

  //  const testing = await ds.batch(4).take(3);
  //  console.log(`testing: ${util.inspect(testing)}`);
  try {
    const decision = {
      data: tf.tensor(dataObj.data, [dataObj.data.length, 83], 'float32'),
      choice: tf.tensor(dataObj.choice, [dataObj.choice.length, 1], 'float32')
    }

    const EPOCHS = 1000;

    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 83 * 2, activation: 'sigmoid', inputShape: [83] })); //input shape is what is going in, so 31 samples of 83 data points
    model.add(tf.layers.dense({ units: 83 * 3, activation: 'sigmoid' }));       //the units is what is coming out (so 200 connections going to 200 cells)
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));       //the units is what is coming out (so 200 connections going to 200 cells)
    model.compile({
      optimizer: tf.train.adam(learningRate = 0.003),
      loss: tf.losses.meanSquaredError
    });
    model.summary();

    const x = await model.fit(decision.data, decision.choice, {
      batchSize: 64,
      epochs: EPOCHS, callbacks: {
        //        onEpochEnd: async (epoch, logs) => {onEpochEndCallback(epoch, logs)},
      }
    });
    //s    model.save('file://model');
    //const model = await tf.loadLayersModel('localstorage://model');

    //    model.evaluate(decision.data, decision.choice).print();

    const [test, dataSize] = [100, dataObj.data.length];

    for (let x = 0; x < test; x++) {
      const prediction = await model.predict(tf.tensor([dataObj.data[dataSize - x - 1]]));
      console.log(`prediction: ${util.inspect(await prediction.data())}`);
      console.log(`actual: ${util.inspect([dataObj.choice[dataSize - x - 1]])}`);
    }
  } catch (e) {
    console.log(`${util.inspect(e)}`);
  }

  console.timeEnd('timer1');

}

async function evaluate(file){
  try{
    const model = await tf.loadLayersModel('file://012120switch_prediction_model_backup/model.json');

    model.compile({
      optimizer: tf.train.adam(learningRate = 0.003),
      loss: tf.losses.meanSquaredError
    });

    if(file){
      let dataJson = await getLogLocal('./replays/data/' + file);
      temp = await JSON.parse(dataJson);
      let switchData = {x: [], y:[]};

      for(data of temp){
//        if(data.choices.hero.switchChoice == true){
          switchData.x.push(data.data);
          switchData.y.push(data.choices.hero.switchChoice);
//        }
      }

      let temp2 = [];

      for(place of switchData.x){
        temp2.push([...Object.values(place)].flat());
      }
      const predictionTensor = tf.tensor(temp2.flat(Infinity),[temp2.length,temp2[0].length]);
      const answerKey = tf.tensor(switchData.y)
      console.log(predictionTensor.toInt())
      console.log(util.inspect(await model.predict(predictionTensor).data()));

      console.log(util.inspect(await model.evaluate(predictionTensor,answerKey,{batchSize: 4}).data()));

    }
  } catch (error) {
    console.log(util.inspect(error));
  }
}

async function predict() {
  try {
    const model = await tf.loadLayersModel('file://012820switch_prediction_model_backup/model.json');

    let dataObj = await fetchData();

    const decision = {
      data: tf.tensor(dataObj.data, [dataObj.data.length, 83], 'float32'),
      choice: tf.tensor(dataObj.choice, [dataObj.choice.length, 1], 'float32')
    }
    model.compile({
      optimizer: tf.train.adam(learningRate = 0.003),
      loss: tf.losses.meanSquaredError
    });
    model.summary();
    model.evaluate(decision.data, decision.choice).print();

  } catch (error) {
    console.log(util.inspect(error));
  }
}

//self invoking function example: (()=>{console.log('test');})();

(async () => {
  let count = 0;

  checkFolders();

  switch (process.argv[2]) {
    case 'makeJSON':
      replayFiles = fs.readdirSync(replaysFolder);
      replaysJSONs = fs.readdirSync(JSONsFolder);

      if (process.argv[3] != 'new') {
        for (const file of replayFiles) {
          console.log(`
          parsing ${++count}/${replayFiles.length}: ${file}`);

          makeJSON(file);
        }
        count = 0;
      }

      let tempJSONreplayNames = [];

      for (name of replayFiles) {
        tempJSONreplayNames.push(name.replace('.log', '.json'));
      }

      var missingJSONs = tempJSONreplayNames.filter(json => replaysJSONs.includes(json) == false);

      for (const file of missingJSONs) {
        console.log(`
        parsing missed file ${++count}/${missingJSONs.length}: ${file}`);
        makeJSON(file);
      }
      break;

    case 'normalize':
      replaysJSONs = fs.readdirSync(JSONsFolder);
      dataJSONs = fs.readdirSync(replaysNN);

      if (process.argv[3] != 'new') {
        for (const file of replaysJSONs) {
          console.log(`
          normalizing ${++count}/${replaysJSONs.length}: ${file}`);

          normalize(file);
        }
        count = 0;
      }
      //first we try to normalize as many replays as we can if we are checking all jsons
      //then we check to see which replays are missing from the data folder and normalize those

      var missingJSONs = replaysJSONs.filter(json => dataJSONs.includes(json) == false);

      for (const file of missingJSONs) {
        console.log(`
        normalizing missed file ${++count}/${missingJSONs.length}: ${file}`);

        await normalize(file);
      }

      break;

    case 'train':
      train();
      break;

    case 'predict':
      predict();
      break;

    case 'evaluate':
      evaluate(process.argv[3]);
      break;

    case 'test':
      const replayID = 'gen7randombattle-1044090741';
      const replayData = await fsPromises.readFile(`${JSONsFolder}${replayID}.json`);
      const replayModel = new Model(replayData, `${replayID}.json`);
      await replayModel.init();
      //      const teamToAnalyze = replayModel.getRemaining(replayModel.data[replayModel.data.length-1].states[0].hero.pokemon);
      const teamToAnalyze = replayModel.getRemaining(replayModel.hero.pokemon);
      console.log(`Total Remaining: ${teamToAnalyze.length} 
      ${util.inspect(teamSummary(teamToAnalyze))}`);

      break;

    default:
      //  start().then(() => { go(); });
      console.log("No Parameters Given");
  }
  //  if (!process.argv[2]) {  };

})();

//start();
//go();

//@TODO: Skip parsing and/or normalizing files/data that already exists
//@TODO: Review the errors in the folder 'new_errors' for normalized

//The following error comes from replays which include the |choice output, (ex: |choice|move airslash|move moonblast)
//TypeError: Cannot read property 'basePower' of undefined
//at MOVES.forEach (/home/joseph/Desktop/pkmn-nn/model.js:155:48)
//
//TypeError: Cannot read property 'split' of undefined
//at logParser.lineParse (/home/joseph/Desktop/pkmn-nn/logParser.js:300:82)
//at log.full.split.forEach (/home/joseph/Desktop/pkmn-nn/logParser.js:57:18)
//
//