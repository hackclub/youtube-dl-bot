const express = require('express')
const app = express()

app.use(express.urlencoded({extended: true}))
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ping: 'pong'})
})
app.get('/api', async (req, res) => {
  console.log('/api hi!')
  await require('./api/index')(req, res)
})

const PORT = process.env.PORT || 0
const HOST = '0.0.0.0'
app.listen(PORT, HOST, () => console.log("Server started"))