const util = require('util');

util.inspect.defaultOptions.depth = Infinity;
util.inspect.defaultOptions.colors = true;

var tf = require('@tensorflow/tfjs');

// Load the binding
require('@tensorflow/tfjs-node');

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
//start();

async function go() {
  let dataObj = { data: [], choice: [] };

  for (const file of fs.readdirSync('./replays/data/')) {
    let dataJson = await getLogLocal('./replays/data/' + file);
    temp = await JSON.parse(dataJson);

    for (let data of temp) {
      dataObj.data.push(data.data.flat());
      dataObj.choice.push(data.choice[1].includes(1) ? 1 : 0);
    }
  }

  /*  let dataJson = await getLogLocal('./replays/data/gen7randombattle-603536613.json');
    dataObj = await JSON.parse(dataJson);*/
  const EPOCHS = 10000;

  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 100, activation: 'sigmoid', inputShape: [82] })); //input shape is what is going in, so 31 samples of 82 datapoints
  model.add(tf.layers.dense({ units: 1, activation: 'sigmoid', inputShape: 100 }));       //the units is what is coming out (so 200 connections going to 200 cells)
  model.compile({ loss: 'meanSquaredError', optimizer: 'rmsprop' });
  model.summary();

  try {

    let X = await tf.tensor2d(dataObj.data, [dataObj.data.length, 82]);
    let Y = await tf.tensor2d(dataObj.choice, [dataObj.choice.length, 1]);
    var h = await model.fit(X, Y, {
      epochs: EPOCHS, callbacks: {
        onEpochEnd: async (epoch, logs) => {
          console.log(`
      Epoch: ${epoch}
      Loss: ${logs.loss.toPrecision(4)}
      Correct Answer: ${Y.dataSync()}
      Prediction****: ${Array.from(model.predict(X).dataSync(), x => Math.round(x))}
      Prediction: ${Array.from(model.predict(X).dataSync(), x => x.toPrecision(2))}
      `);
          /*      console.log(`
                Data shape: ${X.shape}
                answer shape: ${Y.shape}      
                `);*/
        }
      }
    });

  } catch (e) {
    console.log(e);
  }



  try {
    let testData = [];
    testData[1] = await tf.tensor([(dataObj[1].data.flat())]);
    console.log(dataObj[1].choice[1]);
    console.log(`testData[1]: ${model.predict(testData[1]).dataSync()}`);

    testData[25] = await tf.tensor([(dataObj[25].data.flat())]);
    console.log(dataObj[25].choice[1]);
    console.log(`testData[25]: ${model.predict(testData[25]).dataSync()}`);

    testData[30] = await tf.tensor([(dataObj[30].data.flat())]);
    console.log(dataObj[30].choice[1]);
    /*
        await model.fit(testData[1], tf.tensor([1]), { epochs: EPOCHS });
        console.log(`testData[1]: ${model.predict(testData[1]).dataSync()}`);
        await model.fit(testData[25], tf.tensor([1]), { epochs: EPOCHS });
        console.log(`testData[25]: ${model.predict(testData[25]).dataSync()}`);
        console.log(`testData[1]: ${model.predict(testData[1]).dataSync()}`);
        console.log(`testData[30]: ${model.predict(testData[30]).dataSync()}`);
        */
  }
  catch (e) {
    console.log(e);
  }
}

go();