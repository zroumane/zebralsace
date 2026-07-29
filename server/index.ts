import { initDb } from './db'
import { createApp } from './routes'

const PORT = Number(process.env.PORT ?? 3000)
const DATA_DIR = process.env.DATA_DIR ?? './data'

const db = initDb(DATA_DIR)
createApp(db, DATA_DIR).listen(PORT, () =>
  console.log(`Serveur étiquettes sur http://localhost:${PORT}`)
)
