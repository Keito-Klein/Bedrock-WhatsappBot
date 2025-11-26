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
import qrcode from "qrcode-terminal"
import Pino from "pino";
import { msgHandler as initialMsgHandler } from "./handler.js";
let msgHandler = initialMsgHandler;
import moment from "moment-timezone";
import "./handler.js";
moment.tz.setDefault("Asia/Jakarta").locale("id");
import chokidar from "chokidar";
import figlet from "figlet";
import fs from "fs"
import NodeCache from "node-cache";
import readline from "readline";
import { Boom } from "@hapi/boom";
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
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(
            state.keys,
            Pino({ level: "fatal" }).child({ level: "fatal" })
        )
    },
     printQRInTerminal: !pairingCode,
     retryRequestDelayMs: 300,
     connectTimeoutMs: 60000,
     defaultQueryTimeoutMs: 0,
     maxMsgRetryCount: 15,
     version: version,
     logger: logger,  
     markOnlineOnConnect: true,
     syncFullHistory: false,
     msgRetryCounterCache,
     generateHighQualityLinkPreview: true,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
     cachedGroupMetadata: async (jid) => groupCache.get(jid),
     /*shouldSyncHistoryMessage: msg => {
			console.log(`\x1b[32mMemuat Chat [${msg.progress || 0}%]\x1b[39m`);
			return !!msg.syncType;		
    },*/
    transactionOpts: {
			maxCommitRetries: 10,
			delayBetweenTriesMs: 10,
		},
    appStateMacVerification: {
			patch: true,
			snapshot: true,
		},
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
      const status = lastDisconnect?.error?.output?.statusCode;
      // console.log(update.qr);
      if (update.qr) {
        qrcode.generate(update.qr, {small: true}, function (qrcode) {
          console.log(qrcode)
      });
    }

        if (connection === 'close') {
          let reason = new Boom(lastDisconnect?.error)?.output.statusCode;

          bus.emit("baileysDisconnected")
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
          if (shouldReconnect) scheduleReconnect()
          if (reason === DisconnectReason.badSession) {
            console.log(`Bad Session File, Please Scan Again`);
            fs.rmSync(`./session`, { recursive: true, force: true });
            process.exit();
          } else if (reason === DisconnectReason.connectionClosed) {
            console.log("Connection closed, reconnecting....");
          } else if (reason === DisconnectReason.connectionLost) {
            console.log("Connection Lost from Server, reconnecting...");
          } else if (reason === DisconnectReason.connectionReplaced) {
            console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First");
            process.exit();
          } else if (reason === DisconnectReason.loggedOut) {
            console.log(`Device Logged Out, Please Scan Again`);
            fs.rmSync(`./session`, { recursive: true, force: true });
            process.exit();
          } else if (reason === DisconnectReason.restartRequired) {
            console.log("Restart Required, Restarting...");
          } else if (reason === DisconnectReason.timedOut) {
            console.log("Connection TimedOut, Reconnecting...");
          } else {
            console.log(`Unknown DisconnectReason: ${reason}|${connection}`);
          }
        } else if (connection === 'open') {
            console.log(`session Connected: ${jidDecode(sock?.user?.id)?.user}`);
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
        if (sock?.user) {
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
