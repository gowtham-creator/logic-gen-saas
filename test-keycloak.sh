#!/bin/bash

echo "=== Keycloak Connection Test ==="
echo ""

echo "1. Checking Keycloak container status..."
docker-compose -f docker-compose.prod.yml ps keycloak

echo ""
echo "2. Testing direct Keycloak health endpoint..."
docker-compose -f docker-compose.prod.yml exec -T keycloak curl -s http://localhost:8080/health/ready || echo "❌ Keycloak health check failed"

echo ""
echo "3. Testing Keycloak root endpoint..."
docker-compose -f docker-compose.prod.yml exec -T keycloak curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:8080/auth/ || echo "❌ Keycloak root check failed"

echo ""
echo "4. Testing Keycloak admin endpoint..."
docker-compose -f docker-compose.prod.yml exec -T keycloak curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:8080/auth/admin || echo "❌ Keycloak admin check failed"

echo ""
echo "5. Testing nginx can reach Keycloak..."
docker-compose -f docker-compose.prod.yml exec -T nginx wget -q -O- http://keycloak:8080/health/ready 2>/dev/null && echo "✅ Nginx can reach Keycloak" || echo "❌ Nginx cannot reach Keycloak"

echo ""
echo "6. Testing nginx /keycloak/ path..."
docker-compose -f docker-compose.prod.yml exec -T nginx wget -q -O- http://localhost/keycloak/health/ready 2>/dev/null && echo "✅ Nginx /keycloak/ path works" || echo "❌ Nginx /keycloak/ path failed"

echo ""
echo "7. Checking nginx error logs (last 20 lines)..."
docker-compose -f docker-compose.prod.yml exec -T nginx tail -20 /var/log/nginx/error.log 2>/dev/null || echo "No error logs or nginx not running"

echo ""
echo "8. Checking nginx access logs for /keycloak (last 10 lines)..."
docker-compose -f docker-compose.prod.yml exec -T nginx tail -10 /var/log/nginx/access.log 2>/dev/null | grep keycloak || echo "No /keycloak requests in access log"

echo ""
echo "9. Testing Keycloak logs (last 10 lines)..."
docker-compose -f docker-compose.prod.yml logs --tail=10 keycloak

echo ""
echo "10. Testing nginx configuration..."
docker-compose -f docker-compose.prod.yml exec -T nginx nginx -t 2>&1 || echo "❌ Nginx configuration has errors"

echo ""
echo "=== Test Complete ==="
echo ""
echo "Next steps:"
echo "1. If nginx config test passed, restart nginx:"
echo "   docker-compose -f docker-compose.prod.yml restart nginx"
echo ""
echo "2. Try accessing these URLs:"
echo "   - https://superadmin.theprojectava.com/keycloak/admin"
echo "   - https://superadmin.theprojectava.com/keycloak/health/ready"
echo "   - https://superadmin.theprojectava.com/keycloak/realms/master/.well-known/openid-configuration"
echo ""
echo "3. If issues persist, check:"
echo "   - Keycloak logs: docker-compose -f docker-compose.prod.yml logs -f keycloak"
echo "   - Nginx logs: docker-compose -f docker-compose.prod.yml logs -f nginx"
echo "   - Container status: docker-compose -f docker-compose.prod.yml ps"
echo ""
echo "4. Verify Keycloak is ready (should return 200):"
echo "   curl http://localhost/keycloak/health/ready"

