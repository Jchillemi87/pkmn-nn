const util = require('util');

util.inspect.defaultOptions.depth = Infinity;
util.inspect.defaultOptions.colors = true;

const tf = require(`@tensorflow/tfjs-node${process.env.GPU === 'true' ? '-gpu' : ''}`);

const fs = require("fs");
const { logParser } = require("./logParser.js");
const { Model } = require("./model.js");
const { getLogLocal } = require("./logParser.js");
const { PkmnError } = require("./logParser.js");

const replaysFolder = './replays/logs/';
const replaysSimpleFolder = './replays/simplified/';
const replaysNN = './replays/data/';

const replaysErrors = './replays/errors/';

const errorFiles = { logs: [], jsons: [], data: [] };

//test.parse('./replays/gen7randombattle-857323060.log');
//let temp = test.parse('https://replay.pokemonshowdown.com/gen7randombattle-857327353.log');

var noAction = new Set();

async function logToJSON(replayLog, replayName) {
  try {
    const localReplay = new logParser(replayLog, replayName);
    await localReplay.init();
    return await localReplay.toJSON();
  }
  catch (e) {
    errorFiles.logs.push(replayName);
    console.log(`Error in replay ${replayName}: `);
    console.log(e);
    fs.rename(replaysFolder + replayName, replaysErrors + replayName, (err) => {
      //console.log(err);
      if (err) {
        console.log(`error in logToJSON >> fs.rename:
        ${err}`);
        //        throw err;
      }
      else { console.log(`Moved ${replayName} to ${replayName}`) };
    });
    return;
  }
}

async function normalizeJSON(replaySimple, replayID) {
  const modelData = new Model(replaySimple, replayID);
  try {
    return await modelData.init();
  }
  catch (e) {
    errorFiles.jsons.push(replayID);
    console.log(`Error in replay ${replayID}: `);
    throw e;
  }
}

async function logsToNNData(replayFileName,settings={flags:'write'}) {
  const FLAG = settings.flags == 'write' ? 'wx': 'w';
  try {
    const replayID = replayFileName.includes('.log') ? replayFileName.replace('.log', '') : replayFileName;
    const replayLog = await getLogLocal(replaysFolder + replayFileName);

    const replaySimple = await logToJSON(replayLog, replayID);
    const replayNormalized = await normalizeJSON(replaySimple, replayID);

    fs.writeFile(`${replaysSimpleFolder}${replayID}.json`, replaySimpleFolder, options = { flag: FLAG }, (e) => {
      if (e) console.log(e);
      else
        console.log(`wrote ${replayID}.json to ${replaysSimple}`);
    });
    fs.writeFile(`${replaysNN}${replayID}.json`, JSON.stringify(replayNormalized), options = { flag: FLAG }, (e) => {
      if (e) console.log(e);
      else
        console.log(`wrote normalized data for ${replayID}.json to ${replaysNN}`);
    });

  } catch (e) {
    errorFiles.data.push(replayFileName);
    console.log(`Error in replay ${replayFileName}: `);
    console.log(`error in logsToNNData
    ${e}`);
    fs.rename(replaysFolder + replayFileName, replaysErrors + replayFileName, (err) => {
      //console.log(err);
      if (err) {
        console.log(`error in logsToNNData >> fs.rename:
        ${err}`);
        //        throw err;
      }
      else { console.log(`Moved ${replayFileName} to ${replaysErrors}`) };
    });

  }
}

//console.log(replaysFolder+'gen7randombattle-857323771.log'.match(/\/.*\.log/gi));
async function start(replayFileName = process.argv[2]) {
  if (replayFileName) {
    logsToNNData(replayFileName);
  }
  else {
    let count = 0;
    const replayFiles = fs.readdirSync(replaysFolder);
    const replaysSimple = fs.readdirSync(replaysSimpleFolder);
    let newArray = [];
    for(name of replaysSimple){
      newArray.push(name.replace('.json', '.log'));
    }

    let newReplays = replayFiles.filter(x => !newArray.includes(x));

    for (const file of newReplays) {
      await console.log(`
      parsing ${++count}/${replayFiles.length}: ${file}`);
      await logsToNNData(file);
    }
    console.log('\nLIST OF FILES WITH ERRORS:');
    console.log(util.inspect(errorFiles));
  }
}

function onEpochEndCallback(epoch, logs) {
  console.log(`
Epoch: ${epoch}
Loss: ${logs.loss.toPrecision(4)}
Memory: ${util.inspect(tf.memory())}
`);
}



async function go() {
  console.time('timer1');
  let dataObj = { data: [], choice: [] };
  //  let ds;

  for (const file of fs.readdirSync('./replays/data/')) {
    let dataJson = await getLogLocal('./replays/data/' + file);
    temp = await JSON.parse(dataJson);

    for (let data of temp) {
      dataObj.data.push(data.data.flat());
      dataObj.choice.push(data.choice[1].includes(1) ? 1 : 0);
    }

    //    ds = await ds ? ds.concatenate(tf.data.array(temp)) : tf.data.array(temp);
  }

  //  const testing = await ds.batch(4).take(3);
  //  console.log(`testing: ${util.inspect(testing)}`);
  try {
    const decision = {
      data: tf.tensor(dataObj.data, [dataObj.data.length, 83], 'float32'),
      choice: tf.tensor(dataObj.choice, [dataObj.choice.length, 1], 'float32')
    }

    const EPOCHS = 1000;

    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 83 * 2, activation: 'sigmoid', inputShape: [83] })); //input shape is what is going in, so 31 samples of 83 datapoints
    model.add(tf.layers.dense({ units: 83 * 3, activation: 'sigmoid' }));       //the units is what is coming out (so 200 connections going to 200 cells)
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));       //the units is what is coming out (so 200 connections going to 200 cells)
    model.compile({
      optimizer: tf.train.adam(learningRate = 0.003),
      loss: tf.losses.meanSquaredError
    });
    model.summary();

    const x = await model.fit(decision.data, decision.choice, {
      //batchSize: 64,
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
    console.log(e);
  }

  console.timeEnd('timer1');

}

start();
//start().then(()=>{go();});
//go();

//@TODO: Skip parsing and/or normalizing files/data that already exists
//@TODO: Review the errors in the folder 'new_errors' for normalized

//The following error comes from replays which include the |choice ouput, (ex: |choice|move airslash|move moonblast)
//TypeError: Cannot read property 'basePower' of undefined
//at MOVES.forEach (/home/joseph/Desktop/pkmn-nn/model.js:155:48)
//
//TypeError: Cannot read property 'split' of undefined
//at logParser.lineParse (/home/joseph/Desktop/pkmn-nn/logParser.js:300:82)
//at log.full.split.forEach (/home/joseph/Desktop/pkmn-nn/logParser.js:57:18)
//
//