#!/bin/bash

# Development Helper Script for Booking System with Dynamic Pricing
# This script helps you run different combinations of services

echo "================================================"
echo "  Booking System - Development Helper"
echo "================================================"
echo ""

show_menu() {
    echo "Choose your setup:"
    echo ""
    echo "1) Full Docker Setup (All services in containers)"
    echo "2) Hybrid Setup (DB+Redis+Worker in Docker, API+Frontend local)"
    echo "3) Local Development (Only DB+Redis in Docker, everything else local)"
    echo "4) Stop all Docker services"
    echo "5) Show running services"
    echo "6) View pricing worker logs"
    echo "q) Quit"
    echo ""
}

full_docker() {
    echo "Starting all services in Docker..."
    docker-compose up -d
    echo ""
    echo "✅ All services started!"
    echo "   - Frontend: http://localhost"
    echo "   - API: http://localhost:3000"
    echo "   - PostgreSQL: localhost:5432"
    echo "   - Redis: localhost:6379"
    echo ""
}

hybrid_setup() {
    echo "Starting DB + Redis + Pricing Worker in Docker..."
    docker-compose -f docker-compose.dev.yml up -d postgres redis pricing-worker
    echo ""
    echo "✅ Infrastructure services started!"
    echo ""
    echo "Now run these commands in separate terminals:"
    echo ""
    echo "  Terminal 1 (Backend API):"
    echo "    cd backend"
    echo "    npm start"
    echo ""
    echo "  Terminal 2 (Frontend):"
    echo "    cd frontend"
    echo "    npm start"
    echo ""
    echo "Services:"
    echo "   - PostgreSQL: localhost:5432"
    echo "   - Redis: localhost:6379"
    echo "   - Pricing Worker: Running in Docker"
    echo ""
}

local_dev() {
    echo "Starting only DB + Redis in Docker..."
    docker-compose -f docker-compose.dev.yml up -d postgres redis
    echo ""
    echo "✅ Infrastructure services started!"
    echo ""
    echo "Now run these commands in separate terminals:"
    echo ""
    echo "  Terminal 1 (Backend API):"
    echo "    cd backend"
    echo "    npm start"
    echo ""
    echo "  Terminal 2 (Pricing Worker):"
    echo "    cd backend"
    echo "    npm run worker"
    echo ""
    echo "  Terminal 3 (Frontend):"
    echo "    cd frontend"
    echo "    npm start"
    echo ""
    echo "Services:"
    echo "   - PostgreSQL: localhost:5432"
    echo "   - Redis: localhost:6379"
    echo ""
}

stop_all() {
    echo "Stopping all services..."
    docker-compose down
    echo "✅ All services stopped"
}

show_status() {
    echo "Running services:"
    echo ""
    docker-compose ps
}

show_logs() {
    echo "Showing pricing worker logs (Ctrl+C to exit)..."
    echo ""
    docker-compose logs -f pricing-worker
}

# Main loop
while true; do
    show_menu
    read -p "Enter choice: " choice
    echo ""
    
    case $choice in
        1)
            full_docker
            ;;
        2)
            hybrid_setup
            ;;
        3)
            local_dev
            ;;
        4)
            stop_all
            ;;
        5)
            show_status
            ;;
        6)
            show_logs
            ;;
        q|Q)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo "Invalid choice. Please try again."
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    clear
done
