const API_BASE = 'http://localhost:3000';

// Tab switching
document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // Remove active class from all tabs and contents
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            btn.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
            
            // Load data for the active tab
            loadTabData(targetTab);
        });
    });

    // Load initial data
    loadTabData('users');
});

// Load data based on active tab
async function loadTabData(tab) {
    switch(tab) {
        case 'users':
            await loadUsers();
            break;
        case 'donors':
            await loadDonors();
            break;
        case 'donations':
            await loadDonations();
            break;
        case 'hospitals':
            await loadHospitals();
            break;
    }
}

// ========== USERS ==========
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/admin/users`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to load users');
        const users = await response.json();
        
        const tbody = document.getElementById('users-table-body');
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No users found</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.accountType}</td>
                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-edit" onclick="editUser('${user._id}')">Edit</button>
                        <button class="btn-delete" onclick="deleteUser('${user._id}')">Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('users-table-body').innerHTML = 
            '<tr><td colspan="5" style="color: #f85149;">Error loading users</td></tr>';
    }
}

function openUserModal(userId = null) {
    const modal = document.getElementById('user-modal');
    const form = document.getElementById('user-form');
    const title = document.getElementById('user-modal-title');
    
    form.reset();
    document.getElementById('user-id').value = '';
    
    if (userId) {
        title.textContent = 'Edit User';
        // Load user data
        fetch(`${API_BASE}/admin/users/${userId}`, { credentials: 'include' })
            .then(res => res.json())
            .then(user => {
                document.getElementById('user-id').value = user._id;
                document.getElementById('user-name').value = user.name;
                document.getElementById('user-email').value = user.email;
                document.getElementById('user-account-type').value = user.accountType;
            });
    } else {
        title.textContent = 'Add User';
    }
    
    modal.style.display = 'block';
}

document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('user-id').value;
    const data = {
        name: document.getElementById('user-name').value,
        email: document.getElementById('user-email').value,
        accountType: document.getElementById('user-account-type').value
    };
    
    const password = document.getElementById('user-password').value;
    if (password) data.password = password;
    
    try {
        const url = id ? `${API_BASE}/admin/users/${id}` : `${API_BASE}/admin/users`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to save user');
        
        closeModal('user-modal');
        loadUsers();
        alert('User saved successfully!');
    } catch (error) {
        console.error('Error saving user:', error);
        alert('Error saving user. Please try again.');
    }
});

async function editUser(userId) {
    openUserModal(userId);
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to delete user');
        
        loadUsers();
        alert('User deleted successfully!');
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user. Please try again.');
    }
}

// ========== DONORS ==========
async function loadDonors() {
    try {
        const response = await fetch(`${API_BASE}/admin/donors`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to load donors');
        const donors = await response.json();
        
        const tbody = document.getElementById('donors-table-body');
        if (donors.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No donors found</td></tr>';
            return;
        }
        
        tbody.innerHTML = donors.map(donor => `
            <tr>
                <td>${donor.name}</td>
                <td>${donor.registrationNumber}</td>
                <td>${donor.donorType}</td>
                <td>${new Date(donor.createdAt).toLocaleDateString()}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-edit" onclick="editDonor('${donor._id}')">Edit</button>
                        <button class="btn-delete" onclick="deleteDonor('${donor._id}')">Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading donors:', error);
        document.getElementById('donors-table-body').innerHTML = 
            '<tr><td colspan="5" style="color: #f85149;">Error loading donors</td></tr>';
    }
}

function openDonorModal(donorId = null) {
    const modal = document.getElementById('donor-modal');
    const form = document.getElementById('donor-form');
    const title = document.getElementById('donor-modal-title');
    
    form.reset();
    document.getElementById('donor-id').value = '';
    
    if (donorId) {
        title.textContent = 'Edit Donor';
        fetch(`${API_BASE}/admin/donors/${donorId}`, { credentials: 'include' })
            .then(res => res.json())
            .then(donor => {
                document.getElementById('donor-id').value = donor._id;
                document.getElementById('donor-name').value = donor.name;
                document.getElementById('donor-registration').value = donor.registrationNumber;
                document.getElementById('donor-type').value = donor.donorType.toLowerCase();
            });
    } else {
        title.textContent = 'Add Donor';
    }
    
    modal.style.display = 'block';
}

document.getElementById('donor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('donor-id').value;
    const data = {
        name: document.getElementById('donor-name').value,
        registrationNumber: document.getElementById('donor-registration').value,
        donorType: document.getElementById('donor-type').value
    };
    
    try {
        const url = id ? `${API_BASE}/admin/donors/${id}` : `${API_BASE}/admin/donors`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to save donor');
        
        closeModal('donor-modal');
        loadDonors();
        alert('Donor saved successfully!');
    } catch (error) {
        console.error('Error saving donor:', error);
        alert('Error saving donor. Please try again.');
    }
});

