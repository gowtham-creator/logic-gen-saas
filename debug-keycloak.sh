#!/bin/bash

echo "=== Keycloak Debugging Script ==="
echo ""

echo "1. Checking Keycloak container status..."
docker-compose -f docker-compose.prod.yml ps keycloak

echo ""
echo "2. Testing direct Keycloak access (from container)..."
# Keycloak container doesn't have curl, use wget or check via docker
docker-compose -f docker-compose.prod.yml exec -T keycloak wget -q -O- http://localhost:8080/auth/admin 2>/dev/null | head -5 && echo "✅ Keycloak admin accessible" || echo "⚠️  Keycloak admin check (may still be starting)"

echo ""
echo "3. Testing Keycloak health endpoint..."
docker-compose -f docker-compose.prod.yml exec -T keycloak wget -q -O- http://localhost:8080/health/ready 2>/dev/null && echo "✅ Health check passed" || echo "⚠️  Health check (Keycloak may still be starting - wait 2-3 minutes)"

echo ""
echo "4. Testing nginx can reach Keycloak..."
docker-compose -f docker-compose.prod.yml exec -T nginx wget -q -O- http://keycloak:8080/health/ready 2>/dev/null && echo "✅ Nginx can reach Keycloak" || echo "❌ Nginx cannot reach Keycloak"

echo ""
echo "5. Testing nginx rewrite (from host)..."
echo "Testing: curl http://localhost/keycloak/admin"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost/keycloak/admin || echo "❌ Failed"

echo ""
echo "6. Testing nginx rewrite to health endpoint..."
curl -s http://localhost/keycloak/health/ready && echo "✅ Health endpoint works" || echo "❌ Health endpoint failed"

echo ""
echo "9. Checking nginx error logs (last 20 lines)..."
docker-compose -f docker-compose.prod.yml exec -T nginx tail -20 /var/log/nginx/error.log 2>/dev/null | grep -i keycloak || echo "No Keycloak errors in nginx log"

echo ""
echo "10. Checking nginx access logs for /keycloak (last 10 lines)..."
docker-compose -f docker-compose.prod.yml exec -T nginx tail -10 /var/log/nginx/access.log 2>/dev/null | grep keycloak || echo "No /keycloak requests in access log"

echo ""
echo "11. Checking Keycloak logs (last 30 lines) - looking for 'started' or errors..."
docker-compose -f docker-compose.prod.yml logs --tail=30 keycloak | tail -30

echo ""
echo "12. Testing what Keycloak receives (from nginx container)..."
docker-compose -f docker-compose.prod.yml exec -T nginx wget -q -O- --header="Host: superadmin.theprojectava.com" http://keycloak:8080/auth/admin 2>&1 | head -10 || echo "⚠️  Failed (Keycloak may still be starting)"

echo ""
echo "=== Debug Complete ==="
echo ""
echo "IMPORTANT: Keycloak takes 2-3 minutes to fully start!"
echo ""
echo "Check if Keycloak is ready:"
echo "  docker-compose -f docker-compose.prod.yml logs keycloak | grep -i 'started'"
echo ""
echo "Wait for this message in logs: 'Keycloak X.X.X started'"
echo ""
echo "Once Keycloak is ready, test:"
echo "  curl -v http://localhost/keycloak/admin"
echo "  curl -v http://localhost/keycloak/health/ready"
echo ""
echo "If Keycloak is ready but still getting 404, check:"
echo "1. KEYCLOAK_HOSTNAME in .env matches your domain"
echo "2. Nginx rewrite rule is working"
echo "3. Keycloak logs for any errors"

