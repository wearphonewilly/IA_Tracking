# Dashboard de Medición de IAs

Dashboard interactivo para monitorear la visibilidad de keywords en las respuestas de diferentes modelos de IA.

## Características

- ✨ Dashboard interactivo con métricas en tiempo real
- 🔍 Tracking de keywords en múltiples modelos de IA
- 🌍 Soporte para múltiples idiomas y prompts
- 📊 Visualización de posición y visibilidad de keywords
- ⚙️ Gestión completa de queries (crear, editar, eliminar)

## Modelos de IA Soportados

- **Llama 4 Maverick** (Groq)
- **Llama 4 Scout** (Groq)
- **Qwen 3** (Groq)
- **Gemini 2.0 Flash** (Google)
- **DeepSeek Chat** (OpenRouter)

## Instalación

1. Instalar las dependencias:

```bash
pip install -r requirements.txt
```

2. Configurar las API Keys (opcional, se pueden usar las del código o establecer variables de entorno):

```bash
export GROQ_API_KEY="tu_api_key_aqui"
export GOOGLE_API_KEY="tu_api_key_aqui"
export OPEN_ROUTER_KEY="tu_api_key_aqui"
```

## Uso

1. Iniciar el servidor:

```bash
python app.py
```

2. Abrir el navegador en:

```
http://localhost:5000
```

## Funcionalidades

### Dashboard Principal
- Visualización de métricas: Queries activas, Resultados totales, Visibilidad media, Modelos IA
- Lista de queries configuradas con sus keywords
- Acciones rápidas: Editar, Eliminar, Trackear

### Crear/Editar Query
- **Información Básica**: Nombre del grupo y keywords
- **Prompts por Idioma**: Añadir prompts (uno por línea) para diferentes idiomas
- **Modelos de IA**: Seleccionar qué modelos trackear

### Vista de Query
- Visualización de cada pregunta con sus métricas de tracking
- Resultados por modelo y keyword
- Posición actual, cambio 24h, y visibilidad

## Notas

- Cada línea en el campo de prompt se trata como una pregunta separada
- Usa `{keyword}` como placeholder en los prompts para reemplazar automáticamente por las keywords
- Los resultados de tracking se guardan en una base de datos SQLite (`dashboard.db`)

