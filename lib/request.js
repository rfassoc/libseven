const request = require('request');

class Requester {
  constructor() {
    this.resetTime = -1;
    this.limited = false;
  }

  async get(...args) {
    return await this._timedCall(request.get, args);
  }

  async post(...args) {
    return await this._timedCall(request.post, args);
  }

  async _timedCall(method, args) {
    if (this.limited) {
      if (Date.now() > this.resetTime) {
        this.limited = false;
      } else {
        throw new UseCached();
      }
    }
    return new Promise((resolve, rej) => {
      method.call(request, ...args, function(err, res, body) {
        if (res && res.headers['X-RateLimit-Reset']) {
          this.resetTime = 1000 * parseInt(res.headers['X-RateLimit-Reset'], 10);
          this.limited = res.headers['X-RateLimit-Remaining'] === '0';
        }
        if (err) {
          rej(err);
        } else {
          resolve(body);
        }
      });
    });
  }
}

class UseCached extends Error {
  constructor() {
    super('Use the cached thing!');
  }
}

module.exports = {request: new Requester(), UseCached};