async function editDonor(donorId) {
    openDonorModal(donorId);
}

async function deleteDonor(donorId) {
    if (!confirm('Are you sure you want to delete this donor?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/donors/${donorId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to delete donor');
        
        loadDonors();
        alert('Donor deleted successfully!');
    } catch (error) {
        console.error('Error deleting donor:', error);
        alert('Error deleting donor. Please try again.');
    }
}

// ========== DONATIONS ==========
async function loadDonations() {
    try {
        const response = await fetch(`${API_BASE}/admin/donations`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to load donations');
        const donations = await response.json();
        
        const tbody = document.getElementById('donations-table-body');
        if (donations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">No donations found</td></tr>';
            return;
        }
        
        tbody.innerHTML = donations.map(donation => `
            <tr>
                <td>${donation.donatedBy?.name || 'N/A'}</td>
                <td>${donation.donatedTo?.name || 'N/A'}</td>
                <td>${
                    donation.isBloodAccepted ? 'Accepted' : 
                    donation.isBloodRejected ? 'Rejected' : 
                    'Pending'
                }</td>
                <td>${donation.isBloodAccepted ? 'Yes' : 'No'}</td>
                <td>${donation.isBloodRejected ? 'Yes' : 'No'}</td>
                <td>${donation.isCertificateIssued ? 'Yes' : 'No'}</td>
                <td>${new Date(donation.createdAt).toLocaleDateString()}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-edit" onclick="editDonation('${donation._id}')">Edit</button>
                        <button class="btn-delete" onclick="deleteDonation('${donation._id}')">Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading donations:', error);
        document.getElementById('donations-table-body').innerHTML = 
            '<tr><td colspan="8" style="color: #f85149;">Error loading donations</td></tr>';
    }
}

async function loadDonorsForSelect() {
    try {
        const response = await fetch(`${API_BASE}/admin/donors`, { credentials: 'include' });
        const donors = await response.json();
        const select = document.getElementById('donation-donor');
        select.innerHTML = '<option value="">Select Donor</option>' + 
            donors.map(d => `<option value="${d._id}">${d.name} (${d.registrationNumber})</option>`).join('');
    } catch (error) {
        console.error('Error loading donors:', error);
    }
}

async function loadHospitalsForSelect() {
    try {
        const response = await fetch(`${API_BASE}/admin/hospitals`, { credentials: 'include' });
        const hospitals = await response.json();
        const select = document.getElementById('donation-hospital');
        select.innerHTML = '<option value="">Select Hospital</option>' + 
            hospitals.map(h => `<option value="${h._id}">${h.name}</option>`).join('');
    } catch (error) {
        console.error('Error loading hospitals:', error);
    }
}

function openDonationModal(donationId = null) {
    const modal = document.getElementById('donation-modal');
    const form = document.getElementById('donation-form');
    const title = document.getElementById('donation-modal-title');
    
    form.reset();
    document.getElementById('donation-id').value = '';
    
    loadDonorsForSelect();
    loadHospitalsForSelect();
    
    if (donationId) {
        title.textContent = 'Edit Donation';
        fetch(`${API_BASE}/admin/donations/${donationId}`, { credentials: 'include' })
            .then(res => res.json())
            .then(donation => {
                document.getElementById('donation-id').value = donation._id;
                document.getElementById('donation-donor').value = donation.donatedBy?._id || '';
                document.getElementById('donation-hospital').value = donation.donatedTo?._id || '';
                document.getElementById('donation-accepted').checked = donation.isBloodAccepted;
                document.getElementById('donation-rejected').checked = donation.isBloodRejected;
                document.getElementById('donation-certificate').checked = donation.isCertificateIssued;
            });
    } else {
        title.textContent = 'Add Donation';
    }
    
    modal.style.display = 'block';
}

document.getElementById('donation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('donation-id').value;
    const data = {
        donatedBy: document.getElementById('donation-donor').value,
        donatedTo: document.getElementById('donation-hospital').value,
        isBloodAccepted: document.getElementById('donation-accepted').checked,
        isBloodRejected: document.getElementById('donation-rejected').checked,
        isCertificateIssued: document.getElementById('donation-certificate').checked
    };
    
    try {
        const url = id ? `${API_BASE}/admin/donations/${id}` : `${API_BASE}/admin/donations`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to save donation');
        
        closeModal('donation-modal');
        loadDonations();
        alert('Donation saved successfully!');
    } catch (error) {
        console.error('Error saving donation:', error);
        alert('Error saving donation. Please try again.');
    }
});

async function editDonation(donationId) {
    openDonationModal(donationId);
}

async function deleteDonation(donationId) {
    if (!confirm('Are you sure you want to delete this donation?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/donations/${donationId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to delete donation');
        
        loadDonations();
        alert('Donation deleted successfully!');
    } catch (error) {
        console.error('Error deleting donation:', error);
        alert('Error deleting donation. Please try again.');
    }
}

// ========== HOSPITALS ==========
async function loadHospitals() {
    try {
        const response = await fetch(`${API_BASE}/admin/hospitals`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to load hospitals');
        const hospitals = await response.json();
        
        const tbody = document.getElementById('hospitals-table-body');
        if (hospitals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">No hospitals found</td></tr>';
            return;
        }
        
        tbody.innerHTML = hospitals.map(hospital => `
            <tr>
                <td>${hospital.name}</td>
                <td>${hospital.phone}</td>
                <td>${hospital.current}</td>
                <td>${hospital.target}</td>
                <td>${hospital.waiting}</td>
                <td>${hospital.beds}</td>
                <td>${hospital.isLocked ? 'Yes' : 'No'}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-edit" onclick="editHospital('${hospital._id}')">Edit</button>
                        <button class="btn-delete" onclick="deleteHospital('${hospital._id}')">Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading hospitals:', error);
        document.getElementById('hospitals-table-body').innerHTML = 
            '<tr><td colspan="8" style="color: #f85149;">Error loading hospitals</td></tr>';
    }
}

async function loadUsersForSelect() {
    try {
        const response = await fetch(`${API_BASE}/admin/users`, { credentials: 'include' });
        const users = await response.json();
        const select = document.getElementById('hospital-user');
        select.innerHTML = '<option value="">Select User</option>' + 
            users.map(u => `<option value="${u._id}">${u.email} (${u.accountType})</option>`).join('');
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function openHospitalModal(hospitalId = null) {
    const modal = document.getElementById('hospital-modal');
    const form = document.getElementById('hospital-form');
    const title = document.getElementById('hospital-modal-title');
    
    form.reset();
    document.getElementById('hospital-id').value = '';
    
    loadUsersForSelect();
    
    if (hospitalId) {
        title.textContent = 'Edit Hospital';
        fetch(`${API_BASE}/admin/hospitals/${hospitalId}`, { credentials: 'include' })
            .then(res => res.json())
            .then(hospital => {
                document.getElementById('hospital-id').value = hospital._id;
                document.getElementById('hospital-name').value = hospital.name;
                document.getElementById('hospital-phone').value = hospital.phone;
                document.getElementById('hospital-current').value = hospital.current;
                document.getElementById('hospital-target').value = hospital.target;
                document.getElementById('hospital-waiting').value = hospital.waiting;
                document.getElementById('hospital-beds').value = hospital.beds;
                document.getElementById('hospital-user').value = hospital.user?._id || '';
                document.getElementById('hospital-locked').checked = hospital.isLocked;
            });
    } else {
        title.textContent = 'Add Hospital';
    }
    
    modal.style.display = 'block';
}

document.getElementById('hospital-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('hospital-id').value;
    const userId = document.getElementById('hospital-user').value;
    const data = {
        name: document.getElementById('hospital-name').value,
        phone: document.getElementById('hospital-phone').value,
        current: parseInt(document.getElementById('hospital-current').value),
        target: parseInt(document.getElementById('hospital-target').value),
        waiting: parseInt(document.getElementById('hospital-waiting').value),
        beds: parseInt(document.getElementById('hospital-beds').value),
        isLocked: document.getElementById('hospital-locked').checked
    };
    
    if (userId) data.user = userId;
    
    try {
        const url = id ? `${API_BASE}/admin/hospitals/${id}` : `${API_BASE}/admin/hospitals`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to save hospital');
        
        closeModal('hospital-modal');
        loadHospitals();
        alert('Hospital saved successfully!');
    } catch (error) {
        console.error('Error saving hospital:', error);
        alert('Error saving hospital. Please try again.');
    }
});

async function editHospital(hospitalId) {
    openHospitalModal(hospitalId);
}

async function deleteHospital(hospitalId) {
    if (!confirm('Are you sure you want to delete this hospital?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/hospitals/${hospitalId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to delete hospital');
        
        loadHospitals();
        alert('Hospital deleted successfully!');
    } catch (error) {
        console.error('Error deleting hospital:', error);
        alert('Error deleting hospital. Please try again.');
    }
}

// ========== MODAL UTILITIES ==========
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

