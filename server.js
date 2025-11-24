import WebSocket from "ws";
import fs from "fs";
import setting from "./setting.js";
import bus from "./bridge.js";

const avoidText = [
  "Running AutoCompaction",
  "Player disconnected",
  "Scripting Error",
  "TypeError",
  "Error",
];

const TIME_ACCUMULATION = "./db/play_time.json";
const TOTAL_PLAYERS = "./db/players.json";

let reconnecting = false;
let baileys;
let reconnectDelay = 2000; // 2 seconds
let playerTime = {};
let totalPlayers = []

// Load existing play time data if available
if (fs.existsSync(TIME_ACCUMULATION)) {
  let playerData = fs.readFileSync(TIME_ACCUMULATION, "utf-8");
  playerTime = JSON.parse(playerData);
}
if (fs.existsSync(TOTAL_PLAYERS)) {
    let playersData = fs.readFileSync(TOTAL_PLAYERS, "utf-8");
    totalPlayers = JSON.parse(playersData);
}

function timeFormat(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

async function startServer() {
 if (reconnecting) return;
 reconnecting = true;

  let ws = new WebSocket(`ws://${setting.minecraft.HOST}:${setting.minecraft.PORT}`);

  ws.on("open", () => {
    console.log("Client connected to Minecraft server!");
    
    reconnectDelay = 2000;
    reconnecting = false;
  });

  ws.on("message", async(message) => {
    if(avoidText.some(text => message.toString().includes(text))) return;
    console.log(`Received from server: ${message.toString().trim()}`);
    let textTemplate;
    let cleanText = message.toString().replace(/\[[^\]]*\]\s*/g, "").trim();
    // Forward message to the client
    if(message.toString().includes("[CHAT]")) {
        cleanText = cleanText.replace(/^([^:]+):/, "*$1*:");
        bus.emit("wsMessage", setting.minecraft.conversationChat, cleanText)
    } else if (message.toString().includes("[LOGOUT]")) {
        const [_, player, duration] = cleanText.match(/(.+) : (\d+)/);
        const sec = parseInt(duration, 10);
        if (!playerTime[player]) playerTime[player] = 0;
        let beforePlay = playerTime[player];
        playerTime[player] += sec;
        fs.writeFileSync(TIME_ACCUMULATION, JSON.stringify(playerTime, null, 2));
        textTemplate = `*${player}* logged out.\nSession Duration: *${timeFormat(sec)}*.\nTotal Play Time: *${timeFormat(playerTime[player])}*\n(Before: *${timeFormat(beforePlay)}*)`;
        bus.emit("wsMessage", setting.minecraft.announceChat, textTemplate)
        
    } else if (message.toString().includes("[LOGIN]")) {
        const [_, player, duration] = cleanText.match(/(.+) : (\d+)/);
        if (!totalPlayers.includes(player)) {
            totalPlayers.push(player);
            fs.writeFileSync(TOTAL_PLAYERS, JSON.stringify(totalPlayers, null, 2));
        }
    }/*else if (message.toString().includes("[PHONE]")) {
        const [_, player, phoneNumber, otp] = cleanText.match(/(.+?) : (\d{9,15}) : (\d+)/);
        metadata = global.db.groupMetadata["120363321807611707@g.us"];
        const isMember = metadata?.participants.some(participant => participant.jid.split("@")[0] === phoneNumber);
        if(!isMember) {
             return global.ws.send(`tellraw "${player}" {"rawtext": [{"text":"§cNomor tidak terdaftar di grup. Silakan gabung grup terlebih dahulu!"}]}`);
        }
        return global.ws.send(`tellraw "${player}" {"rawtext": [{"text":"§aNomor terverifikasi. Ingat cepat kode ini, OTP Code = ${otp}."}]}`);
        if (message.toString().includes("ECONNREFUSED")) return;

    }*/ else {
      
        bus.emit("wsMessage", setting.minecraft.announceChat, cleanText)
    }
})

ws.on("close", async() => {
    console.log("Disconnected from server.");
    bus.emit("wsDisconnected");
    scheduleReconnect();
})

bus.on("wsSend", (msg) => {
  if(!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(msg)
})

ws.on("error", (error) => {
    console.error("WebSocket error:", error);
});

bus.on("baileysDisconnected", () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
            console.log("WS Minecraft: closing because Baileys disconnected");
            ws.close();
        }
});
}

function scheduleReconnect() {
    console.log(`WS Minecraft: reconnecting in ${reconnectDelay / 1000}s...`);
    setTimeout(() => {
        reconnecting = false;
        // Tingkatkan delay tapi stop di 30 detik
        reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
        startServer();
    }, reconnectDelay);
}

export default startServer;
