require("./server");
const fs = require("fs");
const os = require("os");
const chalk = require("chalk");
const axios = require("axios");
const path = require("path");
const speed = require("performance-now");
const moment = require("moment-timezone");
const { color } = require("./lib/color");
const { performance } = require("perf_hooks");
const ind = require("./language/ind");
const eng = require("./language/eng");
const setting = require("./setting");
const {
  formatp,
  runtime,
} = require("./lib/general-function");



//set your Timezone in tz()
var currentTime = moment().tz("Asia/Jakarta").format("HH:mm");

module.exports = core = async (client, m, chatUpdate) => {
  var body =
    (m.mtype === "conversation")
      ? m.message.conversation
      : (m.mtype == "imageMessage")
      ? m.message.imageMessage.caption
      : (m.mtype == "videoMessage")
      ? m.message.videoMessage.caption
      : (m.mtype == "extendedTextMessage")
      ? m.message.extendedTextMessage.text
      : (m.mtype == "buttonsResponseMessage")
      ? m.message.buttonsResponseMessage.selectedButtonId
      : (m.mtype == "listResponseMessage")
      ? m.message.listResponseMessage.singleSelectReply.selectedRowId
      : (m.mtype == "templateButtonReplyMessage")
      ? m.message.templateButtonReplyMessage.selectedId 
      : (m.mtype == 'interactiveResponseMessage') 
      ? JSON.parse(m.msg.nativeFlowResponseMessage.paramsJson).id 
      : (m.mtype == 'templateButtonReplyMessage') 
      ? m.msg.selectedId
      : (m.mtype === "messageContextInfo")
      ? (m.message.buttonsResponseMessage?.selectedButtonId ||
        m.message.listResponseMessage?.singleSelectReply.selectedRowId ||
        m.text)
      : "";
  const prefix = /^[\\/!#.]/gi.test(body) ? body.match(/^[\\/!#.]/gi) : "/";
  const command = body
    .replace(prefix, "")
    .trim()
    .split(/ +/)
    .shift()
    .toLowerCase();
  const isUrl = (url) => {
    return url.match(
      new RegExp(
        /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/,
        "gi"
      )
    );
  };
  const mik = m.quoted || m;
  const quoted =
    mik.mtype == "buttonsMessage"
      ? mik[Object.keys(mik)[1]]
      : mik.mtype == "templateMessage"
      ? mik.hydratedTemplate[Object.keys(mik.hydratedTemplate)[1]]
      : mik.mtype == "product"
      ? mik[Object.keys(mik)[0]]
      : m.quoted
      ? m.quoted
      : m;
  const args = body.trim().split(/ +/).slice(1);
  const isCmd = body.startsWith(prefix);
  const pushname = m.pushName || "No Name";
  const botNumber = await client.decodeJid(client.user.id);
  const itsMe = m.key.fromMe
  let text = (q = args.join(" "));
  const budy = typeof m.text == "string" ? m.text : "";
  const qms = quoted.msg || quoted;
  const mime = qms.mimetype || "";
  const mek = chatUpdate.messages[0];
  const content = JSON.stringify(m.message);
  const sender = m.isGroup ? m.key.fromMe ? m.sender : m.key.participant : m.sender;
  const from = m.chat;
  const reply = m.reply;

  //security
  const isGroup = m.isGroup;
  const groupMetadata = m.isGroup
    ? await client.groupMetadata(m.chat).catch((e) => {})
    : "";
  const getGroupAdmins = (participants) => {
    admins = [];
    for (let i of participants) {
      i.admin ? admins.push(i.jid) : "";
    }
    return admins;
  };
  const groupName = m.isGroup ? groupMetadata.subject : "";
  const groupId = m.isGroup ? groupMetadata.id : "";
  const groupMembers = m.isGroup ? groupMetadata.participants : "";
  const groupAdmins = m.isGroup ? getGroupAdmins(groupMembers) : "";
  const isOwner = setting.owner.includes(sender.split("@")[0]) || false;
  const botAdmin = groupAdmins.includes(botNumber) || false;
  const isGroupAdmins = groupAdmins.includes(sender) || false;

  //Media init
  const isMedia = m.mtype === "imageMessage" || m.mtype === "videoMessage";
  const isQuotedImage =
    m.mtype === "extendedTextMessage" && content.includes("imageMessage");
  const isQuotedSticker =
    m.mtype === "extendedTextMessage" && content.includes("stickerMessage");
  const isQuotedVideo =
    m.mtype === "extendedTextMessage" && content.includes("videoMessage");

  //Save every Message to JSON
  /*let infoMSG = JSON.parse(fs.readFileSync("./db/message.json"));
  infoMSG.push(JSON.parse(JSON.stringify(mek)));
  fs.writeFileSync("./db/message.json", JSON.stringify(infoMSG, null, 2));
  const amount_message = infoMSG.length;
  if (amount_message === 5000) {
    infoMSG.splice(0, 4300);
    fs.writeFileSync("./db/message.json", JSON.stringify(infoMSG, null, 2));
  }*/

      //Language
  senderType = m.isGroup ? groupMetadata.id : sender;
  user = global.db.user.findIndex((user) => user.id === senderType);
  if( global.db.user[user]?.language === "ind" ) {
    lang = ind;
    language = "ind";
  } else if (global.db.user[user]?.language === "eng") {
    lang = eng;
    language = "eng";
  } else {
    lang = ind; //default language
    language = "ind"; //default language
  }

  //Proccess
  const progress = (reaction) => {
    const reactions = {
      react: {
        text: reaction,
        key: m.key,
      },
    };
    client.sendMessage(from, reactions);
  };

  //auto read incoming message
  await client.readMessages([m.key]);

  if(isGroup && !setting.minecraft.groups.includes(groupMetadata.id)) return;

  //Send conversastion to Minecraft WebSocket
  if (global.ws && global.ws.readyState === global.ws.OPEN) {
    if(isGroup && groupMetadata.id == setting.minecraft.conversationChat && !itsMe) {
      if(budy) {
        textMessage = budy.replace(/[\r\n]+/g, " ");
        global.ws.send(`say §a${pushname} : ${textMessage}`);
      }
    }
  }

  //mongoDB Error Handler
  if (
    setting.mongoDB == true &&
    setting.mongoString === "Enter Your Connection String!!"
  ) {
    return console.log(
      color(
        "Be sure your connection mongoDB string is corrrect!!\nCheck it on setting.js Line : 13",
        "red"
      )
    );
  }

  //Message Detector
  if (!isCmd && !isGroup && !itsMe) {
    if (body && !isOwner) {
      template = `
      ${setting.botName} has new message
      Message ID: ${m.key.id}
      Sender: ${sender}
      Name: ${pushname}
      Text: ${body}`;
      client.sendText(setting.owner[0] + "@s.whatsapp.net", template);
    }

    //forward message replied by owner
    if (
      sender.includes(setting.owner[0]) &&
      m.quoted &&
      qms.text.includes(`${setting.botName} has new message`)
    ) {
      messageMatchID = qms.text.match(/Message ID: ([A-Z0-9]+)/);
      messageID = messageMatchID ? messageMatchID[1] : null;
      if (messageID === null) return;
      messageMatchSender = qms.text.match(/\d+@s\.whatsapp\.net/);
      messageSender = messageMatchSender ? messageMatchSender[0] : null;
      if (messageSender === null) return;
      for (let mess of global.store.messages[messageSender].array) {
        if (mess.match(messageID)) {
          quotedMessage = mess.message.extendedTextMessage;
          imgMessage = mess.message.imageMessage;
          vidMessage = mess.message.videoMessage;
          defaultMessage = mess.message.conversation;
          teksTemplate = `
        *Reply from owner*
        ${body}
        `;
          client.sendMessage(
            mess.key.remoteJid,
            { text: teksTemplate },
            { quoted: mess }
          );
        }
      }
    }
  }

  // ON/OFF BOT
  if (isCmd && m.isGroup) {
    if (!global.db.groups[groupMetadata.id]) {
      global.db.groups[groupMetadata.id] = {
        open : true,
     }
    }
    global.db.groups[groupMetadata.id].open ??= true;
    opened = global.db.groups[groupMetadata.id].open;
    if (!opened && !isGroupAdmins) return;
  }

  // Push Message To Console
  let argsLog = budy.length > 30 ? `${q.substring(0, 30)}...` : budy;

  if (isCmd && !isGroup) {
    console.log(
      chalk.black(chalk.bgWhite("[ LOGS ]")),
      color(argsLog, "turquoise"),
      chalk.magenta("From"),
      chalk.green(pushname),
      chalk.yellow(`[ ${sender.replace("@s.whatsapp.net", "")} ]`),
      chalk.black.bgYellow(`[ ${currentTime} ]`)
    );
  } else if (isCmd && m.isGroup) {
    console.log(
      chalk.black(chalk.bgWhite("[ LOGS ]")),
      color(argsLog, "turquoise"),
      chalk.magenta("From"),
      chalk.green(pushname),
      chalk.yellow(`[ ${sender.replace("@s.whatsapp.net", "")} ]`),
      chalk.blueBright("IN"),
      chalk.green(groupName),
      chalk.black.bgYellow(`[ ${currentTime} ]`)
    );
  }

  //Command Handler
  if (isCmd) {
    switch (command) {
      case "listonline":{
        global.ws.send("list");
      }
      break;
      
      case "mcprofile": {
        if(!q) return reply("Please enter player name or gamertag!");
        const req = await axios.get(`https://mcprofile.io/api/v1/bedrock/gamertag/${encodeURIComponent(text)}`)
        if(req.data.message) return reply(req.data.message);
        const data = req.data;
        const imgUrl = data.icon
        const textTemplate = `*Minecraft Profile*
- *Gamertag:* ${data.gamertag}
- *XUID:* ${data.xuid}
- *Floodgate ID:* ${data.floodgateuid}
- *Game Score:* ${data.gamescore}
- *Account Tier:* ${data.accounttier}
- *Texture ID:* ${data.textureid}
- "Skin:* ${data.skin}
`
        client.sendImage(from, imgUrl, textTemplate, mek)
      }
      break

      case "listplayer":{
        let data = JSON.parse(fs.readFileSync("./db/players.json"));
          if(data.length === 0) return reply("There's no player on server!")
          let textTemplate = `
List player on Minecraft Server (${data.length}):\n`
          for(let i = 0; i < data.length; i++) {
            textTemplate += `- ${data[i]}\n`
          }
          reply(textTemplate);
        }
      break;

      case "allowlist": {
        if (!isGroup) return reply(lang.onGroup());
        if (!isGroupAdmins) return reply(lang.onAdmin());
        if(!q) return reply("Please enter nametag!");
          const method = args[0].toLowerCase();
          const nametag = args.slice(1).join(" ");
          switch (method) {
            case "add":
              global.ws.send(`whitelist add ${nametag}`);
            break;
            case "remove":
            case "delete":
              global.ws.send(`whitelist remove ${nametag}`);
            break;
            case "list":
              global.ws.send(`whitelist list`);
            break;
            case "reload":
              global.ws.send(`whitelist reload`);
            break;
            case "on":
              global.ws.send(`whitelist on`);
            break;
            case "off":
              global.ws.send(`whitelist off`);
            break;
            default:
              reply("Method not found! Use add/remove/list/reload/on/off");
            break;
          }
      }

      /* ================ Group Menu ================ */
      case "metadata":
        if (!m.isGroup) return reply(lang.onGroup());
        timeUnix = (timeStamp) => {
          months = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ];
          date = new Date(timeStamp * 1000);
          year = date.getFullYear();
          month = months[date.getMonth()];
          day = date.getDate();
          hour = date.getHours();
          minute = date.getMinutes();
          second = date.getSeconds();
          time = `${day} ${month} ${year} ${hour}:${minute}:${second}`;
          return time;
        };
        infoGroup = `*- Group Metadata Info -*\n\n*Group ID:* ${
          groupMetadata.id
        }\n*Group Name:* ${groupName}\n*Name Since:* ${timeUnix(
          groupMetadata.subjectTime
        )}\n*Group Creation:* ${timeUnix(
          groupMetadata.creation
        )}\n*Owner Group:* ${
          groupMetadata.owner !== undefined
            ? client.getName(groupMetadata.owner)
            : "-"
        }\n*Members:* ${groupMetadata.size} member.\n*Join Approval:* ${
          groupMetadata.joinApprovalMode ? "Yes" : "No"
        }.\n*Member Add Mode:* ${
          groupMetadata.memberAddMode ? "Yes" : "No"
        }.\n*Antilink:* ${
          global.db.groups[groupMetadata.id]?.antilink ? "Yes" : "No"
        }\n*Antilinkgc:* ${
          global.db.groups[groupMetadata.id]?.antilinkgc ? "Yes" : "No"
        }.\n*Bot open:* ${
          global.db.groups[groupMetadata.id]?.open ? "Yes" : "No"
        }.\n*Language: ${language == "eng" ? "English" : "Indonesia"}*\n*Disappearing Message:* ${
          groupMetadata.ephemeralDuration !== undefined
            ? groupMetadata.ephemeralDuration / (24 * 60 * 60) + " Days"
            : "OFF"
        }.\n*Description:*\n${groupMetadata.desc}`;
        reply(infoGroup);
        break;

        case "welcome":
        if (!text) return reply("ON/OFF?");
        if (!m.isGroup) return reply(lang.onGroup());
        if (!isGroupAdmins) return reply(lang.onAdmin());
         if (text.toLowerCase() === "on") {
          if (global.db.groups[groupMetadata.id]?.welcome) return reply("Welcome already on!");
          if(!global.db.groups[groupMetadata.id]) {
            global.db.groups[groupMetadata.id] = { welcome: true };
          } else {
            global.db.groups[groupMetadata.id].welcome = true;
          }
          reply("Welcome message is now ON!");
         }
          if (text.toLowerCase() === "off") {
            if (!global.db.groups[groupMetadata.id]?.welcome) return reply("Welcome already off!");
            if(!global.db.groups[groupMetadata.id]) {
              global.db.groups[groupMetadata.id] = { welcome: false };
            } else {
              global.db.groups[groupMetadata.id].welcome = false;
            }
            reply("Welcome message is now OFF!");
          }
        break;


      /* ================ Other Menu ================ */
      case "owner":
        reply(lang.ownerContact());
        break;

      case "ping":
      case "botstatus":
      case "statusbot":
      case "info":
        const used = process.memoryUsage();
        const cpus = os.cpus().map((cpu) => {
          cpu.total = Object.keys(cpu.times).reduce(
            (last, type) => last + cpu.times[type],
            0
          );
          return cpu;
        });
        const cpu = cpus.reduce(
          (last, cpu, _, { length }) => {
            last.total += cpu.total;
            last.speed += cpu.speed / length;
            last.times.user += cpu.times.user;
            last.times.nice += cpu.times.nice;
            last.times.sys += cpu.times.sys;
            last.times.idle += cpu.times.idle;
            last.times.irq += cpu.times.irq;
            return last;
          },
          {
            speed: 0,
            total: 0,
            times: {
              user: 0,
              nice: 0,
              sys: 0,
              idle: 0,
              irq: 0,
            },
          }
        );
        let timestamp = speed();
        let latensi = speed() - timestamp;
        neww = performance.now();
        oldd = performance.now();
        bio = await client.fetchStatus(botNumber);
        respon = `
  - *${setting.botName}* -
  
  _*INFO*_
  *Name:* ${setting.botName}.
  *Bio:* ${bio[0].status.status}.
  *last update Bio:* ${moment
    .utc(bio[0].status.setAt)
    .tz("Asia/Jakarta")
    .format("YYYY-MM-DD HH:mm:ss")}.
  *Owner:* ${setting.ownerName}.
  *Contact:* wa.me/${setting.owner[0]}
  *Private Usage:* ${global.db.private_usage}.
  *Group Usage:* ${global.db.private_usage}.
  *Total usage:* ${global.db.private_usage + global.db.private_usage}.
  *Total user:* ${global.db.user.length}.
  
  Kecepatan Respon ${latensi.toFixed(4)} _Second_ \n ${
          oldd - neww
        } _miliseconds_\n\nRuntime : ${runtime(process.uptime())}
  
  💻 Info Server
  RAM: ${formatp(os.totalmem() - os.freemem())} / ${formatp(os.totalmem())}
  
  _NodeJS Memory Usage_
  ${Object.keys(used)
    .map(
      (key, _, arr) =>
        `${key.padEnd(Math.max(...arr.map((v) => v.length)), " ")}: ${formatp(
          used[key]
        )}`
    )
    .join("\n")}
  
  ${
    cpus[0]
      ? `_Total CPU Usage_
  ${cpus[0].model.trim()} (${cpu.speed} MHZ)\n${Object.keys(cpu.times)
          .map(
            (type) =>
              `- *${(type + "*").padEnd(6)}: ${(
                (100 * cpu.times[type]) /
                cpu.total
              ).toFixed(2)}%`
          )
          .join("\n")}
  _CPU Core(s) Usage (${cpus.length} Core CPU)_
  ${cpus
    .map(
      (cpu, i) =>
        `${i + 1}. ${cpu.model.trim()} (${cpu.speed} MHZ)\n${Object.keys(
          cpu.times
        )
          .map(
            (type) =>
              `- *${(type + "*").padEnd(6)}: ${(
                (100 * cpu.times[type]) /
                cpu.total
              ).toFixed(2)}%`
          )
          .join("\n")}`
    )
    .join("\n\n")}`
      : ""
  }
                  `.trim();
        reply(respon);

        break;

      /* ================ Other Menu ================ */

      /* ================ Owner Menu ================ */
      case "reset":
        {
          if (!isOwner) return reply(lang.owner());
          progress("⏳");
          allDB = global.db.user;
          for (let i = 0; i < allDB.length; i++) {
            allDB[i].latest = false;
          }
          progress("✔");
        }
        break;

      case "clear":
        if (!isOwner) return reply(lang.owner());
        fs.readdir("./tmp", (err, files) => {
          if (err) return console.error(err);
          reply("delete" + files.length + "files.");
          files.forEach((file, index) => {
            fs.unlink(path.join("./tmp", file), (err) => {
              if (err) console.error(err);
              console.log(`File ${file} deleted`);
            });
          });
          progress("✔");
        });
        break;

      default: {
        if (isCmd && budy.toLowerCase() != undefined) {
          if (m.chat.endsWith("broadcast")) return;
          if (m.isBaileys) return;
          if (!budy.toLowerCase()) return;
          if (argsLog || (isCmd && !isGroup)) {
            console.log(
              chalk.black(chalk.bgRed("[ ERROR ]")),
              color("command", "turquoise"),
              color(`${prefix}${command}`, "turquoise"),
              color("tidak tersedia", "turquoise")
            );
          } else if (argsLog || (isCmd && isGroup)) {
            console.log(
              chalk.black(chalk.bgRed("[ ERROR ]")),
              color("command", "turquoise"),
              color(`${prefix}${command}`, "turquoise"),
              color("tidak tersedia", "turquoise")
            );
          }
        }
      }
    }

    if (command !== "deleteuser") {
      //Push Database to DB
      if (user === -1) {
        obj = {
          id: senderType,
          language: "ind",
          latest: true,
          date: new Date(),
        };
        global.db.user.push(obj);
        reply(lang.update(pushname));
      } else if (!global.db.user[user].latest) {
        global.db.user[user].latest = true;
        reply(lang.update(pushname));
      }
      if (senderType.includes("s.whatsapp.net")) {
        global.db.private_usage++;
      }
      if (senderType.includes("g.us")) {
        global.db.group_usage++;
      }
    }
  }

  if (budy.startsWith(">")) {
    if (!isOwner) return;
    try {
      console.log("[eval] " + body);
      let evaled = await eval(budy.slice(2));
      if (typeof evalved !== "string") evaled = require("util").inspect(evaled);
      await m.reply(evaled);
    } catch (error) {
      await m.reply(String(error));
    }
  }
};

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});
