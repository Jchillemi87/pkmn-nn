const util = require('util');

var tf = require('@tensorflow/tfjs');

// Load the binding
require('@tensorflow/tfjs-node');

// 2x3 Tensor
const shape = [2, 3]; // 2 rows, 3 columns
const a = tf.tensor([1.0, 2.0, 3.0, 10.0, 20.0, 30.0], shape);
a.print(); // print Tensor values
// Output: [[1 , 2 , 3 ],
//          [10, 20, 30]]

// The shape can also be inferred:
const b = tf.tensor([
    [1.0, 2.0, 3.0],
    [10.0, 20.0, 30.0]
]);
b.print();
// Output: [[1 , 2 , 3 ],
//          [10, 20, 30]]



const puppeteer = require('puppeteer');


(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http:localhost:8000');
    //console.log(await page.$('[name="search"]'));
    await page.waitForSelector('button[class="button mainmenu1 big"]');
    await page.click("button[class='closebutton']");
    const client = await page.target().createCDPSession();

    var response = await client.send('Runtime.evaluate', {
        expression: 'app.user.attributes;',
        returnByValue: true
    });

    await console.log(response);

   	await new Promise(resolve => setTimeout(resolve, 1000));

	response = await client.send('Runtime.evaluate', {
        expression: 'app.user.rename("boob7");',
        returnByValue: true
    });

    await console.log(response);

	await new Promise(resolve => setTimeout(resolve, 1000));
	response = await client.send('Runtime.evaluate', {
        expression: 'app.user.attributes;',
        returnByValue: true
    });

	await console.log(response);

	await new Promise(resolve => setTimeout(resolve, 1000));


    response = await client.send('Runtime.evaluate',{
    	expression:'app.send("/challenge voov2, gen7unratedrandombattle");',
    	returnByValue: true
    });

    await new Promise(resolve => setTimeout(resolve, 10000));

    response = await client.send('Runtime.evaluate',{
    expression:'app.curRoom.myPokemon[0].item',
    returnByValue: true
    });

    console.log(response);

    await page.screenshot({ path: 'example.png' });




//    console.log(response.result.value.name);
    await browser.close();
})();

//********************************************************************

const rndbtl = require("./formats.json");
const rndpkmn = Object.keys(rndbtl)[Math.floor(Math.random() * Object.keys(rndbtl).length)];
console.log(rndpkmn)

const rt = require('./Pokemon-Showdown/data/random-teams.js');
const RT = new rt;

var initTeam = new Array();

var mCounter = 0;
var moves = RT.getTemplate(process.argv[2]).randomBattleMoves;
var movesCount = Array(moves.length);

var items = new Array();
var abilities = new Array();

movesCount.fill(0);
console.log("All moves: " + util.inspect(moves));

for(var x = 0; x < process.argv[3]; x++){
	initTeam.push(RT.randomSet(RT.getTemplate(process.argv[2])));
	initTeam[x].moves.sort();

	console.log(util.inspect(initTeam[x])+"\n");



	moves.forEach(function(X,n){
//		console.log("IS "+X+ " IN: "+ util.inspect(initTeam[x].moves));
		movesCount[n] += initTeam[x].moves.includes(X);
	});

	//items
	let temp = items.findIndex(function(element) {
		return element.name == initTeam[x].item;
	});

	if(temp != -1){
		items[temp].counter++;
	}
	else{
		items.push({name:initTeam[x].item, counter: 1});
	}

	//abilities
	temp = abilities.findIndex(function(element) {
		return element.name == initTeam[x].ability;
	});

	if(temp != -1){
		abilities[temp].counter++;
	}
	else{
		abilities.push({name:initTeam[x].ability, counter: 1});
	}

}
	
	moves.forEach(function(X,n){
		console.log(X+ " : "+ movesCount[n]);
	});

	console.log(util.inspect(items));
	console.log(util.inspect(abilities));
/**/
//var initTeam = RT.randomSet(RT.getTemplate(rndpkmn));
//console.log(util.inspect(RT.randomTeam()));

function toSmogon(pkmn) {
    if (pkmn.nature === undefined) {
        pkmn.nature = "Hardy";
    }
    var buf = pkmn.name;
    buf += " @ " + pkmn.item + '\n';
    buf += "Ability: " + pkmn.ability + '\n';
    buf += "Level: " + pkmn.level + '\n';
    buf += "EVs: " + pkmn.evs.hp + " HP | " + pkmn.evs.atk + " Atk | " + pkmn.evs.def + " Def | " + pkmn.evs.spa + " SpA | " + pkmn.evs.spd + " SpD | " + pkmn.evs.spe + " Spe \n";
    buf += pkmn.nature + " Nature \n";
    pkmn.moves.forEach(function(x) {
        buf += "- " + x + " \n"
    });
    return buf;
}

//console.log(toSmogon(initTeam) + "\n");

function pickOne(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}