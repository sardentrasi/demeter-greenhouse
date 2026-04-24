document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const moistVal = document.getElementById('moisture-val');
    const tempVal = document.getElementById('temp-val');
    const humidityVal = document.getElementById('humidity-val');
    const co2Val = document.getElementById('co2-val');
    const actionBadge = document.getElementById('action-badge');
    const statusDesc = document.getElementById('system-status-badge');
    const lastSeenTime = document.getElementById('last-seen-time');
    
    const latestCapture = document.getElementById('latest-capture');
    const noImage = document.getElementById('no-image');
    const logList = document.getElementById('log-list');

    // ===== CHART SETUP =====
    const ctx = document.getElementById('sensor-chart');
    let sensorChart = null;
    
    if (ctx) {
        sensorChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Humidity',
                        data: [],
                        borderColor: '#9fe870',
                        backgroundColor: function(context) {
                            const chart = context.chart;
                            const {ctx: c, chartArea} = chart;
                            if (!chartArea) return 'rgba(159,232,112,0)';
                            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            gradient.addColorStop(0, 'rgba(159,232,112,0.4)');
                            gradient.addColorStop(1, 'rgba(159,232,112,0)');
                            return gradient;
                        },
                        fill: true,
                        tension: 0.4,
                        borderWidth: 4,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: '#9fe870',
                        pointHoverBorderColor: '#fff',
                        pointHoverBorderWidth: 2
                    },
                    {
                        label: 'Temperature',
                        data: [],
                        borderColor: '#163300',
                        backgroundColor: function(context) {
                            const chart = context.chart;
                            const {ctx: c, chartArea} = chart;
                            if (!chartArea) return 'rgba(22,51,0,0)';
                            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            gradient.addColorStop(0, 'rgba(22,51,0,0.1)');
                            gradient.addColorStop(1, 'rgba(22,51,0,0)');
                            return gradient;
                        },
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: '#163300',
                        pointHoverBorderColor: '#fff',
                        pointHoverBorderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#fff',
                        titleColor: '#0e0f0c',
                        bodyColor: '#0e0f0c',
                        borderColor: 'rgba(14,15,12,0.08)',
                        borderWidth: 1,
                        cornerRadius: 16,
                        padding: 14,
                        titleFont: { weight: '900', size: 11, family: 'Inter' },
                        bodyFont: { weight: '700', size: 11, family: 'Inter' },
                        usePointStyle: true,
                        callbacks: {
                            title: function(items) {
                                return items[0].label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: '#e8ebe6', drawBorder: false },
                        ticks: { 
                            color: '#868685', 
                            font: { weight: '700', size: 11, family: 'Inter' },
                            padding: 12
                        }
                    },
                    y: {
                        grid: { color: '#e8ebe6', drawBorder: false },
                        ticks: { 
                            color: '#868685', 
                            font: { weight: '700', size: 11, family: 'Inter' } 
                        }
                    }
                }
            }
        });
    }

    // ===== FETCH STATUS =====
    async function fetchStatus() {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            
            moistVal.textContent = data.moisture;
            tempVal.textContent = data.temp;
            if (humidityVal) humidityVal.textContent = data.humidity;
            if (co2Val) co2Val.textContent = data.co2;
            
            // Format time
            if (data.last_seen) {
                const dt = new Date(data.last_seen);
                const timeStr = dt.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                const dateStr = dt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}).toUpperCase();
                lastSeenTime.textContent = `${timeStr}, ${dateStr}`;
            }

            // Action Badge
            if (actionBadge) actionBadge.textContent = data.action;
            if (statusDesc) statusDesc.textContent = data.status;

            // Image
            if (data.latest_image) {
                latestCapture.src = `/vision_capture/${data.latest_image}?t=${new Date().getTime()}`;
                latestCapture.style.display = 'block';
                latestCapture.classList.remove('hidden');
                noImage.style.display = 'none';
            } else {
                latestCapture.style.display = 'none';
                latestCapture.classList.add('hidden');
                noImage.style.display = 'flex';
            }
        } catch (e) {
            console.error("Status fetch error:", e);
        }
    }

    // ===== FETCH HISTORY =====
    async function fetchHistory() {
        try {
            const res = await fetch('/api/history');
            const data = await res.json();
            
            // Data comes newest-first from API, reverse for chart
            const chronological = [...data].reverse();
            
            // Update Chart
            if (sensorChart && chronological.length > 0) {
                sensorChart.data.labels = chronological.map(r => {
                    const ts = r.timestamp;
                    if (ts && ts.includes(' ')) return ts.split(' ')[1].substring(0, 5);
                    return ts || '--';
                });
                sensorChart.data.datasets[0].data = chronological.map(r => r.humidity || 0);
                sensorChart.data.datasets[1].data = chronological.map(r => r.temp || 0);
                sensorChart.update('none');
            }

            // Update Log Panel (timeline)
            if (logList && data.length > 0) {
                logList.innerHTML = '';
                
                const logColors = [
                    { bg: 'bg-[#e2f6d5]', text: 'text-[#163300]' },
                    { bg: 'bg-[#cdffad]', text: 'text-[#163300]' },
                    { bg: 'bg-[rgba(56,200,255,0.15)]', text: 'text-[#0e0f0c]' },
                    { bg: 'bg-[#e8ebe6]', text: 'text-[#454745]' }
                ];

                data.slice(0, 6).forEach((row, i) => {
                    const color = logColors[i % logColors.length];
                    const isLast = i === Math.min(data.length, 6) - 1;
                    
                    const item = document.createElement('div');
                    item.className = `flex gap-4 items-start relative ${!isLast ? 'before:absolute before:left-6 before:top-12 before:bottom-[-24px] before:w-px before:bg-[#e8ebe6]' : ''}`;
                    
                    item.innerHTML = `
                        <div class="w-12 h-12 rounded-full ${color.bg} ${color.text} flex items-center justify-center shrink-0 z-10 shadow-sm border border-white">
                            <i data-lucide="user" class="w-5 h-5" stroke-width="2.5"></i>
                        </div>
                        <div class="flex-1 pt-1">
                            <p class="font-bold text-[#0e0f0c] text-[14px]">${row.action === 'SIRAM' ? 'Auto System' : 'Sensor Report'}</p>
                            <p class="text-[11px] font-bold uppercase tracking-widest text-[#868685] mt-1">${row.timestamp}</p>
                            <div class="mt-2 text-[12px] font-semibold text-[#454745] bg-[#e8ebe6] inline-block px-3 py-1.5 rounded-lg">
                                ${row.action === 'SIRAM' ? 'Irrigation Activated' : `M:${row.moisture}% · T:${row.temp}°C · H:${row.humidity || 0}%`}
                            </div>
                        </div>
                    `;
                    logList.appendChild(item);
                });

                // Re-create Lucide icons for injected HTML
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
        } catch (e) {
            console.error("History fetch error:", e);
        }
    }

    // ===== INIT =====
    fetchStatus();
    fetchHistory();
    
    // Polling
    setInterval(fetchStatus, 5000);
    setInterval(fetchHistory, 15000);
});

function forceAnalyze() {
    alert("Manual visual scan triggered. Connect to /lapor endpoint for full integration.");
}

function forceWater() {
    alert("Force watering command triggered (mock).");
}
