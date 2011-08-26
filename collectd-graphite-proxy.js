/* TODO(sissel): make connections retry/etc 
 * TODO(sissel): make graphite target configurable via command line
 *
 * This code is a work in progress.
 *
 * To use this, put the following in your collectd config:
 *
 * LoadPlugin write_http
 * <Plugin write_http>
 *   <URL "http://monitor:3012/post-collectd">
 *   </URL>
 * </Plugin>
 *
 * This will make collectd write 'PUTVAL' statements over HTTP to the above URL.
 * This code below will then convert the PUTVAL statements to graphite metrics
 * and ship them to 'monitor:2003'
 */
var http = require("http");
var net = require("net");
var assert = require("assert");
var fs = require('fs');

var types = fs.readFileSync('./types.db', encoding='utf8').split("\n");

var typesObj = new Object;

var type_comments_re = /^#/;
var type_cut_re = /^([^\s]+)\s+(.*)/;

for (var i in types) {
  if (!type_comments_re.exec(types[i])) {
    typeSet = type_cut_re.exec(types[i])
    if (!typeSet) { continue; }
    for (var t=0;t < typeSet.length;t++) {
      var name = typeSet[1];
      typesObj[name] = new Array();
      var eachType = typeSet[2].split(", ")
      for (var u=0; u < eachType.length; u++){
        var theName = eachType[u].split(":")[0];
        typesObj[name].push(theName);
      }
    }
  }
}



try {
  var graphite_connection = net.createConnection(2003, host=process.argv[2]);
} catch (error) {
  throw error;
}
graphite_connection.on("close", function() {
  throw new Error("Connection closed");
});
graphite_connection.on("error", function() {
  throw new Error("Connection error");
});

var request_handler = function(request, response) {
  var putval_re = /^PUTVAL ([^ ]+)(?: ([^ ]+=[^ ]+)?) ([0-9.]+)(:.*)/;
  request.addListener("data", function(chunk) {
    metrics = chunk.toString().split("\n");
    for (var i in metrics) {
      var m = putval_re.exec(metrics[i]);
      if (!m) {
        continue;
      }
      var values = m[4].split(":");

      for (var v in values) {
        
        var name = m[1];
        var options = m[2];
        var time = m[3];

        if ( v == 0 ) {
          continue;
        }

        name = "agents." + name.replace(/\./g, "_").replace(/\//g, ".");
        if ( values.length > 2 ) {
          var metric = name.split(".")[3];
          name = name + "_" + typesObj[metric][v - 1];
        }
        message = [name, values[v], time].join(" ");
        graphite_connection.write(message + "\n");

      }

    }
  });

  request.addListener("end", function() {
    response.writeHead(200, {"Content-Type": "text/plain"});
    response.write("OK");
    response.end();
  });
}

var server = http.createServer()
server.addListener("request", request_handler)
server.listen(3012);
