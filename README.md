# Chat con Groq: Prototipo de Interfaz + Metricas

Prototipo en Next.js que integra Groq (Llama 3) para chat en tiempo real y muestra metricas de uso por respuesta y acumuladas por sesion.

## Requisitos

- Node.js 20+
- API Key de Groq

## Configuracion

1. Instalar dependencias:

```bash
npm install
```

2. Crear archivo local de entorno desde el ejemplo:

```bash
cp .env.example .env.local
```

3. Agregar tu API key de Groq en `.env.local`:

```env
GROQ_API_KEY=tu_api_key_aqui
```

## Ejecutar

```bash
npm run dev
```

Abrir en `http://localhost:3000`.

## Lo que incluye

- Chat funcional con Groq via API route segura (`src/app/api/chat/route.js`)
- Modelo configurado: `llama-3.1-8b-instant` (familia Llama 3)
- Registro de `usage` por respuesta:
	- `prompt_tokens`
	- `completion_tokens`
	- `total_tokens`
- Metricas acumuladas de sesion
- Metricas adicionales:
	- latencia por request
	- tokens por segundo (TPS)
	- modelo reportado por la API
- Persistencia de historial y metricas con `localStorage`
- Vistas: Chat, History y Usage

## Nota de seguridad

No pongas la API key en el frontend ni la subas a GitHub. Siempre usa `.env.local` y llamadas desde el backend (API routes).