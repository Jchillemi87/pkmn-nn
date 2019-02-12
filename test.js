var tf = require('@tensorflow/tfjs');

// Load the binding
require('@tensorflow/tfjs-node');
async function go() {

const model = tf.sequential();
model.add(tf.layers.dense({units: 10, activation: 'sigmoid',inputShape: [5]}));
model.add(tf.layers.dense({units: 1, activation: 'sigmoid',inputShape: [10]}));

model.compile({loss: 'meanSquaredError', optimizer: 'rmsprop'});

const training_data = tf.tensor([[0,0,0,1,0],[0,1,0,1,1],[1,0,0,1,0],[1,1,0,1,1]]);
const target_data = tf.tensor([[0],[1],[1],[0]]);

for (let i = 1; i < 200 ; ++i) {
 var h = await model.fit(training_data, target_data, {epochs: 30});
   console.log("Loss after Epoch " + i + " : " + h.history.loss[0]);
}

 model.predict(training_data).print();
 model.predict(tf.tensor([[0,0,1,1,0],[0,1,1,1,1],[1,0,1,1,0],[1,1,1,1,1]])).print();

}

go();