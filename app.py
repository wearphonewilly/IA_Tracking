# -*- coding: utf-8 -*-
"""
Backend Flask para el Dashboard de Medición de IAs
"""

from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import sqlite3
import json
import time
import os
import requests
from datetime import datetime
from datetime import datetime
from groq import Groq
from openai import OpenAI
from google import generativeai as genai
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuración de API Keys
# Configuración de API Keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Base de datos
# Base de datos
DB_FILE = "dashboard.db"

# Detectar si el directorio actual es escribible
if os.access('.', os.W_OK):
    DB_PATH = DB_FILE
else:
    # En Vercel o entornos de solo lectura, usar /tmp
    DB_PATH = os.path.join('/tmp', DB_FILE)
    print(f"Entorno solo lectura detectado. Usando base de datos en: {DB_PATH}")

# Configuración de API Keys
# Configuración de API Keys
OPEN_ROUTER_KEY = os.getenv("OPEN_ROUTER_KEY")
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Modelos disponibles
# Modelos disponibles
AVAILABLE_MODELS = [
    {
        "id": "meta-llama/llama-4-maverick-17b-128e-instruct", 
        "name": "Llama 4 Maverick", 
        "provider": "groq",
        "params": {
            "temperature": 1,
            "max_completion_tokens": 1024,
            "top_p": 1
        }
    },
    {
        "id": "meta-llama/llama-4-scout-17b-16e-instruct", 
        "name": "Llama 4 Scout", 
        "provider": "groq",
        "params": {
            "temperature": 1,
            "max_completion_tokens": 1024,
            "top_p": 1
        }
    },
    {
        "id": "qwen/qwen3-32b", 
        "name": "Qwen 3", 
        "provider": "groq",
        "params": {
            "temperature": 0.6,
            "max_completion_tokens": 4096,
            "top_p": 0.95,
            "reasoning_effort": "default"
        }
    },
    {
        "id": "llama-3.1-8b-instant",
        "name": "Llama 3.1 8B Instant",
        "provider": "groq",
        "params": {
            "temperature": 1,
            "max_completion_tokens": 1024,
            "top_p": 1
        }
    },
    {
        "id": "openai/gpt-oss-120b",
        "name": "SambaNova GPT-OSS 120B",
        "provider": "groq",
        "params": {
            "temperature": 1,
            "max_completion_tokens": 8192,
            "top_p": 1,
            "reasoning_effort": "medium"
        }
    },
    {
        "id": "gpt-5.2",
        "name": "GPT 5.2",
        "provider": "openai",
        "params": {
            "temperature": 1,
            "max_completion_tokens": 4096,
            "top_p": 1,
            "reasoning_effort": "medium"
        }
    },
    {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "provider": "google"},
    {"id": "deepseek-chat", "name": "DeepSeek Chat", "provider": "openrouter"},
    {"id": "openai/gpt-5.2-chat", "name": "GPT 5.2 (via OpenRouter)", "provider": "openrouter"},
    {"id": "sonar-pro", "name": "Perplexity Sonar Pro", "provider": "perplexity"},
    {"id": "sonar-reasoning-pro", "name": "Perplexity Sonar Reasoning Pro", "provider": "perplexity"}
]

def init_db():
    """Inicializa la base de datos"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Tabla de queries
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS queries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabla de keywords
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS keywords (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query_id INTEGER NOT NULL,
            keyword TEXT NOT NULL,
            FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE
        )
    ''')
    
    # Tabla de prompts por idioma
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query_id INTEGER NOT NULL,
            language TEXT NOT NULL,
            prompt_text TEXT NOT NULL,
            FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE
        )
    ''')
    
    # Tabla de modelos seleccionados por query
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS query_models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query_id INTEGER NOT NULL,
            model_id TEXT NOT NULL,
            FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE
        )
    ''')
    
    # Tabla de tracking results
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tracking_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query_id INTEGER NOT NULL,
            keyword TEXT NOT NULL,
            model_id TEXT NOT NULL,
            prompt_text TEXT NOT NULL,
            question_text TEXT NOT NULL,
            language TEXT NOT NULL,
            response_text TEXT NOT NULL,
            position REAL,
            visibility REAL,
            tracked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE
        )
    ''')
    
    conn.commit()
    conn.close()

def migrate_db():
    """Migra la base de datos existente si es necesario"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        # Verificar si la columna question_text existe
        cursor.execute("PRAGMA table_info(tracking_results)")
        columns = [row[1] for row in cursor.fetchall()]
        if 'question_text' not in columns:
            cursor.execute('ALTER TABLE tracking_results ADD COLUMN question_text TEXT')
            cursor.execute('ALTER TABLE tracking_results ADD COLUMN language TEXT')
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error en migración de BD: {e}")

