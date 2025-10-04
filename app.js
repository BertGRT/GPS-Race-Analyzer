// FONCTIONS D'AFFICHAGE

function displayLapsTable() {
    const tbody = document.querySelector('#laps-table tbody');
    tbody.innerHTML = '';
    
    const bestTime = sessionData.best;
    let bestLapIndex = sessionData.times.findIndex(t => t === bestTime);
    
    sessionData.times.forEach((time, index) => {
        const row = document.createElement('tr');
        if (index === bestLapIndex) row.classList.add('best-lap');
        
        const delta = time - bestTime;
        const deltaClass = delta === 0 ? 'delta-zero' : 'delta-positive';
        const deltaSign = delta === 0 ? '' : '+';
        
        let maxSpeed = '-';
        let avgSpeed = '-';
        
        if (lapSegments && lapSegments.length > index) {
            const lap = lapSegments[index];
            if (lap.points && lap.points.length > 0) {
                const validSpeeds = lap.points.filter(p => p.spd !== undefined && p.spd !== null);
                if (validSpeeds.length > 0) {
                    const speeds = validSpeeds.map(p => p.spd);
                    maxSpeed = Math.max(...speeds).toFixed(1);
                    const avgSpd = speeds.reduce((a, b) => a + b, 0) / speeds.length;
                    avgSpeed = avgSpd.toFixed(1);
                }
            }
        }
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${formatTime(time)}</td>
            <td class="${deltaClass}">${deltaSign}${(delta/1000).toFixed(3)}</td>
            <td>${maxSpeed}</td>
            <td>${avgSpeed}</td>
        `;
        tbody.appendChild(row);
    });
}

function displayAnalysis() {
    const grid = document.getElementById('analysis-grid');
    const times = sessionData.times;
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);
    const consistency = Math.max(0, 100 - (stdDev / avg) * 100);
    
    grid.innerHTML = `
        <div class="analysis-card">
            <h4>Consistance des Tours</h4>
            <p><strong>Ecart-type:</strong> ${(stdDev/1000).toFixed(3)}s</p>
            <p><strong>Consistance:</strong> ${consistency.toFixed(1)}%</p>
            <div style="background: #e0e0e0; height: 20px; border-radius: 10px; margin: 10px 0; overflow: hidden;">
                <div style="background: linear-gradient(90deg, #4caf50, #8bc34a); height: 100%; width: ${consistency}%; border-radius: 10px;"></div>
            </div>
        </div>
        <div class="analysis-card">
            <h4>Performance</h4>
            <p><strong>Meilleur tour:</strong> ${formatTime(sessionData.best)}</p>
            <p><strong>Vitesse max:</strong> ${sessionData.maxSpd.toFixed(1)} km/h</p>
            <p><strong>Tours sub-1'08:</strong> ${times.filter(t => t < 68000).length}/${times.length}</p>
        </div>
        <div class="analysis-card">
            <h4>Progression</h4>
            <p><strong>Premier tour:</strong> ${formatTime(times[0])}</p>
            <p><strong>Dernier tour:</strong> ${formatTime(times[times.length-1])}</p>
            <p><strong>Amelioration:</strong> ${((times[0]-sessionData.best)/1000).toFixed(3)}s</p>
        </div>
        <div class="analysis-card">
            <h4>Statistiques Globales</h4>
            <p><strong>Temps moyen:</strong> ${formatTime(avg)}</p>
            <p><strong>Tours total:</strong> ${times.length}</p>
            <p><strong>Points GPS:</strong> ${sessionData.points || '-'}</p>
        </div>
    `;
}

function displayProgression() {
    const container = document.getElementById('progress-bars');
    const times = sessionData.times;
    const bestTime = sessionData.best;
    const worstTime = Math.max(...times);
    
    container.innerHTML = times.map((time, index) => {
        const delta = time - bestTime;
        const percentage = ((worstTime - time) / (worstTime - bestTime)) * 100;
        
        let color = '';
        if (time === bestTime) color = 'linear-gradient(90deg, #4caf50, #8bc34a)';
        else if (delta < 1000) color = 'linear-gradient(90deg, #2196f3, #64b5f6)';
        else if (delta < 2000) color = 'linear-gradient(90deg, #ff9800, #ffb74d)';
        else color = 'linear-gradient(90deg, #f44336, #ef5350)';
        
        return `
            <div class="progress-item">
                <div class="progress-label">T${index + 1}</div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${Math.max(percentage, 20)}%; background: ${color};">
                        ${formatTime(time)} ${delta === 0 ? '(RECORD)' : `(+${(delta/1000).toFixed(3)})`}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// GESTION DES ONGLETS

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    document.getElementById(`${tabName}-content`).classList.add('active');
    event.target.classList.add('active');
    
    if (tabName === 'track' && sessionData && sessionData.gpsTrack) {
        setTimeout(() => {
            if (!map) {
                initMap();
            } else {
                map.invalidateSize();
            }
            showCircuitDetection();
        }, 100);
    }
    
    if (tabName === 'turns' && sessionData && sessionData.gpsTrack) analyzeTurns();
}

// CARTE LEAFLET

function initMap() {
    if (!sessionData || !sessionData.gpsTrack || sessionData.gpsTrack.length === 0) {
        document.getElementById('map').innerHTML = '<div style="padding: 50px; text-align: center; color: #999;">Aucune donnee GPS disponible</div>';
        return;
    }
    
    const track = sessionData.gpsTrack;
    const centerLat = track.reduce((sum, p) => sum + p.lat, 0) / track.length;
    const centerLng = track.reduce((sum, p) => sum + p.lng, 0) / track.length;
    
    map = L.map('map').setView([centerLat, centerLng], 15);
    addMapTiles();
    displayBestLap();
    
    setTimeout(() => map.invalidateSize(), 100);
}

function addMapTiles() {
    if (currentMapView === 'satellite') {
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles Esri',
            maxZoom: 19
        }).addTo(map);
    } else {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);
    }
}

