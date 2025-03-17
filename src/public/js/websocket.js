// WebSocket connection handler
class HotelWebSocket {
    constructor() {
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.listeners = new Map();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
            this.emit('connection', { status: 'connected' });
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        this.socket.onclose = () => {
            console.log('WebSocket disconnected');
            this.handleReconnect();
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
        } else {
            this.emit('error', { message: 'Failed to reconnect to server' });
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'ROOM_STATUS_UPDATE':
                this.updateRoomStatus(data.payload);
                break;
            case 'CHECK_IN_OUT':
                this.updateCheckInOut(data.payload);
                break;
            case 'NEW_BOOKING':
                this.handleNewBooking(data.payload);
                break;
            case 'INVENTORY_ALERT':
                this.handleInventoryAlert(data.payload);
                break;
            case 'MAINTENANCE_REQUEST':
                this.handleMaintenanceRequest(data.payload);
                break;
            default:
                console.log('Unhandled message type:', data.type);
        }

        // Emit event for any custom listeners
        this.emit(data.type, data.payload);
    }

    updateRoomStatus(data) {
        const roomElement = document.querySelector(`#room-${data.roomId}`);
        if (roomElement) {
            roomElement.className = `room-status ${data.status.toLowerCase()}`;
            roomElement.querySelector('.status-text').textContent = data.status;
        }

        // Update room status dashboard if present
        const statusChart = window.roomStatusChart;
        if (statusChart) {
            statusChart.update();
        }

        // Show notification
        this.showNotification('Room Status Update', `Room ${data.roomNumber} is now ${data.status}`);
    }

    updateCheckInOut(data) {
        // Update check-in/out lists
        const listId = data.type === 'CHECK_IN' ? 'checkInList' : 'checkOutList';
        const list = document.getElementById(listId);
        if (list) {
            // Update the list with new data
            this.updateCheckList(list, data);
        }

        // Show notification
        const message = data.type === 'CHECK_IN' 
            ? `New check-in: Room ${data.roomNumber}`
            : `New check-out: Room ${data.roomNumber}`;
        this.showNotification('Check-in/out Update', message);
    }

    handleNewBooking(data) {
        // Update booking calendar if present
        const calendar = window.bookingCalendar;
        if (calendar) {
            calendar.addEvent({
                title: `Booking: ${data.guestName}`,
                start: data.checkIn,
                end: data.checkOut,
                roomId: data.roomId
            });
        }

        // Update booking list if present
        const bookingList = document.getElementById('upcomingBookings');
        if (bookingList) {
            this.updateBookingList(bookingList, data);
        }

        // Show notification
        this.showNotification('New Booking', `New booking received for ${data.guestName}`);
    }

    handleInventoryAlert(data) {
        // Update inventory dashboard if present
        const inventoryElement = document.querySelector(`#inventory-${data.itemId}`);
        if (inventoryElement) {
            inventoryElement.querySelector('.stock-level').textContent = data.currentStock;
            if (data.currentStock <= data.threshold) {
                inventoryElement.classList.add('low-stock');
            }
        }

        // Show notification for low stock
        if (data.currentStock <= data.threshold) {
            this.showNotification('Low Stock Alert', 
                `${data.itemName} is running low (${data.currentStock} remaining)`);
        }
    }

    handleMaintenanceRequest(data) {
        // Update maintenance dashboard if present
        const maintenanceList = document.getElementById('maintenanceRequests');
        if (maintenanceList) {
            this.updateMaintenanceList(maintenanceList, data);
        }

        // Show notification
        this.showNotification('Maintenance Request', 
            `New maintenance request for Room ${data.roomNumber}: ${data.issue}`);
    }

    updateCheckList(list, data) {
        const template = document.getElementById('checkListItemTemplate');
        if (template) {
            const clone = template.content.cloneNode(true);
            // Fill in the template with data
            clone.querySelector('.guest-name').textContent = data.guestName;
            clone.querySelector('.room-number').textContent = data.roomNumber;
            clone.querySelector('.time').textContent = new Date(data.time).toLocaleTimeString();
            
            // Add to list
            list.insertBefore(clone, list.firstChild);
        }
    }

    updateBookingList(list, data) {
        const template = document.getElementById('bookingListItemTemplate');
        if (template) {
            const clone = template.content.cloneNode(true);
            // Fill in the template with data
            clone.querySelector('.guest-name').textContent = data.guestName;
            clone.querySelector('.check-in').textContent = new Date(data.checkIn).toLocaleDateString();
            clone.querySelector('.check-out').textContent = new Date(data.checkOut).toLocaleDateString();
            clone.querySelector('.room-type').textContent = data.roomType;
            
            // Add to list
            list.insertBefore(clone, list.firstChild);
        }
    }

    updateMaintenanceList(list, data) {
        const template = document.getElementById('maintenanceListItemTemplate');
        if (template) {
            const clone = template.content.cloneNode(true);
            // Fill in the template with data
            clone.querySelector('.room-number').textContent = data.roomNumber;
            clone.querySelector('.issue').textContent = data.issue;
            clone.querySelector('.priority').textContent = data.priority;
            clone.querySelector('.status').textContent = data.status;
            
            // Add to list
            list.insertBefore(clone, list.firstChild);
        }
    }

    showNotification(title, message) {
        // Check if the browser supports notifications
        if (!("Notification" in window)) {
            console.log("This browser does not support desktop notifications");
            return;
        }

        // Check if we have permission
        if (Notification.permission === "granted") {
            new Notification(title, { body: message });
        }
        // If we need to ask for permission
        else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(function (permission) {
                if (permission === "granted") {
                    new Notification(title, { body: message });
                }
            });
        }

        // Also show toast notification
        Swal.fire({
            title: title,
            text: message,
            icon: 'info',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
        });
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }

    send(type, payload) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type, payload }));
        }
    }
}

// Initialize WebSocket connection
const hotelWS = new HotelWebSocket();
hotelWS.connect();

// Request notification permission on page load
document.addEventListener('DOMContentLoaded', () => {
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
});
