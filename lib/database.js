const Airtable = require('airtable');

class PromiseWrapper {
  constructor(table) {
    this._t = table;
  }

  select(...args) {
    return this._t.select(...args);
  }

  _execPromise(func, ...args) {
    return new Promise((res, rej) => {
      func.call(this._t, ...args, (err, rec) => {
        if (err) {
          rej(err);
        } else {
          res(rec);
        }
      });
    });
  }

  async find(id) {
    return await this._execPromise(this._t.find, id);
  }

  async create(data) {
    return await this._execPromise(this._t.create, data);
  }

  async update(id, data) {
    return await this._execPromise(this._t.update, id, data);
  }

  async destroy(id) {
    return await this._execPromise(this._t.destroy, id);
  }
}

Airtable.configure({apiKey: process.env.AIRTABLE_KEY});
const db = Airtable.base(process.env.AIRTABLE_DB);
function open(name) {
  return new PromiseWrapper(db(name));
}

module.exports = {chatrooms: open('chatrooms'), reports: open('reports')};