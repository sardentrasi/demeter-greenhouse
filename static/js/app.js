document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const moistVal = document.getElementById('moisture-val');
    const tempVal = document.getElementById('temp-val');
    const actionBadge = document.getElementById('action-badge');
    const statusDesc = document.getElementById('status-desc');
    const lastSeenTime = document.getElementById('last-seen-time');
    
    const latestCapture = document.getElementById('latest-capture');
    const noImage = document.getElementById('no-image');
    const historyTbody = document.getElementById('history-tbody');

    // Fetch Status
    async function fetchStatus() {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            
            moistVal.textContent = data.moisture;
            tempVal.textContent = data.temp;
            
            // Format time
            if (data.last_seen) {
                const dt = new Date(data.last_seen);
                lastSeenTime.textContent = dt.toLocaleTimeString();
            }

            // Action Badge
            actionBadge.textContent = data.action;
            actionBadge.className = 'badge ' + data.action.toLowerCase();
            
            statusDesc.textContent = data.status;

            // Image
            if (data.latest_image) {
                // To prevent caching issue, append timestamp
                latestCapture.src = `/vision_capture/${data.latest_image}?t=${new Date().getTime()}`;
                latestCapture.style.display = 'block';
                noImage.style.display = 'none';
            } else {
                latestCapture.style.display = 'none';
                noImage.style.display = 'flex';
            }
        } catch (e) {
            console.error("Status fetch error:", e);
        }
    }

    // Fetch History
    async function fetchHistory() {
        try {
            const res = await fetch('/api/history');
            const data = await res.json();
            
            historyTbody.innerHTML = '';
            
            // Data is expected to be array of objects
            // Render in reverse to show newest first if API doesn't sort
            data.reverse().forEach(row => {
                const tr = document.createElement('tr');
                
                const tdTime = document.createElement('td');
                // parse timestamp
                tdTime.textContent = row.timestamp;
                
                const tdMoist = document.createElement('td');
                tdMoist.textContent = row.moisture + '%';
                
                const tdTemp = document.createElement('td');
                tdTemp.textContent = row.temp + '°C';
                
                const tdAction = document.createElement('td');
                tdAction.textContent = row.action;
                
                tr.appendChild(tdTime);
                tr.appendChild(tdMoist);
                tr.appendChild(tdTemp);
                tr.appendChild(tdAction);
                
                historyTbody.appendChild(tr);
            });
        } catch (e) {
            console.error("History fetch error:", e);
        }
    }

    // Initialization
    fetchStatus();
    fetchHistory();
    
    // Polling
    setInterval(fetchStatus, 5000);
    setInterval(fetchHistory, 10000);
});

function forceAnalyze() {
    alert("Manual check via API is not fully implemented in this demo frontend, but you can link it to Demeter's /lapor or a specific trigger route.");
}

function forceWater() {
    alert("Force watering command triggered (mock).");
}
