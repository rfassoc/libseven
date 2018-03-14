const User = require('./user.js');

class Member {
  constructor(name, colour, avatar, heart = false, right = false) {
    this.name = name;
    this.lcname = name.toLowerCase();
    this.colour = `#${colour}`;
    this.avatar = `/static/img/avatar/${avatar}`;
    this.heart = `#${heart}`;
    this.right = right;
  }
}
const rfa = {
  seven: new Member('707', 'fff1f1', '707.png', 'fe2626'),
  jaehee: new Member('Jaehee Kang', 'fff5eb', 'jaehee.jpg', 'cfb742'),
  yoosung: new Member('Yoosung&#9733;', 'eefff4', 'yoosung.jpg', '31ff26'),
  hyun: new Member('ZEN', 'e5e5e5', 'zen.jpg', 'c9c9c9'),
  jumin: new Member('Jumin Han', 'f2fdfe', 'jumin.png', 'a59aed'),
  jihyun: new Member('V', 'c9fbf8', 'v.jpg', '50b3bd'),
  rika: new Member('Rika', 'fff6d7', 'question.jpg'),
  unknown: new Member('Unknown', 'f3e6fa', 'question.jpg'),
  saeran: new Member('Ray', 'f3e6fa', 'question.jpg', 'cc3a9f'),
};
for (const key of Object.keys(rfa)) rfa[key].key = key;
rfa.findMember = name => rfa[name] || Object.values(rfa).find(m => m.lcname === name);

class Warning {
  constructor(name, icon, desc) {
    this.name = name;
    this.icon = `/static/img/icon/${icon}.png`;
    this.desc = desc;
  }
}
const warns = {
  spoiler: new Warning('Spoiler', 'warn_spoiler', 'Involves spoilers for the game.'),
  abuse: new Warning('Abuse', 'warn_abuse', 'Involves abusive behaviour.'),
  injury: new Warning('Injury', 'warn_injury', 'Involves physical injury.'),
  death: new Warning('Death', 'warn_death', 'Involves a character\'s death.'),
  nsfw: new Warning('NSFW', 'warn_nsfw', 'Involves explicit content.'),
  lang: new Warning('Strong Language', 'warn_language', 'Involves the use of strong language.'),
};
for (const key of Object.keys(warns)) warns[key].key = key;

function parseScript(data) {
  const script = {
    mc: {name: 'MC', colour: 'ffffed', avatar: '/static/img/avatar/mc.jpg'},
    video: null,
    initialMembers: [],
    background: 'day',
  };
  data = data.split('\n');
  const sectionDelim = data.findIndex(l => l.trim() === '---');
  if (sectionDelim === -1) throw new Error('No script section');
  for (let i = 0; i < sectionDelim; i++) {
    const delim = data[i].indexOf(':');
    if (delim === -1) throw new Error('Meta line without delimiter');
    const value = data[i].substring(delim + 1).trim();
    switch (data[i].substring(0, delim).trim()) {
      case 'mc.name':
        script.mc.name = value;
        break;
      case 'mc.colour':
        script.mc.colour = value;
        break;
      case 'mc.avatar':
        script.mc.avatar = value;
        break;
      case 'video':
        script.video = value;
        break;
      case 'members':
        script.initialMembers = value.split(',').map(n => rfa.findMember(n.trim().toLowerCase()));
        break;
      case 'background':
        script.background = value;
        break;
    }
  }
  script.body = data.slice(sectionDelim + 1).join('\n');
  return script;
}

class Chatroom {
  constructor(rec, author) {
    this.id = rec.id;
    this.name = rec.get('name');
    this.cleanName = rec.get('clean_name');
    this.scriptText = rec.get('body');
    this.isPrivate = rec.get('private');
    this.warnings = rec.get('warnings');
    if (this.warnings) {
      this.warnings = this.warnings.sort().map(w => warns[w]);
    } else {
      this.warnings = [];
    }
    this.timestamp = new Date(rec.get('timestamp'));
    this.script = parseScript(this.scriptText);
    this.mc = this.script.mc;
    this.video = this.script.video;
    this.members = this.script.initialMembers;
    this.bg = this.script.background;
    this.author = author;
    this.authorProfile = null;
    this.url = `/chat/${this.id}`;
  }

  isWarningActive(key) {
    return this.warnings.some(w => w.key === key);
  }

  async withProfile() {
    this.authorProfile = await this.author.getData();
    return this;
  }

  getMutatedScript(name, avatar) {
    const lines = [
      `mc.name:${name || this.mc.name}`,
      `mc.colour:${this.mc.colour}`,
      `mc.avatar:${avatar || this.mc.avatar}`,
      `members:${this.members.map(m => m.key).join(',')}`,
      `background:${this.bg}`,
    ];
    if (this.script.video) lines.push(`video: ${this.video}`);
    return `${lines.join('\n')}\n---\n${this.script.body}`;
  }

  get jsonify() {
    return {
      'author': this.author.twitterId,
      'name': this.name,
      'clean_name': this.cleanName,
      'body': this.scriptText,
      'private': this.isPrivate,
      'warnings': this.warnings.map(w => w.key),
      'timestamp': this.timestamp.toISOString(),
    };
  }

  static load(rec) {
    return new Chatroom(rec, User.getOrCreate(rec.get('author')));
  }

  static wrapAll(chatrooms) {
    return Promise.all(chatrooms.map(async c => await Chatroom.load(c).withProfile()));
  }
}

Chatroom.blank = {
  name: '',
  scriptText: '',
  isPrivate: false,
  warnings: [],
  isWarningActive(key) {
    return false;
  },
};

module.exports = {rfa, warns, parseScript, Chatroom};