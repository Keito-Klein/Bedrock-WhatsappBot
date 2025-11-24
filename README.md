# Bedrock-WhatsappBot

Whatsapp bot with connection to [Websocket Minecraft Server](https://github.com/Keito-Klein/Bedrock-Socket) that i have made.

## Requirements

- Node.js v20 or latest
- Baileys v7.x.x or latest

## Install

```sh
git clone https://github.com/Keito-Klein/Bedrock-WhatsappBot
cd Bedrock-WhatsappBot
npm install
node start.js
```

## Confoguration

### Port
The port is not your minecraft server's port ex: `19132`

### Groups ID
to get your group id, just type `!groupinfo` in the group you want to see the ID for.

## example of use

### Send command to minecraft server

```js
bus.emit("wsSend", "...your command...");
```

### Whatsapp command
You just have to type the command. For example, to display the players who are online on the server.
***on script:***
```js
case prefix + "listonline":
    bus.emit("wsSend", "list");
break
```

<br>

***on whatsapp:***
`!listonline`
