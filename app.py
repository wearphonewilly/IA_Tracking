# -*- coding: utf-8 -*-
"""
Backend Flask para el Dashboard de Medición de IAs
"""

from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import json
import time
import os
import requests
from datetime import datetime
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
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
# Configuración de API Keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Inicialización de Firebase
# Inicialización de Firebase
try:
    # Intenta cargar desde archivo local (desarrollo)
    if os.path.exists("serviceAccountKey.json"):
        cred = credentials.Certificate("serviceAccountKey.json")
    # Intenta cargar desde variable de entorno (producción/Vercel)
    elif os.getenv("FIREBASE_SERVICE_ACCOUNT"):
        # La variable de entorno debe contener el JSON completo como string
        # En Vercel, a veces es mejor usar base64 si hay problemas con saltos de línea,
        # pero JSON string directo suele funcionar si se copia con cuidado.
        service_account_info = json.loads(os.getenv("FIREBASE_SERVICE_ACCOUNT"))
        cred = credentials.Certificate(service_account_info)
    else:
        raise Exception("No se encontró serviceAccountKey.json ni variable FIREBASE_SERVICE_ACCOUNT")
        
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("Firebase inicializado correctamente.")
except Exception as e:
    print(f"Error al inicializar Firebase: {e}")
    # Si falla, intentamos conectar sin credenciales explícitas (ej. si estamos en Google Cloud environment)
    # o simplemente dejamos que falle más tarde si no hay auth
    try:
        db = firestore.client()
    except:
        print("No se pudo conectar a Firestore.")


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

@app.route('/query/<query_id>')
def query_detail(query_id):
    """Página de detalle de query"""
    return render_template('query_detail.html')

@app.route('/query/<query_id>/edit')
def edit_query(query_id):
    """Página de edición de query"""
    return render_template('edit_query.html')

@app.route('/api/queries', methods=['GET'])
def get_queries():
    """Obtiene todas las queries"""
    queries_ref = db.collection('queries').order_by('updated_at', direction=firestore.Query.DESCENDING)
    docs = queries_ref.stream()
    
    queries = []
    for doc in docs:
        query_data = doc.to_dict()
        query_data['id'] = doc.id
        
        # En Firestore guardamos keywords, models y prompts dentro del documento
        # Aseguramos valores por defecto si no existen
        query_data['keywords'] = query_data.get('keywords', [])
        query_data['models'] = query_data.get('models', [])
        query_data['prompts'] = query_data.get('prompts', {})
        
        # Obtener estadísticas (simplificado para evitar N lecturas excesivas si es posible)
        # Para métricas exactas, tendríamos que consultar la colección tracking_results
        
        # Consultar últimos resultados para métricas
        results_ref = db.collection('tracking_results').where('query_id', '==', doc.id).order_by('tracked_at', direction=firestore.Query.DESCENDING).limit(50)
        results_docs = results_ref.stream()
        
        results = []
        for r_doc in results_docs:
            results.append(r_doc.to_dict())
            
        keyword_metrics = {}
        latest_results_by_keyword = {}
        unique_models = set()
        
        for r in results:
            kw = r.get('keyword')
            model_id = r.get('model_id')
            unique_models.add(model_id)
            
            if kw not in latest_results_by_keyword:
                latest_results_by_keyword[kw] = {'vis': [], 'pos': []}
                
            latest_results_by_keyword[kw]['vis'].append(r.get('visibility', 0))
            if r.get('position') is not None:
                latest_results_by_keyword[kw]['pos'].append(r.get('position'))
        
        for kw, data in latest_results_by_keyword.items():
            recent_vis = data['vis'][:5]
            recent_pos = data['pos'][:5]
            
            avg_vis = sum(recent_vis) / len(recent_vis) if recent_vis else 0
            avg_pos = sum(recent_pos) / len(recent_pos) if recent_pos else 0
            
            keyword_metrics[kw] = {
                'avg_visibility': round(avg_vis, 1),
                'avg_position': round(avg_pos, 1) if avg_pos > 0 else '-'
            }
            
        query_data['keyword_metrics'] = keyword_metrics
        query_data['stats'] = {
            'total_keywords': len(query_data['keywords']),
            'total_models': len(unique_models)
        }
        
        queries.append(query_data)

    return jsonify(queries)

