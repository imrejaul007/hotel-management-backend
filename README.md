# Hotel Booking Application

A Node.js Express application for hotel booking management with admin interface.

## Features

- User Authentication (Login/Register)
- Role-based Access Control (Admin/User)
- Hotel Management
  - Add/Edit/Delete Hotels
  - Manage Rooms
  - Toggle Hotel Status
- User Management (Admin)
  - View All Users
  - Toggle User Status
  - Manage Admin Roles
- Booking System
- Responsive UI with Bootstrap

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **View Engine**: Handlebars
- **Authentication**: JWT, Passport
- **UI Framework**: Bootstrap 5
- **Icons**: Font Awesome

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Git

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd hotel-booking
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```
Then edit `.env` with your configuration.

4. Start the server:
```bash
# For production
npm start

# For development with auto-reload
npm run dev
```

The server will run on http://localhost:3000 by default.

## Environment Variables

Copy `.env.example` to `.env` and update the values:

- `PORT`: Server port (default: 3000)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `NODE_ENV`: Environment (development/production)
- `FRONTEND_URL`: Frontend URL for CORS

## API Documentation

API documentation is available at `/api-docs` when the server is running.

## Project Structure

```
src/
├── config/         # Configuration files
├── controllers/    # Route controllers
├── middlewares/    # Custom middlewares
├── models/         # Database models
├── routes/         # Route definitions
├── utils/          # Utility functions
└── views/          # Handlebars templates
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
