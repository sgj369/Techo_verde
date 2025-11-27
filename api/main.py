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
    """Ruta para obtener el estado actual del sistema (Batería, Panel) y Sensores Ambientales."""
    
    # Lista de todos los campos que el frontend espera en /extras
    campos_energeticos = ["voltajePanel", "voltajeBateria", "porcentajeBateria", "porcentajePanel"]
    
    # ¡AQUÍ ESTÁ LA CORRECCIÓN! Usamos los nombres de columna de tu imagen (sin espacios)
    campos_ambientales = ["AHT Temp", "AHT Hum", "BMP Temp", "Presión", "Luz"]
    
    campos_totales = campos_energeticos + campos_ambientales

    try:
        rows = get_sheet_data()
        
        # Iteramos al revés para encontrar la fila más reciente con datos
        for row in reversed(rows):
            # Aseguramos que la fila tenga valores para todos los campos críticos (usaremos los energéticos como críticos)
            if all(row.get(campo, "").strip() != "" for campo in campos_energeticos):
                
                # Mapeamos todos los campos totales para devolverlos
                response_data = {}
                for campo in campos_totales:
                    # Usamos el nombre de campo de la hoja como clave
                    # El frontend (main.js) deberá mapear "AHT Temp" a "ahtTemp"
                    response_data[campo] = row[campo] if campo in row else None
                    
                # Antes de devolver, normalizamos las claves ambientales al formato camelCase
                # que espera main.js
                response_data_final = {
                    "voltajePanel": response_data.get("voltajePanel"),
                    "voltajeBateria": response_data.get("voltajeBateria"),
                    "porcentajeBateria": response_data.get("porcentajeBateria"),
                    "porcentajePanel": response_data.get("porcentajePanel"),
                    "ahtTemp": response_data.get("AHT Temp"), # Clave corregida
                    "ahtHum": response_data.get("AHT Hum"),   # Clave corregida
                    "bmpTemp": response_data.get("BMP Temp"), # Clave corregida
                    "presion": response_data.get("Presión"), # Clave corregida
                    "luz": response_data.get("Luz"),         # Clave corregida
                }
                
                return response_data_final
                
        # Si no encontramos ninguna fila con datos energéticos completos, devolvemos Nulo
        return {
            "voltajePanel": None, "voltajeBateria": None, "porcentajeBateria": None, "porcentajePanel": None,
            "ahtTemp": None, "ahtHum": None, "bmpTemp": None, "presion": None, "luz": None
        }
    except Exception as e:
        print("❌ Error en /extras:", str(e))
        return {
            "voltajePanel": None, "voltajeBateria": None, "porcentajeBateria": None, "porcentajePanel": None,
            "ahtTemp": None, "ahtHum": None, "bmpTemp": None, "presion": None, "luz": None
        }
