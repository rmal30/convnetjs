
var data, labels;
var layer_defs, net, trainer;

// create neural net
var t = "layer_defs = [];\n\
layer_defs.push({type:'input', out_sx:9, out_sy:1, out_depth:2}); // 2 inputs: x, y \n\
layer_defs.push({type:'fc', num_neurons:64, activation:'relu'});\n\
layer_defs.push({type:'regression', num_neurons:9}); // 3 outputs: r,g,b \n\
\n\
net = new convnetjs.Net();\n\
net.makeLayers(layer_defs);\n\
\n\
trainer = new convnetjs.SGDTrainer(net, {learning_rate:0.01, momentum:0.9, batch_size:5, l2_decay:0.0});\n\
";

var batches_per_iteration = 100;
var mod_skip_draw = 100;
var smooth_loss = -1;

function update(){
  // forward prop the data
  var W = nn_canvas.width;
  var H = nn_canvas.height;

  var p = oridata.data;

  var v = new convnetjs.Vol(9,1,2);
  var loss = 0;
  var lossi = 0;
  var N = batches_per_iteration;
  for(var iters=0;iters<trainer.batch_size;iters++) {
    for(var i=0;i<N;i++) {
      // sample a coordinate
      var x = convnetjs.randi(0, W);
      var y = convnetjs.randi(0, H);
      var ix = ((W*y)+x)*4;
      var r = [].concat(analog_output(p[ix]>>5), analog_output(p[ix+1]>>5), analog_output(p[ix+2]>>5)); // r g b
      v.w = [].concat(analog_input(x), analog_input(y));
      var stats = trainer.train(v, r);
      loss += stats.loss;
      lossi += 1;
    }
  }
  loss /= lossi;

  if(counter === 0) smooth_loss = loss;
  else smooth_loss = 0.99*smooth_loss + 0.01*loss;

  var t = '';
  t += 'loss: ' + loss;
  t += '<br>'
  t += 'iteration: ' + counter;
  $("#report").html(t);
}
function digital(arr){
  var total = 0;
  for(var i=0; i<arr.length; i++){
    total = total<<1;
    if(arr[i]>=0.5){
      total++;
    }
  }
  return total;
}
function analog_input(number){
  var string = number.toString(2).padStart(9, "0");
  var bits = [];
  for(var i=0; i<string.length; i++){
    bits[i] = (string[i]-0.5)*1.4;
  }
  return bits;
}

function analog_output(number){
  var string = number.toString(2).padStart(3, "0");
  var bits = [];
  for(var i=0; i<string.length; i++){
    bits[i] = string[i]*0.7+0.15;
  }
  return bits;
}

function draw() {
  if(counter % mod_skip_draw !== 0) return;

  // iterate over all pixels in the target array, evaluate them
  // and draw
  var W = nn_canvas.width;
  var H = nn_canvas.height;

  var g = nn_ctx.getImageData(0, 0, W, H);
  var v = new convnetjs.Vol(9, 1, 2);
  for(var x=0;x<W;x++) {
    for(var y=0;y<H;y++) {
      v.w = [].concat(analog_input(x), analog_input(y));
      var ix = ((W*y)+x)*4;
      var r = net.forward(v);
      g.data[ix+0] = digital(r.w.slice(0, 3))<<5;
      g.data[ix+1] = digital(r.w.slice(3, 6))<<5;
      g.data[ix+2] = digital(r.w.slice(6, 9))<<5;
      g.data[ix+3] = 255; // alpha...
    }
  }
  nn_ctx.putImageData(g, 0, 0);
}

function tick() {
  update();
  draw();
  counter += 1;
}

function reload() {
  counter = 0;
  eval($("#layerdef").val());
  //$("#slider").slider("value", Math.log(trainer.learning_rate) / Math.LN10);
  //$("#lr").html('Learning rate: ' + trainer.learning_rate);
}
function refreshSwatch() {
  var lr = $("#slider").slider("value");
  trainer.learning_rate = Math.pow(10, lr);
  $("#lr").html('Learning rate: ' + trainer.learning_rate);
}

var ori_canvas, nn_canvas, ori_ctx, nn_ctx, oridata;
var sz = 200; // size of our drawing area
var counter = 0;
$(function() {
    // dynamically load lena image into original image canvas
    var image = new Image();
    //image.src = "lena.png";
    image.onload = function() {

      ori_canvas = document.getElementById('canv_original');
      nn_canvas = document.getElementById('canv_net');
      ori_canvas.width = sz;
      ori_canvas.height = sz;
      nn_canvas.width = sz;
      nn_canvas.height = sz;

      ori_ctx = ori_canvas.getContext("2d");
      nn_ctx = nn_canvas.getContext("2d");
      ori_ctx.drawImage(image, 0, 0, sz, sz);
      oridata = ori_ctx.getImageData(0, 0, sz, sz); // grab the data pointer. Our dataset.

      // start the regression!
      setInterval(tick, 1);
    }
    image.src = "imgs/cat.jpg";

    // init put text into textarea
    $("#layerdef").val(t);

    // load the net
    reload();

    // set up slider for learning rate
    $("#slider").slider({
      orientation: "horizontal",
      min: -4,
      max: -1,
      step: 0.05,
      value: Math.log(trainer.learning_rate) / Math.LN10,
      slide: refreshSwatch,
      change: refreshSwatch
    });
    $("#lr").html('Learning rate: ' + trainer.learning_rate);

    $("#f").on('change', function(ev) {
      var f = ev.target.files[0];
      var fr = new FileReader();
      fr.onload = function(ev2) {
        var image = new Image();
        image.onload = function(){
          ori_ctx.drawImage(image, 0, 0, sz, sz);
          oridata = ori_ctx.getImageData(0, 0, sz, sz);
          reload();
        }
        image.src = ev2.target.result;
      };
      fr.readAsDataURL(f);
    });

    $('.ci').click(function(){
      var src = $(this).attr('src');
      ori_ctx.drawImage(this, 0, 0, sz, sz);
      oridata = ori_ctx.getImageData(0, 0, sz, sz);
      reload();
    });
});