def query_groq(model, prompt, api_key, params=None):
    """Consulta a un modelo Groq con parámetros personalizados"""
    client = Groq(api_key=api_key)
    
    # Parámetros por defecto
    request_params = {
        "messages": [{"role": "user", "content": prompt}],
        "model": model,
        "temperature": 0.2,
        "max_tokens": 1024,
        "stream": False # Desactivamos stream para simplificar la lógica actual
    }
    
    # Sobreescribir con parámetros específicos del modelo si existen
    if params:
        if "temperature" in params: request_params["temperature"] = params["temperature"]
        if "top_p" in params: request_params["top_p"] = params["top_p"]
        
        # Mapear max_completion_tokens a max_tokens para compatibilidad, o usar si la librería lo soporta
        # La librería groq recién actualizada debería soportar max_completion_tokens
        if "max_completion_tokens" in params: 
            request_params["max_completion_tokens"] = params["max_completion_tokens"]
            # Removemos max_tokens si usamos max_completion_tokens para evitar conflictos
            if "max_tokens" in request_params: del request_params["max_tokens"]
            
        if "reasoning_effort" in params: request_params["reasoning_effort"] = params["reasoning_effort"]

    start = time.time()
    chat_completion = client.chat.completions.create(**request_params)
    elapsed = round(time.time() - start, 3)
    content = chat_completion.choices[0].message.content
    if not content or content.strip() == "":
        raise ValueError("Respuesta vacía o nula")
    return content, elapsed

def query_gemini(prompt, api_key):
    """Consulta a Gemini"""
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")
    start = time.time()
    response = model.generate_content(prompt)
    elapsed = round(time.time() - start, 3)
    if hasattr(response, "text") and response.text:
        content = response.text
    elif hasattr(response, "candidates") and response.candidates:
        content = response.candidates[0].content.parts[0].text
    else:
        raise ValueError("Respuesta vacía o nula en Gemini")
    return content, elapsed

def query_openrouter(model, prompt, api_key):
    """Consulta a un modelo a través de OpenRouter"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 1024
    }
    start = time.time()
    response = requests.post("https://openrouter.ai/api/v1/chat/completions", 
                           headers=headers, json=data, timeout=60)
    elapsed = round(time.time() - start, 3)
    response.raise_for_status()
    result = response.json()
    content = result["choices"][0]["message"]["content"]
    if not content or content.strip() == "":
        raise ValueError("Respuesta vacía o nula")
    return content, elapsed

def query_openai(model, prompt, api_key, params=None):
    """Consulta a un modelo OpenAI"""
    client = OpenAI(api_key=api_key)
    
    # Parámetros por defecto
    request_params = {
        "messages": [{"role": "user", "content": prompt}],
        "model": model,
        "temperature": 1,
        "max_tokens": 2048
    }

    if params:
        if "temperature" in params: request_params["temperature"] = params["temperature"]
        if "top_p" in params: request_params["top_p"] = params["top_p"]
        if "max_completion_tokens" in params: request_params["max_completion_tokens"] = params["max_completion_tokens"]
        if "max_tokens" in request_params and "max_completion_tokens" in params: del request_params["max_tokens"]
        if "reasoning_effort" in params: request_params["reasoning_effort"] = params["reasoning_effort"]

    start = time.time()
    chat_completion = client.chat.completions.create(**request_params)
    elapsed = round(time.time() - start, 3)
    content = chat_completion.choices[0].message.content
    if not content or content.strip() == "":
        raise ValueError("Respuesta vacía o nula")
    return content, elapsed

def query_perplexity(model, prompt, api_key):
    """Consulta a un modelo Perplexity"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 1024
    }
    start = time.time()
    response = requests.post("https://api.perplexity.ai/chat/completions", 
                           headers=headers, json=data, timeout=60)
    elapsed = round(time.time() - start, 3)
    response.raise_for_status()
    result = response.json()
    content = result["choices"][0]["message"]["content"]
    if not content or content.strip() == "":
        raise ValueError("Respuesta vacía o nula")
    return content, elapsed

