# AWS S3 session middleware for Telegraf

AWS S3 powered session middleware for [Telegraf](https://github.com/telegraf/telegraf).

## Prerequisites

1. You have made your AWS access and secret key available through a provided method, like storing them in the ~/.aws/credentials file or export them into environment variables
2. You need to install Node.js  with a minimum version of 8.9.0 

## Installation

```js
$ npm install telegraf-session-s3
```

## Example

```js
const Telegraf = require('telegraf');
const S3Session = require('telegraf-session-s3');

const bot = new Telegraf(process.env.BOT_TOKEN);

const s3Session = new S3Session({
    bucket: process.env.S3_STATES_BUCKET
});
bot.use(s3Session.middleware());

bot.on('text', (ctx) => {
  ctx.session.counter = ctx.session.counter || 0
  ctx.session.counter++
  console.log('Session', ctx.session)
})

bot.startPolling();
```

When you have stored the session key beforehand, you can access a
session without having access to a context object. This is useful when
you perform OAUTH or something similar, when a REDIRECT_URI is called
on your bot server.

```js
const s3Session = new S3Session({
    bucket: process.env.S3_STATES_BUCKET
});

// Retrieve session state by session key
s3Session.getSession(key)
  .then((session) => {
      console.log('Session state', session);
  });

// Save session state
s3Session.saveSession(key, session);
```

## API

### Options

* `bucket`: AWS S3 Bucket where session will be stored
* `property`: context property name (default: `session`)
* `getSessionKey`: session key resolver function `(ctx) => any`)

Default implementation of `getSessionKey`:

```js
function getSessionKey(ctx) {
  if (!ctx.from || !ctx.chat) {
    return
  }
  return `${ctx.from.id}:${ctx.chat.id}`
}
```

### Destroying a session

To destroy a session simply set it to `null`.

```js
bot.on('text', (ctx) => {
  ctx.session = null
})

```


### Acknowledgement
* [telegraf-session-redis](https://github.com/telegraf/telegraf-session-redis)