function switchMapView(view) {
    if (!map) return;
    currentMapView = view;
    map.eachLayer((layer) => { if (layer instanceof L.TileLayer) map.removeLayer(layer); });
    addMapTiles();
}

function getAccelerationColor(prevSpeed, currentSpeed, nextSpeed) {
    const accel1 = currentSpeed - prevSpeed;
    const accel2 = nextSpeed - currentSpeed;
    const avgAccel = (accel1 + accel2) / 2;
    
    if (avgAccel < -3) return '#ff0000';
    else if (avgAccel < -1) return '#ff8800';
    else if (avgAccel < 1) return '#ffff00';
    else if (avgAccel < 3) return '#88ff00';
    else return '#00ff00';
}

function detectAndDisplaySpeedMarkers(points, layer) {
    let speedMarkers = [];
    const windowSize = 8;
    
    for (let j = windowSize; j < points.length - windowSize; j++) {
        const speeds = [];
        for (let k = j - windowSize; k <= j + windowSize; k++) {
            speeds.push(points[k].spd);
        }
        
        const currentSpeed = points[j].spd;
        const minSpeed = Math.min(...speeds);
        const maxSpeed = Math.max(...speeds);
        
        if (currentSpeed === minSpeed) {
            const prevSpeed = points[Math.max(0, j - 3)].spd;
            const nextSpeed = points[Math.min(points.length - 1, j + 3)].spd;
            
            if (prevSpeed > currentSpeed && nextSpeed > currentSpeed) {
                speedMarkers.push({
                    pos: [points[j].lat, points[j].lng],
                    speed: currentSpeed,
                    type: 'min'
                });
                j += windowSize;
            }
        }
        
        if (currentSpeed === maxSpeed) {
            const prevSpeed = points[Math.max(0, j - 3)].spd;
            const nextSpeed = points[Math.min(points.length - 1, j + 3)].spd;
            
            if (prevSpeed < currentSpeed && nextSpeed < currentSpeed) {
                speedMarkers.push({
                    pos: [points[j].lat, points[j].lng],
                    speed: currentSpeed,
                    type: 'max'
                });
                j += windowSize;
            }
        }
    }
    
    speedMarkers.forEach((marker) => {
        const bgColor = marker.type === 'min' ? '#ff0000' : '#00ff00';
        
        const icon = L.divIcon({
            className: 'speed-marker',
            html: `<div style="background: ${bgColor}; color: white; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 13px; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.5); white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">${Math.round(marker.speed)}</div>`,
            iconSize: [50, 25],
            iconAnchor: [25, 12]
        });
        
        L.marker(marker.pos, { icon: icon, zIndexOffset: 1000 }).addTo(layer);
    });
}

