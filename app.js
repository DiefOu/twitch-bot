const tmi = require("tmi.js");
const player = require("node-wav-player");
const fs = require("fs");

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
    password: "oauth:711266zyg0i93owuvzuc0x1ohovalp",
  },
  channels: ["diefou"],
};

const client = new tmi.client(opts);

const pingthreshold = 900000; // 15 min, in milliseconds
const replaycd = 20000; // the cooldown for the !replay command
let lastmsgtime = 0; // first msg always pings, no matter how late into the stream
let lastreplaycmdtime = 0;

client.on("message", (channel, tags, message, self) => {
  if (self) return;

  // Only send audio notif if its been longer than `pingthreshold` milliseconds since last msg
  if (
    tags["tmi-sent-ts"] - lastmsgtime >= pingthreshold &&
    tags.username.toLowerCase() !== "streamelements" // dont want it to ding twice if chatter put in a command for streamelements
  ) {
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
    // Only allow the command to execute once every `replaycd` milliseconds
    if (tags["tmi-sent-ts"] - lastreplaycmdtime >= replaycd) {
      fs.appendFile(
        "canishowreplay.txt",
        "START INSTANT REPLAY\n",
        function (err) {
          if (err) return console.log(err);
          console.log("something wrong happened with the !replay command");
        }
      );
      lastreplaycmdtime = tags["tmi-sent-ts"];
    } else {
      client.say(
        channel,
        `@${tags.username}, the replay is already playing FeelsWeirdMan`
      );
    }
  }

  // Chat command to explain what this bot is
  if (message.toLowerCase() === "!bot") {
    client.say(
      channel,
      `@diefoubot does things that @Streamelements can't YEP`
    );
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
