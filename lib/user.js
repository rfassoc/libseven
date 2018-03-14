const {request, UseCached} = require('./request.js');
const getToken = require('./twitter.js');

const userCache = new Map();
const UPDATE_DELAY = 30 * 60 * 1000;

class User {
  constructor(twitterId) {
    this.twitterId = twitterId;
    this._cache = {};
    this._updateTime = -1;
  }

  update(data) {
    if (data) {
      this._cache = data;
      this._updateTime = Date.now();
    }
    return this;
  }

  async queryUpdate() {
    try {
      this.update(await request.get(`https://api.twitter.com/1.1/users/show?user_id=${this.twitterId}`, {
        json: true,
        auth: {bearer: await getToken()},
      }));
    } catch (e) {
      if (e instanceof UseCached) {
        this._updateTime = Date.now();
      } else {
        throw e;
      }
    }
  }

  async getData() {
    if (Date.now() - this._updateTime > UPDATE_DELAY) {
      await this.queryUpdate();
    }
    return this._cache;
  }

  static getOrCreate(id, data) {
    let user = userCache.get(id);
    if (!user) userCache.set(id, user = new User(id));
    return user.update(data);
  }
}

User.serialization = {
  serialize(user) {
    return user.twitterId;
  },
  deserialize(id) {
    return User.getOrCreate(id);
  },
};

module.exports = User;