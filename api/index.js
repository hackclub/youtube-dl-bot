import ytdl from "ytdl-core";
import FormData from "form-data";
import fetch from "node-fetch";
const stb = require("@jorgeferrero/stream-to-buffer");

export default async (req, res) => {
  const { challenge, event } = req.body;
  if (challenge) return await res.json({ challenge });
  if (event.channel !== "C01744EK4BD" || event.subtype)
    return res.status(200).end();

  console.log(event);
  console.log(event.text, event.ts, event.user);

  try {
    getUrlFromString(event.text);
    await react("add", event.channel, event.ts, "beachball");
  } catch {
    return;
  }
  if(event.text.includes('googlevideo.com')){
    await react("remove", event.channel, event.ts, "beachball");
    return;
  }
  const url = getUrlFromString(event.text);
  const videoId = url.split("v=")[1];
  console.log(url, videoId);
  if (!videoId) {
    await react("remove", event.channel, event.ts, "beachball");
    await react("add", event.channel, event.ts, "x");
    await reply(
      event.channel,
      event.ts,
      `What is this trickery??? That is not a YouTube link!`
    );
  }

  res.status(200).end();

  const vid = await ytdl(url);

  const youtubedl_job = stb.streamToBuffer(vid);
  const thirty_sec_job = new Promise((resolve) => {
    setTimeout(() => resolve(ytdl.getInfo(videoId)), 30000);
  });
  await Promise.race([youtubedl_job, thirty_sec_job]).then(async (value) => {
    console.log(typeof value.page);
    if (typeof value.page == "undefined") {
      const info = await ytdl.getInfo(videoId)
      const vidBuffer = value
      const title = info.videoDetails.title;
      console.log(info);
      const form = new FormData();
      form.append("file", vidBuffer, {
        filename: title + ".mp4",
        contentType: "video/mp4",
        knownLength: vidBuffer.length,
      });
      form.append("channels", "C01744EK4BD");
      form.append("thread_ts", event.ts);
      form.append('token', process.env.SLACK_BOT_TOKEN)
      form.append(
        "initial_comment",
        `Oui ouiiii. This reminds me of a Rembrandt I once stole. This must be worth 10,000gp.`
      );
      console.log(form);
      await fetch("https://slack.com/api/files.upload", {
        method: "POST",
        body: form,
      })
        .then((r) => r.json())
        .then((r) => console.log(r));

      await react("remove", event.channel, event.ts, "beachball");
      await react("add", event.channel, event.ts, "youtube");
    } else {
      await react("remove", event.channel, event.ts, "beachball");
      await react("add", event.channel, event.ts, "fb-wow");
      await reply(event.channel, event.ts, `Sooooooo BIG! but do not stress! i have a friend who has big enough hands to capture this masterpiece: <${value.formats[0]['url']}}|Nic Nicosia>. FYI: He has a flight in six hours and will bin the masterpiece right before it :(`);
    }
  });
};

const getUrlFromString = (str) => {
  const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
  let url = str.match(urlRegex)[0];
  if (url.includes("|")) url = url.split("|")[0];
  if (url.startsWith("<")) url = url.substring(1, url.length - 1);
  return url;
};

const react = async (addOrRemove, channel, ts, reaction) =>
  await fetch("https://slack.com/api/reactions." + addOrRemove, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({ channel: channel, name: reaction, timestamp: ts }),
  })
    .then((r) => r.json())
    .catch((err) => console.error(err));

const reply = async (channel, parentTs, text, unfurl) =>
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      channel: channel,
      thread_ts: parentTs,
      text: text,
      parse: "mrkdwn",
      unfurl_links: unfurl,
      unfurl_media: false,
    }),
  })
    .then((r) => r.json())
    .then((json) => json.ts);
