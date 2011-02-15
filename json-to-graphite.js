var net = require("net");

function to_dotted_notation(obj, parent_key, result) {
  if (typeof(parent_key) == 'undefined') parent_key = "";
  if (typeof(result) == 'undefined') result = {};

  if (typeof(obj) == 'object') {
    for (var i in obj) {
      var key = parent_key ? (parent_key + "." + i) : i;
      to_dotted_notation(obj[i], key, result);
    }
  } else if (typeof(obj) == 'number') {
    result[parent_key] = obj;
  }
  return result;
}

var stdin = process.openStdin();
var input = "";
stdin.on("data", function(chunk) {
  input += chunk;
});
stdin.on("end", function() {
  data = JSON.parse(input);
  results = to_dotted_notation(data);

  /* TODO(sissel): validate args */
  var address = process.argv[2].split(":");
  address.push(2003); /* default port */
  var host = address[0];
  var port = address[1];
  /* Only fetch matching keys */
  var args = process.argv.slice(3); /* argv[0] == 'node', argv[1] is script name */

  /* Create a regexp of (arg)|(arg)|(arg)... */
  var pattern = args.map(function(arg) { return "(" + arg + ")" }).join("|");
  var re = new RegExp(pattern);

  var now = Math.floor((new Date()).getTime() / 1000);
  var messages = []
  for (var key in results) { 
    if (re.test(key)) {
      messages.push([key, results[key], now].join(" "));
    }
  }

  var graphite = net.createConnection(port, host);
  graphite.on('connect', function() {
    for (var i in messages) {
      graphite.write(messages[i].toLowerCase() + "\n");
    }
    graphite.end();
  });
});
