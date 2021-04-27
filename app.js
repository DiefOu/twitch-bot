const tmi = require("tmi.js");
const player = require("node-wav-player");
const fs = require("fs");
const OBSWebSocket = require("obs-websocket-js");
const { Translate } = require("@google-cloud/translate").v2;
const chen = require("./data/strings.js");

const opts = {
  options: {
    debug: true,
  },
  connection: {
    secure: true,
    reconnect: true,
  },
  identity: chen.botinfo,
  channels: ["diefou"],
};

const client = new tmi.client(opts);
const obs = new OBSWebSocket();
const translate = new Translate({
  projectId: chen.projectId,
  keyFilename: chen.keyFilename,
});

// Variables
let currentScene; // Stores what the current scene is
const pingthreshold = 1800000; // 30 min, in milliseconds
const replaycd = 60000; // the cooldown for the !replay command (60 seconds) so it doesn't get spammed
let lastmsgtime = 0; // first msg always pings, no matter how late into the stream
let lastreplaycmdtime = 0; // obviously the first time someone activates the instant replay it goes off
const enablereplay = false; // Flag for enabling/disabling replay feature
let languages; // place to store language lookup table, not a const because async await is shit

obs
  .connect(chen.obswebsocketinfo)
  .then(() => {
    console.log(`OBS Studio web sockets connected.`);
    obs.send("GetCurrentScene").then((data) => {
      currentScene = data.name;
    });
  })
  .catch((err) => {
    // Promise convention dicates you have a catch on every chain.
    console.log(err);
  });

// You must add this handler to avoid uncaught exceptions.
obs.on("error", (err) => {
  console.error("socket error:", err);
});

obs.on("SwitchScenes", (data) => {
  console.log(`New Active Scene: ${data.sceneName}`);
  currentScene = data.sceneName;
  if (currentScene === "INSTANT REPLAY") {
    lastreplaycmdtime = Date.now();
  }
});

// See if the msg sent is in English, according to the Google Translate API
async function detectLanguage(text) {
  let [detections] = await translate.detect(text);
  detections = Array.isArray(detections) ? detections : [detections];
  return detections;
}

// The actual translation engine
async function translateText(text) {
  let [translations] = await translate.translate(text, "en");
  translations = Array.isArray(translations) ? translations : [translations];
  return translations;
}

// Fetching the langauge list for looking up the full language name
async function listLanguages() {
  const [languages] = await translate.getLanguages();
  return languages;
}

client.on("message", async (channel, tags, message, self) => {
  if (self) return;

  const msg = (await detectLanguage(message))[0];
  let msgTranslated; // stores translated message
  let fullLanguage; // stores full name of language of original message
  console.log(msg);
  // Translate the message if it's pretty clear it is in another language.
  if (
    msg.language !== "en" &&
    msg.language !== "ja" &&
    msg.language !== "und" &&
    msg.confidence >= 0.75
  ) {
    // Finding the full name of the language from the shortened language code
    languages.forEach((language) => {
      if (language.code == msg.language) {
        fullLanguage = language.name;
      }
    });
    // Actually translates the text
    msgTranslated = (await translateText(msg.input))[0];
    client.say(
      channel,
      `Message translated by Google Translate from ${fullLanguage}: ${msgTranslated}`
    );
  }

  // Only send audio notif if its been longer than `pingthreshold` milliseconds since last msg
  if (
    tags["tmi-sent-ts"] - lastmsgtime >= pingthreshold &&
    !message.toLowerCase().startsWith("!")
  ) {
    // This should ping twice on bot commands...
    player
      .play({
        path: "./media/alert.wav",
      })
      .catch((error) => {
        console.error(error);
      });
  }
  lastmsgtime = tags["tmi-sent-ts"];

  // Write to a file if someone types in the command, which should indirectly trigger the instant replay feature.
  if (message.toLowerCase() === "!replay") {
    // Only do anything if the replay flag is set to true.
    if (!enablereplay) {
      client.say(
        channel,
        "The !replay command has been disabled until the streamer has a better computer or a 2 PC setup FeelsBadMan"
      );
    } else {
      if (currentScene === "INSTANT REPLAY") {
        // Tells the user that a replay is already playing if it is on the "INSTANT REPLAY" scene in OBS
        client.say(
          channel,
          `@${tags.username}, a replay is already playing FeelsWeirdMan`
        );
      } else if (currentScene !== "Fullscreen Game") {
        client.say(
          channel,
          `@${tags.username}, please use the command when the streamer is playing a game.`
        );
      } else if (tags["tmi-sent-ts"] - lastreplaycmdtime < replaycd) {
        // Tells chat to stop spamming the command if it has already been typed in chat once by anyone.
        client.say(
          channel,
          `Please wait ${
            (replaycd - (Date.now() - lastreplaycmdtime)) / 1000
          } seconds before the instant replay can be triggered again.`
        );
      } else {
        fs.appendFile(
          "canishowreplay.txt",
          "START INSTANT REPLAY\n",
          function (err) {
            if (err) return console.log(err);
            console.log("Instant replay should be playing rn"); // This should be an ack msg
          }
        );
        lastreplaycmdtime = tags["tmi-sent-ts"];
      }
    }
  }

  // Chat command to explain what this bot is
  if (message.toLowerCase() === "!bot") {
    client.say(channel, `I'm basically @Streamelements, but better YEP`);
  }

  // Example chat command
  /* if (message.toLowerCase() === "!hello") {
    client.say(channel, `@${tags.username}, Yo what's up`);
  } */
});

client.on("connected", async (address, port) => {
  console.log(`connected to ${address} and the port: ${port}`);
  // fetching the language list when the bot connects on start
  languages = await listLanguages().then((res) => {
    console.log("Google Translate language list successfully retrieved");
    return res;
  });
});

client.connect();
