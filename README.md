# odoots

odoots is a typescript client for odoo's JSON-RCP API.

## Features

* Written in typescript, fully typed
* Supports both HTTP and HTTPS
* Works in nodejs and browsers (as long as they have builtin "fetch" support)
* Minimal set of dependencies

## Usage

```typescript
import * as odoots from 'tsodoo'

const odoo = new odoots('https://runbot.odoo.com', 'dbname')
odoo.login('user', 'password').then(loggedUser => console.log(loggedUser))
)
```