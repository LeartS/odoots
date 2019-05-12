# odoots

odoots is a typescript client for odoo's JSON-RCP API.

## Features (current and planned)

* Written in typescript, fully typed
* Supports both HTTP and HTTPS
* Works in nodejs and browsers (as long as they have builtin "fetch" support)
* Minimal set of dependencies
* Clean and documented code
* Promise-based API, no callbacks

## Current status

This library is very new, development started 11 May 2019.

Despite this, the library can be considered in beta state and should be
good and stable enough to use for non-critical stuff, like one-off scripts,
demos and such.

In the current version, only the general `call` method is implemented and
there are no convenience methods for CRUD operations and other common method
calls. These are in the roadmap, but they will just be for convience and
improved type-safety when using typescript.

Feature-wise, the current `call` already covers the entire
feature space as all operations, including `create`, `read`, `update` and
`delete` (`unlink` in odoo) can be executed via `call`.

## Installation

Install from NPM registry:

```sh
npm install odoots
```

If you intend to use it in nodejs, you must also install the optional
`node-fetch` dependency:

```sh
npm install odoots node-fetch
```

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

### Call odoo model methods

The main method provided by odoots. Using `call` you can call any python
method of the odoo models, both standard and custom ones.
The signature is quite self-explanatory:

```typescript
async call (
    model: string,
    method: string,
    args: any[] = [],
    kwargs: object = {},
    options: {includeContext: boolean} = {includeContext: true}
)
```

* `model` is the model to use
* `method` is the model's method to call
* `args?:` is the list of positional arguments, optional
* `kwargs?` is the object of keywoard arguments, optional
* `options?` is an optional object of call options, which are detailed below.

for example the odoo python call:

```python
employees = env['res.users'].search_read([('name', 'ilike', 'Ma%')], ['name', 'login'])
```

Can be executed remotely via JSON-RPC using odoots like this:

```typescript
odoo.call('res.users', 'search_read', [[['name', 'ilike', 'Ma%']], ['name', 'login']])
```

Which returns something like this:

```javascript
[ { name: 'Mark Twain', login: 'markt', id: 23 } ]
```
(note that odoo' `search_read` automatically adds `id` to the
list of fields to read)

#### Call options

The last parameter of the `call` method is an object of options.
Here are the currently implemented options and what they do:

* `includeContext: boolean = true`

  If `true` (the default) the user context returned during login
  is automatically added to the keyword arguments of the method call.
  In odoo, the context influences the output of several methods: for
  example, the context timezone influences the values of datetime fields,
  and the context language influences the values of translated text
  fields. Therefore, set this option to `false` only if you understand
  the consequences.