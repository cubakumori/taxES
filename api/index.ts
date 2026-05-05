import { Router } from 'express'
import { health } from './routes/health'

export const api = Router()

api.use('/health', health)

// Futuro: api.use('/ai', ai)  // proxy a proveedores IA con clave en servidor
