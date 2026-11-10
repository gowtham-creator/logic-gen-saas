#!/bin/bash

echo "=== Disk Space Cleanup Script ==="
echo ""

# Check current disk usage
echo "1. Current disk usage:"
df -h
echo ""

# Check Docker disk usage
echo "2. Docker disk usage:"
docker system df 2>/dev/null || echo "Docker not available or not running"
echo ""

# Get available space in GB
AVAILABLE_SPACE=$(df -BG / | tail -1 | awk '{print $4}' | sed 's/G//')
echo "Available space: ${AVAILABLE_SPACE}GB"
echo ""

# Clean up Docker resources
echo "3. Cleaning up Docker resources..."
echo "   - Removing stopped containers..."
docker container prune -f 2>/dev/null || echo "   ⚠️  Could not prune containers"

echo "   - Removing unused images (this may take a while)..."
docker image prune -a -f 2>/dev/null || echo "   ⚠️  Could not prune images"

echo "   - Removing unused volumes..."
docker volume prune -f 2>/dev/null || echo "   ⚠️  Could not prune volumes"

echo "   - Removing build cache..."
docker builder prune -a -f 2>/dev/null || echo "   ⚠️  Could not prune build cache"

echo ""
echo "4. Disk usage after cleanup:"
df -h
echo ""

echo "5. Docker disk usage after cleanup:"
docker system df 2>/dev/null || echo "Docker not available"
echo ""

# Check if we have enough space (at least 2GB recommended)
NEW_AVAILABLE_SPACE=$(df -BG / | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$NEW_AVAILABLE_SPACE" -lt 2 ]; then
    echo "⚠️  WARNING: Less than 2GB available. Build may fail!"
    echo ""
    echo "Additional cleanup options:"
    echo "  - Remove specific old images: docker rmi <image-id>"
    echo "  - Remove specific volumes: docker volume rm <volume-name>"
    echo "  - Clean Next.js cache: rm -rf frontend/.next/cache"
    echo "  - Clean npm cache: npm cache clean --force"
    echo "  - Remove old logs: journalctl --vacuum-time=7d"
    echo ""
else
    echo "✅ Sufficient space available (${NEW_AVAILABLE_SPACE}GB)"
fi

echo ""
echo "=== Cleanup Complete ==="

