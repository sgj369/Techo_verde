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
