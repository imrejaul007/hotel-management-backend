// Form validation
document.addEventListener('DOMContentLoaded', function() {
    const forms = document.querySelectorAll('.needs-validation');
    forms.forEach(form => {
        form.addEventListener('submit', function(event) {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            form.classList.add('was-validated');
        });
    });
});

// Date input validation
const checkInDate = document.querySelector('input[name="checkIn"]');
const checkOutDate = document.querySelector('input[name="checkOut"]');

if (checkInDate && checkOutDate) {
    // Set minimum check-in date to today
    const today = new Date().toISOString().split('T')[0];
    checkInDate.setAttribute('min', today);

    // Update check-out date minimum when check-in date changes
    checkInDate.addEventListener('change', function() {
        checkOutDate.setAttribute('min', this.value);
        if (checkOutDate.value && checkOutDate.value < this.value) {
            checkOutDate.value = this.value;
        }
    });
}

// Newsletter form submission
const newsletterForm = document.getElementById('newsletterForm');
if (newsletterForm) {
    newsletterForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const emailInput = this.querySelector('input[type="email"]');
        const email = emailInput.value;

        try {
            const response = await fetch('/api/newsletter/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            if (response.ok) {
                showAlert('success', 'Successfully subscribed to newsletter!');
                emailInput.value = '';
            } else {
                const data = await response.json();
                showAlert('danger', data.message || 'Failed to subscribe. Please try again.');
            }
        } catch (error) {
            console.error('Newsletter subscription error:', error);
            showAlert('danger', 'An error occurred. Please try again later.');
        }
    });
}

// Alert helper function
function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Room booking form handler
const bookingForm = document.getElementById('bookingForm');
if (bookingForm) {
    bookingForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const bookingData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(bookingData)
            });

            if (response.ok) {
                const data = await response.json();
                window.location.href = `/bookings/${data.bookingId}`;
            } else {
                const data = await response.json();
                showAlert('danger', data.message || 'Failed to create booking. Please try again.');
            }
        } catch (error) {
            console.error('Booking error:', error);
            showAlert('danger', 'An error occurred. Please try again later.');
        }
    });
}

// Search form handler
const searchForm = document.querySelector('form[action="/search"]');
if (searchForm) {
    searchForm.addEventListener('submit', function(e) {
        const checkIn = this.querySelector('input[name="checkIn"]').value;
        const checkOut = this.querySelector('input[name="checkOut"]').value;

        if (new Date(checkIn) >= new Date(checkOut)) {
            e.preventDefault();
            showAlert('danger', 'Check-out date must be after check-in date.');
        }
    });
}

// Image error handler
document.addEventListener('error', function(e) {
    if (e.target.tagName.toLowerCase() === 'img') {
        e.target.src = '/images/hotel-placeholder.jpg';
    }
}, true);

// Scroll to top button
const scrollButton = document.createElement('button');
scrollButton.className = 'btn btn-primary scroll-top';
scrollButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
scrollButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: none;
    z-index: 1000;
`;

document.body.appendChild(scrollButton);

window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
        scrollButton.style.display = 'block';
    } else {
        scrollButton.style.display = 'none';
    }
});

scrollButton.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});
