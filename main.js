// main.js

// Definición de colores para cada sensor (usados en gráficas y resumen)
const COLORES_SENSORES = [
    '#22c55e', // Sensor 1: Verde
    '#3b82f6', // Sensor 2: Azul
    '#f97316', // Sensor 3: Naranja
    '#ec4899', // Sensor 4: Rosa
    '#a855f7', // Sensor 5: Púrpura
    '#14b8a6', // Sensor 6: Verde Agua
    '#f59e0b', // Sensor 7: Ámbar/Amarillo
    '#ef4444'  // Sensor 8: Rojo
];


document.addEventListener("DOMContentLoaded", () => {
  const apiUrl = "https://techo-verde.onrender.com";

  // DOM Elements
  const sensorLabel = document.getElementById("sensorLabel");
  const sensorSelect = document.getElementById("sensorSelect");
  const tableBody = document.getElementById("sensorTableBody");
  const chartCanvas = document.getElementById("sensorChart")?.getContext("2d");
  const compareChartCanvas = document.getElementById("compareChart")?.getContext("2d");
  const downloadButton = document.getElementById("downloadBtn");
  const resumenContainer = document.getElementById("resumenContainer");

  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");

  if (menuToggle && sideMenu) {
    menuToggle.addEventListener("click", () => {
      sideMenu.classList.toggle("hidden");
    });
  }

  let chart;
  let compareChart;

function showSection(sectionId) {
  const sections = ["resumenPanel", "mainPanel", "historyPanel"];
  sections.forEach(id => {
    const panel = document.getElementById(id);
    if (panel) panel.classList.add("hidden");
  });

  const target = document.getElementById(sectionId);
  if (target) target.classList.remove("hidden");

  // Ejecuta función específica según el panel mostrado
  if (sectionId === "resumenPanel") {
    initResumenPanel();
  } else if (sectionId === "mainPanel") {
    updateSensor("Sensor1");
  } else if (sectionId === "historyPanel") {
    initComparativa();
  }

  if (sideMenu) sideMenu.classList.add("hidden");
}

// Hacer la función accesible globalmente
window.showSection = showSection;

  async function fetchSensorData(sensorId) {
    try {
      const response = await fetch(`${apiUrl}/sensor/${sensorId}`);
      const json = await response.json();
      return json.datos.reverse();
    } catch (err) {
      console.error("Error al obtener datos:", err);
      return [];
    }
  }

  async function fetchAllSensors() {
    try {
      const response = await fetch(`${apiUrl}/sensores`);
      return await response.json();
    } catch (err) {
      console.error("Error al obtener sensores:", err);
      return [];
    }
  }

  async function fetchExtras() {
    try {
      const response = await fetch(`${apiUrl}/extras`);
      return await response.json();
    } catch (err) {
      console.error("Error al obtener extras:", err);
      return {};
    }
  }

  function updateTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = "";
    data.forEach(({ timestamp, valor }) => {
      const row = `<tr><td class='border px-4 py-2'>${timestamp}</td><td class='border px-4 py-2'>${valor}</td></tr>`;
      tableBody.innerHTML += row;
    });
  }

  function updateChart(data, sensorId) {
    if (!chartCanvas) return;
    
    // Obtener el color asignado al sensor para la gráfica
    const sensorIndex = parseInt(sensorId.replace("Sensor", "")) - 1;
    const colorSensor = COLORES_SENSORES[sensorIndex] || '#000000'; // Fallback a negro

    const datosOrdenCronologico = [...data].reverse();

    const timestamps = datosOrdenCronologico.map(d => d.timestamp);
    const valores = datosOrdenCronologico.map(d => parseFloat(d.valor));

    if (chart) chart.destroy();

    chart = new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels: timestamps,
        datasets: [{
          label: `${sensorId}`,
          data: valores,
          borderColor: colorSensor, // <-- USAR COLOR ASIGNADO
          tension: 0.3,
          pointRadius: 3,
          fill: false
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: { title: { display: true, text: "Tiempo" } },
          y: { title: { display: true, text: "Temperatura" } }
        }
      }
    });
  }

  async function updateSensor(sensorId) {
    if (sensorLabel) {
      sensorLabel.textContent = sensorId.replace("Sensor","");
    }
    const data = await fetchSensorData(sensorId);
    updateTable(data);
    updateChart(data, sensorId);
  }

  function initSensorSelect() {
    for (let i = 1; i <= 8; i++) {
      const option = document.createElement("option");
      option.value = `Sensor${i}`;
      option.textContent = `Sensor ${i}`;
      sensorSelect.appendChild(option);
    }
    sensorSelect.addEventListener("change", (e) => {
      updateSensor(e.target.value);
    });
  }

  if (downloadButton) {
    downloadButton.addEventListener("click", () => {
      if (!compareChart) return;
      const link = document.createElement("a");
      link.href = compareChart.toBase64Image();
      link.download = "grafica_comparativa.png";
      link.click();
    });
  }

  async function initComparativa() {
    if (!compareChartCanvas) {
      console.warn("Canvas de comparativa no encontrado.");
      return;
    }

    try {
      const sensores = await fetchAllSensors();
      // Usamos la constante global de colores
      const colores = COLORES_SENSORES; 

      if (!sensores || sensores.length === 0) {
        console.warn("No hay sensores disponibles.");
        return;
     }

      // La lógica de la API ya viene del más reciente al más antiguo.
      const etiquetas = sensores[0]?.datos.map(d => d.timestamp).reverse() || []; // Reverse para orden cronológico

      const datasets = sensores.map((sensor, i) => ({
        label: sensor.sensor,
        data: sensor.datos.map(d => parseFloat(d.valor)).reverse(), // Reverse para orden cronológico
        borderColor: colores[i % colores.length],
        tension: 0.3,
        pointRadius: 2,
        fill: false,
        hidden: !(i === 0 || i === 7)  // Muestra solo sensor 1 y 8 al inicio
      }));

      if (compareChart) compareChart.destroy();

      compareChart = new Chart(compareChartCanvas, {
        type: 'line',
        data: {
          labels: etiquetas,
          datasets: datasets
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                usePointStyle: true
              }
            }
          },
          scales: {
            x: {
              title: { display: true, text: 'Tiempo' }
            },
            y: {
              title: { display: true, text: 'Temperatura' },
              beginAtZero: false
            }
          }
        }
      });
    } catch (err) {
      console.error("Error en initComparativa:", err);
    }
  }