def find_keyword_position(response, keyword):
    """Encuentra la posición de una keyword basada en el número de párrafo (1-indexado)"""
    response_lower = response.lower()
    keyword_lower = keyword.lower()
    pos_idx = response_lower.find(keyword_lower)
    
    if pos_idx == -1:
        return None
        
    # Contar saltos de línea antes de la coincidencia para determinar el "párrafo"
    # Se suma 1 porque empezamos en el párrafo 1
    paragraph_num = response_lower[:pos_idx].count('\n') + 1
    return paragraph_num

def calculate_visibility(response, keyword):
    """Calcula la visibilidad de una keyword (0-100%)"""
    response_lower = response.lower()
    keyword_lower = keyword.lower()
    count = response_lower.count(keyword_lower)
    
    if count == 0:
        return 0.0
        
    # Encontrar posición relativa (0-1) para el cálculo de visibilidad
    pos_idx = response_lower.find(keyword_lower)
    relative_pos = pos_idx / len(response)
    
    # Visibilidad basada en frecuencia y posición (cuanto más arriba mejor)
    # Fórmula: (frecuencia * 20) * (1 - position)
    # Ejemplo: 1 vez al principio = 20 * 1 = 20%
    # Ejemplo: 5 veces al principio = 100%
    visibility = min(100.0, count * 20 * (1 - relative_pos))
    return round(visibility, 2)



# Rutas de la API

@app.route('/')
def index():
    """Página principal del dashboard"""
    return render_template('dashboard.html')

@app.route('/query/<int:query_id>')
def query_detail(query_id):
    """Página de detalle de query"""
    return render_template('query_detail.html')

@app.route('/query/<int:query_id>/edit')
def edit_query(query_id):
    """Página de edición de query"""
    return render_template('edit_query.html')

@app.route('/api/queries', methods=['GET'])
def get_queries():
    """Obtiene todas las queries"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM queries ORDER BY updated_at DESC')
    queries = [dict(row) for row in cursor.fetchall()]
    
    for query in queries:
        # Obtener keywords
        cursor.execute('SELECT keyword FROM keywords WHERE query_id = ?', (query['id'],))
        query['keywords'] = [row[0] for row in cursor.fetchall()]
        
        # Obtener prompts
        cursor.execute('SELECT language, prompt_text FROM prompts WHERE query_id = ?', (query['id'],))
        query['prompts'] = {row[0]: row[1] for row in cursor.fetchall()}
        
        # Obtener modelos seleccionados
        cursor.execute('SELECT model_id FROM query_models WHERE query_id = ?', (query['id'],))
        query['models'] = [row[0] for row in cursor.fetchall()]
        
        # Obtener estadísticas de tracking
        cursor.execute('''
            SELECT COUNT(DISTINCT keyword) as total_keywords,
                   COUNT(DISTINCT model_id) as total_models
            FROM tracking_results
            WHERE query_id = ?
        ''', (query['id'],))
        stats = cursor.fetchone()
        query['stats'] = {
            'total_keywords': stats[0] or 0,
            'total_models': stats[1] or 0
        }
        
        # Obtener métricas por keyword (último resultado)
        cursor.execute('''
            SELECT keyword, visibility, position, tracked_at
            FROM tracking_results
            WHERE query_id = ?
            ORDER BY tracked_at DESC
        ''', (query['id'],))
        
        results = cursor.fetchall()
        keyword_metrics = {}
        
        latest_results_by_keyword = {} 
        
        for row in results:
            kw = row[0]
            vis = row[1]
            # row[2] es position, pero tenemos que asegurarnos de que la consulta SQL lo traiga
            # En la versión anterior de tracking_results ya debía tener la columna position
            pos = row[2] if len(row) > 2 else None
            
            if kw not in latest_results_by_keyword:
                latest_results_by_keyword[kw] = {'vis': [], 'pos': []}
            
            latest_results_by_keyword[kw]['vis'].append(vis)
            if pos is not None:
                latest_results_by_keyword[kw]['pos'].append(pos)

        for kw, data in latest_results_by_keyword.items():
            # Tomamos hasta 5 resultados más recientes
            recent_vis = data['vis'][:5]
            recent_pos = data['pos'][:5]
            
            avg_vis = sum(recent_vis) / len(recent_vis) if recent_vis else 0
            avg_pos = sum(recent_pos) / len(recent_pos) if recent_pos else 0
            
            keyword_metrics[kw] = {
                'avg_visibility': round(avg_vis, 1),
                'avg_position': round(avg_pos, 1) if avg_pos > 0 else '-'
            }
            
        query['keyword_metrics'] = keyword_metrics
    
    conn.close()
    return jsonify(queries)

@app.route('/api/queries/<int:query_id>', methods=['GET'])
def get_query(query_id):
    """Obtiene una query específica"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM queries WHERE id = ?', (query_id,))
    query = cursor.fetchone()
    if not query:
        conn.close()
        return jsonify({'error': 'Query no encontrada'}), 404
    
    query = dict(query)
    
    # Obtener keywords
    cursor.execute('SELECT keyword FROM keywords WHERE query_id = ?', (query_id,))
    query['keywords'] = [row[0] for row in cursor.fetchall()]
    
    # Obtener prompts
    cursor.execute('SELECT language, prompt_text FROM prompts WHERE query_id = ?', (query_id,))
    query['prompts'] = {row[0]: row[1] for row in cursor.fetchall()}
    
    # Obtener modelos seleccionados
    cursor.execute('SELECT model_id FROM query_models WHERE query_id = ?', (query_id,))
    query['models'] = [row[0] for row in cursor.fetchall()]
    
    conn.close()
    return jsonify(query)