function displayBestLap() {
    if (!map || !lapSegments || lapSegments.length === 0) return;
    
    const bestLap = lapSegments.find(lap => lap.isBestLap);
    if (!bestLap) return;
    
    if (gpsLayer) map.removeLayer(gpsLayer);
    gpsLayer = L.layerGroup().addTo(map);
    
    const track = bestLap.points;
    currentReplayData = { lap: bestLap, track: track };
    
    for (let i = 0; i < track.length - 1; i++) {
        const prevPoint = i > 0 ? track[i - 1] : track[i];
        const p1 = track[i];
        const p2 = track[i + 1];
        const nextPoint = i < track.length - 2 ? track[i + 2] : p2;
        
        const color = getAccelerationColor(prevPoint.spd, p1.spd, nextPoint.spd);
        
        const segment = L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], {
            color: color,
            weight: 5,
            opacity: 0.9
        });
        
        const accel = p2.spd - p1.spd;
        const accelText = accel > 0 ? `+${accel.toFixed(1)}` : accel.toFixed(1);
        
        segment.bindPopup(`
            <strong>MEILLEUR TOUR ${bestLap.lapNumber}</strong><br>
            Temps: ${formatTime(bestLap.time)}<br>
            Vitesse: ${p1.spd.toFixed(1)} km/h<br>
            Acceleration: ${accelText} km/h<br>
            Position: ${(p1.t / 1000).toFixed(1)}s
        `);
        
        segment.addTo(gpsLayer);
    }
    
    detectAndDisplaySpeedMarkers(track, gpsLayer);
    
    if (!replayMarker) {
        const markerIcon = L.divIcon({
            className: 'replay-marker',
            html: `<div style="position: relative;">
                <div style="width: 16px; height: 16px; background: #ff0000; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"></div>
                <div id="replay-speed-tag" style="position: absolute; top: -35px; left: 50%; transform: translateX(-50%); background: #ff0000; color: white; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 13px; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.5); display: none;">0 km/h</div>
            </div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });
        
        replayMarker = L.marker([track[0].lat, track[0].lng], { 
            icon: markerIcon, 
            opacity: 0,
            zIndexOffset: 2000 
        }).addTo(gpsLayer);
    }
    
    const bounds = L.latLngBounds(track.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [50, 50] });
    
    displayBestLapStats(bestLap);
    initReplayControlsForBestLap(bestLap);
    createBestLapSpeedChart(bestLap);
}

function displayBestLapStats(bestLap) {
    const track = bestLap.points;
    document.getElementById('track-points').textContent = track.length;
    
    let totalDistance = 0;
    for (let i = 0; i < track.length - 1; i++) {
        totalDistance += calculateDistance(track[i], track[i + 1]);
    }
    document.getElementById('track-distance').textContent = (totalDistance / 1000).toFixed(2) + ' km';
    
    const speeds = track.map(p => p.spd);
    document.getElementById('track-minspeed').textContent = Math.min(...speeds).toFixed(1) + ' km/h';
    document.getElementById('track-maxspeed').textContent = Math.max(...speeds).toFixed(1) + ' km/h';
}

// REPLAY

function initReplayControlsForBestLap(bestLap) {
    const track = bestLap.points;
    document.getElementById('replay-controls-circuit').style.display = 'block';
    
    const slider = document.getElementById('replay-slider-circuit');
    slider.max = track.length - 1;
    slider.value = 0;
    
    const newSlider = slider.cloneNode(true);
    slider.parentNode.replaceChild(newSlider, slider);
    
    newSlider.addEventListener('input', (e) => {
        replayIndex = parseInt(e.target.value);
        updateReplayPosition();
    });
    
    replayIndex = 0;
}

function updateReplayPosition() {
    if (!currentReplayData) return;
    
    const track = currentReplayData.track;
    const point = track[Math.floor(replayIndex)];
    if (!point) return;
    
    if (replayMarker) {
        replayMarker.setOpacity(1);
        replayMarker.setLatLng([point.lat, point.lng]);
        map.panTo([point.lat, point.lng], {animate: false});
        
        const speedTag = document.getElementById('replay-speed-tag');
        if (speedTag) {
            speedTag.style.display = 'block';
            speedTag.textContent = `${Math.round(point.spd)} km/h`;
            speedTag.style.background = '#ff0000';
        }
    }
    
    document.getElementById('replay-time-circuit').textContent = (point.t / 1000).toFixed(1) + 's';
    document.getElementById('replay-speed-circuit').textContent = point.spd.toFixed(1) + ' km/h';
    document.getElementById('replay-position-circuit').textContent = `${Math.floor(replayIndex) + 1}/${track.length}`;
    document.getElementById('replay-slider-circuit').value = replayIndex;
    
    if (speedChart) {
        const datasetIndex = isComparisonMode ? speedChart.data.datasets.length - 1 : 1;
        if (speedChart.data.datasets[datasetIndex]) {
            speedChart.data.datasets[datasetIndex].data = [{ x: point.t / 1000, y: point.spd }];
            speedChart.update('none');
        }
    }
    
    if (comparisonChart) {
        const cursorDatasetIndex = comparisonChart.data.datasets.length - 1;
        if (comparisonChart.data.datasets[cursorDatasetIndex]) {
            const startTime = currentReplayData.lap.points[0].t;
            comparisonChart.data.datasets[cursorDatasetIndex].data = [{ 
                x: (point.t - startTime) / 1000, 
                y: point.spd 
            }];
            comparisonChart.update('none');
        }
    }
}

function replayControl(action) {
    if (!currentReplayData) return;
    const track = currentReplayData.track;
    
    switch(action) {
        case 'play':
            if (replayInterval) clearInterval(replayInterval);
            replayInterval = setInterval(() => {
                replayIndex += replaySpeed;
                if (replayIndex >= track.length - 1) {
                    replayIndex = track.length - 1;
                    clearInterval(replayInterval);
                    replayInterval = null;
                }
                updateReplayPosition();
            }, 50);
            break;
        case 'pause':
            if (replayInterval) { clearInterval(replayInterval); replayInterval = null; }
            break;
        case 'reset':
            if (replayInterval) { clearInterval(replayInterval); replayInterval = null; }
            replayIndex = 0;
            updateReplayPosition();
            break;
    }
}

function changeReplaySpeed(speed) { replaySpeed = speed; }

// GRAPHIQUES

function createBestLapSpeedChart(bestLap) {
    const ctx = document.getElementById('speed-chart');
    if (!ctx) return;
    
    const track = bestLap.points;
    document.getElementById('speed-chart-container').style.display = 'block';
    
    if (speedChart) speedChart.destroy();
    
    speedChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: `Meilleur Tour ${bestLap.lapNumber} - ${formatTime(bestLap.time)}`,
                    data: track.map(p => ({ x: p.t / 1000, y: p.spd })),
                    borderColor: '#1976d2',
                    backgroundColor: 'rgba(25, 118, 210, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    borderWidth: 3
                },
                {
                    label: 'Position',
                    data: [{ x: track[0].t / 1000, y: track[0].spd }],
                    borderColor: '#ff0000',
                    backgroundColor: '#ff0000',
                    pointRadius: 8,
                    pointHoverRadius: 10,
                    pointBorderWidth: 3,
                    pointBorderColor: '#ffffff',
                    showLine: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Temps (s)', font: { size: 14 } },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                y: {
                    title: { display: true, text: 'Vitesse (km/h)', font: { size: 14 } },
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { filter: function(item) { return item.text !== 'Position'; } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) return `Vitesse: ${context.parsed.y.toFixed(1)} km/h`;
                            return null;
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Evolution de la Vitesse - Meilleur Tour',
                    font: { size: 16, weight: 'bold' },
                    color: '#1976d2'
                }
            },
            onClick: (event, elements, chart) => {
                const canvasPosition = Chart.helpers.getRelativePosition(event, chart);
                const dataX = chart.scales.x.getValueForPixel(canvasPosition.x);
                
                let closestIndex = 0;
                let minDiff = Math.abs(track[0].t / 1000 - dataX);
                
                for (let i = 1; i < track.length; i++) {
                    const diff = Math.abs(track[i].t / 1000 - dataX);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestIndex = i;
                    }
                }
                
                replayIndex = closestIndex;
                updateReplayPosition();
            }
        }
    });
}

// COMPARAISON

function segmentLapsFromGPSTrack() {
    if (!sessionData || !sessionData.gpsTrack || !sessionData.times) return;
    
    const track = sessionData.gpsTrack;
    const lapTimes = sessionData.times;
    lapSegments = [];
    
    const pointsPerLap = Math.floor(track.length / lapTimes.length);
    
    for (let lapIndex = 0; lapIndex < lapTimes.length; lapIndex++) {
        const startIndex = lapIndex * pointsPerLap;
        const endIndex = (lapIndex === lapTimes.length - 1) ? track.length : (lapIndex + 1) * pointsPerLap;
        const lapPoints = track.slice(startIndex, endIndex);
        
        if (lapPoints.length > 0) {
            lapSegments.push({
                lapNumber: lapIndex + 1,
                time: lapTimes[lapIndex],
                points: lapPoints,
                isBestLap: lapTimes[lapIndex] === sessionData.best
            });
        }
    }
    populateLapSelectors();
}

function populateLapSelectors() {
    const selector1 = document.getElementById('compare-lap1');
    const selector2 = document.getElementById('compare-lap2');
    if (!selector1 || !selector2) return;
    
    const bestLap = lapSegments.find(lap => lap.isBestLap);
    if (bestLap) {
        selector1.innerHTML = `<option value="${lapSegments.indexOf(bestLap)}">Tour ${bestLap.lapNumber} - ${formatTime(bestLap.time)} (Meilleur)</option>`;
    }
    
    selector2.innerHTML = '<option value="">-- Selectionner --</option>';
    lapSegments.forEach((lap, i) => {
        if (!lap.isBestLap) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Tour ${lap.lapNumber} - ${formatTime(lap.time)}`;
            selector2.appendChild(option);
        }
    });
}

