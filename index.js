const {Floof, FloofBall, Floop, redirect} = require('floof');
const PassportPlugin = require('floof-passport');
const SessionPlugin = require('floof-session');
const TwitterStrategy = require('passport-twitter');
const parseUrl = require('url').parse;

const {warns, parseScript, Chatroom} = require('./lib/chatroom.js');
const Db = require('./lib/database.js');
const {logs, LogLevel} = require('./lib/logs.js');
const User = require('./lib/user.js');

let debugMode = false;

const app = new FloofBall();
app.plugin(new SessionPlugin(process.env.CLIENT_SECRET));
app.plugin(new PassportPlugin(true, User.serialization)
  .use(new TwitterStrategy({
    consumerKey: process.env.TWITTER_KEY,
    consumerSecret: process.env.TWITTER_SECRET,
    callbackURL: `${process.env.BASE_URL}/authcb`,
  }, (token, tokenSecret, profile, cb) => {
    cb(null, User.getOrCreate(profile.id, profile._json));
  })));

app.context({search: null, warns: Object.keys(warns).sort().map(k => warns[k])});
app.before().exec(async req => {
  req.flashes = req.session.flashes || [];
  req.session.flashes = [];
  req.cameFrom = req.session.cameFrom || '/';
  req.session.cameFrom = '/';
  req.flash = str => req.session.flashes.push(str);
  if (req.user) {
    req.profile = await req.user.getData();
    req.privatePredicate = `AND(private, author != "${req.user.twitterId}")`;
  } else {
    req.privatePredicate = 'private';
  }
});
const crossOriginUrl = (u => `${u.protocol}//${u.host}`)(parseUrl(process.env.MM_URL));
app.after().exec(async (req, res) => {
  if (req.allowCrossOrigin) {
    res.header('Access-Control-Allow-Origin', crossOriginUrl);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
});

app.get('/').exec(async (req, ren) => {
  const chatrooms = await new Promise((res, rej) => {
    Db.chatrooms.select({
      filterByFormula: `NOT(${req.privatePredicate})`,
      maxRecords: 5,
      pageSize: 5,
      sort: [{field: 'timestamp', direction: 'desc'}],
    }).eachPage((recs, next) => {
      res(recs);
    }, err => {
      if (err) rej(err);
    });
  });
  return await ren.render('home.html', {chats: await Chatroom.wrapAll(chatrooms)});
});

app.get('/login').exec(async (req, ren) => {
  req.session.cameFrom = req.header('referer') || '/';
  const result = await req.authenticate('twitter');
  if (result.status === 'redirect') return result.redirect;
  throw new Floop(500);
});

app.get('/authcb').exec(async (req, ren) => {
  const result = await req.authenticate('twitter');
  if (result.status !== 'success') {
    req.flash('login failed. please try again...');
  } else {
    req.flash('logged in.');
  }
  return redirect(req.cameFrom);
});

app.get('/logout').exec(async (req, ren) => {
  await req.logout();
  req.flash('logged out.');
  return redirect(req.header('referer') || '/');
});

async function renderList(ren, template, page, ctx, query) {
  if (page < 0) throw new Floop(400, 'invalid page');
  const length = (page + 1) * 10;
  let pageCount = Math.ceil(length / 100);
  const pageSize = Math.ceil(length / pageCount);
  let retrieved = 0;
  const lookup = await new Promise((res, rej) => {
    let records, done = false;
    Db.chatrooms.select({
      ...query,
      sort: [{field: 'timestamp', direction: 'desc'}],
      pageSize: pageSize,
      maxRecords: length + 1,
    }).eachPage((recs, next) => {
      if (done) {
        res({chatrooms: records, more: true});
      } else {
        if (--pageCount > 0) {
          retrieved += recs.length;
        } else {
          retrieved = retrieved + recs.length;
          if (Math.ceil(retrieved / 10) - 1 < page) {
            res(null);
            return;
          } else {
            records = recs.slice(recs.length - ((retrieved % 10) || 10));
            done = true;
          }
        }
        next();
      }
    }, err => {
      if (err) {
        rej(err);
      } else if (done) {
        res({chatrooms: records, more: false});
      } else {
        res(null);
      }
    });
  });
  if (!lookup) throw new Floop(400, 'invalid page');
  return ren.render(template, {
    ...ctx, page, more: lookup.more,
    chats: await Chatroom.wrapAll(lookup.chatrooms),
  });
}

app.get('/browse').withQuery('p', 'int').exec(async (req, ren) => {
  return await renderList(ren, 'browse.html', req.p || 0, null, {
    filterByFormula: `NOT(${req.privatePredicate})`,
  });
});

app.get('/search').withQuery('q', 'str').withQuery('p', 'int').exec(async (req, ren) => {
  if (!req.q) throw new Floop(400, 'no search query');
  req.q = decodeURIComponent(req.q.replace(/\+/g, ' '));
  const sanitized = req.q.replace(/[^\w\s]/gi, '').toLowerCase();
  return await renderList(ren, 'search.html', req.p || 0, {search: req.q}, {
    filterByFormula: `NOT(OR(SEARCH("${sanitized}", clean_name) = BLANK(), ${req.privatePredicate}))`,
  });
});

app.get('/profile/:tid').withQuery('p', 'int').exec(async (req, ren) => {
  if (!req.tid) throw new Floop(400, 'no user specified');
  const user = User.getOrCreate(req.tid);
  let profile;
  try {
    profile = await user.getData();
  } catch (e) {
    throw new Floop(404, 'user not found');
  }
  const predicate = (req.user && req.user.twitterId === user.twitterId)
    ? `author = "${user.twitterId}"`
    : `AND(author = "${user.twitterId}", NOT(private))`;
  return await renderList(ren, 'profile.html', req.p || 0, {profile: profile}, {
    filterByFormula: predicate,
  });
});

app.get('/chat/:id').exec(async (req, ren) => {
  if (!req.id) throw new Floop(400, 'no chatroom specified');
  const rec = await Db.chatrooms.find(req.id);
  if (!rec) throw new Floop(404, 'chatroom not found');
  const chat = await Chatroom.load(rec).withProfile();
  return ren.render('chat.html', {
    chat,
    isOwner: req.user && req.user.twitterId === chat.author.twitterId,
  });
});

app.get('/chat/:id/play').exec(async (req, ren) => {
  if (!req.id) throw new Floop(400, 'no chatroom specified');
  const rec = await Db.chatrooms.find(req.id);
  if (!rec) throw new Floop(404, 'chatroom not found');
  return redirect(`${process.env.MM_URL}/?type=direct\
&url=${process.env.BASE_URL}/chat/${rec.id}/retrieve\
&redir=${process.env.BASE_URL}/chat/${req.id}`);
});

app.get('/chat/:id/retrieve').exec(async (req, ren) => {
  if (!req.id) throw new Floop(400, 'no chatroom specified');
  const rec = await Db.chatrooms.find(req.id);
  if (!rec) throw new Floop(404, 'chatroom not found');
  req.allowCrossOrigin = true;
  if (req.user) {
    return Chatroom.load(rec)
      .getMutatedScript(req.profile.name, req.profile.profile_image_url.replace('_normal', '_bigger'));
  }
  return rec.get('body');
});

app.post('/chat/:id/delete').exec(async (req, ren) => {
  if (!req.user) throw new Floop(401);
  if (!req.id) throw new Floop(400, 'no chatroom specified');
  const rec = await Db.chatrooms.find(req.id);
  if (!rec) throw new Floop(404, 'chatroom not found');
  if (req.user.twitterId !== rec.get('author')) throw new Floop(403);
  await Db.chatrooms.destroy(rec.id);
  req.flash(`deleted "${rec.get('name')}".`);
  return redirect('/');
});

app.post('/chat/:id/report').withBody('json').exec(async (req, ren) => {
  const body = await req.body();
  if (!body.reason) throw new Floop(400, 'no reason');
  if (!req.id) throw new Floop(400, 'no chatroom specified');
  const rec = await Db.chatrooms.find(req.id);
  if (!rec) throw new Floop(404, 'chatroom not found');
  await Db.reports.create({
    'chatroom_id': rec.id,
    'chatroom': `${rec.get('author')}/${rec.get('name')}`,
    'reason': body.reason,
    'ip': req.backing.connection.remoteAddress,
  });
});

app.get('/new').exec(async (req, ren) => {
  if (!req.user) return redirect('/login');
  return ren.render('editor.html', {chat: Chatroom.blank, edit: false});
});

app.get('/chat/:id/edit').exec(async (req, ren) => {
  if (!req.user) if (!req.user) return redirect('/login');
  if (!req.id) throw new Floop(400, 'no chatroom specified');
  const rec = await Db.chatrooms.find(req.id);
  if (!rec) throw new Floop(404, 'chatroom not found');
  if (req.user.twitterId !== rec.get('author')) throw new Floop(403);
  const chat = Chatroom.load(rec);
  return ren.render('editor.html', {chat, edit: true});
});

function validateScript(body) {
  try {
    parseScript(body);
    return true;
  } catch (e) {
    return false;
  }
}

function validate(body) {
  if (!body.name || body.name.length > 32) throw new Floop(400, 'invalid name');
  if (!body.body || !validateScript(body.body)) throw new Floop(400, 'invalid script');
}

app.post('/new').withBody('form').exec(async (req, ren) => {
  if (!req.user) throw new Floop(401);
  const body = await req.body();
  validate(body);
  const warnings = Object.keys(warns)
    .filter(w => body.hasOwnProperty(`warn-${w}`));
  const rec = await Db.chatrooms.create({
    'name': body.name,
    'author': req.user.twitterId,
    'clean_name': body.name.replace(/[^\w\s]/gi, '').toLowerCase(),
    'body': body.body,
    'private': !!body.isprivate,
    'warnings': warnings,
  });
  req.flash(`created "${body.name}".`);
  return redirect(`/chat/${rec.id}`);
});

app.post('/chat/:id/edit').withBody('form').exec(async (req, ren) => {
  if (!req.user) throw new Floop(401);
  if (!req.id) throw new Floop(400, 'no chatroom specified');
  const rec = await Db.chatrooms.find(req.id);
  if (!rec) throw new Floop(404, 'chatroom not found');
  if (req.user.twitterId !== rec.get('author')) throw new Floop(403);
  const body = await req.body();
  validate(body);
  const warnings = Object.keys(warns)
    .filter(w => body.hasOwnProperty(`warn-${w}`));
  await Db.chatrooms.update(rec.id, {
    'name': body.name,
    'author': req.user.twitterId,
    'clean_name': body.name.replace(/[^\w\s]/gi, '').toLowerCase(),
    'body': body.body,
    'private': !!body.isprivate,
    'warnings': warnings,
  });
  req.flash(`edited "${body.name}".`);
  return redirect(`/chat/${req.id}`);
});

app.error().forCodes(400, 600).exec((req, msg, ren) => ren.render('error.html', {code: req.code, msg}));

(async function() {
  const server = new Floof().ball(app);
  if (process.env.DEBUG === 'true') {
    debugMode = true;
    logs.setLevel(LogLevel.TRACE);
    logs.debug('Debug mode enabled!');
    const watcher = require('chokidar').watch('templates', {disableGlobbing: true});
    function recompile(fn) {
      setTimeout(function() {
        server.renderer.recompile();
      }, 250);
    }
    watcher.on('ready', function() {
      watcher.on('change', recompile).on('add', recompile).on('unlink', recompile);
    });
  }
  server.error().exec(async (req, ren) => await req.delegateError(app));
  await server.go();
  logs.info('Server started.');
})();