/**
 * @project chat server
 * chat server for weeby.co
 * @file chatserver.js
 * primary application driver file
 * @author curtis zimmerman
 * @contact curtis.zimmerman@gmail.com
 * @license BSD3
 * @version 0.0.1
 */

var net = require('net');

/*\
|*| publish-subscribe pattern functions
\*/
var _pubsub = (function() {
  // pub/sub/unsub pattern cache
  var cache = {};
  function _flush() {
    cache = {};
  };
  function _pub(topic, args, scope) {
    if(cache[topic]) {
      var currentTopic = cache[topic],
        topicLength = currentTopic.length;
      for(var i=0; i<topicLength; i++) {
        currentTopic[i].apply(scope || this, args || []);
      }
    }
  };
  function _sub(topic, callback) {
    if(!cache[topic]) {
      cache[topic] = [];
    }
    cache[topic].push(callback);
    return [topic, callback];
  };
  function _unsub(handle, total) {
    var topic = handle[0],
      cacheLength = cache[topic].length;
    if(cache[topic]) {
      for(var i=0; i<cacheLength; i++) {
        if(cache[topic][i] === handle) {
          cache[topic].splice(cache[topic][i], 1);
          if(total) {
            delete cache[topic];
          }
        }
      }
    }
  };
  return {
    flush:_flush,
    pub:_pub,
    sub:_sub,
    unsub:_unsub
  };
}());

/*\
|*| application data storage object
|*| note: most of these values are overwritten inside _init()
\*/
var _app = {
  environment: '',
  port: 0,
  version: ''
};

/*\
|*| chat server specific data storage object
\*/
var _server = {
  boot: 0,
  channels: [],
  clients: [],
  clientIDLength: 12,
  messages: {
    motd: "Welcome to chat server v"+_app.version+"!"
  }
};

/*\
|*| application initialization function
\*/
var _init = (function() {
  _log("[+] Initializing environment...");
  var args = process.argv.slice(2);
  var environment = (args.length != 1) ? 'dev' : args[0];
  _app.environment = (environment == 'prod') ? 'prod' : 'dev';
  _app.port = (_app.environment == 'prod') ? 8088 : 8089;
  _app.version = "0.0.1"
})();

/*\
|*| usurping a log function
\*/
var _genID = function( tokenLength ) {
  var charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    id = '';
  for (var i=0; i<tokenLength; i++) {
    id += charset.substr(Math.floor(Math.random()*charset.length), 1);
  }
  return id;
};

/*\
|*| generate and return a randomized default username
\*/
var _genUsername = function() {
  var username = 'Guest',
    unavailable = true,
    numClients = _server.clients.length;
  while(unavailable) {
    var rand = Math.floor(Math.random()*5000).toString();
    if (!_usernameExists(username+rand)) {
      unavailable = false;
      username += rand;
    }
  }
  return username;
};

/*\
|*| usurping a log function
\*/
var _log = function( data ) {
  console.log(data);
};

/*\
|*| parse input from client
\*/
var _parseInput = function( clientID, data ) {
  var containsCommand = (data.substr(0,1) == '/') ? true : false;
  // if !command and joined-channel/room, broadcast data to channel/room
  if (!containsCommand && _server.clients[clientID].currentroom) {
    _pubsub.pub('/action/message', [clientID, data]);
  } else if (!containsCommand) {
    _server.clients[clientID].socket.write("Cannot send message! Join a channel!\n");
  } else {
    // _server.clients[clientID].socket is the client socket
    //
    //
    //  FIX -- FINISH THIS
    //
    //
    var input = data.split('/')[1].split(' ');
    if (input.length > 1) {
      var command = input[0],
        modifier = input[1];
      // join, leave, login, who, whois
      switch (command) {
        case 'join':
          _pubsub.pub('/command/join', [clientID, modifier]);
          break;
        case 'login':
          _pubsub.pub('/command/login', [clientID, modifier]);
          break;
        case 'who':
          _pubsub.pub('/command/who', [clientID, modifier]);
          break;
        case 'whois':
          _pubsub.pub('/command/whois', [clientID, modifier]);
          break;
        default:
          _server.clients[clientID].socket.write("Command not recognized (/help for help).\n");
      };
    } else if (input.length == 1) {
      var command = input[0];
      // leave, list, quit
      switch (command) {
        case 'help':
          _pubsub.pub('/command/help', [clientID]);
          break;
        case 'leave':
          _pubsub.pub('/command/leave', [clientID]);
          break;
        case 'list':
          _pubsub.pub('/command/list', [clientID]);
          break;
        case 'quit':
          _pubsub.pub('/command/quit', [clientID]);
          break;
        default:
          _server.clients[clientID].socket.write("Command not recognized (/help for help).\n");
      };
    } else {
      _server.clients[clientID].socket.write("Invalid input. Try again!");
    }
  }
};

/*\
|*| create and return a timestamp in pretty format
\*/
var _prettyTime = function( timestamp ) {
  var date = new Date(timestamp*1000),
    days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var fd = days[date.getDay()]+', ';
  fd += date.getDate()+' ';
  fd += months[date.getMonth()]+' ';
  fd += date.getYear()+' ';
  fd += (date.getHours() < 10) ? '0'+date.getHours()+':' : date.getHours()+':';
  fd += (date.getMinutes() < 10) ? '0'+date.getMinutes()+':' : date.getMinutes()+':';
  fd += (date.getSeconds() < 10) ? '0'+date.getSeconds() : date.getSeconds();
  return fd;
};

