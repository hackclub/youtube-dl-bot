const express = require('express')
const app = express()

app.use(express.urlencoded({extended: true}))
app.use(express.json())

app.all('/', (req, res) => {
  res.json({ping: 'pong'})
})

app.all('/api', require('./api/index'))

const PORT = process.env.PORT || 0
const HOST = '0.0.0.0'
app.listen(PORT, HOST, () => console.log("Server started"))