@app.route('/api/queries', methods=['POST'])
def create_query():
    """Crea una nueva query"""
    data = request.json
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Crear query
    cursor.execute('INSERT INTO queries (name) VALUES (?)', (data.get('name', ''),))
    query_id = cursor.lastrowid
    
    # Añadir keywords
    for keyword in data.get('keywords', []):
        cursor.execute('INSERT INTO keywords (query_id, keyword) VALUES (?, ?)', (query_id, keyword))
    
    # Añadir prompts
    for language, prompt_text in data.get('prompts', {}).items():
        cursor.execute('INSERT INTO prompts (query_id, language, prompt_text) VALUES (?, ?, ?)',
                      (query_id, language, prompt_text))
    
    # Añadir modelos
    for model_id in data.get('models', []):
        cursor.execute('INSERT INTO query_models (query_id, model_id) VALUES (?, ?)',
                      (query_id, model_id))
    
    conn.commit()
    conn.close()
    return jsonify({'id': query_id, 'message': 'Query creada correctamente'}), 201

@app.route('/api/queries/<int:query_id>', methods=['PUT'])
def update_query(query_id):
    """Actualiza una query existente"""
    data = request.json
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Actualizar nombre
    cursor.execute('UPDATE queries SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                  (data.get('name', ''), query_id))
    
    # Eliminar keywords existentes y añadir nuevas
    cursor.execute('DELETE FROM keywords WHERE query_id = ?', (query_id,))
    for keyword in data.get('keywords', []):
        cursor.execute('INSERT INTO keywords (query_id, keyword) VALUES (?, ?)', (query_id, keyword))
    
    # Eliminar prompts existentes y añadir nuevos
    cursor.execute('DELETE FROM prompts WHERE query_id = ?', (query_id,))
    for language, prompt_text in data.get('prompts', {}).items():
        cursor.execute('INSERT INTO prompts (query_id, language, prompt_text) VALUES (?, ?, ?)',
                      (query_id, language, prompt_text))
    
    # Eliminar modelos existentes y añadir nuevos
    cursor.execute('DELETE FROM query_models WHERE query_id = ?', (query_id,))
    for model_id in data.get('models', []):
        cursor.execute('INSERT INTO query_models (query_id, model_id) VALUES (?, ?)',
                      (query_id, model_id))
    
    conn.commit()
    conn.close()
    return jsonify({'message': 'Query actualizada correctamente'})

@app.route('/api/queries/<int:query_id>', methods=['DELETE'])
def delete_query(query_id):
    """Elimina una query"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM queries WHERE id = ?', (query_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Query eliminada correctamente'})

@app.route('/api/queries/<int:query_id>/track', methods=['POST'])
def track_query(query_id):
    """Realiza tracking de una query"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Obtener datos de la query
    cursor.execute('SELECT * FROM queries WHERE id = ?', (query_id,))
    query = cursor.fetchone()
    if not query:
        conn.close()
        return jsonify({'error': 'Query no encontrada'}), 404
    
    # Obtener keywords
    cursor.execute('SELECT keyword FROM keywords WHERE query_id = ?', (query_id,))
    keywords = [row[0] for row in cursor.fetchall()]
    
    # Obtener prompts
    cursor.execute('SELECT language, prompt_text FROM prompts WHERE query_id = ?', (query_id,))
    prompts = {row[0]: row[1] for row in cursor.fetchall()}
    
    # Obtener modelos seleccionados
    cursor.execute('SELECT model_id FROM query_models WHERE query_id = ?', (query_id,))
    model_ids = [row[0] for row in cursor.fetchall()]
    
    results = []
    
    # Procesar cada prompt y cada keyword
    # Cada línea del prompt es una pregunta separada
    for language, prompt_template in prompts.items():
        # Dividir el prompt en líneas (cada línea es una pregunta)
        question_lines = [line.strip() for line in prompt_template.split('\n') if line.strip()]
        
        for question_text in question_lines:
            for keyword in keywords:
                # Reemplazar placeholder {keyword} en la pregunta
                prompt = question_text.replace('{keyword}', keyword)
                
                # Procesar cada modelo
                for model_id in model_ids:
                    try:
                        # Buscar el modelo en la lista de disponibles
                        model_info = next((m for m in AVAILABLE_MODELS if m['id'] == model_id), None)
                        if not model_info:
                            continue
                        
                        # Consultar según el provider
                        if model_info['provider'] == 'groq':
                            # Extraer parámetros específicos del modelo si existen
                            params = model_info.get('params', {})
                            response, elapsed = query_groq(model_id, prompt, GROQ_API_KEY, params)
                        elif model_info['provider'] == 'openai':
                            params = model_info.get('params', {})
                            response, elapsed = query_openai(model_id, prompt, OPENAI_API_KEY, params)
                        elif model_info['provider'] == 'google':
                            response, elapsed = query_gemini(prompt, GOOGLE_API_KEY)
                        elif model_info['provider'] == 'openrouter':
                            # Mapear el modelo de openrouter
                            openrouter_model = "deepseek/deepseek-chat" if model_id == "deepseek-chat" else model_id
                            response, elapsed = query_openrouter(openrouter_model, prompt, OPEN_ROUTER_KEY)
                        elif model_info['provider'] == 'perplexity':
                            response, elapsed = query_perplexity(model_id, prompt, PERPLEXITY_API_KEY)
                        else:
                            continue
                        
                        print(f"DEBUG: Consultando modelo {model_id} para keyword '{keyword}'...")
                        
                        # Calcular posición y visibilidad
                        position = find_keyword_position(response, keyword)
                        visibility = calculate_visibility(response, keyword)
                        
                        # Guardar resultado
                        cursor.execute('''
                            INSERT INTO tracking_results 
                            (query_id, keyword, model_id, prompt_text, question_text, language, response_text, position, visibility)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (query_id, keyword, model_id, prompt, question_text, language, response, position, visibility))
                        
                        results.append({
                            'keyword': keyword,
                            'model': model_id,
                            'question': question_text,
                            'position': position,
                            'visibility': visibility,
                            'success': True
                        })
                        
                    except Exception as e:
                        results.append({
                            'keyword': keyword,
                            'model': model_id,
                            'question': question_text,
                            'error': str(e),
                            'success': False
                        })

    
    conn.commit()
    conn.close()
    return jsonify({'results': results, 'message': 'Tracking completado'})

@app.route('/api/queries/<int:query_id>/results', methods=['GET'])
def get_tracking_results(query_id):
    """Obtiene los resultados de tracking de una query"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT keyword, model_id, question_text, language, position, visibility, tracked_at
        FROM tracking_results
        WHERE query_id = ?
        ORDER BY tracked_at DESC
    ''', (query_id,))
    
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(results)

@app.route('/api/models', methods=['GET'])
def get_models():
    """Obtiene la lista de modelos disponibles"""
    return jsonify(AVAILABLE_MODELS)

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Obtiene estadísticas globales del dashboard"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Queries activas
    cursor.execute('SELECT COUNT(*) FROM queries')
    active_queries = cursor.fetchone()[0]
    
    # Resultados totales
    cursor.execute('SELECT COUNT(*) FROM tracking_results')
    total_results = cursor.fetchone()[0]
    
    # Visibilidad media
    cursor.execute('SELECT AVG(visibility) FROM tracking_results WHERE visibility IS NOT NULL')
    avg_visibility = cursor.fetchone()[0] or 0.0
    
    # Modelos IA únicos
    cursor.execute('SELECT COUNT(DISTINCT model_id) FROM query_models')
    total_models = cursor.fetchone()[0]
    
    conn.close()
    
    return jsonify({
        'active_queries': active_queries,
        'total_results': total_results,
        'avg_visibility': round(avg_visibility, 2),
        'total_models': total_models
    })

# Inicializar y migrar base de datos al arrancar
init_db()
migrate_db()

if __name__ == '__main__':
    app.run(debug=True, port=5000)

