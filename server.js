const express = require('express')
const app = express()
app.use(express.urlencoded())

app.get('/api', (req, res) => {
  require('./api/index')(req, res)
})

const PORT = process.env.PORT || 0
const HOST = '0.0.0.0'
app.listen(PORT, HOST, () => console.log("Server started"))