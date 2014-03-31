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
    motd: ''
  }
};

/*\
|*| generate and return a random ID of supplied length
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
    numClients = Object.keys(_server.clients).length;
  while(unavailable) {
    var rand = Math.floor(Math.random()*5000).toString();
    if (!_getClientID(username+rand)) {
      unavailable = false;
      username += rand;
    }
  }
  return username;
};

/*\
|*| return client ID of specified username
\*/
var _getClientID = function( username ) {
  for (var key in _server.clients) {
    if (_server.clients[key].username == username) {
      return key;
    }
  }
  return false;
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
  data = data.replace(/(\n|\r\n|\r)/gm, '');
  // if !command and joined-channel/room, broadcast data to channel/room
  if (!containsCommand && _server.clients[clientID].currentChannel) {
    _pubsub.pub('/action/message', [_server.clients[clientID].currentChannel, "<= "+_server.clients[clientID].username+": "+data+"\n"]);
  } else if (!containsCommand) {
    _server.clients[clientID].socket.write("<= Cannot send message! Join a channel!\n");
  } else {
    var input = data.split('/')[1].split(' ');
    if (input.length == 1) {
      var command = input[0];
      // leave, list, quit
      switch (command) {
        case 'help':
          _pubsub.pub('/command/help', [clientID]);
          break;
        case 'leave':
          _pubsub.pub('/command/leave', [clientID]);
          break;
        case 'quit':
          _pubsub.pub('/command/quit', [clientID]);
          break;
        case 'rooms':
          _pubsub.pub('/command/rooms', [clientID]);
          break;
        default:
          _server.clients[clientID].socket.write("<= Command not recognized (/help for help).\n");
      };
    } else if (input.length == 2) {
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
          _server.clients[clientID].socket.write("<= Command not recognized (/help for help).\n");
      };
    } else if (input.length > 2) {
      var command = input[0],
        extra = input.slice(2).join(' '),
        modifier = input[1];
      switch (command) {
        case 'msg':
          _pubsub.pub('/command/msg', [clientID, modifier, extra]);
          break;
        default:
          _server.clients[clientID].socket.write("<= Commadn not recognized (/help for help).\n");
      };
    } else {
      _server.clients[clientID].socket.write("<= Invalid input. Try again!\n");
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
  fd += (date.getYear()+1900)+' ';
  fd += (date.getHours() < 10) ? '0'+date.getHours()+':' : date.getHours()+':';
  fd += (date.getMinutes() < 10) ? '0'+date.getMinutes()+':' : date.getMinutes()+':';
  fd += (date.getSeconds() < 10) ? '0'+date.getSeconds() : date.getSeconds();
  return fd;
};

/*\
|*| chat server command infrastructure
\*/
// broadcast message to current room
var _act_message = function( channel, message ) {
  for (var key in _server.channels[channel].clients) {
    var client = _server.channels[channel].clients[key].socket.write(message);
  }
};
// display server MOTD
var _act_motd = function( clientID ) {
  _server.clients[clientID].socket.write(_server.messages.motd);
};
// help
var _cmd_help = function( clientID ) {
  var socket = _server.clients[clientID].socket;
  socket.write("<= Chat server v"+_app.version+" help:\n");
  socket.write("<= /help                   This help message.\n");
  socket.write("<= /join [channel]         Joins specified channel.\n");
  socket.write("<= /leave                  Leaves your current channel.\n");
  socket.write("<= /login [username]       Login with specified username.\n");
  socket.write("<= /msg [username] [msg]   Send message to specified user.\n");
  socket.write("<= /quit                   Quit the chat server.\n");
  socket.write("<= /rooms                  Lists available channels.\n");
  socket.write("<= /who [channel]          Lists users in specified channel.\n");
  socket.write("<= /whois [username]       Lists details of specified user.\n");
};
// join channel
var _cmd_join = function( clientID, channel ) {
  if (!_server.channels[channel]) {
    _server.channels[channel] = {
      clients: []
    };
  }
  if (_server.clients[clientID].currentChannel == channel) {
    _server.clients[clientID].socket.write("<= * You are already in "+channel+"!\n");
  } else {
    if (_server.clients[clientID].currentChannel) {
      var oldChannel = _server.clients[clientID].currentChannel;
      if (Object.keys(_server.channels[oldChannel].clients).length == 1) {
        delete _server.channels[oldChannel];
      } else {
        var leaveMessage = "<= * "+_server.clients[clientID].username+" has left "+oldChannel+"!\n";
        _pubsub.pub('/action/message', [oldChannel, leaveMessage]);
        delete _server.channels[oldChannel].clients[clientID];
      }
    }
    var joinMessage = "<= * "+_server.clients[clientID].username+" has joined "+channel+"!\n";
    _pubsub.pub('/action/message', [channel, joinMessage]);
    _server.clients[clientID].currentChannel = channel;
    _server.channels[channel].clients[clientID] = _server.clients[clientID];
    _server.clients[clientID].socket.write("<= You have joined '"+channel+"'.\n");
    _pubsub.pub('/command/who', [clientID, channel]);
  }
};
// leave channel
var _cmd_leave = function( clientID, callback ) {
  if (_server.clients[clientID].currentChannel) {
    var currentChannel = _server.clients[clientID].currentChannel;
    if (Object.keys(_server.channels[currentChannel].clients).length == 1) {
      delete _server.channels[currentChannel];
    } else {
      var leaveMessage = "<= * "+_server.clients[clientID].username+" has left "+currentChannel+"!\n";
      delete _server.channels[currentChannel].clients[clientID];
      _server.clients[clientID].socket.write("<= You have left "+currentChannel+"!\n");
      _pubsub.pub('/action/message', [currentChannel, leaveMessage]);
    }
    delete _server.clients[clientID].currentChannel;
  } else {
    _server.clients[clientID].socket.write("<= Invalid command. You must be in a channel to leave it!\n");
  }
  if (callback && typeof(callback) == 'function') callback();
};
// login to get username
var _cmd_login = function( clientID, username ) {
  var socket = _server.clients[clientID].socket;
  if (_getClientID(username)) {
    socket.write("<= Username in use! Choose another.\n");
  } else {
    var oldUsername = _server.clients[clientID].username;
    _server.clients[clientID].username = username;
    socket.write("<= Welcome "+username+"!\n");
    if (_server.clients[clientID].currentChannel) {
      var nickChange = oldUsername+" is now known as "+_server.clients[clientID].username+"!\n";
      _pubsub.pub('/action/message', [_server.clients[clientID].currentChannel, nickChange]);
    }
  }
};
// message another user
var _cmd_msg = function( clientID, recipient, message ) {
  var socket = _server.clients[clientID].socket,
    recipientID = _getClientID(recipient);
  if (!recipientID) {
    socket.write("<= Cannot send message! User does not exist.\n");
  } else {
    var toSocket = _server.clients[recipientID].socket,
      from = _server.clients[clientID].username;
    socket.write("<= [msg:"+recipient+"] <"+from+"> "+message+"\n");
    toSocket.write("<= [msg:"+from+"] <"+from+"> "+message+"\n");
  }
};
// quit server
var _cmd_quit = function( clientID ) {
  var socket = _server.clients[clientID].socket;
  if (_server.clients[clientID].currentChannel) {
    _pubsub.pub('/command/leave', [clientID, function() {
      socket.write("<= BYE!\n");
      socket.end();
      delete _server.clients[clientID];
    }]);
  } else {
    socket.write("<= BYE!\n");
    socket.end();
    delete _server.clients[clientID];
  }
};
// rooms command lists channels
var _cmd_rooms = function( clientID ) {
  var numChannels = Object.keys(_server.channels).length;
  if (numChannels > 0) {
    for (var key in _server.channels) {
      if (!_server.channels.hasOwnProperty(key)) continue;
      var numClients = Object.keys(_server.channels[key].clients).length;
      _server.clients[clientID].socket.write("<= "+key+" ("+numClients+" user(s))\n");
    }
  } else {
    _server.clients[clientID].socket.write("<= No active channels! Create a channel by joining one, such as: /join foo\n");
  }
};
// list users in channel
var _cmd_who = function( clientID, channel ) {
  if (_server.channels[channel]) {
    var numClients = Object.keys(_server.channels[channel].clients).length,
      socket = _server.clients[clientID].socket;
    for (var key in _server.channels[channel].clients) {
      socket.write("<= * "+_server.channels[channel].clients[key].username+"\n");
    }
    socket.write("<= end of list.\n");
  } else {
    _server.clients[clientID].socket.write("<= Channel does not exist!\n");
  }
};
// whois details on user
var _cmd_whois = function( clientID, user ) {
  var socket = _server.clients[clientID].socket,
    targetClientID = _getClientID(user);
  if (targetClientID) {
    var now = Math.floor(new Date().valueOf()/1000);
    var targetUsername = _server.clients[targetClientID].username,
      targetLastActive = _server.clients[targetClientID].timestamps.lastActive,
      targetLastLogin = _server.clients[targetClientID].timestamps.login;
    var targetIdle = Math.floor((now - targetLastActive) / 60);
    socket.write("User "+targetUsername+" (login "+_prettyTime(targetLastLogin)+") idle for "+targetIdle+" minutes\n");
  } else {
    socket.write("User "+user+" does not exist!\n");
  }
};

/*\
|*| chat server command subscription infrastructure
\*/
var _act_message_handle = _pubsub.sub('/action/message', _act_message);
var _act_motd_handle = _pubsub.sub('/action/motd', _act_motd);
var _cmd_help_handle = _pubsub.sub('/command/help', _cmd_help);
var _cmd_join_handle = _pubsub.sub('/command/join', _cmd_join);
var _cmd_leave_handle = _pubsub.sub('/command/leave', _cmd_leave);
var _cmd_login_handle = _pubsub.sub('/command/login', _cmd_login);
var _cmd_msg_handle = _pubsub.sub('/command/msg', _cmd_msg);
var _cmd_quit_handle = _pubsub.sub('/command/quit', _cmd_quit);
var _cmd_rooms_handle = _pubsub.sub('/command/rooms', _cmd_rooms);
var _cmd_who_handle = _pubsub.sub('/command/who', _cmd_who);
var _cmd_whois_handle = _pubsub.sub('/command/whois', _cmd_whois);

/*\
|*| application initialization function
\*/
var _init = (function() {
  _log("[+] Initializing environment...");
  var args = process.argv.slice(2);
  var environment = (args.length != 1) ? 'dev' : args[0];
  _app.environment = (environment == 'prod') ? 'prod' : 'dev';
  _app.port = (_app.environment == 'prod') ? 8088 : 8089;
  _app.version = "0.1.0";
  _server.messages.motd = "<= Welcome to chat server v"+_app.version+"!\n<= Use /login to select a username\n<= List available commands with /help\n";
})();

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
  var timestamp = Math.floor(new Date().valueOf()/1000);
  client.timestamps.lastActive = timestamp;
  client.timestamps.login = timestamp;
  _server.clients[client.id] = client;

  _log("[-] Inbound connection ("+client.id+") from ("+client.ip+") at ("+_prettyTime(timestamp)+")\n");
  _pubsub.pub('/action/motd', [client.id]);

  socket.on('end', function() {
    for (var channel in _server.channels) {
      if (_server.channels.hasOwnProperty(channel)) {
        if (Object.keys(_server.channels[channel].clients).length == 0) {
          delete _server.channels[channel];
        } else {
          delete _server.channels[channel].clients[client.id];
        }
      }
    }
  });

  socket.on('data', function(data) {
    if (_server.clients[client.id]) {
      _server.clients[client.id].timestamps.lastActive = Math.floor(new Date()/1000);
      _server.clients[client.id].socket.write("=> "+data.toString());
      _parseInput(client.id, data.toString());
    }
  });
}).on('error', function(err) {
  _log("[!] Error: "+err+"\n");
}).listen( _app.port, function() {
  _log("[+] Server listening on port "+_app.port+"\n");
});
