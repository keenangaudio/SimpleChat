/** Handles emoji logic */
class Emoji {
  // do this client side for real-time changes
  /** the emojis the chat will auto convert */
  repl;
  /** for emoji replacements */
  emoji_repl;
  /** to check if something is only unicode emojis
   * @type {RegExp}
   */
  emoji_regex;

  constructor() {
    this.repl = Object.freeze(new Map([
      [';)', '😉'], [':devil:', '😈'], [':uwu:', '🥺'],
      [':D','😁'], ['(:','🙃'], [':)','🙂'],
      [':(','🙁'], ['):','🙁'], ['D:','😟'],
      [':o','😲'], [':p','😛'], [';p','😜'],
      ['->','→'], ['<-','←'], [':^','↑'], [':v','↓'],
    ]));
    this.emoji_repl = new RegExp(
      Array.from(this.repl.keys())
        .map(s => s.toLowerCase().replace(/[\(\)\\\^]/g, m => `\\${m}`))
        .join('|')
      , 'i');
    this.emoji_regex = /^(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\s|\u2934|\u2935|[\u2190-\u21ff])+$/;
  }

  /**
   * @param {string} text
   * @returns {string}
   */
  emojify(text) {
    return text.replace(this.emoji_repl, m =>
      this.repl.has(m) ? this.repl.get(m) : 
        this.repl.has(m.toLowerCase()) ? this.repl.get(m.toLowerCase()) : m
    );
  }

  /**
   * @param {string} text the text to check
   * @returns {boolean} if text contains only unicode emoji characters
   */
  only(text) {
    // thanks SO: https://stackoverflow.com/users/6558042/omid-nikrah
    return this.emoji_regex.test(text);
  }
}

class User {
  id; name; colour;
  constructor(id, name, colour) {
    if (id === 'json') {
      let o = JSON.parse(name || '{}');
      name = o.name;
      colour = o.colour;
      id = o.id;
    }
    this.id = id;
    this.colour = colour;
    this.name = name;
  }
}

function isValidColour(col) {
  // Thanks SO: https://stackoverflow.com/users/418150/leegee
  var s = new Option().style;
  s.color = col;
  return s.color !== '';
}

