document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Status
    const moistVal = document.getElementById('moisture-val');
    const tempVal = document.getElementById('temp-val');
    const humidityVal = document.getElementById('humidity-val');
    const co2Val = document.getElementById('co2-val');
    const lastSeenTime = document.getElementById('last-seen-time');
    const systemBadge = document.getElementById('system-status-badge');
    const actionBadge = document.getElementById('action-badge');
    
    // DOM Elements - Images
    const latestCapture = document.getElementById('latest-capture');
    const noImage = document.getElementById('no-image');
    
    // DOM Elements - Logs
    const logList = document.getElementById('log-list');

    // DOM Elements - Sidebar
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('btn-sidebar-toggle');
    const sidebarToggleIcon = document.getElementById('sidebar-toggle-icon');
    
    // DOM Elements - Sidebar Submenu
    const climaticToggle = document.getElementById('btn-climatic-toggle');
    const climaticSubmenu = document.getElementById('climatic-submenu');
    const climaticChevron = document.getElementById('climatic-chevron');

    // DOM Elements - AI Chat
    const chatFab = document.getElementById('chat-fab');
    const chatPanel = document.getElementById('chat-panel');
    const chatClose = document.getElementById('chat-close');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');

    // DOM Elements - Notifications
    const notifBtn = document.getElementById('btn-notifications');
    const notifDropdown = document.getElementById('notif-dropdown');
    const notifCount = document.getElementById('notif-count');
    const notifList = document.getElementById('notif-list');
    const markReadBtn = document.getElementById('btn-mark-read');

    // DOM Elements - Dashboard Controls
    const btnForceScan = document.getElementById('btn-force-scan');
    const btnForceWater = document.getElementById('btn-force-water');

    // ===== CHART SETUP (Only if on Dashboard) =====
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
                        backgroundColor: 'rgba(159, 232, 112, 0.1)',
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
                        backgroundColor: 'rgba(22, 51, 0, 0.05)',
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
                interaction: { mode: 'index', intersect: false },
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
                        bodyFont: { weight: '700', size: 11, family: 'Inter' }
                    }
                },
                scales: {
                    x: { grid: { color: '#e8ebe6', drawBorder: false }, ticks: { color: '#868685', font: { weight: '700', size: 11 } } },
                    y: { grid: { color: '#e8ebe6', drawBorder: false }, ticks: { color: '#868685', font: { weight: '700', size: 11 } } }
                }
            }
        });
    }

    // ===== SIDEBAR LOGIC =====
    if (sidebarToggle) {
        // Load preference
        const isMinimized = localStorage.getItem('sidebar-minimized') === 'true';
        if (isMinimized) {
            sidebar.classList.add('minimized');
            sidebarToggleIcon.setAttribute('data-lucide', 'chevron-right');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('minimized');
            const nowMinimized = sidebar.classList.contains('minimized');
            localStorage.setItem('sidebar-minimized', nowMinimized);
            
            sidebarToggleIcon.setAttribute('data-lucide', nowMinimized ? 'chevron-right' : 'chevron-left');
            if (typeof lucide !== 'undefined') lucide.createIcons();
            
            // Close submenus if minimizing
            if (nowMinimized) {
                climaticSubmenu.classList.remove('show');
                climaticChevron.style.transform = 'rotate(0deg)';
            }
        });
    }

    if (climaticToggle) {
        climaticToggle.addEventListener('click', (e) => {
            e.preventDefault();
            // Don't open submenu if minimized
            if (sidebar.classList.contains('minimized')) {
                sidebar.classList.remove('minimized');
                localStorage.setItem('sidebar-minimized', 'false');
                sidebarToggleIcon.setAttribute('data-lucide', 'chevron-left');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
            climaticSubmenu.classList.toggle('show');
            climaticChevron.style.transform = climaticSubmenu.classList.contains('show') ? 'rotate(180deg)' : 'rotate(0deg)';
        });
        
        // Auto-open if active page is climatic
        if (window.location.pathname.includes('/climatic')) {
            climaticSubmenu.classList.add('show');
            climaticChevron.style.transform = 'rotate(180deg)';
        }
    }

    // ===== NOTIFICATION LOGIC =====
    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
            notifDropdown.classList.toggle('show');
            if (notifDropdown.classList.contains('show')) fetchNotifications();
        });

        markReadBtn.addEventListener('click', async () => {
            await fetch('/api/notifications/read', { method: 'POST' });
            notifCount.classList.add('hidden');
            notifCount.textContent = '0';
            notifList.innerHTML = '<p class="text-center py-6 text-[12px] font-bold text-[#868685] uppercase tracking-wider">No notifications</p>';
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!notifBtn.contains(e.target) && !notifDropdown.contains(e.target)) {
                notifDropdown.classList.remove('show');
            }
        });
    }

    async function fetchNotifications() {
        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();
            
            if (data.length > 0) {
                notifCount.textContent = data.length;
                notifCount.classList.remove('hidden');
                
                notifList.innerHTML = '';
                data.forEach(n => {
                    const icon = n.type === 'irrigation' ? '💦' : '⚙️';
                    const item = document.createElement('div');
                    item.className = 'notif-item p-3 border-b border-[#e8ebe6] flex gap-3 cursor-pointer';
                    item.innerHTML = `
                        <div class="w-8 h-8 rounded-full bg-[#e8ebe6] flex items-center justify-center shrink-0 text-sm">${icon}</div>
                        <div>
                            <p class="text-[12px] font-bold text-[#0e0f0c]">${n.message}</p>
                            <p class="text-[10px] font-semibold text-[#868685] uppercase mt-1">${n.timestamp}</p>
                        </div>
                    `;
                    notifList.appendChild(item);
                });
            } else {
                notifCount.classList.add('hidden');
            }
        } catch(e) {}
    }

    // ===== AI CHAT LOGIC =====
    if (chatFab) {
        chatFab.addEventListener('click', () => chatPanel.classList.toggle('show'));
        chatClose.addEventListener('click', () => chatPanel.classList.remove('show'));

        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = chatInput.value.trim();
            if (!msg) return;

            // User Message
            addChatMessage(msg, true);
            chatInput.value = '';

            // AI Loading
            const loadingId = 'ai-loading-' + Date.now();
            addChatLoading(loadingId);

            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: msg })
                });
                const data = await res.json();
                
                // Remove loading, add reply
                document.getElementById(loadingId).remove();
                addChatMessage(data.reply, false);
            } catch (e) {
                document.getElementById(loadingId).remove();
                addChatMessage("⚠️ Communication error.", false);
            }
        });
    }

    function addChatMessage(text, isUser) {
        const div = document.createElement('div');
        div.className = isUser ? 'flex justify-end' : 'flex gap-3';
        
        if (isUser) {
            div.innerHTML = `
                <div class="bg-[#9fe870] text-[#163300] rounded-[16px] rounded-tr-[4px] px-4 py-3 max-w-[85%]">
                    <p class="text-[13px] font-semibold">${text}</p>
                </div>
            `;
        } else {
            div.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-[#e2f6d5] text-[#163300] flex items-center justify-center shrink-0">
                    <i data-lucide="bot" class="w-4 h-4" stroke-width="2.5"></i>
                </div>
                <div class="bg-[#e8ebe6] rounded-[16px] rounded-tl-[4px] px-4 py-3 max-w-[85%]">
                    <p class="text-[13px] font-semibold">${text}</p>
                </div>
            `;
        }
        chatMessages.appendChild(div);
        if (!isUser && typeof lucide !== 'undefined') lucide.createIcons();
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addChatLoading(id) {
        const div = document.createElement('div');
        div.id = id;
        div.className = 'flex gap-3';
        div.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-[#e2f6d5] text-[#163300] flex items-center justify-center shrink-0 animate-pulse">
                <i data-lucide="bot" class="w-4 h-4" stroke-width="2.5"></i>
            </div>
            <div class="bg-[#e8ebe6] rounded-[16px] rounded-tl-[4px] px-4 py-3">
                <p class="text-[10px] font-bold uppercase tracking-widest text-[#868685]">Thinking...</p>
            </div>
        `;
        chatMessages.appendChild(div);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // ===== STATUS POLLING =====
    async function fetchStatus() {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            
            if (moistVal) moistVal.textContent = data.moisture;
            if (tempVal) tempVal.textContent = data.temp;
            if (humidityVal) humidityVal.textContent = data.humidity;
            if (co2Val) co2Val.textContent = data.co2;
            
            if (data.last_seen) {
                const dt = new Date(data.last_seen);
                lastSeenTime.textContent = `${dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}, ${dt.toLocaleDateString('en-US', {month:'short', day:'numeric'})}`;
            }

            if (systemBadge) systemBadge.textContent = data.status;
            if (actionBadge) actionBadge.textContent = data.action;

            if (latestCapture) {
                if (data.latest_image) {
                    latestCapture.src = `/vision_capture/${data.latest_image}?t=${Date.now()}`;
                    latestCapture.style.display = 'block';
                    noImage.style.display = 'none';
                } else {
                    latestCapture.style.display = 'none';
                    noImage.style.display = 'flex';
                }
            }
        } catch (e) {}
    }

    async function fetchHistory() {
        if (!logList) return;
        try {
            const res = await fetch('/api/history');
            const data = await res.json();
            
            const chronological = [...data].reverse();
            if (sensorChart && chronological.length > 0) {
                sensorChart.data.labels = chronological.map(r => r.timestamp.split(' ')[1].substring(0, 5));
                sensorChart.data.datasets[0].data = chronological.map(r => r.humidity || 0);
                sensorChart.data.datasets[1].data = chronological.map(r => r.temp || 0);
                sensorChart.update('none');
            }

            if (data.length > 0) {
                logList.innerHTML = '';
                data.slice(0, 6).forEach((row, i) => {
                    const item = document.createElement('div');
                    item.className = `log-item flex gap-4 items-start relative`;
                    item.innerHTML = `
                        <div class="w-12 h-12 rounded-full bg-[#e8ebe6] flex items-center justify-center shrink-0 z-10 shadow-sm border border-white text-lg">${row.action === 'SIRAM' ? '💦' : '📊'}</div>
                        <div class="flex-1 pt-1">
                            <p class="font-bold text-[#0e0f0c] text-[14px]">${row.action === 'SIRAM' ? 'Irrigation Active' : 'Sensor Report'}</p>
                            <p class="text-[11px] font-bold uppercase tracking-widest text-[#868685] mt-1">${row.timestamp}</p>
                            <div class="mt-2 text-[12px] font-semibold text-[#454745] bg-[#e8ebe6] inline-block px-3 py-1.5 rounded-lg">
                                M:${row.moisture}% · T:${row.temp}°C · H:${row.humidity}%
                            </div>
                        </div>
                    `;
                    logList.appendChild(item);
                });
            }
        } catch (e) {}
    }

    // ===== DASHBOARD BUTTONS =====
    if (btnForceScan) {
        btnForceScan.addEventListener('click', async () => {
            if (!confirm('Trigger a manual visual scan + AI analysis?')) return;
            const res = await fetch('/api/controls/scan', { method: 'POST' });
            const data = await res.json();
            alert(data.message);
        });
    }

    if (btnForceWater) {
        btnForceWater.addEventListener('click', async () => {
            if (!confirm('⚠️ This will activate the water pump! Are you sure?')) return;
            const res = await fetch('/api/controls/water', { method: 'POST' });
            const data = await res.json();
            alert(data.message);
        });
    }

    // Initial load
    fetchStatus();
    fetchHistory();
    fetchNotifications();
    
    // Polling
    setInterval(fetchStatus, 5000);
    setInterval(fetchHistory, 15000);
    setInterval(fetchNotifications, 30000);
});
