import express from 'express'
import helmet from 'helmet'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { api } from './api/index'

const __dirname = dirname(fileURLToPath(import.meta.url))

const rawPort = process.env.PORT
const parsedPort = rawPort ? Number(rawPort) : 5173
if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
  console.error(`PORT inválido: "${rawPort}". Debe ser un entero entre 1 y 65535.`)
  process.exit(1)
}
const PORT = parsedPort
const isDev = process.env.NODE_ENV !== 'production'

async function start() {
  const app = express()

  // En producción servimos el SPA estático y solo /api/health (sin cuerpo).
  // CSP estricta: la app no carga assets de terceros ni hace fetch fuera de
  // 'self'; los datos del usuario nunca salen del navegador. Si en el futuro
  // se añade /api/ai/* u otro proxy, ajustar `connect-src` con su dominio.
  // En dev no aplicamos CSP porque Vite middleware inyecta HMR con eval.
  if (!isDev) {
    app.use(
      helmet({
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            'default-src': ["'self'"],
            'script-src': ["'self'"],
            'style-src': ["'self'", "'unsafe-inline'"],
            'img-src': ["'self'", 'data:'],
            'font-src': ["'self'", 'data:'],
            'connect-src': ["'self'"],
            'object-src': ["'none'"],
            'base-uri': ["'self'"],
            'form-action': ["'self'"],
            'frame-ancestors': ["'none'"],
            'upgrade-insecure-requests': [],
          },
        },
        crossOriginEmbedderPolicy: false,
        referrerPolicy: { policy: 'no-referrer' },
        // taxES no debe embeberse en ningún iframe (mitiga clickjacking más
        // allá de `frame-ancestors`). Mantener alineado con `public/_headers`
        // para que ambos canales — Express y Cloudflare Pages — entreguen la
        // misma política.
        xFrameOptions: { action: 'deny' },
      }),
    )
  }

  // /api/health es GET y no consume cuerpo. No registramos express.json para
  // mantener mínima la superficie de ataque del backend.
  app.use('/api', api)

  if (isDev) {
    const { createServer } = await import('vite')
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = resolve(__dirname, 'dist')
    app.use(express.static(distPath))
    app.get('*', (_req, res) => {
      res.sendFile(resolve(distPath, 'index.html'))
    })
  }

  app.listen(PORT, () => {
    console.log(`▲ taxES listo en http://localhost:${PORT}  (${isDev ? 'dev' : 'prod'})`)
  })
}

start().catch((err) => {
  console.error('Error al arrancar el servidor:', err)
  process.exit(1)
})
