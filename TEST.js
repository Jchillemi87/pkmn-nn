const util = require('util');

util.inspect.defaultOptions.depth = Infinity;
util.inspect.defaultOptions.colors = true;

const tf = require(`@tensorflow/tfjs-node${process.env.GPU === 'true' ? '-gpu' : ''}`);

const fs = require("fs");
const fsPromises = require("fs").promises;
const { Model } = require("./model.js");
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

async function logsToNNData(replayFileName, settings = { flags: 'write' }) {
  const FLAG = settings.flags == 'write' ? 'wx' : 'w';
  try {
    const replayID = replayFileName.includes('.log') ? replayFileName.replace('.log', '') : replayFileName;
    const replayLog = await getLogLocal(replaysFolder + replayFileName);

    const replayJSON = await logToJSON(replayLog, replayID);
    await fsPromises.writeFile(`${JSONsFolder}${replayID}.json`, replayJSON, { flag: FLAG });
    //  (e) => {
    //    if (e) console.log(e);
    //    else
    console.log(`wrote ${replayID}.json to ${JSONsFolder}`);
    //  }

    const replayNormalized = await normalizeJSON(replayJSON, replayID);

    fs.writeFile(`${replaysNN}${replayID}.json`, JSON.stringify(replayNormalized), options = { flag: FLAG }, (e) => {
      if (e) console.log(e);
      else
        console.log(`wrote normalized data for ${replayID}.json to ${replaysNN}`);
    });

  } catch (e) {
    errorFiles.data.push(replayFileName);
    console.log(`Error in replay ${replayFileName}: `);
    console.log(`error in logsToNNData
    ${util.inspect(e)}`);
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

//console.log(replaysFolder+'gen7randombattle-857323771.log'.match(/\/.*\.log/gi));
async function start(replayFileName = process.argv[2]) {
  if (replayFileName) {
    await logsToNNData(replayFileName,{settings: 'write'});
  }
  else {
    let count = 0;
    const replayFiles = fs.readdirSync(replaysFolder);
    const replaysJSONs = fs.readdirSync(JSONsFolder);
    let newArray = [];
    for (name of replaysJSONs) {
      newArray.push(name.replace('.json', '.log'));
    }

    let newReplays = replayFiles.filter(x => !newArray.includes(x));

    for (const file of newReplays) {
      console.log(`
      parsing ${++count}/${replayFiles.length}: ${file}`);
      logsToNNData(file);
    }
    console.log('\nLIST OF FILES WITH ERRORS:');
    console.log(util.inspect(errorFiles));
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



async function go() {
  console.log("GO");
  console.time('timer1');
  let dataObj = { data: [], choice: [] };
  //  let ds;

  for (const file of fs.readdirSync('./replays/data/')) {
    let dataJson = await getLogLocal('./replays/data/' + file);
    temp = await JSON.parse(dataJson);

    for (let data of temp) {
      dataObj.data.push(Object.values(data.data).flat());
      dataObj.choice.push(data.choices.foe.switchChoice);
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
    model.add(tf.layers.dense({ units: 83 * 2, activation: 'sigmoid', inputShape: [83] })); //input shape is what is going in, so 31 samples of 83 data points
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
    console.log(`${util.inspect(e)}`);
  }

  console.timeEnd('timer1');

}

//start();
start().then(()=>{go();});
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