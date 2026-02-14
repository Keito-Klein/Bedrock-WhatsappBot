const WebSocket = require('ws');
const { sock } = require('./index.js'); // Import the client from index.js
const { spawn } = require('child_process');
const { exitCode } = require('process');
const fs = require('fs');
const DB = require('./db/storeDB.js');
const setting  = require('./setting.js');

const avoidText = [
  "Running AutoCompaction",
  "Player disconnected",
  "Scripting Error",
  "TypeError",
  "Error",
  "[Json]"
]
const TIME_ACCUMULATION = './db/play_time.json';
const TOTAL_PLAYERS = './db/players.json';

let baileys;
let retryCount = 0;
const maxRetries = 5;
let reconnectDelay = 15000; // 15 seconds
let playerTime = {};

// Load existing play time data if available
if (fs.existsSync(TIME_ACCUMULATION)) {
    const playerData = fs.readFileSync(TIME_ACCUMULATION, "utf-8");
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

async function connectBaileys() {
    if (!baileys) {
        baileys = await sock();
    }
    return baileys;
}

async function startServer() {

const client = await connectBaileys();
global.ws = new WebSocket(`ws://${setting.minecraft.HOST}:${setting.minecraft.PORT}`);
    
global.ws.on("open", () => {
    console.log("Client connected to Minecraft server!");
    setTimeout(() => {
        client.sendText(setting.minecraft.announceChat, "Client connected to Minecraft server!");
    }, 3000)
    reconnectDelay = 15000;
    retryCount = 0;
})

global.ws.on("message", async(message) => {
    if(avoidText.some(text => message.toString().includes(text))) return;
    console.log(`Received from server: ${message.toString().trim()}`);
    let cleanText = message.toString().replace(/\[[^\]]*\]\s*/g, "").trim();
    // Forward message to the client
    if(message.toString().includes("[CHAT]")) {
        cleanText = cleanText.replace(/^([^:]+):/, "*$1*:");
        await client.sendText(setting.minecraft.conversationChat, cleanText)
    } else if (message.toString().includes("[LOGOUT]")) {
        const [_, player, duration] = cleanText.match(/(.+) : (\d+)/);
        const sec = parseInt(duration, 10);
        if (!playerTime[player]) playerTime[player] = 0;
        let beforePlay = playerTime[player];
        playerTime[player] += sec;
        fs.writeFileSync(TIME_ACCUMULATION, JSON.stringify(playerTime, null, 2));
        textTemplate = `*${player}* logged out.\nSession Duration: *${timeFormat(sec)}*.\nTotal Play Time: *${timeFormat(playerTime[player])}*\n(Before: *${timeFormat(beforePlay)}*)`;
        
        await client.sendText(setting.minecraft.announceChat, textTemplate);
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

    }*/ else {
        await client.sendText(setting.minecraft.announceChat, cleanText);
    }
})

global.ws.on("close", async() => {
    console.log("Disconnected from server.");
    if (retryCount < maxRetries) {
        console.log(`Attempting to reconnect in ${reconnectDelay/1000}s... (${retryCount}/${maxRetries})`);
        setTimeout(startServer, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 60000); // Exponential backoff up to 1 minute
        retryCount++;
    } else {
        console.log("❌ WS failed to reconnect after 5 attempts.");
        await client.sendText(setting.minecraft.announceChat,
        "Client failed to reconnect to Minecraft Server after 5 attempts (4 minute). Bot wil shutting down."
    );
        exitCode = spawn('pm2', ['stop', 'vertibus']);
        exitCode.on('close', (code) => {
            console.log(`pm2 process exited with code ${code}`);
            process.exit(0); // Exit the process after max retries
        });
    }

})

global.ws.on("error", (error) => {
    console.error("WebSocket error:", error);
});

setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.ping() // traffic kecil
  }
}, 30000)
}

async function start() {
    await connectBaileys(); // connect baileys sekali
    startServer();          // jalankan ws auto reconnect
}

start()