/*\
|*| check if client username exists
\*/
var _usernameExists = function( username ) {
  var numClients = _server.clients.length;
  for (var i=0; i<numClients; i++) {
    if (_server.clients[i].username == username) {
      return true;
    }
  }
  return false;
};

/*\
|*| chat server command infrastructure
\*/
// broadcast message to current room
var _act_message = function( clientID, message ) {
  var channel = _server.clients[clientID].currentChannel;
  var numClients = _server.channels[channel].clients.length;
  for (var i=0; i<numClients; i++) {
    var client = _server.channels[channel].clients[i];
    _server.clients[client].socket.write(message);
  }
};
// display server MOTD
var _act_motd = function( clientID ) {
  _server.clients[clientID].socket.write(_server.messages.motd+"\n");
};
// join channel
var _cmd_join = function( clientID, channel ) {
  if (!_server.channels[channel]) {
    _server.channels.append(channel);
  }
  _server.channels[channel].clients.append(clientID);
};
// leave channel
var _cmd_leave = function( clientID ) {
  delete _server.clients[clientID].currentChannel;
  delete _server.channels[channel].clients[clientID];
  if (_server.channels[channel].clients.length == 0) {
    delete _server.channels[channel];
  }
};
// list channels
var _cmd_list = function( clientID ) {
  var numChannels = _server.channels.length;
  for (var i=0; i<numChannels; i++) {
    var channel = _server.channels[i].username;
    _server.clients[clientID].socket.write(channel+' ('+_server.channels.clients.length+' users)');
  }
};
// login
var _cmd_login = function( clientID, username ) {
  if (_usernameExists(username)) {
    _server.clients[clientID].socket.write("Username in use! Choose another.\n");
  } else {
    _server.clients[clientID].username = username;
  }
};
// quit server
var _cmd_quit = function( clientID ) {
  var socket = _server.clients[clientID].socket;
  socket.write("Goodbye!\n");
  socket.close();
  delete _server.clients[clientID];
};
// list users in channel
var _cmd_who = function( clientID, channel ) {
  var numClients = _server.channels[channel].clients.length,
    socket = _server.clients[clientID].socket;
  socket.write("Users in "+channel+": ");
  for (var i=0; i<numClients; i++) {
    socket.write(_server.channels[channel].clients[i].username+" ");
  }
  socket.write("\n");
};
// whois details on user
var _cmd_whois = function( clientID, user ) {
  var socket = _server.clients[clientID].socket;
  if (_usernameExists(user)) {
    var now = new Date();
    var targetClientID = _getClientID(user);
    var targetUsername = _server.clients[targetClientID].username,
      targetLastActivity = _server.clients[targetClientID].timestamps.lastActivity,
      targetLastLogin = _server.clients[targetClientID].timestamps.login;
    var targetIdle = (now-targetLastActivity)/60;
    socket.write("User "+targetUsername+" (login "+targetLastLogin+") idle for "+targetIdle+" minutes");
  } else {
    socket.write("User "+user+" does not exist!\n");
  }
};

/*\
|*| chat server command subscription infrastructure
\*/
var _act_motd_handle = _pubsub.sub('/action/message', _act_message);
var _act_motd_handle = _pubsub.sub('/action/motd', _act_motd);
var _cmd_join_handle = _pubsub.sub('/command/join', _cmd_join);
var _cmd_leave_handle = _pubsub.sub('/command/leave', _cmd_leave);
var _cmd_list_handle = _pubsub.sub('/command/list', _cmd_list);
var _cmd_login_handle = _pubsub.sub('/command/login', _cmd_login);
var _cmd_quit_handle = _pubsub.sub('/command/quit', _cmd_quit);
var _cmd_who_handle = _pubsub.sub('/command/who', _cmd_who);
var _cmd_whois_handle = _pubsub.sub('/command/whois', _cmd_whois);

/*\
|*| primary application driver
\*/
var server = net.createServer(function(socket) {
  // inbound connection data storage object
  var client = {
    timestamps: {
      login: 0,
      lastActive: 0
    }
  };
  client.ip = socket.remoteAddress;
  client.id = _genID(_server.clientIDLength);
  client.username = _genUsername();
  client.socket = socket;

  var timestamp = Math.floor(new Date()/1000);
  client.timestamps.login = timestamp;
  client.timestamps.lastActive = timestamp;

  _server.clients[client.id] = client;
  _log("[-] Inbound connection ("+client.id+") from ("+client.ip+") at ("+_prettyTime(timestamp)+")");

  socket.on('end', function() {
    // @task close out client connection
    delete _server.clients[client.id];
  });

  socket.on('data', function(data) {
    // @todo parse input, handle commands, etc
    _parseInput(client.id, data);
    _server.clients[client.id].timestamps.lastActive = Math.floor(new Date()/1000);
  });
}).on('error', function(err) {
  _log("[!] Error: "+err);
}).listen( _app.port, function() {
  _log("[+] Server listening on port "+_app.port);
});
