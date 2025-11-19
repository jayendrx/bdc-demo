const pendingReviewTable = document.querySelector(
  "#pending-review-table tbody"
);
const pendingCertTable = document.querySelector("#pending-cert-table tbody");
const totalPending = document.querySelector("#total-pending");
const totalCertsDue = document.querySelector("#total-certs-due");
const searchInput = document.querySelector("#donor-search");
const refreshBtn = document.querySelector("#refresh-btn");

// Check if all required elements are found
if (!refreshBtn) {
  console.error("Refresh button not found!");
}
if (!searchInput) {
  console.error("Search input not found!");
}

let storedData = { pendingReview: [], pendingCert: [] };

async function loadDonors() {
  try {
    // Show loading state and disable refresh button
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "Refreshing...";
    }
    if (pendingReviewTable) {
      pendingReviewTable.innerHTML = '<tr><td colspan="5">Loading pending donors...</td></tr>';
    }
    if (pendingCertTable) {
      pendingCertTable.innerHTML = '<tr><td colspan="4">Loading certificate-pending donors...</td></tr>';
    }
    
    const res = await fetch("/hospital/donors");

    // Check if the response was successful before proceeding
    if (!res.ok) {
      console.error("Failed to load donors:", res.status, res.statusText);
      if (res.status === 401 || res.status === 403) {
        alert("Authentication failed. Please log in again.");
        window.location.href = "/";
        return;
      }
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    storedData = data;

    renderTables();
  } catch (error) {
    console.error("Error loading donors:", error);
    if (pendingReviewTable) {
      pendingReviewTable.innerHTML = '<tr><td colspan="5" style="color: #e94560;">Error loading data. Please try again.</td></tr>';
    }
    if (pendingCertTable) {
      pendingCertTable.innerHTML = '<tr><td colspan="4" style="color: #e94560;">Error loading data. Please try again.</td></tr>';
    }
  } finally {
    // Re-enable refresh button
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "Refresh List";
    }
  }
}

function renderTables(filter = "") {
  // --- Pending review
  const filteredPending = (storedData.pendingReview || []).filter(
    (d) =>
      (d.donatedBy?.name?.toLowerCase() || "").includes(filter.toLowerCase()) ||
      (d.donatedBy?.registrationNumber?.toLowerCase() || "").includes(
        filter.toLowerCase()
      )
  );

  if (filteredPending.length === 0) {
    pendingReviewTable.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #a0a0a0;">No pending donors found</td></tr>';
  } else {
    pendingReviewTable.innerHTML = filteredPending
      .map(
        (d) => `
          <tr>
              <td>${d.donatedBy?.name || "Unknown Donor"}</td>
              <td>${d.donatedBy?.registrationNumber || "N/A"}</td>
              <td>${d.donatedBy?.donorType || "N/A"}</td>
              <td>${d.createdAt ? new Date(d.createdAt).toLocaleString() : "N/A"}</td>
              <td>
                  <button class="btn-accept" onclick="accept('${d._id}')">Accept</button>
                  <button class="btn-reject" onclick="rejectDonation('${d._id}')">Reject</button>
              </td>
          </tr>
      `
      )
      .join("");
  }

  // --- Pending certificates
  const filteredCert = (storedData.pendingCert || []).filter(
    (d) =>
      (d.donatedBy?.name?.toLowerCase() || "").includes(filter.toLowerCase()) ||
      (d.donatedBy?.registrationNumber?.toLowerCase() || "").includes(
        filter.toLowerCase()
      )
  );

  if (filteredCert.length === 0) {
    pendingCertTable.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #a0a0a0;">No certificate-pending donors found</td></tr>';
  } else {
    pendingCertTable.innerHTML = filteredCert
      .map(
        (d) => `
          <tr>
              <td>${d.donatedBy?.name || "Unknown Donor"}</td>
              <td>${d.donatedBy?.registrationNumber || "N/A"}</td>
              <td>${d.donatedBy?.donorType || "N/A"}</td>
              <td>
                  <button class="btn-issue-cert" onclick="issueCert('${d._id}')">Give Certificate</button>
              </td>
          </tr>
      `
      )
      .join("");
  }

  totalPending.textContent = filteredPending.length;
  totalCertsDue.textContent = filteredCert.length;
}

// Accept blood
async function accept(id) {
  try {
    const res = await fetch(`/hospital/accept/${id}`, { method: "POST" });
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    loadDonors();
  } catch (error) {
    console.error("Error accepting donation:", error);
    alert("Failed to accept donation. Please try again.");
  }
}

// Reject
async function rejectDonation(id) {
  try {
    const res = await fetch(`/hospital/reject/${id}`, { method: "POST" });
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    loadDonors();
  } catch (error) {
    console.error("Error rejecting donation:", error);
    alert("Failed to reject donation. Please try again.");
  }
}

// Issue certificate
async function issueCert(id) {
  try {
    const res = await fetch(`/hospital/certificate/${id}`, { method: "POST" });
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    loadDonors();
  } catch (error) {
    console.error("Error issuing certificate:", error);
    alert("Failed to issue certificate. Please try again.");
  }
}

// Live search
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    renderTables(e.target.value);
  });
}

// Refresh button
if (refreshBtn) {
  refreshBtn.addEventListener("click", (e) => {
    e.preventDefault();
    console.log("Refresh button clicked");
    loadDonors();
  });
}

loadDonors();
