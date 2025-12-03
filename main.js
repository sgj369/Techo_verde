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

// ***************************************
// FUNCIÓN PARA ABRIR LA HOJA DE CÁLCULO
// ***************************************
window.openGoogleSheet = function() {
    // ID de tu Google Sheet (tomado de tu main.py)
    const SHEET_ID = "1Mu0mfmwoWRI_kJ8EweGpJT1g608t6EQixtfevX0z0ac"; 
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/view#gid=0`;
    
    window.open(url, '_blank'); // Abre la URL en una nueva pestaña
};


document.addEventListener("DOMContentLoaded", () => {
    const apiUrl = "https://techo-verde.onrender.com";

    // DOM Elements (Se mantienen)
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
            initComparativa(); // Inicializa la gráfica de Comparativa
        }

        if (sideMenu) sideMenu.classList.add("hidden");
    }

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
        [...data].reverse().forEach(({ timestamp, valor }) => { 
            const row = `<tr><td class='border-b border-gray-100 px-4 py-2'>${timestamp}</td><td class='border-b border-gray-100 px-4 py-2 font-medium'>${valor}</td></tr>`;
            tableBody.innerHTML += row;
        });
    }

    function updateChart(data, sensorId) {
        if (!chartCanvas) return;

        const sensorIndex = parseInt(sensorId.replace("Sensor", "")) - 1;
        const colorSensor = COLORES_SENSORES[sensorIndex] || '#000000';

        const datosOrdenCronologico = [...data].reverse();

        // **CORRECCIÓN DE TYPO** (Ya no es 'datosOrdenologico')
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

            const etiquetas = sensores[0]?.datos.map(d => d.timestamp).reverse() || [];

            const datasets = sensores.map((sensor, i) => ({
                label: sensor.sensor,
                data: sensor.datos.map(d => parseFloat(d.valor)).reverse(), 
                borderColor: colores[i % colores.length],
                tension: 0.3,
                pointRadius: 2,
                fill: false,
                // **CORRECCIÓN:** Se elimina la propiedad 'hidden' o se cambia la lógica.
                // Recomiendo eliminarla para que todos se muestren por defecto:
                // hidden: !(i === 0 || i === 7) 
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
    
    // ... (El resto de la función initResumenPanel ya es correcta) ...
    // Asegúrate de que los cambios de px-2 y py-1 siguen ahí:

    async function initResumenPanel() {
        const sensores = await fetchAllSensors();
        const extras = await fetchExtras();

        const tbody = document.getElementById("tbodySensores");
        if (tbody) tbody.innerHTML = "";

        sensores.forEach((sensor, i) => { 
            const datos = sensor.datos;
            const colorSensor = COLORES_SENSORES[i] || '#000000';
            
            const ultimo = datos[0];

            if (ultimo && tbody) {
                const row = document.createElement("tr");
                row.classList.add('hover:bg-green-50', 'transition', 'duration-100');

                row.innerHTML = `
                    <td class="border-b border-gray-100 px-2 py-1 flex items-center">
                        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${colorSensor}; margin-right:10px;"></span>
                        ${sensor.sensor}
                    </td>
                    <td class="border-b border-gray-100 px-2 py-1 font-semibold text-center">${ultimo.valor ?? "--"}</td>
                    <td class="border-b border-gray-100 px-2 py-1 text-gray-500 text-xs text-left">${ultimo.timestamp ?? "--"}</td>
                `;

                tbody.appendChild(row);
            }
        });
        
        // ... (resto de la función initResumenPanel) ...
        
        // =======================================================
        // ACTUALIZACIÓN DE ESTADO DEL SISTEMA (ENERGÉTICO)
        // =======================================================
        if (document.getElementById("voltajePanel")) document.getElementById("voltajePanel").textContent = (extras.voltajePanel ?? "--") + " V";
        if (document.getElementById("voltajeBateria")) document.getElementById("voltajeBateria").textContent = (extras.voltajeBateria ?? "--") + " V";

        // Lógica de la Batería
        const bateriaPct = parseFloat(extras.porcentajeBateria) || 0;
        if (document.getElementById("porcentajeBateria")) document.getElementById("porcentajeBateria").textContent = bateriaPct + "%";
        
        const bateriaFill = document.getElementById("bateriaFill");
        if (bateriaFill) {
            bateriaFill.style.width = bateriaPct + "%";
            bateriaFill.style.backgroundColor = bateriaPct > 50 ? '#10b981' : (bateriaPct > 20 ? '#f97316' : '#ef4444');
        }

        // Lógica del Panel Solar
        const panelPct = parseFloat(extras.porcentajePanel) || 0;
        if (document.getElementById("porcentajePanel")) document.getElementById("porcentajePanel").textContent = panelPct + "%";
        
        const panelIcon = document.getElementById("panelIcon");
        if (panelIcon) {
            panelIcon.style.color = panelPct > 10 ? '#f59e0b' : '#9ca3af'; 
            panelIcon.textContent = panelPct > 0 ? '☀️' : '☁️';
        }

        // =======================================================
        // ******* NUEVOS SENSORES AMBIENTALES (con lógica de íconos) *******
        // =======================================================
        
        // AHT Temp (Temperatura Ambiente)
        const ahtTemp = parseFloat(extras.ahtTemp) || 0;
        if (document.getElementById("ahtTemp")) {
            document.getElementById("ahtTemp").textContent = ahtTemp.toFixed(2) + " °C";
        }
        const ahtTempIcon = document.getElementById("ahtTempIcon");
        if (ahtTempIcon) {
            if (ahtTemp > 30) { ahtTempIcon.textContent = '🥵'; ahtTempIcon.style.color = '#ef4444'; }
            else if (ahtTemp < 10 && ahtTemp > 0) { ahtTempIcon.textContent = '🥶'; ahtTempIcon.style.color = '#3b82f6'; }
            else if (ahtTemp <= 0) { ahtTempIcon.textContent = '❄️'; ahtTempIcon.style.color = '#bfdbfe'; }
            else { ahtTempIcon.textContent = '🌡️'; ahtTempIcon.style.color = '#ef4444'; }
        }

        // AHT Hum (Humedad Ambiente)
        const ahtHum = parseFloat(extras.ahtHum) || 0;
        if (document.getElementById("ahtHum")) {
            document.getElementById("ahtHum").textContent = ahtHum.toFixed(2) + " %";
        }
        const ahtHumIcon = document.getElementById("ahtHumIcon");
        if (ahtHumIcon) {
            if (ahtHum > 70) { ahtHumIcon.textContent = '🌧️'; ahtHumIcon.style.color = '#2563eb'; }
            else if (ahtHum < 30) { ahtHumIcon.textContent = '🏜️'; ahtHumIcon.style.color = '#f97316'; }
            else { ahtHumIcon.textContent = '💧'; ahtHumIcon.style.color = '#0ea5e9'; }
        }

        // BMP Temp (Temperatura de Presión)
        const bmpTemp = parseFloat(extras.bmpTemp) || 0;
        if (document.getElementById("bmpTemp")) {
            document.getElementById("bmpTemp").textContent = bmpTemp.toFixed(2) + " °C";
        }
        const bmpTempIcon = document.getElementById("bmpTempIcon");
        if (bmpTempIcon) {
            if (bmpTemp > 30) { bmpTempIcon.textContent = '🔥'; bmpTempIcon.style.color = '#dc2626'; }
            else if (bmpTemp < 10 && bmpTemp > 0) { bmpTempIcon.textContent = '🧊'; bmpTempIcon.style.color = '#60a5fa'; }
            else if (bmpTemp <= 0) { bmpTempIcon.textContent = '🥶'; bmpTempIcon.style.color = '#3b82f6'; }
            else { bmpTempIcon.textContent = '🌡️'; bmpTempIcon.style.color = '#ef4444'; }
        }

        // Presión (Presión Atmosférica)
        const presion = parseFloat(extras.presion) || 0;
        if (document.getElementById("presion")) {
            document.getElementById("presion").textContent = presion.toFixed(2) + " hPa";
        }
        const presionIcon = document.getElementById("presionIcon");
        if (presionIcon) {
            if (presion > 1010) { presionIcon.textContent = '📈'; presionIcon.style.color = '#16a34a'; }
            else if (presion < 990) { presionIcon.textContent = '📉'; presionIcon.style.color = '#dc2626'; }
            else { presionIcon.textContent = '🌬️'; presionIcon.style.color = '#6b7280'; }
        }
        
        // Luz (Nivel de Luz)
        const luz = parseFloat(extras.luz) || 0;
        if (document.getElementById("luz")) {
            document.getElementById("luz").textContent = luz.toFixed(2);
        }
        const luzIcon = document.getElementById("luzIcon");
        if (luzIcon) {
            if (luz > 800) { luzIcon.textContent = '☀️'; luzIcon.style.color = '#fde047'; }
            else if (luz > 200) { luzIcon.textContent = '💡'; luzIcon.style.color = '#facc15'; }
            else if (luz > 50) { luzIcon.textContent = '🕯️'; luzIcon.style.color = '#fcd34d'; }
            else { luzIcon.textContent = '🌑'; luzIcon.style.color = '#374151'; }
        }
    }

    // Inicialización general
    initSensorSelect();
    initResumenPanel();
    showSection("resumenPanel");
    // Esto llama a initResumenPanel (que recarga todos los datos) cada 30 segundos.
    setInterval(initResumenPanel, 30000); 
 // <--- El "});" es el cierre del document.addEventListener("DOMContentLoaded"
});
