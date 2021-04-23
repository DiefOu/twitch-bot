const tmi = require("tmi.js");
const player = require("node-wav-player");
const fs = require("fs");
const OBSWebSocket = require("obs-websocket-js");

const opts = {
  options: {
    debug: true,
  },
  connection: {
    secure: true,
    reconnect: true,
  },
  identity: {
    username: "DiefOubot",
    password: "oauth:rk32p2hn1i9iq8pfcptnpol02oqex6",
  },
  channels: ["diefou"],
};

const client = new tmi.client(opts);
const obs = new OBSWebSocket();

let currentScene; // Stores what the current scene is
const pingthreshold = 1800000; // 30 min, in milliseconds
const replaycd = 60000; // the cooldown for the !replay command (60 seconds) so it doesn't get spammed
let lastmsgtime = 0; // first msg always pings, no matter how late into the stream
let lastreplaycmdtime = 0; // obviously the first time someone activates the instant replay it goes off

obs
  .connect({
    address: "localhost:4444",
  })
  .then(() => {
    console.log(`OBS Studio web sockets connected.`);
    obs.send("GetCurrentScene").then((data) => {
      currentScene = data.name;
      // console.log(data.name);
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
    // console.log(lastreplaycmdtime.toString());
  }
});

client.on("message", (channel, tags, message, self) => {
  if (self) return;

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
    /* if (tags["tmi-sent-ts"] - lastreplaycmdtime < replaycd) {
      // Tells chat to stop spamming the command if it has already been typed in chat once by anyone.
      client.say(
        channel,
        `Please wait ${
          (replaycd - (Date.now() - lastreplaycmdtime)) / 1000
        } seconds before the instant replay can be triggered again.`
      );
    } else if (currentScene === "INSTANT REPLAY") {
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
    } else { */
    if (currentScene !== "Fullscreen Game") {
      client.say(
        channel,
        `@${tags.username}, please use the command when the streamer is playing a game.`
      );
    } else if (currentScene === "INSTANT REPLAY") {
      // Tells the user that a replay is already playing if it is on the "INSTANT REPLAY" scene in OBS
      client.say(
        channel,
        `@${tags.username}, a replay is already playing FeelsWeirdMan`
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

  // Chat command to explain what this bot is
  if (message.toLowerCase() === "!bot") {
    client.say(channel, `I do things that @Streamelements can't YEP`);
  }

  // Example chat command
  /* if (message.toLowerCase() === "!hello") {
    client.say(channel, `@${tags.username}, Yo what's up`);
  } */
});

client.on("connected", (address, port) => {
  console.log(`connected to ${address} and the port: ${port}`);
});

client.connect();