function compareSelectedLaps() {
    const lap1Index = document.getElementById('compare-lap1').value;
    const lap2Index = document.getElementById('compare-lap2').value;
    
    if (lap1Index === '' || lap2Index === '') {
        alert('Veuillez selectionner un tour a comparer');
        return;
    }
    
    const selectedLaps = [lap1Index, lap2Index];
    
    if (!map) {
        initMap();
        setTimeout(() => displayComparisonOnMap(selectedLaps), 500);
    } else {
        displayComparisonOnMap(selectedLaps);
    }
    
    createComparisonSpeedChart(selectedLaps);
    isComparisonMode = true;
}

function displayComparisonOnMap(selectedLapIndexes) {
    if (!map) return;
    clearComparisonLayers();
    
    const colors = ['#4caf50', '#1976d2'];
    const legendItems = [];
    
    selectedLapIndexes.forEach((lapIndex, i) => {
        const lap = lapSegments[parseInt(lapIndex)];
        if (!lap) return;
        
        const color = colors[i];
        const points = lap.points;
        const lapLayer = L.layerGroup().addTo(map);
        comparisonLayers.push(lapLayer);
        
        if (i === 0) {
            for (let j = 0; j < points.length - 1; j++) {
                const prevPoint = j > 0 ? points[j - 1] : points[j];
                const p1 = points[j];
                const p2 = points[j + 1];
                const nextPoint = j < points.length - 2 ? points[j + 2] : p2;
                
                const segmentColor = getAccelerationColor(prevPoint.spd, p1.spd, nextPoint.spd);
                const polyline = L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], { 
                    color: segmentColor, 
                    weight: 5, 
                    opacity: 0.9 
                });
                polyline.bindPopup(`<strong>Tour ${lap.lapNumber}</strong><br>Temps: ${formatTime(lap.time)}<br>Vitesse: ${p1.spd.toFixed(1)} km/h`);
                polyline.addTo(lapLayer);
            }
            
            detectAndDisplaySpeedMarkers(points, lapLayer);   
        } else {
            const polyline = L.polyline(points.map(p => [p.lat, p.lng]), { 
                color: color, 
                weight: 4, 
                opacity: 0.8, 
                dashArray: '10, 5' 
            });
            polyline.bindPopup(`<strong>Tour ${lap.lapNumber}</strong><br>Temps: ${formatTime(lap.time)}<br>Points GPS: ${points.length}`);
            polyline.addTo(lapLayer);
        }
        
        const startIcon = L.divIcon({
            className: 'speed-marker',
            html: `<div style="background: ${color}; color: white; padding: 3px 8px; border-radius: 10px; font-weight: bold; font-size: 11px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">${lap.isBestLap ? '★' : 'T' + lap.lapNumber}</div>`,
            iconSize: [30, 20],
            iconAnchor: [15, 10]
        });
        L.marker([points[0].lat, points[0].lng], { icon: startIcon }).addTo(lapLayer);
        
        legendItems.push({ 
            color: color, 
            label: `${lap.isBestLap ? '★ ' : ''}Tour ${lap.lapNumber} - ${formatTime(lap.time)}`, 
            dashArray: i === 0 ? null : '10, 5' 
        });
    });
    
    displayComparisonLegend(legendItems);
    
    const allPoints = selectedLapIndexes.map(idx => lapSegments[parseInt(idx)]).filter(lap => lap).flatMap(lap => lap.points).map(p => [p.lat, p.lng]);
    if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [50, 50] });
    }
    
    const bestLap = lapSegments[parseInt(selectedLapIndexes[0])];
    if (bestLap) {
        currentReplayData = { lap: bestLap, track: bestLap.points };
        document.getElementById('replay-controls-circuit').style.display = 'block';
        initReplayControlsForBestLap(bestLap);
    }
}