@app.route('/api/queries/<query_id>', methods=['GET'])
def get_query(query_id):
    """Obtiene una query específica"""
    doc_ref = db.collection('queries').document(query_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        return jsonify({'error': 'Query no encontrada'}), 404
        
    query_data = doc.to_dict()
    query_data['id'] = doc.id
    # Asegurar campos
    query_data['keywords'] = query_data.get('keywords', [])
    query_data['models'] = query_data.get('models', [])
    query_data['prompts'] = query_data.get('prompts', {})
    
    return jsonify(query_data)

@app.route('/api/queries', methods=['POST'])
def create_query():
    """Crea una nueva query"""
    data = request.json
    
    new_query = {
        'name': data.get('name', ''),
        'keywords': data.get('keywords', []),
        'prompts': data.get('prompts', {}),
        'models': data.get('models', []),
        'created_at': datetime.now(),
        'updated_at': datetime.now()
    }
    
    update_time, doc_ref = db.collection('queries').add(new_query)
    
    return jsonify({'id': doc_ref.id, 'message': 'Query creada correctamente'}), 201

@app.route('/api/queries/<query_id>', methods=['PUT'])
def update_query(query_id):
    """Actualiza una query existente"""
    data = request.json
    doc_ref = db.collection('queries').document(query_id)
    
    update_data = {
        'name': data.get('name', ''),
        'keywords': data.get('keywords', []),
        'prompts': data.get('prompts', {}),
        'models': data.get('models', []),
        'updated_at': datetime.now()
    }
    
    doc_ref.update(update_data)
    
    return jsonify({'message': 'Query actualizada correctamente'})

@app.route('/api/queries/<query_id>', methods=['DELETE'])
def delete_query(query_id):
    """Elimina una query"""
    db.collection('queries').document(query_id).delete()
    # Opcional: Eliminar resultados asociados
    # results = db.collection('tracking_results').where('query_id', '==', query_id).stream()
    # for r in results:
    #     r.reference.delete()
    return jsonify({'message': 'Query eliminada correctamente'})

@app.route('/api/queries/<query_id>/track', methods=['POST'])
def track_query(query_id):
    """Realiza tracking de una query"""
    doc_ref = db.collection('queries').document(query_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        return jsonify({'error': 'Query no encontrada'}), 404
    
    query_data = doc.to_dict()
    keywords = query_data.get('keywords', [])
    prompts = query_data.get('prompts', {})
    model_ids = query_data.get('models', [])
    
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
                        
                        # Guardar resultado en Firestore
                        result_data = {
                            'query_id': query_id,
                            'keyword': keyword,
                            'model_id': model_id,
                            'prompt_text': prompt,
                            'question_text': question_text,
                            'language': language,
                            'response_text': response,
                            'position': position,
                            'visibility': visibility,
                            'tracked_at': datetime.now()
                        }
                        
                        db.collection('tracking_results').add(result_data)
                        
                        results.append({
                            'keyword': keyword,
                            'model': model_id,
                            'question': question_text,
                            'position': position,
                            'visibility': visibility,
                            'success': True
                        })
                        
                    except Exception as e:
                        print(f"Error tracking {keyword} on {model_id}: {e}")
                        results.append({
                            'keyword': keyword,
                            'model': model_id,
                            'question': question_text,
                            'error': str(e),
                            'success': False
                        })

    return jsonify({'results': results, 'message': 'Tracking completado'})

@app.route('/api/queries/<query_id>/results', methods=['GET'])
def get_tracking_results(query_id):
    """Obtiene los resultados de tracking de una query"""
    results_ref = db.collection('tracking_results').where('query_id', '==', query_id).order_by('tracked_at', direction=firestore.Query.DESCENDING)
    docs = results_ref.stream()
    
    results = []
    for doc in docs:
        results.append(doc.to_dict())
        
    return jsonify(results)

@app.route('/api/models', methods=['GET'])
def get_models():
    """Obtiene la lista de modelos disponibles"""
    return jsonify(AVAILABLE_MODELS)

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Obtiene estadísticas globales del dashboard"""
    # Nota: Las agregaciones de conteo (count()) son más eficientes in Firestore
    # Queries activas
    queries_coll = db.collection('queries')
    active_queries = queries_coll.count().get()[0][0].value
    
    # Resultados totales
    results_coll = db.collection('tracking_results')
    total_results = results_coll.count().get()[0][0].value
    
    # Visibilidad media (Esto es costoso en Firestore sin agregaciones previas, 
    # lo haremos aproximado o simple por ahora trayendo una muestra o calculando bajo demanda)
    # Por eficiencia, si son muchos datos, mejor mantener un contador en un documento de stats
    # Aquí, por simplicidad para la migración, haremos una consulta limitada o lo dejamos en 0 si es muy costoso
    # Una opción segura para un dashboard pequeño es traer los últimos 100 resultados
    
    recent_results = results_coll.order_by('tracked_at', direction=firestore.Query.DESCENDING).limit(100).stream()
    vis_sum = 0
    vis_count = 0
    unique_models = set()
    
    for r in recent_results:
        data = r.to_dict()
        if data.get('visibility') is not None:
            vis_sum += data.get('visibility')
            vis_count += 1
        if data.get('model_id'):
            unique_models.add(data.get('model_id'))
            
    avg_visibility = vis_sum / vis_count if vis_count > 0 else 0.0
    
    # Para modelos, mejor una estimación basada en configuration o lo que tenemos en memoria
    # Total models lo podemos sacar de AVAILABLE_MODELS o de los documentos de queries
    
    return jsonify({
        'active_queries': active_queries,
        'total_results': total_results,
        'avg_visibility': round(avg_visibility, 2),
        'total_models': len(unique_models)
    })

# Inicializar y migrar base de datos al arrancar


if __name__ == '__main__':
    app.run(debug=True, port=5000)

