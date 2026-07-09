# Deployment Guide - URSB Asset Management System

This guide explains how to deploy the URSB Asset Management System on a VM using Docker Compose.

## Prerequisites

- **Docker** (version 20.10 or higher)
- **Docker Compose** (version 2.0 or higher)
- **VM with IP**: 192.168.8.82 (or your configured IP)
- **Ports available**: 80 (HTTP), 3306 (MySQL - optional, for external access)

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ursb_asset_mgt
```

### 2. Configure Environment Variables (Optional)

Create a `.env` file in the root directory to override default values:

```bash
# MySQL Configuration
MYSQL_ROOT_PASSWORD=your_secure_root_password
MYSQL_DATABASE=ursb_asset_db
MYSQL_USER=ursb_user
MYSQL_PASSWORD=your_secure_password

# Default Admin Credentials
AUTH_DEFAULT_EMAIL=admin@ursb.local
AUTH_DEFAULT_PASSWORD=Admin123!
```

**Default values** (if no `.env` file is provided):
- MySQL Root Password: `ursb_root_pass_2024`
- MySQL Database: `ursb_asset_db`
- MySQL User: `ursb_user`
- MySQL Password: `ursb_pass_2024`
- Admin Email: `admin@ursb.local`
- Admin Password: `Admin123!`

### 3. Build and Start Services

```bash
docker-compose up -d --build
```

This will:
- Build the backend and frontend Docker images
- Start MySQL, backend, and frontend containers
- Initialize the MySQL database
- Run database migrations automatically

### 4. Access the Application

- **Frontend**: http://192.168.8.82
- **Backend API**: http://192.168.8.82/api
- **API Documentation**: http://192.168.8.82/api/docs

### 5. Login

Use the default admin credentials (or your configured ones):
- **Email**: admin@ursb.local
- **Password**: Admin123!

**Important**: Change the default password after first login!

## Service Management

### View Running Containers

```bash
docker-compose ps
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mysql
```

### Stop Services

```bash
docker-compose down
```

### Stop Services and Remove Volumes (⚠️ Deletes Database Data)

```bash
docker-compose down -v
```

### Restart Services

```bash
docker-compose restart
```

### Rebuild After Code Changes

```bash
docker-compose up -d --build
```

## Database Management

### Run Database Migrations

Migrations run automatically on startup. To manually run migrations:

```bash
docker-compose exec backend alembic upgrade head
```

### Access MySQL Shell

```bash
docker-compose exec mysql mysql -u ursb_user -p ursb_asset_db
```

### Backup Database

```bash
docker-compose exec mysql mysqldump -u ursb_user -p ursb_asset_db > backup.sql
```

### Restore Database

```bash
docker-compose exec -T mysql mysql -u ursb_user -p ursb_asset_db < backup.sql
```

## Troubleshooting

### Container Won't Start

Check logs for the specific service:
```bash
docker-compose logs backend
docker-compose logs mysql
```

### Database Connection Errors

1. Ensure MySQL container is healthy:
```bash
docker-compose ps
```

2. Check MySQL logs:
```bash
docker-compose logs mysql
```

3. Verify environment variables in `.env` file

### Frontend Cannot Connect to Backend

1. Check if backend is running:
```bash
docker-compose ps backend
```

2. Verify CORS configuration in `backend/.env.production`

3. Check nginx configuration in `frontend/nginx.conf`

### Port Already in Use

If port 80 or 3306 is already in use, modify the `docker-compose.yml`:

```yaml
services:
  mysql:
    ports:
      - "3307:3306"  # Change host port
  
  frontend:
    ports:
      - "8080:80"  # Change host port
```

### Permission Errors

Ensure proper file permissions:
```bash
chmod -R 755 .
```

## Security Recommendations

1. **Change Default Passwords**: Immediately change MySQL root password and admin credentials
2. **Use HTTPS**: For production, configure SSL/TLS with a reverse proxy (nginx, traefik)
3. **Firewall**: Configure firewall rules to restrict access
4. **Regular Backups**: Set up automated database backups
5. **Update Dependencies**: Regularly update Docker images and dependencies

## Updating the Application

### Pull Latest Code

```bash
git pull origin main
```

### Rebuild and Restart

```bash
docker-compose up -d --build
```

### Database Migrations

If the update includes database changes:
```bash
docker-compose exec backend alembic upgrade head
```

## Performance Tuning

### MySQL Configuration

For high-traffic deployments, create a custom MySQL configuration file and mount it:

```yaml
services:
  mysql:
    volumes:
      - mysql_data:/var/lib/mysql
      - ./mysql.cnf:/etc/mysql/conf.d/custom.cnf:ro
```

### Resource Limits

Add resource limits to `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

## Monitoring

### Container Health

```bash
docker-compose ps
```

### Resource Usage

```bash
docker stats
```

### Database Performance

Monitor MySQL slow query log and optimize queries as needed.

## Support

For issues or questions:
- Check application logs: `docker-compose logs`
- Review this documentation
- Contact system administrator