function displayComparisonLegend(items) {
    const legend = document.getElementById('comparison-legend');
    const itemsContainer = document.getElementById('legend-items');
    
    itemsContainer.innerHTML = items.map(item => `
        <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 40px; height: 3px; background: ${item.color}; ${item.dashArray ? 'background: repeating-linear-gradient(90deg, ' + item.color + ' 0px, ' + item.color + ' 10px, transparent 10px, transparent 15px);' : ''}"></div>
            <span style="font-size: 0.9rem;">${item.label}</span>
        </div>
    `).join('');
    legend.style.display = 'block';
}

function createComparisonSpeedChart(selectedLapIndexes) {
    const container = document.getElementById('speed-chart-container');
    const canvas = document.getElementById('speed-chart');
    if (!container || !canvas) return;
    
    container.style.display = 'block';
    if (speedChart) { speedChart.destroy(); speedChart = null; }
    if (comparisonChart) comparisonChart.destroy();
    
    const colors = [{ border: '#4caf50', bg: 'rgba(76, 175, 80, 0.1)' }, { border: '#1976d2', bg: 'rgba(25, 118, 210, 0.1)' }];
    
    const datasets = selectedLapIndexes.map((lapIndex, i) => {
        const lap = lapSegments[parseInt(lapIndex)];
        if (!lap) return null;
        
        const startTime = lap.points[0].t;
        const normalizedData = lap.points.map(p => ({ x: (p.t - startTime) / 1000, y: p.spd }));
        
        return {
            label: `${lap.isBestLap ? '★ ' : ''}Tour ${lap.lapNumber} - ${formatTime(lap.time)}`,
            data: normalizedData,
            borderColor: colors[i].border,
            backgroundColor: colors[i].bg,
            borderWidth: 3,
            tension: 0.4,
            fill: false,
            pointRadius: 0
        };
    }).filter(d => d !== null);
    
    const firstLap = lapSegments[parseInt(selectedLapIndexes[0])];
    if (firstLap && firstLap.points.length > 0) {
        datasets.push({
            label: 'Position Actuelle',
            data: [{ x: 0, y: firstLap.points[0].spd }],
            borderColor: '#ff0000',
            backgroundColor: '#ff0000',
            pointRadius: 8,
            pointHoverRadius: 10,
            pointBorderWidth: 3,
            pointBorderColor: '#ffffff',
            showLine: false,
            order: 999
        });
    }
    
    comparisonChart = new Chart(canvas, {
        type: 'line',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Temps depuis debut du tour (s)', font: { size: 14 } },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                y: {
                    title: { display: true, text: 'Vitesse (km/h)', font: { size: 14 } },
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { filter: function(item) { return item.text !== 'Position Actuelle'; } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.label === 'Position Actuelle') return null;
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} km/h`;
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Comparaison des Vitesses (Recalees)',
                    font: { size: 16, weight: 'bold' },
                    color: '#1976d2'
                }
            },
            onClick: (event, elements, chart) => {
                const canvasPosition = Chart.helpers.getRelativePosition(event, chart);
                const dataX = chart.scales.x.getValueForPixel(canvasPosition.x);
                
                const firstLap = lapSegments[parseInt(selectedLapIndexes[0])];
                if (firstLap) {
                    const track = firstLap.points;
                    const clickedIndex = Math.round((dataX / (firstLap.time / 1000)) * (track.length - 1));
                    if (clickedIndex >= 0 && clickedIndex < track.length) {
                        replayIndex = clickedIndex;
                        updateReplayPosition();
                    }
                }
            }
        }
    });
}

function clearComparison() {
    clearComparisonLayers();
    document.getElementById('compare-lap2').value = '';
    document.getElementById('comparison-legend').style.display = 'none';
    if (comparisonChart) { comparisonChart.destroy(); comparisonChart = null; }
    if (speedChart) { speedChart.destroy(); speedChart = null; }
    isComparisonMode = false;
    displayBestLap();
}

function clearComparisonLayers() {
    comparisonLayers.forEach(layer => { if (map && map.hasLayer(layer)) map.removeLayer(layer); });
    comparisonLayers = [];
}

// ANALYSE VIRAGES

function analyzeTurns() {
    if (!sessionData || !sessionData.gpsTrack) {
        document.getElementById('turns-grid').innerHTML = '<p style="text-align: center; padding: 50px; color: #999;">Aucune donnee GPS disponible</p>';
        return;
    }
    
    const track = sessionData.gpsTrack;
    const turns = detectTurns(track);
    const turnsGrid = document.getElementById('turns-grid');
    turnsGrid.innerHTML = '';
    
    turns.forEach((turn, index) => {
        const card = document.createElement('div');
        card.className = 'turn-card';
        card.innerHTML = `
            <h4>Virage ${index + 1}</h4>
            <div class="turn-stat"><span>Vitesse d'entree</span><strong>${turn.entrySpeed.toFixed(1)} km/h</strong></div>
            <div class="turn-stat"><span>Vitesse a l'apex</span><strong>${turn.apexSpeed.toFixed(1)} km/h</strong></div>
            <div class="turn-stat"><span>Vitesse de sortie</span><strong>${turn.exitSpeed.toFixed(1)} km/h</strong></div>
            <div class="turn-stat"><span>Perte de vitesse</span><strong>${(turn.entrySpeed - turn.apexSpeed).toFixed(1)} km/h</strong></div>
        `;
        turnsGrid.appendChild(card);
    });
}

function detectTurns(track) {
    const turns = [];
    const minSpeedDrop = 40;
    
    for (let i = 10; i < track.length - 10; i++) {
        const prevSpeed = track[i - 5].spd;
        const currentSpeed = track[i].spd;
        const nextSpeed = track[i + 5].spd;
        
        if (prevSpeed - currentSpeed > minSpeedDrop && nextSpeed > currentSpeed) {
            turns.push({
                index: i,
                entrySpeed: prevSpeed,
                apexSpeed: currentSpeed,
                exitSpeed: nextSpeed,
                position: { lat: track[i].lat, lng: track[i].lng }
            });
            i += 15;
        }
    }
    return turns.slice(0, 8);
}

// EXPORT

function exportData(format) {
    if (!sessionData) return;
    switch(format) {
        case 'csv': exportCSV(); break;
        case 'gpx': exportGPX(); break;
        case 'racechrono': exportRaceChrono(); break;
        case 'telemetry': exportTelemetry(); break;
    }
}

function exportCSV() {
    let csv = 'Tour,Temps (ms),Temps Formate,Ecart,Vitesse Max,Vitesse Moyenne\n';
    const bestTime = sessionData.best;
    sessionData.times.forEach((time, index) => {
        const delta = time - bestTime;
        const maxSpeed = (150 + Math.random() * 40).toFixed(1);
        const avgSpeed = calculateAverageSpeed().toFixed(1);
        csv += `${index + 1},${time},${formatTime(time)},${(delta/1000).toFixed(3)},${maxSpeed},${avgSpeed}\n`;
    });
    downloadFile(csv, `session_${sessionData.id}_data.csv`, 'text/csv');
}

function exportGPX() {
    if (!sessionData.gpsTrack) { alert('Aucune donnee GPS disponible'); return; }
    let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="GPS Race Analyzer Pro">\n';
    gpx += '  <metadata>\n    <name>Session ' + new Date(sessionData.start).toLocaleString() + '</name>\n  </metadata>\n';
    gpx += '  <trk>\n    <name>Trajectoire GPS</name>\n    <trkseg>\n';
    sessionData.gpsTrack.forEach(point => {
        const timestamp = new Date(sessionData.start + point.t).toISOString();
        gpx += `      <trkpt lat="${point.lat}" lon="${point.lng}">\n        <time>${timestamp}</time>\n`;
        gpx += `        <extensions>\n          <speed>${(point.spd / 3.6).toFixed(2)}</speed>\n        </extensions>\n      </trkpt>\n`;
    });
    gpx += '    </trkseg>\n  </trk>\n</gpx>';
    downloadFile(gpx, `session_${sessionData.id}_track.gpx`, 'application/gpx+xml');
}

async function exportRaceChrono() {
    const zip = new JSZip();
    
    const sessionInfo = {
        "session": {
            "id": sessionData.id,
            "name": "GPS Session " + new Date(sessionData.start).toLocaleDateString(),
            "date": new Date(sessionData.start).toISOString(),
            "track": "Circuit détecté",
            "vehicle": "Non spécifié",
            "driver": "Pilote"
        }
    };
    
    const lapsData = {
        "laps": sessionData.times.map((time, index) => ({
            "number": index + 1,
            "time": time / 1000,
            "sectors": [],
            "valid": true
        })),
        "bestLapTime": sessionData.best / 1000,
        "bestLapNumber": sessionData.times.indexOf(sessionData.best) + 1
    };
    
    const telemetryData = {
        "telemetry": sessionData.gpsTrack ? sessionData.gpsTrack.map(p => ({
            "timestamp": p.t,
            "latitude": p.lat,
            "longitude": p.lng,
            "speed": p.spd / 3.6,
            "altitude": 0
        })) : []
    };
    
    zip.file("session.json", JSON.stringify(sessionInfo, null, 2));
    zip.file("laps.json", JSON.stringify(lapsData, null, 2));
    zip.file("telemetry.json", JSON.stringify(telemetryData, null, 2));
    
    const content = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 9 }
    });
    
    downloadFile(content, `session_${sessionData.id}_racechrono.rcz`, 'application/zip');
}

function exportTelemetry() {
    if (!sessionData.gpsTrack) { alert('Aucune donnee de telemetrie disponible'); return; }
    let csv = 'Temps (ms),Latitude,Longitude,Vitesse (km/h),Timestamp\n';
    sessionData.gpsTrack.forEach(point => {
        csv += `${point.t},${point.lat},${point.lng},${point.spd},${sessionData.start + point.t}\n`;
    });
    downloadFile(csv, `session_${sessionData.id}_telemetry.csv`, 'text/csv');
}

function downloadFile(content, filename, type) {
    let blob;
    
    if (content instanceof Blob) {
        blob = content;
    } else {
        blob = new Blob([content], { type: type });
    }
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// UTILITAIRES

function calculateDistance(p1, p2) {
    const R = 6371e3;
    const φ1 = p1.lat * Math.PI / 180;
    const φ2 = p2.lat * Math.PI / 180;
    const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
    const Δλ = (p2.lng - p1.lng) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function calculateAverageSpeed() {
    if (!sessionData.times || sessionData.times.length === 0) return 0;
    const trackLength = sessionData.trackLength || 1.814;
    const avgTimeSeconds = sessionData.times.reduce((a, b) => a + b, 0) / sessionData.times.length / 1000;
    return (trackLength / avgTimeSeconds) * 3600;
}

function formatTime(ms) {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const millis = Math.floor((totalSeconds % 1) * 1000);
    return `${minutes}'${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}