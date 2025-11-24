import {
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  getContentType,
  Browsers
} from "@whiskeysockets/baileys";
import moment from "moment-timezone";
import anyAscii from "any-ascii";
import Pino from "pino";
import util from "util";
import fs from "fs";

import { msgFilter, color } from "./lib/utils.js";
import bus from "./bridge.js";

import setting from "./setting.js";
moment.tz.setDefault("Asia/Jakarta").locale("id");

let msgHandler = async (upsert, sock, message) => {
  try {
    let { text } = message;
    // handle sender kosong
    if (message.sender === "") return;
    const t = message.messageTimestamp;
    const verifquoted = message.quoted ? true : false;
    const msg = verifquoted ? { message: message.quoted.message } : { message: message.message };
    let quotedMsg = message.quoted ? message.quoted : message;
    const groupMetadata = message.isGroup
    ? await sock.groupMetadata(message.chat)
    : {};
    const isGroup = message.isGroup;
    let sender = message.key.addressingMode === "pn" ? message.sender : message.key.remoteJidAlt;
    /*let infoMSG = JSON.parse(fs.readFileSync("./db/message.json"));
  infoMSG.push(JSON.parse(JSON.stringify(mek)));
  fs.writeFileSync("./db/message.json", JSON.stringify(infoMSG, null, 2));
  const amount_message = infoMSG.length;
  if (amount_message === 5000) {
    infoMSG.splice(0, 4300);
    fs.writeFileSync("./db/message.json", JSON.stringify(infoMSG, null, 2));
  }*/

    // LID
    let isGroupAdmins
    let isBotGroupAdmins
    if (isGroup) {
      if (message.key.addressingMode === "pn") {
        sender = message.sender;
      isGroupAdmins = groupMetadata.participants
        .filter((participant) => participant.admin)
        .map((participant) => participant.id)
        .includes(sender)
      isBotGroupAdmins = groupMetadata.participants
        .filter((participant) => participant.admin)
        .map((participant) => participant.id)
        .includes(sock.user.id)
      } else {
        sender = message.key.participantAlt
      isGroupAdmins = groupMetadata.participants
        .filter((participant) => participant.admin)
        .map((participant) => participant.phoneNumber)
        .includes(sender)
      isBotGroupAdmins = groupMetadata.participants
        .filter((participant) => participant.admin)
        .map((participant) => participant.phoneNumber)
        .includes(sock.user.id)
      }
    }
    // LID

    const groupName = isGroup ? groupMetadata.subject : "";
    const pushname = message.pushName || sender;
    const botNumber = sock.user.id;
    const itsMe = message.key.fromMe || sender === botNumber;
    if (!sender) return
    const ownerNumber = setting.owner + "@s.whatsapp.net";
    const isOwner = sender === ownerNumber;

    let budy = typeof message.text == 'string' ? message.text : ''
    const cmd = budy || "";

    let command;
    if (cmd.startsWith(". ") || cmd.startsWith("! ") || cmd.startsWith("# ") || cmd.startsWith("/ ")) {
      const parts = cmd.toLowerCase().split(" ");
      command = parts[0] + parts[1];
    } else {
      command = cmd.toLowerCase().split(" ")[0] || "";
    }
    command = anyAscii(command).toLowerCase()
    const prefix = /^[.#!]/.test(command) ? command.match(/^[.#!]/gi) : "/"; 
    const arg = budy.trim().substring(budy.indexOf(" ") + 1);
    let args;
    if (cmd.startsWith(". ") || cmd.startsWith("! ") || cmd.startsWith("# ") || cmd.startsWith("/ ")) {
      args = budy.trim().split(/ +/).slice(2);
    } else {
      args = budy.trim().split(/ +/).slice(1);
    }
    const string = args.slice().join(" ");
    const isCmd = budy.startsWith(prefix);
    const url = args.length !== 0 ? args[0] : "";
    const q = args.join(" ");
    const isImage = message.mtype === "image/jpeg" || message.mtype === "image/png";
    const isVideo = message.mtype === "video/mp4" || message.mtype === "image/gif";
    const isQuotedImage = quotedMsg && (quotedMsg.mtype === "image/jpeg" || quotedMsg.mtype === "image/png");
    const isQuotedVideo = quotedMsg && (quotedMsg.mtype === "video/mp4" || quotedMsg.mtype === "image/gif");
    const isQuotedVandI = quotedMsg && (quotedMsg.mtype === "video/mp4" || quotedMsg.mtype === "image/gif" || quotedMsg.mtype === "image/jpeg" || quotedMsg.mtype === "image/png");
    const isQuotedGif = quotedMsg && quotedMsg.mtype === "video/mp4";
    const isQuotedSticker = quotedMsg && quotedMsg.mtype === "image/webp";
    const isQuotedAudio = quotedMsg && (quotedMsg.mtype === "audio/mpeg" || quotedMsg.mtype === "audio/ogg; codecs=opus" || quotedMsg.mtype === "audio/mp4");
    const isQuotedAudioVn = quotedMsg && quotedMsg.mtype === "audio/mpeg";
    const isQuotedFile = quotedMsg && (quotedMsg.mtype === "video/mp4" || quotedMsg.mtype === "image/jpeg" || quotedMsg.mtype === "image/png");
    const isQuotedText = quotedMsg && quotedMsg.mtype === "conversation";
    const isQuotedpdf = quotedMsg && quotedMsg.mtype === "application/pdf";
    const stickerName = "Arkanee⚔";
    const stickerAuthor = "MiKako";

        if (isGroup) {
          const listBlocked = await sock.fetchBlocklist()
        const isBlocked = listBlocked.includes(sender)
        if (isBlocked) return; 
    }

    if (isCmd && msgFilter.isFiltered(message.chat) && !isGroup) {
      return console.log(color("[SPAM]", "red"), color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "yellow"), color(`${command} [${args.length}]`), "from", color(pushname));
    }
    if (isCmd && msgFilter.isFiltered(message.chat) && isGroup) {
      return console.log(color("[SPAM]", "red"), color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "yellow"), color(`${command} [${args.length}]`), "from", color(pushname), "in", color(groupName));
    }

     //Send conversation to Minecraft server
      if(isGroup && groupMetadata.id === setting.minecraft.conversationChat && !itsMe) {
        if (budy) {
          const chatMessage = budy.replace(/[\r\n]+/g, " ");
          bus.emit("wsSend", `say §a${pushname} : ${chatMessage}`);
        }
      } 

        if (budy.startsWith(">")) {
    if (!isOwner) return;
    try {
      console.log("[eval] " + budy.slice(2));
      let evaled = await eval(budy.slice(2));
      if (typeof evaled !== "string") {
        evaled = util.inspect(evaled);
      }
      await message.reply(evaled);
    } catch (error) {
      await message.reply(String(error));
    }
  }
     
    if (!isCmd && !isGroup) return;
    if (!isCmd && isGroup) return;
    if (isCmd && !isGroup) {
      console.log(color("[EXEC]"), color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "yellow"), color(`${command} [${args.length}]`), "from", color(pushname));
    }
    if (isCmd && isGroup) {
      console.log(color("[EXEC]"), color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "yellow"), color(`${command} [${args.length}]`), "from", color(pushname), "in", color(groupName));
    }
    
    await sock.readMessages([message.key]) // Auto read

   

    // fitur
  switch (command) {

        case prefix + "listonline":
          bus.emit("wsSend", "list");
        break
        
        case prefix + "listplayer":{
          let data = JSON.parse(fs.readFileSync("./db/players.json"));
          if(data.length === 0) return message.reply("There's no player on server!")
          let textTemplate = `
List player on Minecraft Server (${data.length}):\n`
          for(let i = 0; i < data.length; i++) {
            textTemplate += `- ${data[i]}\n`
          }
          message.reply(textTemplate);
        }
        break
        
        case prefix + "whitelist":
        case prefix + "allowlist":{
          if(!isGroup) return message.reply("Group only!");
          if(!isGroupAdmins) return message.reply("Admin only!");
          if(!q) return message.reply("Please enter nametag!");
          const method = args[0].toLowerCase();
          const nametag = args.slice(1).join(" ");
          switch (method) {
            case "add":
              bus.emit("wsSend", `whitelist add ${nametag}`);
            break;
            case "remove":
            case "delete":
              bus.emit("wsSend", `whitelist remove ${nametag}`);
            break;
            case "list":
              bus.emit("wsSend", "allowlist list");
            break;
            case "reload":
              bus.emit("wsSend", "allowlist reload");
            break;
            case "on":
              bus.emit("wsSend", "allowlist on");
            break;
            case "off":
              bus.emit("wsSend", "allowlist off");
            break;
            default:
              message.reply("Method not found! Use add/remove/list/reload/on/off");
            break;
          }
        }
          break;

/*========================== MiNECRAFT ====================================*/

/*========================== Other ====================================*/

case prefix + "groupinfo":{
  if(!isGroup) return message.reply("only on group!")
          const timeUnix = (timeStamp) => {
          let months = [
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
          let date = new Date(timeStamp * 1000);
          let year = date.getFullYear();
          let month = months[date.getMonth()];
          let day = date.getDate();
          let hour = date.getHours();
          let minute = date.getMinutes();
          let second = date.getSeconds();
          let time = `${day} ${month} ${year} ${hour}:${minute}:${second}`;
          return time;
        };
let infoGroup = `*- Group Metadata Info -*\n\n*Group ID:* ${
          groupMetadata.id
        }\n*Group Name:* ${groupName}\n*Name Since:* ${timeUnix(
          groupMetadata.subjectTime
        )}\n*Group Creation:* ${timeUnix(
          groupMetadata.creation
        )}\n*Owner Group:* ${
          groupMetadata.owner !== undefined
            ? groupMetadata.owner
            : "-"
        }\n*Members:* ${groupMetadata.size} member.\n*Join Approval:* ${
          groupMetadata.joinApprovalMode ? "Yes" : "No"
        }.\n*Member Add Mode:* ${
          groupMetadata.memberAddMode ? "Yes" : "No"
        }.\n*Disappearing Message:* ${
          groupMetadata.ephemeralDuration !== undefined
            ? groupMetadata.ephemeralDuration / (24 * 60 * 60) + " Days"
            : "OFF"
        }.\n*Description:*\n${groupMetadata.desc}`;
        message.reply(infoGroup);
}
break

    case prefix + "ping": case prefix + "test": case prefix + "tes":
      await message.reply(`Pong! 🏓\n\nSpeed: ${Date.now() - t * 1000} ms`);
      break;
      case prefix + "say":
    if (!q) return message.reply("Masukkan teks!");
    await message.reply(q);
    break;
        case prefix + "resend": // contoh fitur download video atau gambar
        if ((isImage || isQuotedImage) || (isVideo || isQuotedVideo)) {
          const type = Object.keys(quotedMsg.message || quotedMsg)[0];
            try {
          const buffer = await downloadMediaMessage(msg, "buffer", {}, { Pino, reuploadRequest: sock.updateMediaMessage });
          await sock.sendMessage(
            message.chat,
            { [type.includes("image") ? "image" : "video"]: buffer, caption: "*Success Resend*" },
            { quoted: message, ephemeralExpiration: message.contextInfo.expiration }
          );
          } catch (err) {
            console.log(err);
            message.reply("ada yang error!");
          }
        } else {
          message.reply(`Reply gambar atau video yang ingin diresend`);
        }
        break;

    default:


      if (isCmd) {
        console.log(color("[ERROR]", "red"), color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "yellow"), "Unregistered Command from", color(pushname));
      }
      break; 

      
  }
  } catch (err) {
    console.log(color("[ERROR]", "red"), err);
  }

};

export { msgHandler };
export default {
  msgHandler,
};
