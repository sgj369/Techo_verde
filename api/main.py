import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
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
# ID de tu Google Sheet
SHEET_ID = "1Mu0mfmwoWRI_kJ8EweGpJT1g608t6EQixtfevX0z0ac"
SHEET_NAME = "Lecturas" # Nombre de la pestaña con los datos

# Leemos la llave secreta JSON de la variable de entorno configurada en Render
SERVICE_ACCOUNT_JSON = os.environ.get("GOOGLE_CREDENTIALS_JSON") 

# --- FUNCIÓN CENTRAL DE LECTURA DE GOOGLE SHEETS (CORREGIDA) ---

def get_sheet_data() -> List[Dict[str, str]]:
    """Autentica con el JSON y lee todos los datos de la hoja de manera robusta."""
    if not SERVICE_ACCOUNT_JSON:
        print("ERROR: GOOGLE_CREDENTIALS_JSON no está configurado.")
        return [] 
    
    try:
        # 1. Autenticar
        creds_dict = json.loads(SERVICE_ACCOUNT_JSON)
        gc = gspread.service_account_from_dict(creds_dict)
        
        # 2. Abrir la hoja por su ID
        sh = gc.open_by_key(SHEET_ID)
        worksheet = sh.worksheet(SHEET_NAME)
        
        # 3. Leer todos los valores como lista de listas (más robusto que get_all_records)
        all_values = worksheet.get_all_values()
        
        if not all_values:
            return []
            
        # 4. Mapear manualmente los datos (Saltamos la fila de encabezado y mapeamos)
        headers = all_values[0] # La primera fila es el encabezado
        data_rows = all_values[1:] # El resto son datos
        
        processed_data = []
        for row in data_rows:
            row_dict = {}
            for i, header in enumerate(headers):
                # Asignamos el valor, rellenando con cadenas vacías si la fila es más corta
                row_dict[header] = row[i] if i < len(row) else ""
            processed_data.append(row_dict)
            
        return processed_data

    except Exception as e:
        # Este error ahora solo se activará por fallos de red o de clave, no por encabezados
        print("❌ Error al acceder a Google Sheets:", str(e))
        return []

# --- RUTAS DE LA API (SIN CAMBIOS DE LÓGICA) ---

@app.get("/sensor/{sensor_id}", response_model=SensorResponse)
def get_sensor(sensor_id: str):
    """Ruta para obtener el historial de un sensor específico."""
    try:
        rows = get_sheet_data()
        
        datos = []
        for row in rows:
            # Ahora la verificación es más robusta porque el mapeo se hizo en get_sheet_data()
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
    """Ruta para obtener los datos de todos los sensores."""
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
    campos = ["voltajePanel", "voltajeBateria", "porcentajeBateria", "porcentajePanel"]
    try:
        rows = get_sheet_data()
        
        # Iteramos al revés para encontrar la fila más reciente con datos completos
        for row in reversed(rows):
            if all(row.get(campo, "").strip() != "" for campo in campos):
                return {campo: row[campo] for campo in campos}
                
        return {campo: None for campo in campos}
    except Exception as e:
        print("❌ Error en /extras:", str(e))
        return {campo: None for campo in campos}
