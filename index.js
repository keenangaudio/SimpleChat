const { SSL_OP_NO_TICKET } = require('constants');
const e = require('express');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const sass = require('node-sass');
const { v4: uuidv4 } = require('uuid');

const content = __dirname + '/content/';

class User {
  id; name; colour;
  constructor(id, name, colour) {
    this.id = id;
    this.colour = (colour !== "undefined" && colour) || 'azure';
    this.name = (name !== "undefined" && name) || `User ${users.size || 0}`;
  }
}

const history = [];
const connectedUsers = [];
const users = new Map([['server', new User('server', '#ff0000', 'Server')]]);

const getTime = () => {
  let d = new Date();
  const fixup = (num) => num.toString().padStart(2,'0')
  const hr = a => a % 12 == 0 ? 12 : a % 12;
  return `${hr(d.getHours())}:${fixup(d.getMinutes())}${d.getHours() < 12 ? 'a': 'p'}m`;
};

app.use('/assets',express.static('assets/build'));

app.get('/', (req, res) => {
  res.sendFile(content + 'index.html');
});

io.on('connection', socket => {
  const usr = (() => {
    let id = socket.handshake.query.id;
    if  (!id || id === "undefined") id = uuidv4();
    return users.has(id) && users.get(id) ? users.get(id): new User(id, socket.handshake.query.name, socket.handshake.query.colour);
  })();
  if (!users.has(usr.id)) users.set(usr.id, usr);
  connectedUsers.push(usr);

  console.log('user', typeof usr.id, usr.id, usr.name, usr.colour);

  console.log(`${usr.name} connected`);

  socket.broadcast.emit('user list', {usr, action: 'connect'});

  socket.on('chat message', msg => {
    // we dont want any ~fishy~ messages
    if ((/\<script\>/i).test(msg.msg)) {
      io.emit('chat message', {
        effect: 'warning', from: 'server', name: msg.name, time: getTime(), msg: 'That messsage looks fishy...'
      });
      return;
    }
    if (users.has(msg.from)) {
      const u = users.get(msg.from)
      msg.name = u.name;
      msg.colour = u.colour;
    }
    msg.time = getTime();

    history.push(msg);
    if (history.length > 200) history.unshift();

    io.emit('chat message', msg);
  });

  socket.on('user changes', ({id, name, colour}) => {
    const usr = users.get(id) || new User(id, name, colour); // in case the server restarted
    if (name) usr.name = name;
    if (colour) usr.colour = colour;
    users.set(id, usr)
    console.log('updated user', id, usr.name, usr.colour);
    io.emit('user list', {usr, action: 'update'});
  });

  socket.on('disconnect', () => {
    console.log(`${usr.name} disconnected`);
    let ind = connectedUsers.findIndex(u => u.id === usr.id);
    if (ind !== -1) connectedUsers.splice(ind, 1);
    socket.broadcast.emit('user list', {usr, action: 'disconnect'});
  });

  socket.on('request refresh all', password => {
    io.emit('refresh all', 'now');
  });

  socket.emit('startup', {
    usr,
    connectedUsers,
    history: history.map( msg => {
      if (users.has(msg.from)) {
        const u = users.get(msg.from)
        msg.name = u.name;
        msg.colour = u.colour;
      };
      return msg;
    })
  });
});

http.listen(3000, () => {
  console.log('listening on *.3000');
});