async function initResumenPanel() {
  const sensores = await fetchAllSensors();
  const extras = await fetchExtras();

  const tbody = document.getElementById("tbodySensores");
  tbody.innerHTML = ""; // Limpia contenido previo

  sensores.forEach((sensor, i) => { // Añadir el índice 'i' para el color
    const datos = sensor.datos;
    const colorSensor = COLORES_SENSORES[i] || '#000000'; // Obtener color
    
    const ultimo = datos[0]; // CORRECCIÓN: Tomar el dato más reciente

    if (ultimo) {
      const row = document.createElement("tr");

      row.innerHTML = `
          <td class="border px-4 py-2 flex items-center">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${colorSensor}; margin-right:8px;"></span>
            ${sensor.sensor}
          </td>
        <td class="border px-4 py-2">${ultimo.valor ?? "--"}</td>
        <td class="border px-4 py-2">${ultimo.timestamp ?? "--"}</td>
      `;

      tbody.appendChild(row);
    }
  });

  // Estado del sistema
  document.getElementById("voltajePanel").textContent = (extras.voltajePanel ?? "--") + " V";
  document.getElementById("voltajeBateria").textContent = (extras.voltajeBateria ?? "--") + " V";

  // Lógica de la Batería (Efecto de Relleno)
  const bateriaPct = parseFloat(extras.porcentajeBateria) || 0;
  document.getElementById("porcentajeBateria").textContent = bateriaPct + "%";
  
  // Establece el ancho y color de la barra
  const bateriaFill = document.getElementById("bateriaFill");
  if (bateriaFill) {
      bateriaFill.style.width = bateriaPct + "%";
      // Lógica de color: Verde (>50), Naranja (>20), Rojo (<20)
      bateriaFill.style.backgroundColor = bateriaPct > 50 ? '#22c55e' : (bateriaPct > 20 ? '#f97316' : '#ef4444');
  }

  // Lógica del Panel Solar (Ícono y color)
  const panelPct = parseFloat(extras.porcentajePanel) || 0;
  document.getElementById("porcentajePanel").textContent = panelPct + "%";
  
  const panelIcon = document.getElementById("panelIcon");
  if (panelIcon) {
      // Cambia el color del ícono (Amarillo si está produciendo, Púrpura si está bajo)
      panelIcon.style.color = panelPct > 10 ? '#f59e0b' : '#a855f7'; 
      // Opcional: Cambiar el ícono si la producción es cero
      panelIcon.textContent = panelPct > 0 ? '☀️' : '☁️';
  }
}

  // Inicialización general
  initSensorSelect();
  initResumenPanel();
  showSection("resumenPanel");
});

---

## 2. 📄 Archivo `index.html` (Ajustes de Estructura Visual)

**Por favor, reemplaza el contenido de tu `index.html` con el siguiente código:**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Techo Verde - Monitor de Sensores</title>
  <script src="[https://cdn.tailwindcss.com](https://cdn.tailwindcss.com)"></script>
  <script src="[https://cdn.jsdelivr.net/npm/chart.js](https://cdn.jsdelivr.net/npm/chart.js)"></script>
