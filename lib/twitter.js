const request = require('request');

const credentials = Buffer.from(`${process.env.TWITTER_KEY}:${process.env.TWITTER_SECRET}`).toString('base64');
let token = null;
async function getToken() {
  if (!token) {
    token = await new Promise((resolve, rej) => {
      request.post('https://api.twitter.com/oauth2/token?grant_type=client_credentials', {
        json: true,
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
        form: {
          'grant_type': 'client_credentials',
        },
      }, (err, res, body) => {
        if (err) {
          rej(err);
        } else {
          resolve(body.access_token);
        }
      });
    });
  }
  return token;
}

module.exports = getToken;