
// main.js
document.addEventListener("DOMContentLoaded", () => {
  const apiUrl = "https://techo-verde.onrender.com";

  // DOM Elements
  const sensorLabel = document.getElementById("sensorLabel");
  const sensorSelect = document.getElementById("sensorSelect");
  const tableBody = document.getElementById("sensorTableBody");
  const chartCanvas = document.getElementById("sensorChart")?.getContext("2d");
  const compareChartCanvas = document.getElementById("compareChart")?.getContext("2d");
  const downloadButton = document.getElementById("downloadBtn");
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");

  // Toggle menú lateral
  if (menuToggle && sideMenu) {
    menuToggle.addEventListener("click", () => {
      sideMenu.classList.toggle("hidden");
    });
  }

  let chart;
  let compareChart;

  // Mostrar paneles
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

  // Fetch de datos
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

  // Actualizar tabla
  function updateTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = "";
    data.forEach(({ timestamp, valor }) => {
      const row = `<tr>
        <td class='border px-4 py-2'>${timestamp}</td>
        <td class='border px-4 py-2'>${valor}</td>
      </tr>`;
      tableBody.innerHTML += row;
    });
  }

  // Actualizar gráfica individual
  function updateChart(data, sensorId) {
    if (!chartCanvas) return;

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
          borderColor: "#22c55e",
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
      sensorLabel.textContent = sensorId.replace("Sensor", "");
    }
    const data = await fetchSensorData(sensorId);
    updateTable(data);
    updateChart(data, sensorId);
  }

  // Inicializar select de sensores
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

  // Descargar imagen comparativa
  if (downloadButton) {
    downloadButton.addEventListener("click", () => {
      if (!compareChart) return;
      const link = document.createElement("a");
      link.href = compareChart.toBase64Image();
      link.download = "grafica_comparativa.png";
      link.click();
    });
  }

  // Inicializar comparativa
  async function initComparativa() {
    if (!compareChartCanvas) {
      console.warn("Canvas de comparativa no encontrado.");
      return;
    }

    try {
      const sensores = await fetchAllSensors();
      const colores = ['#22c55e', '#3b82f6', '#f97316', '#ec4899', '#a855f7', '#14b8a6', '#f59e0b', '#ef4444'];

      if (!sensores || sensores.length === 0) {
        console.warn("No hay sensores disponibles.");
        return;
      }

      const etiquetas = sensores[0]?.datos.map(d => d.timestamp) || [];

      const datasets = sensores.map((sensor, i) => ({
        label: sensor.sensor,
        data: sensor.datos.map(d => parseFloat(d.valor)),
        borderColor: colores[i % colores.length],
        tension: 0.3,
        pointRadius: 2,
        fill: false,
        hidden: !(i === 0 || i === 7) // Muestra solo sensor 1 y 8 al inicio
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
              labels: { usePointStyle: true }
            }
          },
          scales: {
            x: { title: { display: true, text: 'Tiempo' } },
            y: { title: { display: true, text: 'Temperatura' }, beginAtZero: false }
          }
        }
      });
    } catch (err) {
      console.error("Error en initComparativa:", err);
    }
  }

  // Inicializar resumen
  async function initResumenPanel() {
    const sensores = await fetchAllSensors();
    const extras = await fetchExtras();

    const tbody = document.getElementById("tbodySensores");
    tbody.innerHTML = ""; // Limpia contenido previo

    sensores.forEach(sensor => {
      const datos = sensor.datos;
      const ultimo = datos[datos.length - 1];
      if (ultimo) {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td class="border px-4 py-2">${sensor.sensor}</td>
          <td class="border px-4 py-2">${ultimo.valor ?? "--"}</td>
          <td class="border px-4 py-2">${ultimo.timestamp ?? "--"}</td>
        `;
        tbody.appendChild(row);
      }
    });

    // Estado del sistema
    document.getElementById("voltajePanel").textContent = (extras.voltajePanel ?? "--") + " V";
    document.getElementById("voltajeBateria").textContent = (extras.voltajeBateria ?? "--") + " V";
    document.getElementById("porcentajeBateria").textContent = (extras.porcentajeBateria ?? "--") + "%";
    document.getElementById("porcentajePanel").textContent = (extras.porcentajePanel ?? "--") + "%";
  }

  // Inicialización general
  initSensorSelect();
  initResumenPanel();
  showSection("resumenPanel");
});