</head>
<body class="bg-gray-100 min-h-screen font-sans">
    <header class="bg-green-600 text-white p-4 flex justify-between items-center shadow">
    <h1 class="text-2xl font-bold">Techo Verde</h1>

    <div class="relative inline-block text-left">
      <button id="menuToggle" class="text-white">&#9776; Menú</button>
            <nav id="sideMenu" class="hidden absolute right-0 mt-2 w-40 origin-top-right rounded-lg bg-white shadow-xl border border-gray-100 z-50">
        <ul class="text-gray-800 divide-y divide-gray-100">
          <li>
            <button onclick="showSection('resumenPanel')" class="w-full text-left px-3 py-1.5 text-sm font-medium hover:bg-gray-50">Resumen</button>
          </li>
          <li>
            <button onclick="showSection('mainPanel')" class="w-full text-left px-3 py-1.5 text-sm font-medium hover:bg-gray-50">Historial de Sensores</button>
          </li>
          <li>
            <button onclick="showSection('historyPanel')" class="w-full text-left px-3 py-1.5 text-sm font-medium hover:bg-gray-50">Comparativa</button>
          </li>
        </ul>
      </nav>
    </div>
  </header>

    <main id="mainPanel" class="p-6 hidden">
    <h2 class="text-center text-xl font-semibold mb-4">
      Lecturas recientes - Sensor <span id="sensorLabel"></span>
    </h2>

    <div class="flex justify-center mb-6">
      <select id="sensorSelect" class="p-2 border border-gray-300 rounded">
              </select>
    </div>

    <div class="flex flex-wrap justify-center gap-6">
      <div class="w-full md:w-1/2 max-w-xl">
        <canvas id="sensorChart" class="bg-white p-4 rounded shadow w-full h-96"></canvas>
      </div>
      <div class="w-full md:w-1/2 max-w-xl overflow-x-auto">
        <table class="w-full bg-white rounded shadow text-sm">
          <thead>
            <tr class="bg-gray-200">
              <th class="border px-4 py-2">Fecha y hora</th>
              <th class="border px-4 py-2">Valor</th>
            </tr>
            </thead>
          <tbody id="sensorTableBody"></tbody>
        </table>
      </div>
    </div>
  </main>

      <div id="resumenPanel" class="p-6">
      <h2 class="text-xl font-bold mb-4 text-center">Resumen de Sensores</h2>
      
      <div class="flex justify-center mb-8">
        <div class="w-full max-w-3xl overflow-x-auto bg-white shadow-md rounded">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-200">
              <tr>
                <th class="border px-3 py-2 text-left w-3/12">Sensor</th>
                <th class="border px-3 py-2 text-left w-2/12">Valor</th>
                <th class="border px-3 py-2 text-left w-6/12">Fecha y Hora</th>
              </tr>
            </thead>
            <tbody id="tbodySensores">
                          </tbody>
          </table>
        </div>
      </div>
            <h2 class="text-xl font-bold mt-8 mb-4 text-center">Estado del Sistema</h2>
      
      <div class="flex justify-center">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl text-center">
            
                    <div class="bg-white p-3 rounded shadow">
            <div class="text-xs text-gray-500">Voltaje Panel</div>
            <div class="text-xl font-bold" id="voltajePanel">-- V</div>
          </div>
          
                    <div class="bg-white p-3 rounded shadow">
            <div class="text-xs text-gray-500">Voltaje Batería</div>
            <div class="text-xl font-bold" id="voltajeBateria">-- V</div>
          </div>
          
                    <div class="bg-white p-3 rounded shadow relative overflow-hidden">
              <div class="text-xs text-gray-500 z-10 relative">% Batería</div>
              <div class="text-xl font-bold z-10 relative" id="porcentajeBateria">--%</div>
              <div id="bateriaFill" class="absolute inset-0 transition-all duration-500 ease-out" style="width:0; opacity:0.6;"></div>
          </div>
          
                    <div class="bg-white p-3 rounded shadow">
              <div class="text-xs text-gray-500 flex items-center justify-center">
                  <span id="panelIcon" class="text-xl mr-2 transition-colors duration-500">☀️</span>
                  % Panel Solar
              </div>
              <div class="text-xl font-bold" id="porcentajePanel">--%</div>
          </div>
        </div>
      </div>
          </div>

        <main id="historyPanel" class="p-6 hidden">
      <h2 class="text-center text-xl font-semibold mb-4">
        Comparativa de Sensores
      </h2>

      <div class="flex justify-center">
        <div class="w-full max-w-4xl">
          <canvas id="compareChart" class="bg-white p-4 rounded shadow w-full h-96"></canvas>
        </div>
      </div>
            <div class="flex justify-end mt-4 max-w-4xl mx-auto">
        <button id="downloadBtn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
          Descargar Imagen
        </button>
      </div>
    </main>
  
  <script src="main.js"></script>
</body>
</html>
