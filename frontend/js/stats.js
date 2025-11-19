document.addEventListener("DOMContentLoaded", () => {

    // --- REAL DATA FROM SOCKET.IO ---
    let currentStats = {
        totalDonations: 0,
        hospitals: [],
        donorTypes: {},
        donationStatus: {}
    };

    // --- CHART COLORS ---
    const chartColors = {
        red: '#ef4444',
        deepRed: '#b91c1c',
        lightRed: '#fca5a5',
        grey: '#9ca3af',
        darkGrey: '#4b5563'
    };

    // Get the heartbeat icon element
    const heartbeatIcon = document.getElementById('heartbeat-icon');

    // --- HEARTBEAT ANIMATION FUNCTION ---
    function triggerHeartbeat() {
        heartbeatIcon.classList.add('visible'); // Make it visible
        heartbeatIcon.classList.add('heart-beating'); // Start animation
        
        // Remove animation class after it completes to allow re-triggering
        // (2s matches the animation duration in CSS)
        setTimeout(() => {
            heartbeatIcon.classList.remove('heart-beating');
            heartbeatIcon.classList.remove('visible'); // Fully hide it
            heartbeatIcon.style.opacity = ''; // Clear inline style
        }, 2000); // Wait for the full animation duration
    }
    
    // Make triggerHeartbeat globally accessible for the test button
    window.triggerHeartbeat = triggerHeartbeat;


    // --- 1. BIG COUNTER ANIMATION ---
    // GSAP function to animate numbers
    function animateCounter(id, start, end, duration) {
        let obj = { val: start };
        gsap.to(obj, {
            duration: duration,
            val: end,
            onUpdate: () => {
                document.getElementById(id).textContent = Math.round(obj.val);
            },
            ease: "power3.out"
        });
    }
    
    // Initial call - will be updated when real data arrives
    // Don't animate initially, just set to 0
    document.getElementById("total-donations").textContent = "0";


    // --- 2. POPULATE HOSPITAL LIST ---
    const hospitalListEl = document.getElementById("hospital-list");
    
    function updateHospitalList(hospitals) {
        hospitalListEl.innerHTML = ""; // Clear existing list
        hospitals.forEach(hospital => {
            const percentage = (hospital.current / hospital.target) * 100;
            const li = document.createElement("li");
            li.innerHTML = `
                <div class="list-item-header">
                    <span>${hospital.name}</span>
                    <span>${hospital.current} / ${hospital.target}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-bar-inner" style="width: ${percentage}%"></div>
                </div>
            `;
            hospitalListEl.appendChild(li);
        });
    }

    // Initial call - will be updated when real data arrives
    updateHospitalList([]);


    // --- 3. CHART.JS INITIALIZATION ---

    // Chart 1: Hospital Donations (Bar Chart)
    const ctxHospital = document.getElementById('hospitalChart').getContext('2d');
    const hospitalChart = new Chart(ctxHospital, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Donations Received',
                data: [],
                backgroundColor: [chartColors.red, chartColors.deepRed, chartColors.lightRed],
                borderRadius: 5,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });

    // Chart 2: Donor Demographics (Doughnut Chart)
    const ctxDonor = document.getElementById('donorTypeChart').getContext('2d');
    const donorTypeChart = new Chart(ctxDonor, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                label: 'Donor Type',
                data: [],
                backgroundColor: [chartColors.deepRed, chartColors.red, chartColors.grey],
                borderColor: '#ffffff',
                borderWidth: 4,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 14 } }
                }
            }
        }
    });

    // Chart 3: Donation Status (Pie Chart)
    const ctxStatus = document.getElementById('donationStatusChart').getContext('2d');
    const donationStatusChart = new Chart(ctxStatus, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                label: 'Status',
                data: [],
                backgroundColor: [chartColors.deepRed, chartColors.darkGrey, chartColors.lightRed],
                borderColor: '#ffffff',
                borderWidth: 4,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 14 } }
                }
            }
        }
    });


    // --- 4. GSAP PAGE LOAD ANIMATIONS ---
    // Wait a bit for DOM to be fully ready
    setTimeout(() => {
        // Set initial states
        gsap.set("#welcome-message", { y: -50, opacity: 0 });
        gsap.set("header p", { y: -20, opacity: 0 });
        gsap.set(".stats-counter-card", { y: 50, opacity: 0 });
        gsap.set(".stat-card", { y: 30, opacity: 0 });
        
        // Animate in
        const tl = gsap.timeline();
        tl.to("#welcome-message", { duration: 0.8, y: 0, opacity: 1, ease: "bounce.out" })
          .to("header p", { duration: 0.5, y: 0, opacity: 1, ease: "power3.out" }, "-=0.6")
          .to(".stats-counter-card", { duration: 0.8, y: 0, opacity: 1, ease: "power3.out" }, "-=0.5")
          .to(".stat-card", { 
              duration: 0.7, 
              y: 0, 
              opacity: 1, 
              stagger: 0.2, 
              ease: "power3.out" 
          }, "-=0.5");
    }, 100); // Small delay to ensure DOM is ready


    // --- 5. SOCKET.IO INTEGRATION ---
    const socket = io();
    let currentTotalDonations = 0;
    
    // Connection status elements
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');

    // Function to update all charts and data
    function updateAllCharts(newStats) {
        // 1. Update Big Counter
        animateCounter("total-donations", currentTotalDonations, newStats.totalDonations, 1.5);
        currentTotalDonations = newStats.totalDonations;

        // 2. Update Hospital List
        updateHospitalList(newStats.hospitals);

        // 3. Update Hospital Bar Chart
        hospitalChart.data.labels = newStats.hospitals.map(h => h.name);
        hospitalChart.data.datasets[0].data = newStats.hospitals.map(h => h.current);
        hospitalChart.update();

        // 4. Update Donor Doughnut Chart
        donorTypeChart.data.labels = Object.keys(newStats.donorTypes);
        donorTypeChart.data.datasets[0].data = Object.values(newStats.donorTypes);
        donorTypeChart.update();
        
        // 5. Update Status Pie Chart
        donationStatusChart.data.labels = Object.keys(newStats.donationStatus);
        donationStatusChart.data.datasets[0].data = Object.values(newStats.donationStatus);
        donationStatusChart.update();
    }

    // Socket event handlers
    socket.on('connect', () => {
        console.log('Connected to stats server');
        statusIndicator.className = 'status-indicator connected';
        statusText.textContent = 'Connected - Live data';
        // Request initial stats
        socket.emit('requestStats');
    });

    socket.on('statsUpdate', (newStats) => {
        console.log("Received new stats:", newStats);
        
        // Check if total donations have increased
        if (newStats.totalDonations > currentTotalDonations) {
            triggerHeartbeat(); // Trigger animation if new donation received
        }

        // Update current stats
        currentStats = newStats;
        
        // Update all charts
        updateAllCharts(newStats);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from stats server');
        statusIndicator.className = 'status-indicator disconnected';
        statusText.textContent = 'Disconnected - Retrying...';
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        statusIndicator.className = 'status-indicator disconnected';
        statusText.textContent = 'Connection failed - Retrying...';
    });

});