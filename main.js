const NextcloudTalkBot = require("./src/nextcloudTalkBot");
const Jitsi = require("@pojntfx/jitsi-meet-node-client");
const crypto = require("crypto");
const log = require("pino")();

const main = async () => {
  const addr = process.env.BOT_JITSI_ADDR;
  const botName = process.env.BOT_JITSI_BOT_NAME;
  const sleepTime = process.env.BOT_JITSI_SLEEP_TIME;
  const nxtalkproxydAddr = process.env.BOT_NXTALKPROXYD_ADDR;
  const passwordLength = process.env.BOT_JITSI_ROOM_PASSWORD_BYTE_LENGTH;
  const rawCommands = process.env.BOT_COMMANDS;
  const commands = rawCommands.split(",");

  log.info(`starting WebRTC node subsystem with timeout ${sleepTime} seconds`);

  await jitsi.open();

  const bot = new NextcloudTalkBot(nxtalkproxydAddr);

  log.info(`connecting to nxtalkproxyd with address ${nxtalkproxydAddr}`);

  return await bot.readChats(async (chat) => {
    log.info(
      `received message from "${chat.getActordisplayname()}" ("${chat.getActorid()}") in room "${chat.getToken()}" with ID "${chat.getId()}": "${JSON.stringify(
        chat.getMessage()
      )}`
    );

    const message = chat.getMessage();

    const test = new RegExp(`^(${commands.join("|")})`, "g");

    if (!test.test(message)) {
      return;
    }

    const token = chat.getToken();
    const actorID = chat.getActorid();
    const password = crypto
      .randomBytes(parseInt(passwordLength))
      .toString("hex");

    log.info(
      `"${chat.getActordisplayname()}" ("${
        chat.getActorid
      }") has requested a video call in room "${chat.getToken()}" with ID "${chat.getId()}"; creating video call.`
    );

    await bot.writeChat(
      token,
      `@${actorID} started a video call. Tap on https://${addr}/${token} and enter ${password} to join; if no one joins within ${sleepTime} seconds or if the last user leaves, the password will be removed.`
    );

    await jitsi.createRoom(addr, token, botName, password, sleepTime);

    return log.info(
      `WebRTC subsystem exiting room ${chat.getToken()} after ${sleepTime} seconds`
    );
  });
};

const jitsi = new Jitsi();

process.on("SIGINT", async () => await jitsi.close());
process.on("uncaughtException", async (e) => {
  const timeout = 0.125;

  log.info(`bot crashed, restarting in ${timeout} seconds:`, e.stack);

  await new Promise((resolve) => setTimeout(resolve), timeout * 1000);

  main();
});

main();
