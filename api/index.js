const ytdl = require('ytdl-core')
const FormData = require('form-data')
const fetch = require('node-fetch')
const stb = require("@jorgeferrero/stream-to-buffer");
const transcript = require('../utils/transcript')
const URL = require('url')

module.exports = async (req, res) => {
  const { challenge, event } = req.body;
  if (challenge) return await res.json({ challenge });
  if (event.channel !== "C01744EK4BD" || event.subtype) {
    return res.status(200).end();
  }

  try {
    const url = getUrlFromString(event.text)
    await react("add", event.channel, event.ts, transcript('reactions.loading'));

    let videoId = ''
    if (url.includes('https://youtu.be')) {
      // youtube short link
      videoId = url.replace('https://youtu.be/', '')
    } else if (url.includes('https://youtube.com/watch?v=')) {
      // youtube watch link
      videoId = URL.parse(url).query.v
    }

    if (!videoId) {
      await Promise.all([
        react("remove", event.channel, event.ts, transcript('reactions.loading')),
        react("add", event.channel, event.ts, transcript("reactions.failure")),
        reply(event.channel, event.ts, transcript('errors.not-yt-link')),
      ])
      return res.status(200).end()
    }

    const downloadJob = new Promise(async (resolve, reject) => {
      try {
        const vid = await ytdl(url)
        resolve(await stb.streamToBuffer(vid))
      } catch (e) {
        reject(e)
      }
    })
    const fallbackJob = new Promise((resolve) => {
      // this waits 30s for the downloadjob to run, then resolves if the download job hasn't succeeded by then
      const ytdlTask = ytdl.getInfo(videoId)
      setTimeout(() => resolve(await ytdlTask), 30000)
    })

    const downloadFinished = async (buffer) => {
      await Promise.all([
        react("remove", event.channel, event.ts, transcript('reactions.loading')),
        react("add", event.channel, event.ts, transcript('reactions.big-file-success')),
        reply(event.channel, event.ts, transcript('big-file', {url: JSON.stringify(value.formats[0])})),
      ])
    }
    const fallbackFinished = async (info) => {
      const vidBuffer = value
      const title = info.videoDetails.title;
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
        transcript('starting-message', {artist: stringToArtist(videoId)})
      );
      await Promise.all([
        fetch("https://slack.com/api/files.upload", {
          method: "POST",
          body: form,
        }),
        react("remove", event.channel, event.ts, transcript('reactions.loading')),
        react("add", event.channel, event.ts, transcript('reactions.success')),
      ])
    }

    const value = await Promise.race([downloadJob, fallbackJob])
    if (typeof value.page == "undefined") {
      await fallbackFinished(value)
    } else {
      await downloadFinished(value)
    }
  } catch (e) {
    await Promise.all([
      react("remove", event.channel, event.ts, transcript('reactions.loading')),
      react("add", event.channel, event.ts, transcript('reactions.error')),
    ])
  }
}

const stringToArtist = (str) => {
  // we want random artists, but we want it to be deterministic
  // ex. https://youtu.be/wH4QsKQPYKQ shouldn't be assigned "Picasso" once, then "Warhol" the next
  // one input 'str' should always return the same artist

  // First we'll turn the 'str' into a number (arbitrary, but deterministic)
  const strWeight = str.split('').map(l => l.charCodeAt(0)).reduce((a,b) => a + b, 0)
  const { array: artistArray } = transcript('artists')
  // Then choose an artist from the array with the index of our 'strWeight'
  const chosenArtist = artistArray[strWeight % artistArray.length]

  return chosenArtist
}

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
