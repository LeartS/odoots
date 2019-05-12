# odoots

odoots is a typescript client for odoo's JSON-RCP API.

## Features

* Written in typescript, fully typed
* Supports both HTTP and HTTPS
* Works in nodejs and browsers (as long as they have builtin "fetch" support)
* Minimal set of dependencies

## Usage

### Initialize client
Create and initialize the client by providing the odoo host and the database
name to use.
```typescript
import * as odoots from 'tsodoo'

const odoo = new odoots('https://runbot.odoo.com', 'dbname')
```

### Login

Before calling model methods, you'll have to login using the credentials of
an internal odoo user.

```typescript
odoo.login('user', 'password').then(loggedUser => console.log(loggedUser))
```
The login method returns some data about the logged in user:
```javascript
{ uid: 2,
  partnerId: 3,
  sessionId: '0ab5c8817ca4c8bed0b6dff42606c27e3c3eee93',
  companyId: 1,
  name: 'Administrator',
  username: 'admin',
  isAdmin: true,
  isSuperuser: undefined,
  context: { lang: 'it_IT', tz: false, uid: 2 } }
```

### Call methods on odoo models

```typescript
odoo.call(model, method, args?, kwargs?, options?)
```

for example:

```typescript
odoo.call('res.users', 'search_read', [[[1, '=', 1]], ['name', 'login']])
```

returns a list of all users with the provided fields:

```javascript
[ { name: 'Administrator', login: 'admin', id: 2 } ]
```
(note that odoo' `search_read` always returns the `id` field)

Right now, the only option is `includeContext: boolean`.
If `true` (the default) the user context returned during login
is automatically added to the keyword arguments of the call. This is important
because the language and timezone values in the user context can change the
return values of a call, which become therefore context-dependant.