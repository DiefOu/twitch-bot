const tmi = require("tmi.js");
const player = require("node-wav-player");

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

const pingthreshold = 1800000; // 30 min, in milliseconds
let lastmsgtime = 0; // first msg always pings, no matter how late into the stream

client.on("message", (channel, tags, message, self) => {
  if (self) return;

  // Only send audio notif if its been longer than `pingthreshold` miliseconds since last msg
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

  // Example chat command
  /*   if (message.toLowerCase() === "!hello") {
    client.say(channel, `@${tags.username}, Yo what's up`);
  } */
});

client.on("connected", (address, port) => {
  console.log(`connected to ${address} and the port: ${port}`);
});

client.connect();
