# Techo Verde - API FastAPI

Esta es una API desarrollada con FastAPI para leer y exponer datos de sensores desde una hoja de cálculo de Google Sheets. La API permite:

- Ver todos los datos con `/lecturas`
- Consultar un sensor individual con `/sensor/S1`, `/sensor/S2`, etc.

## Despliegue

Este proyecto está listo para desplegarse en [Render](https://render.com) usando:

- `main.py`: aplicación principal
- `start.sh`: script de arranque
- `requirements.txt`: dependencias

## Variables de entorno

- `CSV_URL`: URL pública del archivo CSV de Google Sheets
