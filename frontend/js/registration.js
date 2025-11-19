document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  const donorTypeEl = document.getElementById("donor-type");
  const nameEl = document.getElementById("name");
  const regNumberEl = document.getElementById("reg-number");
  const hospitalEl = document.getElementById("hospital");
  const hospitalGrid = document.querySelector(".hospitals-grid");
  const refreshBtn = document.querySelector(".refresh-btn");

  // Load hospitals and populate both dropdown + grid
  async function loadHospitals() {
    try {
      const response = await fetch("http://localhost:3000/hospitals");
      const hospitals = await response.json();

      // Populate dropdown
      hospitalEl.innerHTML = hospitals
        .map((h) => `<option value="${h.name}">${h.name}</option>`)
        .join("");

      // Populate hospital grid
      hospitalGrid.innerHTML = hospitals
        .map((h) => {
          const color =
            h.percentage >= 80
              ? "#4CAF50" // Green
              : h.percentage >= 50
              ? "#FFC107" // Yellow
              : "#F44336"; // Red

          return `
            <div class="hospital-card">
              <h3>${h.name}</h3>
              <p><strong>Vacant Beds:</strong> ${h.priorityScore}</p>
              <p><strong>Current:</strong> ${h.current}</p>
              <p><strong>Target:</strong> ${h.target}</p>
              <div class="progress-bar">
                <div class="progress" style="width: ${h.percentage}%; background-color: ${color};"></div>
              </div>
              <p>${h.percentage}% of target reached</p>
            </div>
          `;
        })
        .join("");
    } catch (err) {
      console.error("Error loading hospitals:", err);
      hospitalGrid.innerHTML = `<p style="color:red;">Failed to load hospitals.</p>`;
    }
  }

  // Refresh button
  refreshBtn.addEventListener("click", loadHospitals);

  // Submit donor registration
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const donorType = donorTypeEl.value;
    const name = nameEl.value.trim();
    const registrationNumber = regNumberEl.value.trim();
    const hospitalName = hospitalEl.value;

    if (!donorType || !name || !registrationNumber || !hospitalName) {
      alert("Please fill all the fields!");
      return;
    }

    try {
      const res = await fetch("http://localhost:3000/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donorType, name, registrationNumber, hospitalName }),
      });

      const data = await res.json();
      alert(data.message);

      if (data.success) {
        form.reset();
        loadHospitals(); // Refresh stats
      }
    } catch (err) {
      console.error("Error submitting registration:", err);
      alert("Server error. Please try again later.");
    }
  });

  // Initial load
  loadHospitals();
});
