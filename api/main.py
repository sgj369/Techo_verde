import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
import gspread
import json

# --- CONFIGURACIÓN DE FASTAPI Y CORS ---
app = FastAPI()

# Configuración de CORS (Cross-Origin Resource Sharing) para permitir acceso desde tu Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permite el acceso desde cualquier dominio (incluyendo GitHub Pages)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELOS DE DATOS ---
class Lectura(BaseModel):
    timestamp: str
    valor: str

class SensorResponse(BaseModel):
    sensor: str
    datos: List[Lectura]

# --- CONFIGURACIÓN DE ACCESO SECRETO ---
# ID de tu Google Sheet (No cambia, está incrustado en la URL)
SHEET_ID = "1Mu0mfmwoWRI_kJ8EweGpJT1g608t6EQixtfevX0z0ac"
SHEET_NAME = "Lecturas" # Nombre de la pestaña con los datos

# Leemos la llave secreta JSON de la variable de entorno configurada en Render
SERVICE_ACCOUNT_JSON = os.environ.get("GOOGLE_CREDENTIALS_JSON") 

# --- FUNCIÓN CENTRAL DE LECTURA DE GOOGLE SHEETS ---

def get_sheet_data() -> List[Dict[str, str]]:
    """Autentica con el JSON y lee todos los datos de la hoja en tiempo real."""
    if not SERVICE_ACCOUNT_JSON:
        print("ERROR: GOOGLE_CREDENTIALS_JSON no está configurado.")
        # Retorna una lista vacía si la llave no está configurada (importante para evitar fallos de despliegue)
        return [] 
    
    try:
        # 1. Autenticar usando el JSON de la variable de entorno
        # Convertimos el texto JSON a un diccionario de Python
        creds_dict = json.loads(SERVICE_ACCOUNT_JSON)
        gc = gspread.service_account_from_dict(creds_dict)
        
        # 2. Abrir la hoja por su ID (método más robusto)
        sh = gc.open_by_key(SHEET_ID)
        worksheet = sh.worksheet(SHEET_NAME)
        
        # 3. Leer todos los valores (get_all_records() lee la hoja como una lista de diccionarios)
        return worksheet.get_all_records()

    except Exception as e:
        print("❌ Error al acceder a Google Sheets:", str(e))
        return []

# --- RUTAS DE LA API ---

@app.get("/sensor/{sensor_id}", response_model=SensorResponse)
def get_sensor(sensor_id: str):
    """Ruta para obtener el historial de un sensor específico."""
    try:
        rows = get_sheet_data()
        
        datos = []
        for row in rows:
            # Verifica que la columna 'Timestamp' y la columna del sensor tengan datos
            if row.get("Timestamp") and row.get(sensor_id, "").strip():
                datos.append({
                    "timestamp": row["Timestamp"],
                    "valor": row[sensor_id]
                })

        return {"sensor": sensor_id, "datos": datos}

    except Exception as e:
        print(f"❌ Error en /sensor/{sensor_id}:", str(e))
        return {"sensor": sensor_id, "datos": []}

@app.get("/sensores", response_model=List[SensorResponse])
def get_all_sensors():
    """Ruta para obtener los datos de todos los sensores (usada para la Comparativa y Resumen)."""
    sensores = [f"Sensor{i}" for i in range(1, 9)]
    try:
        rows = get_sheet_data()

        resultado = []
        for sensor_id in sensores:
            datos = []
            for row in rows:
                if row.get("Timestamp") and row.get(sensor_id, "").strip():
                    datos.append({
                        "timestamp": row["Timestamp"],
                        "valor": row[sensor_id]
                    })
            resultado.append({"sensor": sensor_id, "datos": datos})
            
        return resultado

    except Exception as e:
        print("❌ Error en /sensores:", str(e))
        return []
    
@app.get("/extras")
def get_extras():
    """Ruta para obtener el estado actual del sistema (Batería, Panel)."""
    # Campos que se esperan para el estado del sistema
    campos = ["voltajePanel", "voltajeBateria", "porcentajeBateria", "porcentajePanel"]
    try:
        rows = get_sheet_data()
        
        # Iteramos al revés para encontrar la fila más reciente con datos completos
        for row in reversed(rows):
            # Comprueba que todos los campos de extras tengan un valor
            if all(row.get(campo, "").strip() != "" for campo in campos):
                return {campo: row[campo] for campo in campos}
                
        return {campo: None for campo in campos}
    except Exception as e:
        print("❌ Error en /extras:", str(e))
        return {campo: None for campo in campos}
