let currentRequestId = null;
let selectedHotelId = null;

// Initialize components when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    const requestTypeSelect = document.querySelector('select[name="requestType"]');
    const locationTypeSelect = document.querySelector('select[name="locationType"]');
    const scheduleTypeSelect = document.querySelector('select[name="scheduleType"]');
    const hotelSelect = document.querySelector('select[name="hotel"]');
    
    if (requestTypeSelect) {
        requestTypeSelect.addEventListener('change', updateFormFields);
    }
    
    if (locationTypeSelect) {
        locationTypeSelect.addEventListener('change', updateLocationFields);
    }
    
    if (scheduleTypeSelect) {
        scheduleTypeSelect.addEventListener('change', updateScheduleFields);
    }
    
    if (hotelSelect) {
        hotelSelect.addEventListener('change', function() {
            selectedHotelId = this.value;
            updateRoomsList();
        });
    }
    
    // Initialize form fields
    updateFormFields();
    updateLocationFields();
    updateScheduleFields();
});

function updateFormFields() {
    const requestType = document.querySelector('select[name="requestType"]').value;
    const priorityField = document.getElementById('priorityField');
    const serviceTypeField = document.getElementById('serviceTypeField');
    
    if (requestType === 'maintenance') {
        priorityField.style.display = 'block';
        serviceTypeField.style.display = 'block';
    } else {
        priorityField.style.display = 'none';
        serviceTypeField.style.display = 'none';
    }
}

function updateLocationFields() {
    const locationType = document.querySelector('select[name="locationType"]').value;
    const roomField = document.getElementById('roomField');
    const publicAreaField = document.getElementById('publicAreaField');
    const facilityField = document.getElementById('facilityField');
    
    roomField.style.display = locationType === 'room' ? 'block' : 'none';
    publicAreaField.style.display = locationType === 'public-area' ? 'block' : 'none';
    facilityField.style.display = locationType === 'facility' ? 'block' : 'none';
    
    if (locationType === 'room' && selectedHotelId) {
        updateRoomsList();
    }
}

function updateScheduleFields() {
    const scheduleType = document.querySelector('select[name="scheduleType"]').value;
    const oneTimeSchedule = document.getElementById('oneTimeSchedule');
    const recurringSchedule = document.getElementById('recurringSchedule');
    
    oneTimeSchedule.style.display = scheduleType === 'one-time' ? 'block' : 'none';
    recurringSchedule.style.display = scheduleType === 'recurring' ? 'block' : 'none';
}

async function updateRoomsList() {
    if (!selectedHotelId) return;
    
    try {
        const response = await fetch(`/admin/api/hotels/${selectedHotelId}/rooms`);
        const data = await response.json();
        
        if (data.success) {
            const roomSelect = document.querySelector('select[name="room"]');
            roomSelect.innerHTML = '';
            
            data.data.forEach(room => {
                const option = document.createElement('option');
                option.value = room._id;
                option.textContent = `Room ${room.number}`;
                roomSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error fetching rooms:', error);
    }
}

async function addRequest() {
    const form = document.getElementById('addRequestForm');
    const formData = new FormData(form);
    const requestData = Object.fromEntries(formData.entries());
    
    try {
        const response = await fetch('/admin/maintenance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        if (response.ok) {
            // Close modal and refresh page
            const modal = bootstrap.Modal.getInstance(document.getElementById('addRequestModal'));
            modal.hide();
            window.location.reload();
        } else {
            const data = await response.json();
            alert(data.message || 'Error creating maintenance request');
        }
    } catch (error) {
        console.error('Error creating maintenance request:', error);
        alert('Error creating maintenance request');
    }
}

async function updateStatus(status) {
    if (!currentRequestId) return;
    
    try {
        const response = await fetch(`/admin/maintenance/${currentRequestId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            // Close modal and refresh page
            const modal = bootstrap.Modal.getInstance(document.getElementById('viewRequestModal'));
            modal.hide();
            window.location.reload();
        } else {
            const data = await response.json();
            alert(data.message || 'Error updating maintenance request');
        }
    } catch (error) {
        console.error('Error updating maintenance request:', error);
        alert('Error updating maintenance request');
    }
}

async function viewRequest(id) {
    try {
        currentRequestId = id;
        const response = await fetch(`/admin/maintenance/${id}`);
        const data = await response.json();
        
        if (data.success) {
            const request = data.data;
            
            // Update modal content
            document.getElementById('viewRequestId').textContent = request._id;
            document.getElementById('viewRequestType').textContent = request.requestType;
            document.getElementById('viewLocation').textContent = getLocationString(request);
            document.getElementById('viewDescription').textContent = request.description;
            document.getElementById('viewStatus').textContent = request.status;
            document.getElementById('viewCreatedAt').textContent = new Date(request.createdAt).toLocaleString();
            
            if (request.requestType === 'maintenance') {
                document.getElementById('viewPriority').textContent = request.priority;
                document.getElementById('viewServiceType').textContent = request.serviceType;
                document.getElementById('viewPriorityRow').style.display = 'table-row';
                document.getElementById('viewServiceTypeRow').style.display = 'table-row';
            } else {
                document.getElementById('viewPriorityRow').style.display = 'none';
                document.getElementById('viewServiceTypeRow').style.display = 'none';
            }
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('viewRequestModal'));
            modal.show();
        }
    } catch (error) {
        console.error('Error fetching maintenance request:', error);
        alert('Error fetching maintenance request details');
    }
}

function getLocationString(request) {
    switch (request.locationType) {
        case 'room':
            return `Room ${request.room.number}`;
        case 'public-area':
            return request.publicArea;
        case 'facility':
            return request.facility;
        default:
            return 'Unknown location';
    }
}
