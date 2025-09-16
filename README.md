# SmartStock Backend

A comprehensive inventory management system backend built with Node.js, Express, and PostgreSQL.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Database**: PostgreSQL with Neon cloud database support
- **API Architecture**: RESTful APIs and Serverless functions (Vercel)
- **Real-time Features**: WebSocket support for live updates
- **Security**: Rate limiting, input validation, and secure password hashing
- **Logging**: Comprehensive activity logging and error handling

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon)
- **Authentication**: JWT tokens
- **Validation**: Joi
- **Password Hashing**: bcryptjs
- **Database Client**: pg (node-postgres)
- **Serverless**: Vercel Functions

## Project Structure

```
├── api/                    # Vercel serverless functions
│   ├── auth/
│   ├── products/
│   ├── inventory/
│   ├── categories/
│   ├── departments/
│   └── users/
├── config/                 # Database configuration
├── middleware/             # Custom middleware
├── migrations/             # Database migrations
├── routes/                 # Express routes (for local development)
├── scripts/               # Database and utility scripts
└── server.js              # Main server file
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database Configuration (Neon PostgreSQL)
DATABASE_URL=your_neon_database_url

# Security
JWT_SECRET=your-super-secret-jwt-key
REFRESH_TOKEN_SECRET=your-super-secret-refresh-jwt-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=30d
NODE_ENV=production

# Application Settings
APP_NAME=SmartStock
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

## Database Setup

1. **Create Neon Database**: Sign up at [neon.tech](https://neon.tech) and create a new database
2. **Run Migrations**:
   ```bash
   npm run migrate
   ```
3. **Seed Database** (optional):
   ```bash
   npm run seed
   ```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration (Manager only)
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout

### Products
- `GET /api/products` - Get all products with pagination and filtering
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Inventory
- `GET /api/inventory/summary` - Get inventory statistics
- `POST /api/inventory/update` - Update inventory levels
- `GET /api/inventory/alerts` - Get low stock alerts

### Categories & Departments
- `GET /api/categories` - Get all categories
- `GET /api/departments` - Get all departments
- `GET /api/users` - Get all users (Manager only)

## Development

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run migrations
npm run migrate

# Run tests
npm test
```

### Production Deployment (Vercel)

1. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

2. **Set Environment Variables** in Vercel dashboard:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `REFRESH_TOKEN_SECRET`
   - `NODE_ENV=production`
   - `FRONTEND_URL`

3. **Configure `vercel.json`** for API routes:
   ```json
   {
     "version": 2,
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "/api/$1"
       }
     ]
   }
   ```

## Database Schema

### Users
- Authentication and user management
- Role-based permissions (manager/staff)
- Department assignments

### Products
- Product catalog with SKUs
- Category and department organization
- Stock levels and pricing

### Inventory Logs
- Track all inventory movements
- Audit trail for stock changes
- Integration with user activities

### Activity Logs
- Comprehensive activity tracking
- User action logging
- Security audit trail

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for secure password storage
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Joi schema validation
- **SQL Injection Protection**: Parameterized queries
- **CORS Configuration**: Secure cross-origin requests

## Performance

- **Connection Pooling**: Efficient database connections
- **Query Optimization**: Indexed database queries
- **Pagination**: Efficient large dataset handling
- **Caching**: Redis support for session storage

## Monitoring & Logging

- **Error Handling**: Comprehensive error responses
- **Activity Logging**: User action tracking
- **Performance Monitoring**: Response time tracking
- **Health Checks**: API health endpoints

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details