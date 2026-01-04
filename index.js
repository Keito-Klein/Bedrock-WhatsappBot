process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import {
  makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  jidDecode,
  Browsers
} from "@whiskeysockets/baileys";
import Pino from "pino";
import { msgHandler as initialMsgHandler } from "./handler.js";
let msgHandler = initialMsgHandler;
import moment from "moment-timezone";
import "./handler.js";
moment.tz.setDefault("Asia/Jakarta").locale("id");
import chokidar from "chokidar";
import figlet from "figlet";
import NodeCache from "node-cache";
import readline from "readline";
import setting from "./setting.js";
import { Messages } from "./lib/Messages.js";
import { color } from "./lib/utils.js";
import bus from "./bridge.js";

// Baileys
const logger = Pino({
    level: "silent"
});
let phoneNumber = "6281226632293"
const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");
let sock = null;
let reconnecting = false;
let reconnectDelay= 3000
const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });
const msgRetryCounterCache = new NodeCache();
const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
};

 async function socket() {
  if(reconnecting) return;
  reconnecting = true;
  const { state, saveCreds } = await useMultiFileAuthState(`./session`);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
  console.log(
    color(
      figlet.textSync("Vertibus", {
        font: "Standard",
        horizontalLayout: "default",
        vertivalLayout: "default",
        whitespaceBreak: false,
      }),
      "green"
    )
  );

  sock = makeWASocket({
    version,
    browser: Browsers.iOS("Safari"), 
    printQRInTerminal: false,
    markOnlineOnConnect: true,
    msgRetryCounterCache,
    generateHighQualityLinkPreview: true,
    logger: Pino({ level: "silent" }),
    auth: state,
    getMessage: async (key) => {
			if (store) {
				const msg = await store.loadMessage(key.remoteJid, key.id)
				return msg.message || undefined
			}
    },
    cachedGroupMetadata: async (jid) => groupCache.get(jid),
  });

    if (pairingCode && !sock.authState.creds.registered) {
    if (useMobile) throw new Error('Cannot use pairing code with mobile api')
    const number = await askQuestion(
      "Enter your phone number in international format (e.g., 62xxxx): "
    );
    setTimeout(async() => {
      const code = await sock.requestPairingCode(number);
      console.log("🎁 Pairing Code: " + code);

    }, 3000)
  }

  sock.ev.process(async (ev) => {
    if (ev["connection.update"]) {
      const update = ev["connection.update"];
      const { connection, lastDisconnect } = update;

        if (connection === 'close') {
          bus.emit("baileysDisconnected")
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) scheduleReconnect();
            else console.log("Device Logged out, remove /session to re-login.");
        } else if (connection === 'open') {
            console.log(`session Connected: ${jidDecode(sock?.user?.id)?.user}`);
            sock.sendMessage(setting.minecraft.announceChat, { text: `🤖 Client connected to server!` });
            reconnecting = false;
            reconnectDelay= 3000
        }
    }
    if (ev["creds.update"]) {
      await saveCreds();
    }
    
    const upsert = ev["messages.upsert"];
if (upsert) {
  if (upsert.type !== "notify") return;
    const message = Messages(upsert, sock);
    if (message.key && message.key.remoteJid === "status@broadcast") return;
    if (message.key.fromMe) return
        if (!message) return;
            msgHandler(upsert, sock, message);
 }
 
 if (ev["call"]) {
  const call = ev["call"]
        let { id, chatId, isGroup } = call[0];
        if (isGroup) return;
        await sock.rejectCall(id, chatId);
        // await sleep(3000);
        // await sock.updateBlockStatus(chatId, "block"); // Block user
        await sock.sendMessage(
			chatId,
			{
				text: "Tidak bisa menerima panggilan suara/video.",
			},
			{ ephemeralExpiration: upsert?.messages[0].contextInfo?.expiration }
		);
    }
  });
    bus.on("wsDisconnected", () => {
        console.log("Baileys: closing because WS disconnected");
        try { sock?.end?.(); } catch {}
    });

    bus.on("wsMessage", (receiver, msg) => {
        if (sock.ws.readyState !== sock.ws.OPEN) {
            try {
                sock.sendMessage(receiver, { text: msg });
            } catch {
                console.log("Baileys: cannot send message (maybe reconnecting)");
            }
        }
    });

        //Send text message
  sock.sendText = (jid, text, quoted = "", options) =>
  sock.sendMessage(jid, { text: text, ...options }, { quoted });
  return sock;
}

export default socket;
// Baileys

function scheduleReconnect() {
    console.log(`Baileys: reconnecting in ${reconnectDelay / 1000}s...`);
    setTimeout(() => {
        reconnecting = false;
        reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
        socket();
    }, reconnectDelay);
}
// Watch for changes in ./handler/message/index.js
//const watchHandler = (client) => {
  const watcher = chokidar.watch('./handler.js', {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true
  });

  watcher.on('change', async (path) => {
    console.log(`File ${path} has been changed`);
    try {
      const newHandlerModule = await import(`./handler.js?cacheBust=${Date.now()}`);
      console.log("Updated handler module");
      msgHandler = newHandlerModule.msgHandler;
    } catch (err) {
      console.error("Error updating handler module:", err);
    }
  });
//};
