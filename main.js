// main.js

// Definición de colores para cada sensor (usados en gráficas y resumen)
const COLORES_SENSORES = [
    '#10b981', // Sensor 1: Emerald/Verde Vivo (tailwind-500)
    '#3b82f6', // Sensor 2: Blue
    '#f97316', // Sensor 3: Orange
    '#ec4899', // Sensor 4: Pink
    '#a855f7', // Sensor 5: Purple
    '#14b8a6', // Sensor 6: Teal
    '#f59e0b', // Sensor 7: Amber/Amarillo
    '#ef4444'  // Sensor 8: Red
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

    const menuToggle = document.getElementById("menuToggle");
    const sideMenu = document.getElementById("sideMenu");

    if (menuToggle && sideMenu) {
        menuToggle.addEventListener("click", () => {
            sideMenu.classList.toggle("hidden");
        });
        // Ocultar menú al hacer clic fuera
        document.addEventListener("click", (e) => {
            if (!sideMenu.contains(e.target) && !menuToggle.contains(e.target)) {
                sideMenu.classList.add("hidden");
            }
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

        if (sectionId === "resumenPanel") {
            initResumenPanel();
        } else if (sectionId === "mainPanel") {
            const selectedSensor = sensorSelect.value || "Sensor1";
            updateSensor(selectedSensor);
        } else if (sectionId === "historyPanel") {
            initComparativa();
        }

        if (sideMenu) sideMenu.classList.add("hidden");
    }

    // Hacer la función accesible globalmente
    window.showSection = showSection;

    // --- FUNCIONES DE FETCHING DE DATOS ---

    async function fetchSensorData(sensorId) {
        try {
            const response = await fetch(`${apiUrl}/sensor/${sensorId}`);
            const json = await response.json();
            // ¡IMPORTANTE! Devolver los datos en orden natural: Antiguo -> Reciente
            return json.datos; 
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

    // --- FUNCIONES DE RENDERIZADO ---

    function updateTable(data) {
        if (!tableBody) return;
        tableBody.innerHTML = "";
        
        // Invertir la lista para mostrar el dato más reciente primero en la tabla
        data.slice().reverse().forEach(({ timestamp, valor }) => { 
            const row = `<tr><td class='border-b border-gray-100 px-4 py-2'>${timestamp}</td><td class='border-b border-gray-100 px-4 py-2 font-medium'>${valor}</td></tr>`;
            tableBody.innerHTML += row;
        });
    }

    function updateChart(data, sensorId) {
        if (!chartCanvas) return;

        const sensorIndex = parseInt(sensorId.replace("Sensor", "")) - 1;
        const colorSensor = COLORES_SENSORES[sensorIndex] || '#000000';

        // Usamos la data como viene [Antiguo -> Reciente] para el orden cronológico del gráfico
        const timestamps = data.map(d => d.timestamp); 
        const valores = data.map(d => parseFloat(d.valor));

        if (chart) chart.destroy();

        chart = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: timestamps,
                datasets: [{
                    label: `${sensorId}`,
                    data: valores,
                    borderColor: colorSensor,
                    backgroundColor: colorSensor + '40', 
                    tension: 0.3,
                    pointRadius: 3,
                    fill: false 
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { title: { display: true, text: "Tiempo", color: '#4b5563' } },
                    y: { 
                        title: { display: true, text: "Valor Registrado", color: '#4b5563' },
                        grid: { color: '#e5e7eb' } 
                    }
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
            const colores = COLORES_SENSORES;

            if (!sensores || sensores.length === 0) {
                console.warn("No hay sensores disponibles.");
                return;
            }

            // Datos ya vienen Oldest -> Newest. Usamos slice().reverse() para el orden cronológico.
            const etiquetas = sensores[0]?.datos.map(d => d.timestamp) || [];

            const datasets = sensores.map((sensor, i) => ({
                label: sensor.sensor,
                data: sensor.datos.map(d => parseFloat(d.valor)), 
                borderColor: colores[i % colores.length],
                tension: 0.3,
                pointRadius: 2,
                fill: false,
                hidden: !(i === 0 || i === 7) 
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
                            position: 'bottom', 
                            labels: {
                                usePointStyle: true,
                                padding: 20
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: 'Tiempo', color: '#4b5563' }
                        },
                        y: {
                            title: { display: true, text: 'Valor Registrado', color: '#4b5563' },
                            beginAtZero: false,
                            grid: { color: '#e5e7eb' }
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
        if (tbody) tbody.innerHTML = ""; 

        sensores.forEach((sensor, i) => { 
            const datos = sensor.datos;
            const colorSensor = COLORES_SENSORES[i] || '#000000';
            
            // TOMAR EL ÚLTIMO ELEMENTO DE LA LISTA (EL MÁS RECIENTE)
            const ultimo = datos[datos.length - 1]; 

            if (ultimo && tbody) {
                const row = document.createElement("tr");
                row.classList.add('hover:bg-green-50', 'transition', 'duration-100');

                row.innerHTML = `
                    <td class="border-b border-gray-100 px-4 py-2 flex items-center">
                        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${colorSensor}; margin-right:10px;"></span>
                        ${sensor.sensor}
                    </td>
                    <td class="border-b border-gray-100 px-4 py-2 font-semibold">${ultimo.valor ?? "--"}</td>
                    <td class="border-b border-gray-100 px-4 py-2 text-gray-500 text-xs">${ultimo.timestamp ?? "--"}</td>
                `;

                tbody.appendChild(row);
            }
        });

        // Estado del sistema
        if (document.getElementById("voltajePanel")) document.getElementById("voltajePanel").textContent = (extras.voltajePanel ?? "--") + " V";
        if (document.getElementById("voltajeBateria")) document.getElementById("voltajeBateria").textContent = (extras.voltajeBateria ?? "--") + " V";

        // Lógica de la Batería (Efecto de Relleno)
        const bateriaPct = parseFloat(extras.porcentajeBateria) || 0;
        if (document.getElementById("porcentajeBateria")) document.getElementById("porcentajeBateria").textContent = bateriaPct + "%";
        
        const bateriaFill = document.getElementById("bateriaFill");
        if (bateriaFill) {
            bateriaFill.style.width = bateriaPct + "%";
            bateriaFill.style.backgroundColor = bateriaPct > 50 ? '#10b981' : (bateriaPct > 20 ? '#f97316' : '#ef4444');
        }

        // Lógica del Panel Solar (Ícono y color)
        const panelPct = parseFloat(extras.porcentajePanel) || 0;
        if (document.getElementById("porcentajePanel")) document.getElementById("porcentajePanel").textContent = panelPct + "%";
        
        const panelIcon = document.getElementById("panelIcon");
        if (panelIcon) {
            panelIcon.style.color = panelPct > 10 ? '#f59e0b' : '#9ca3af'; 
            panelIcon.textContent = panelPct > 0 ? '☀️' : '☁️';
        }
    }

    // Inicialización general
    initSensorSelect();
    initResumenPanel();
    showSection("resumenPanel"); 
});
