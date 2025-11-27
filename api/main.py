import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import gspread
import json

# --- CONFIGURACIÓN DE FASTAPI Y CORS ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

# --- VARIABLES DE ENTORNO ---
# Nombre de tu hoja (Lecturas) y URL del Sheet
SHEET_NAME = "Lecturas"
# El JSON completo de la Cuenta de Servicio lo leeremos de Render
SERVICE_ACCOUNT_JSON = os.environ.get("GOOGLE_CREDENTIALS_JSON") 
SHEET_URL = "https://docs.google.com/spreadsheets/d/1Mu0mfmwoWRI_kJ8EweGpJT1g608t6EQixtfevX0z0ac/edit" # Usaremos esta URL para abrir

# --- FUNCIÓN DE ACCESO A GOOGLE SHEETS ---

def get_sheet_client():
    """Autentica y devuelve el objeto gspread de la hoja."""
    if not SERVICE_ACCOUNT_JSON:
        raise Exception("GOOGLE_CREDENTIALS_JSON no está configurado.")
    
    # 1. Autenticar usando el JSON de la variable de entorno
    # gspread requiere un archivo, por lo que creamos uno temporal o usamos from_json_keyfile_dict
    
    # Opción más limpia: usar from_json_keyfile_dict (requiere gspread>=4.0 y oauth2client)
    creds_dict = json.loads(SERVICE_ACCOUNT_JSON)
    gc = gspread.service_account_from_dict(creds_dict)
    
    # 2. Abrir el spreadsheet y la hoja
    sh = gc.open_by_url(SHEET_URL)
    worksheet = sh.worksheet(SHEET_NAME)
    return worksheet

def get_all_sheet_data(worksheet: gspread.Worksheet) -> List[Dict[str, str]]:
    """Lee todos los datos de la hoja y los devuelve como lista de diccionarios."""
    # Lee todos los valores, incluyendo el encabezado
    data = worksheet.get_all_records() 
    return data

# --- RUTAS DE LA API ---

@app.get("/sensor/{sensor_id}", response_model=SensorResponse)
def get_sensor(sensor_id: str):
    try:
        worksheet = get_sheet_client()
        rows = get_all_sheet_data(worksheet)
        
        datos = []
        for row in rows:
            # Reemplazamos 'Timestamp' con el nombre real de tu columna de fecha
            if sensor_id in row and row.get(sensor_id, "").strip():
                datos.append({
                    "timestamp": row["Timestamp"], # Usamos la columna real de tu hoja
                    "valor": row[sensor_id]
                })

        return {"sensor": sensor_id, "datos": datos}

    except Exception as e:
        print(f"❌ Error en /sensor/{sensor_id}:", str(e))
        return {"sensor": sensor_id, "datos": []}

@app.get("/sensores", response_model=List[SensorResponse])
def get_all_sensors():
    sensores = [f"Sensor{i}" for i in range(1, 9)]
    try:
        worksheet = get_sheet_client()
        rows = get_all_sheet_data(worksheet)

        resultado = []
        for sensor_id in sensores:
            datos = []
            for row in rows:
                if sensor_id in row and row.get(sensor_id, "").strip():
                    datos.append({
                        "timestamp": row["Timestamp"],
                        "valor": row[sensor_id]
                    })
            resultado.append({"sensor": sensor_id, "datos": datos})
            
        return resultado

    except Exception as e:
        print("❌ Error en /sensores:", str(e))
        return []

# --- Ruta /extras (ajustada para el nuevo método de lectura) ---

@app.get("/extras")
def get_extras():
    campos = ["voltajePanel", "voltajeBateria", "porcentajeBateria", "porcentajePanel"]
    try:
        worksheet = get_sheet_client()
        rows = get_all_sheet_data(worksheet)

        # Tomamos la fila más reciente con todos los valores no vacíos
        for row in reversed(rows):
            # Tu código necesita el nombre real de las columnas Q, R, S, T.
            # Asumo que tu amigo ya las nombró correctamente en la primera fila.
            if all(row.get(campo, "").strip() != "" for campo in campos):
                return {campo: row[campo] for campo in campos}
                
        return {campo: None for campo in campos}
    except Exception as e:
        print("❌ Error en /extras:", str(e))
        return {campo: None for campo in campos}