$(function () {
  const emoji = new Emoji();
  // I'm usig localStorage instead of cookies because its better apparently idk
  let my = new User('json', localStorage.getItem('user'));
  const socket = io({ query: my });
  let lastMessage = {};
  let connectedUsers = [];
  let currentlyScrolling = false;

  function changeName(name) {
    if (typeof name !== 'string') return false;
    if (name.trim() === '') return false;

    $('#my-name').val(name);
    localStorage.setItem('username', my.name = name);
    socket.emit('user changes', {id: my.id, name});

    $('#settings').hide();
    return true;
  }

  function changeColour(colour) {
    if (typeof colour !== 'string') return false;
    if (!isValidColour(colour)) return false;

    $('#my-colour').val(colour);
    localStorage.setItem('usercolour', my.colour = colour);
    socket.emit('user changes', {id: my.id, colour});

    $('#settings').hide();
    return true;
  }

  function command(msg) {
    const [cmd, ...args] = msg.split(/\s+/);
    switch (cmd.toLowerCase()) {
      case "color":
      case "colour":
        return args.length == 1 && changeColour(args[0]);
      case 'name':
        return changeName(args.join(' '));

      case 'reload':
        socket.emit('request refresh all', args.join(' '));
        return true;
      default:
        return false;
    }
  }

  function renderUsers() {
    $('.users').html('');
    $('.users').append(connectedUsers.map( u => {
      console.log('add user', u);
      let [f, s] = u.name.split(/\s+/, 2);
      const isoFL = s => !s || s.length < 2 ? s || '' : `${s.substring(0,1).toUpperCase()}<span>${s.substring(1)}&nbsp;</span>`;
      let me = u.id === my.id;
      return $(`<button title="${u.name}${me ? ' (me)': ''}" ${me ? 'class="me"' : ''}>`)
        .css('background-color', u.colour)
        .append($('<h4>').html(isoFL(f) + isoFL(s) + (me ? ' <span>(me)</span>' : '')));
    }));
  }

  function scrollToBottom() {
    currentlyScrolling = true;
    $("#new-messages").hide();
    $("#messages").stop();
    $("#messages").animate({ scrollTop: $("#messages").prop("scrollHeight") }, 700, 'swing', ()=>currentlyScrolling=false);
  }

  $('form').submit(function(e) {
    e.preventDefault(); // prevents page reloading
    const msg = $('#m').val();
    if (msg === '') return;
    if (msg.startsWith('/')) {
      if (command(msg.substring(1)))
        $('#m').val('');
      else
        $('#m').addClass('error');
      return;
    }

    socket.emit('chat message', {from: my.id, name: my.name, msg});
    $('#m').val('');
    return false;
  });

  //$('#settings').hide();
  $('#settings-btn').click(e => $('#settings').toggle());
  $('#change-name').click(() => {
    changeName($('#my-name').val());
    changeColour($('#my-colour').val());
  });

  $("#new-messages").hide();
  $("#scroll-to-bottom").click(scrollToBottom);

  $('#m').keypress(e => {
    $('#m').removeClass('error');
    e.target.value = emoji.emojify(e.target.value)
  });


  const onMessage = obj => {
    const { effect, from: id, time, msg } = obj;
    let { name, colour } = obj;
    let emojis = emoji.only(msg), sent = id === my.id, ind;
    let c = ` ${effect || ''} ${sent ? 'sent' : ''} ${emojis ? 'emojis' : ''}`;
    if ((ind = connectedUsers.findIndex(u => u.id === id)) !== -1) {
      let u = connectedUsers[ind];
      [name, colour] = [u.name, u.colour];
    }
    const distfrombot = $("#messages").prop("scrollHeight") - $("#messages").scrollTop() - $("#messages").prop("offsetHeight");

    if (!sent && (!lastMessage || lastMessage.from !== id))
      $('#messages').append($(`<span class="name${c}" data-from="${id}">`).text(name).css('color', colour));
    $('#messages').append($(`<li class="${c}">`).html(emojis ? msg.replace(/\s+/g, '') : msg));
    $('#messages').append($(`<span class="time${c}">`).text(time));
    lastMessage = obj;

    if ( !currentlyScrolling && distfrombot > 150) // ask first
      $("#new-messages").show();
    else 
      scrollToBottom();
    
  }

  socket.on('startup', ({usr, history, connectedUsers: users}) => {
    console.log('startup with usr ', usr, users);
    localStorage.setItem('user', JSON.stringify(my = usr));
    connectedUsers = users;

    $('#my-name').val(my.name);
    $('#my-colour').val(my.colour);
    $('#messages').html('');
    history.forEach(m => onMessage(m));
    renderUsers();
    currentlyScrolling = true;
    $("#messages").stop();
    $("#messages").animate({ scrollTop: $("#messages").prop("scrollHeight") }, 700, 'swing', ()=>currentlyScrolling=false);
  });

  socket.on('user list', ({usr, action}) => {
    console.log('user change', connectedUsers)
    const ind = connectedUsers.findIndex(u => usr.id === u.id);
    switch (action) {
      case 'disconnect':
        if (ind)
          connectedUsers.splice(ind, 1);
        break;
      case 'update':
        $(`[data-from=${usr.id}]`).text(usr.name).css('color', usr.colour);
      case 'connect':
        if (ind !== -1)
          connectedUsers[ind] = usr;
        else
          connectedUsers.push(usr);
    }
    console.log(connectedUsers)
    renderUsers();
  });

  socket.on('refresh all', () => location.reload())

  socket.on('chat message', onMessage);
  if (my.name) $('#settings').hide();
});
