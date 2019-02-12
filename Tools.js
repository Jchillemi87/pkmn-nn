const fs = require('fs');
const logParser = require('./logParser.js');
const replaysFolder = './replays/';
var localReplay;

//test.parse('./replays/gen7randombattle-857323060.log');
//let temp = test.parse('https://replay.pokemonshowdown.com/gen7randombattle-857327353.log');

async function main(file) {
    console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~" + replaysFolder + file);
    await logParser.getLogLocal(replaysFolder + file).then((res => {
        localReplay = new logParser.logParser(res);
        console.log(res);
    }));
    //    console.log(localReplay);
    localReplay.toJSON().then((res) => {
        let jsonName = file.replace('.log', '.json');
        fs.writeFile('./replays.json/' + jsonName, res, () => {
            console.log('wrote ' + jsonName + ' to FS.');
        });
    })
}
//console.log(replaysFolder+'gen7randombattle-857323771.log'.match(/\/.*\.log/gi));


fs.readdirSync(replaysFolder).forEach(file => {
    console.log(file);
    main(file);
});

/*
const typeChart = require('./honko-damagecalc-master/js/data/type_data.js');

const Damage = require('./honko-damagecalc-master/js/damage.js');

var atkr = {
    "name": "Houndoom",
    "species": "Houndoom",
    "set": {
        "moves": {}
    },
    "boosts": {
        "atk": 0,
        "def": 0,
        "spa": 0,
        "spd": 0,
        "spe": 0,
        "accuracy": 0,
        "evasion": 0
    },
    "level": 78,
    "gender": "F",
    "curHP": 245,
    "maxHP": 245,
    "isActive": true
}

var def = {
    "name": "Sylveon",
    "species": "Sylveon",
    "set": {
        "moves": {}
    },
    "boosts": {
        "atk": 0,
        "def": 0,
        "spa": 0,
        "spd": 0,
        "spe": 0,
        "accuracy": 0,
        "evasion": 0
    },
    "level": 77,
    "gender": "M",
    "curHP": 273,
    "maxHP": 273,
    "isActive": true
}


Damage.getDamageResult(atkr, def, {
    'name':'Earthquake',
    'bp': 100,
    'type': 'Ground',
    'category': 'Physical',
    'isSpread': true
}, {});*/