const fs = require("fs");
const logParser = require("./logParser.js");
const replaysFolder = "./replays/";
var localReplay;

//test.parse('./replays/gen7randombattle-857323060.log');
//let temp = test.parse('https://replay.pokemonshowdown.com/gen7randombattle-857327353.log');

var noAction = new Set();

async function main(file) {
  console.log(
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~" + replaysFolder + file
  );
  await logParser.getLogLocal(replaysFolder + file).then(res => {
    localReplay = new logParser.logParser(res);
    console.log(res);
  });
  //    console.log(localReplay);
  localReplay.toJSON().then(res => {
    let jsonName = file.replace(".log", ".json");
    fs.writeFile("./replays.json/" + jsonName, res, () => {
      console.log("wrote " + jsonName + " to FS.");
    });
  });
}
//console.log(replaysFolder+'gen7randombattle-857323771.log'.match(/\/.*\.log/gi));

async function start () {
  console.log(process.argv);
  if (!process.argv[2]) {
    fs.readdirSync(replaysFolder).forEach(file => {
      console.log(file);
      main(file);
    });
  } else {
    main(process.argv[2]);
  }
}
start();
