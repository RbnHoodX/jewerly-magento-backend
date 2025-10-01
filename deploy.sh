#!/bin/bash

# PrimeStyle Backend Deployment Script
# This script helps deploy the backend using Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    print_success "Docker is installed"
}

# Check if .env file exists
check_env() {
    if [ ! -f .env ]; then
        print_error ".env file not found. Please create one with your environment variables."
        exit 1
    fi
    print_success ".env file found"
}

# Build Docker image
build_image() {
    print_status "Building Docker image..."
    docker build -t shopify-database-sync:latest .
    print_success "Docker image built successfully"
}

# Stop existing container
stop_container() {
    if docker ps -q -f name=shopify-backend | grep -q .; then
        print_status "Stopping existing container..."
        docker stop shopify-backend
        docker rm shopify-backend
        print_success "Existing container stopped and removed"
    fi
}

# Run container
run_container() {
    print_status "Starting container..."
    docker run -d \
        --name shopify-backend \
        -p 3000:3000 \
        --env-file .env \
        --restart unless-stopped \
        shopify-database-sync:latest
    print_success "Container started successfully"
}

# Check container health
check_health() {
    print_status "Checking container health..."
    sleep 10
    
    if docker ps -f name=shopify-backend --format "table {{.Names}}\t{{.Status}}" | grep -q "Up"; then
        print_success "Container is running"
    else
        print_error "Container failed to start"
        docker logs shopify-backend
        exit 1
    fi
    
    # Test health endpoint
    print_status "Testing health endpoint..."
    sleep 5
    
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        print_success "Health check passed"
    else
        print_warning "Health check failed, but container is running"
    fi
}

# Show container info
show_info() {
    print_status "Container Information:"
    echo "Container Name: shopify-backend"
    echo "Port: 3000"
    echo "Status: $(docker ps -f name=shopify-backend --format '{{.Status}}')"
    echo ""
    print_status "Useful Commands:"
    echo "  View logs: docker logs shopify-backend"
    echo "  Stop container: docker stop shopify-backend"
    echo "  Remove container: docker rm shopify-backend"
    echo "  View container stats: docker stats shopify-backend"
}

# Main deployment function
deploy() {
    print_status "Starting PrimeStyle Backend Deployment..."
    
    check_docker
    check_env
    build_image
    stop_container
    run_container
    check_health
    show_info
    
    print_success "Deployment completed successfully!"
    print_status "Your backend is now running at http://localhost:3000"
}

# Development deployment
deploy_dev() {
    print_status "Starting Development Deployment..."
    
    check_docker
    check_env
    
    # Stop existing dev container
    if docker ps -q -f name=shopify-backend-dev | grep -q .; then
        docker stop shopify-backend-dev
        docker rm shopify-backend-dev
    fi
    
    # Build dev image
    print_status "Building development image..."
    docker build -f Dockerfile.dev -t shopify-database-sync:dev .
    
    # Run dev container with volume mounting
    print_status "Starting development container..."
    docker run -d \
        --name shopify-backend-dev \
        -p 3000:3000 \
        --env-file .env \
        -v $(pwd)/src:/app/src \
        shopify-database-sync:dev
    
    print_success "Development container started with hot reloading"
}

# Clean up function
cleanup() {
    print_status "Cleaning up..."
    docker stop shopify-backend 2>/dev/null || true
    docker rm shopify-backend 2>/dev/null || true
    docker rmi shopify-database-sync:latest 2>/dev/null || true
    print_success "Cleanup completed"
}

# Show help
show_help() {
    echo "PrimeStyle Backend Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy     Deploy production container"
    echo "  dev        Deploy development container with hot reloading"
    echo "  stop       Stop running container"
    echo "  logs       Show container logs"
    echo "  status     Show container status"
    echo "  cleanup    Remove container and image"
    echo "  help       Show this help message"
    echo ""
}

# Parse command line arguments
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    dev)
        deploy_dev
        ;;
    stop)
        print_status "Stopping container..."
        docker stop shopify-backend 2>/dev/null || docker stop shopify-backend-dev 2>/dev/null || true
        print_success "Container stopped"
        ;;
    logs)
        docker logs -f shopify-backend 2>/dev/null || docker logs -f shopify-backend-dev 2>/dev/null || print_error "No container found"
        ;;
    status)
        docker ps -f name=shopify-backend --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        ;;
    cleanup)
        cleanup
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
