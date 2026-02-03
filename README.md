# Mystery Shopper Backend

Backend API for the Mystery Shopper application, built with TypeScript and Express.js.

## Quick Start

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd mysteryShopperBE
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with environment variables:
```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=msDB
DB_USER=postgres
DB_PASSWORD=password

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

4. Set up the PostgreSQL database:
```bash
# Create the database
createdb msDB

# Run the SQL script to create tables
psql -d msDB -f database_schema.sql

# Populate tables with test data
psql -d msDB -f seed_data.sql
```

### Running

#### Development mode
```bash
npm run dev
```

#### Production mode
```bash
npm run build
npm start
```

## Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── middleware/      # Middleware
├── routes/          # API routes
├── types/           # TypeScript types
├── utils/           # Utilities and helpers
└── index.ts         # Application entry point
```

## Available Scripts

- `npm run dev` - Run in development mode with hot reload
- `npm run build` - Build the project
- `npm start` - Run the built project
- `npm test` - Run tests
- `npm run lint` - Lint the code
- `npm run lint:fix` - Auto-fix lint errors

## Configuration

Main settings are in the `.env` file:

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - Allowed origins for CORS
- `JWT_SECRET` - Secret key for JWT tokens
- `DB_*` - Database settings

## API Endpoints

### Main routes

- `GET /health` - Server health check
- `GET /api` - API information
- `GET /api/protected` - Example protected route

### Response structure

```json
{
  "success": true,
  "data": {},
  "error": {
    "message": "Error message",
    "statusCode": 400
  }
}
```

## Security

The project includes the following security measures:

- Helmet.js for security headers
- CORS for access control
- Rate limiting for DDoS protection
- Input validation
- Data sanitization

## Testing

```bash
npm test
```

## Logging

The application uses Morgan for HTTP request logging and a custom error logging system.

## Deployment

1. Install dependencies: `npm install`
2. Build the project: `npm run build`
3. Run: `npm start`

## Contributing

1. Fork the repository
2. Create a branch for your feature
3. Make your changes
4. Add tests
5. Create a Pull Request

## License

MIT License
