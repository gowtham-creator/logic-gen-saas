#!/bin/bash

# Security Scanning Script
# This script runs various security scans and generates reports
# Run this script weekly via cron: 0 0 * * 1 /path/to/security-scan.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the project root (parent of scripts directory)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project root to ensure relative paths work
cd "$PROJECT_ROOT"

# Configuration
REPORT_DIR="scripts/security-reports"
DATE=$(date +%Y%m%d)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create reports directory if it doesn't exist
mkdir -p "$REPORT_DIR"

echo -e "${GREEN}Starting security scan...${NC}"
echo "Project root: $PROJECT_ROOT"
echo "Report directory: $REPORT_DIR"
echo "Date: $DATE"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to extract npm audit vulnerability count
extract_npm_vulns() {
    local file="$1"
    if [ -f "$file" ]; then
        # Look for "found X vulnerabilities" pattern
        local vulns=$(grep -oE "found [0-9]+ vulnerabilities" "$file" 2>/dev/null | grep -oE "[0-9]+" | head -1)
        if [ -n "$vulns" ]; then
            echo "$vulns"
        else
            echo "unknown"
        fi
    else
        echo "N/A"
    fi
}

# Function to extract Trivy vulnerability count
extract_trivy_vulns() {
    local file="$1"
    if [ -f "$file" ]; then
        # Trivy table format shows counts in the summary
        local vulns=$(grep -E "Vulnerabilities" "$file" 2>/dev/null | head -1 | grep -oE "[0-9]+" | head -1)
        if [ -n "$vulns" ]; then
            echo "$vulns"
        else
            # Check if it says "Clean" or "0"
            if grep -qE "(Clean|0.*vulnerabilities)" "$file" 2>/dev/null; then
                echo "0"
            else
                echo "unknown"
            fi
        fi
    else
        echo "N/A"
    fi
}

# Function to check if Snyk scan was successful
check_snyk_status() {
    local json_file="$1"
    if [ -f "$json_file" ]; then
        if grep -q '"ok": true' "$json_file" 2>/dev/null; then
            echo "success"
        elif grep -q "auth" "$json_file" 2>/dev/null; then
            echo "auth_required"
        else
            echo "failed"
        fi
    else
        echo "not_run"
    fi
}

# 1. npm audit (Backend)
echo -e "${YELLOW}[1/6] Running npm audit (backend)...${NC}"
if [ -d "backend" ]; then
    cd backend
    if [ -f "package.json" ]; then
        npm audit --audit-level=moderate > "$PROJECT_ROOT/$REPORT_DIR/npm-audit-backend-$DATE.txt" 2>&1 || true
        npm audit --json > "$PROJECT_ROOT/$REPORT_DIR/npm-audit-backend-$DATE.json" 2>&1 || true
        echo -e "${GREEN}✓ Backend npm audit complete${NC}"
    fi
    cd "$PROJECT_ROOT"
else
    echo -e "${RED}✗ Backend directory not found${NC}"
fi

# 2. npm audit (Frontend)
echo -e "${YELLOW}[2/6] Running npm audit (frontend)...${NC}"
if [ -d "frontend" ]; then
    cd frontend
    if [ -f "package.json" ]; then
        npm audit --audit-level=moderate > "$PROJECT_ROOT/$REPORT_DIR/npm-audit-frontend-$DATE.txt" 2>&1 || true
        npm audit --json > "$PROJECT_ROOT/$REPORT_DIR/npm-audit-frontend-$DATE.json" 2>&1 || true
        echo -e "${GREEN}✓ Frontend npm audit complete${NC}"
    fi
    cd "$PROJECT_ROOT"
else
    echo -e "${RED}✗ Frontend directory not found${NC}"
fi

# 3. Snyk scan (if available)
echo -e "${YELLOW}[3/6] Running Snyk scan...${NC}"
if command_exists snyk; then
    if [ -d "backend" ]; then
        cd backend
        snyk test --json > "$PROJECT_ROOT/$REPORT_DIR/snyk-backend-$DATE.json" 2>&1 || true
        snyk test > "$PROJECT_ROOT/$REPORT_DIR/snyk-backend-$DATE.txt" 2>&1 || true
        cd "$PROJECT_ROOT"
        echo -e "${GREEN}✓ Snyk scan complete${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Snyk not installed. Install with: npm install -g snyk${NC}"
fi

# 4. Trivy container scan (if available)
echo -e "${YELLOW}[4/6] Running Trivy container scan...${NC}"
if command_exists trivy; then
    # Scan backend Dockerfile
    if [ -f "backend/Dockerfile" ]; then
        trivy fs --format json --output "$PROJECT_ROOT/$REPORT_DIR/trivy-backend-$DATE.json" backend/ 2>&1 || true
        trivy fs --format table --output "$PROJECT_ROOT/$REPORT_DIR/trivy-backend-$DATE.txt" backend/ 2>&1 || true
        echo -e "${GREEN}✓ Trivy backend scan complete${NC}"
    fi
    
    # Scan frontend Dockerfile
    if [ -f "frontend/Dockerfile" ]; then
        trivy fs --format json --output "$PROJECT_ROOT/$REPORT_DIR/trivy-frontend-$DATE.json" frontend/ 2>&1 || true
        trivy fs --format table --output "$PROJECT_ROOT/$REPORT_DIR/trivy-frontend-$DATE.txt" frontend/ 2>&1 || true
        echo -e "${GREEN}✓ Trivy frontend scan complete${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Trivy not installed.${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "   Install with Homebrew: ${GREEN}brew install trivy${NC}"
        echo -e "   Or download from: https://github.com/aquasecurity/trivy/releases"
    else
        echo -e "   Install from: https://github.com/aquasecurity/trivy"
        echo -e "   Quick install: curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin"
    fi
fi

# 5. OWASP ZAP baseline scan (if available and server is running)
echo -e "${YELLOW}[5/6] Running OWASP ZAP baseline scan...${NC}"

# Check if application is running
APP_RUNNING=false
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    APP_RUNNING=true
    APP_URL="http://localhost:3001"
elif curl -s http://localhost:3000 > /dev/null 2>&1; then
    APP_RUNNING=true
    APP_URL="http://localhost:3000"
fi

if [ "$APP_RUNNING" = false ]; then
    echo -e "${YELLOW}⚠ Application not running. Start the application to run ZAP scan.${NC}"
    echo -e "   Expected endpoints: http://localhost:3001/health or http://localhost:3000"
else
    ZAP_FOUND=false
    
    # Try Docker first (most reliable)
    if command_exists docker && docker images | grep -q "owasp/zap2docker"; then
        echo -e "   Using Docker-based ZAP..."
        docker run --rm -v "$PROJECT_ROOT/$REPORT_DIR:/zap/wrk/:rw" \
            owasp/zap2docker-stable zap-baseline.py \
            -t "$APP_URL" \
            -J "/zap/wrk/zap-baseline-$DATE.json" \
            > "$PROJECT_ROOT/$REPORT_DIR/zap-baseline-$DATE.txt" 2>&1 || true
        ZAP_FOUND=true
        echo -e "${GREEN}✓ OWASP ZAP scan complete (Docker)${NC}"
    # Try zap-baseline.py command
    elif command_exists zap-baseline.py; then
        zap-baseline.py -t "$APP_URL" -J "$PROJECT_ROOT/$REPORT_DIR/zap-baseline-$DATE.json" > "$PROJECT_ROOT/$REPORT_DIR/zap-baseline-$DATE.txt" 2>&1 || true
        ZAP_FOUND=true
        echo -e "${GREEN}✓ OWASP ZAP scan complete${NC}"
    # Try finding ZAP in Applications (macOS)
    elif [[ "$OSTYPE" == "darwin"* ]] && [ -d "/Applications/ZAP.app" ]; then
        ZAP_SCRIPT=$(find /Applications/ZAP.app -name "zap-baseline.py" 2>/dev/null | head -1)
        if [ -n "$ZAP_SCRIPT" ] && [ -f "$ZAP_SCRIPT" ]; then
            "$ZAP_SCRIPT" -t "$APP_URL" -J "$PROJECT_ROOT/$REPORT_DIR/zap-baseline-$DATE.json" > "$PROJECT_ROOT/$REPORT_DIR/zap-baseline-$DATE.txt" 2>&1 || true
            ZAP_FOUND=true
            echo -e "${GREEN}✓ OWASP ZAP scan complete${NC}"
        fi
    fi
    
    if [ "$ZAP_FOUND" = false ]; then
        echo -e "${YELLOW}⚠ OWASP ZAP not found.${NC}"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo -e "   Install options:"
            echo -e "   1. Docker (recommended): ${GREEN}docker pull owasp/zap2docker-stable${NC}"
            echo -e "   2. Homebrew: ${GREEN}brew install --cask owasp-zap${NC}"
            echo -e "   3. Download from: https://www.zaproxy.org/download/"
        else
            echo -e "   Install options:"
            echo -e "   1. Docker (recommended): ${GREEN}docker pull owasp/zap2docker-stable${NC}"
            echo -e "   2. Download from: https://www.zaproxy.org/download/"
        fi
    fi
fi

# 6. Generate summary report
echo -e "${YELLOW}[6/6] Generating summary report...${NC}"
SUMMARY_FILE="$PROJECT_ROOT/$REPORT_DIR/security-scan-summary-$DATE.md"

# Extract statistics
BACKEND_NPM_VULNS=$(extract_npm_vulns "$PROJECT_ROOT/$REPORT_DIR/npm-audit-backend-$DATE.txt")
FRONTEND_NPM_VULNS=$(extract_npm_vulns "$PROJECT_ROOT/$REPORT_DIR/npm-audit-frontend-$DATE.txt")
BACKEND_TRIVY_VULNS=$(extract_trivy_vulns "$PROJECT_ROOT/$REPORT_DIR/trivy-backend-$DATE.txt")
FRONTEND_TRIVY_VULNS=$(extract_trivy_vulns "$PROJECT_ROOT/$REPORT_DIR/trivy-frontend-$DATE.txt")
SNYK_STATUS=$(check_snyk_status "$PROJECT_ROOT/$REPORT_DIR/snyk-backend-$DATE.json")

cat > "$SUMMARY_FILE" << EOF
# Security Scan Summary

**Date:** $(date)
**Scan ID:** $TIMESTAMP

## Executive Summary

| Scan Type | Status | Findings |
|-----------|--------|----------|
| npm audit (Backend) | ✅ Complete | $BACKEND_NPM_VULNS vulnerabilities |
| npm audit (Frontend) | ✅ Complete | $FRONTEND_NPM_VULNS vulnerabilities |
| Trivy (Backend) | ✅ Complete | $BACKEND_TRIVY_VULNS vulnerabilities |
| Trivy (Frontend) | ✅ Complete | $FRONTEND_TRIVY_VULNS vulnerabilities |
| Snyk (Backend) | $(if [ "$SNYK_STATUS" = "success" ]; then echo "✅ Complete"; elif [ "$SNYK_STATUS" = "auth_required" ]; then echo "⚠️ Auth Required"; else echo "❌ Not Run"; fi) | $(if [ "$SNYK_STATUS" = "success" ]; then echo "See report"; elif [ "$SNYK_STATUS" = "auth_required" ]; then echo "Run: snyk auth"; else echo "N/A"; fi) |
| OWASP ZAP | $(if [ -f "$PROJECT_ROOT/$REPORT_DIR/zap-baseline-$DATE.txt" ]; then echo "✅ Complete"; else echo "⚠️ Not Run"; fi) | $(if [ -f "$PROJECT_ROOT/$REPORT_DIR/zap-baseline-$DATE.txt" ]; then echo "See report"; else echo "Tool not installed or app not running"; fi) |

## Detailed Scan Results

### Dependency Vulnerabilities (npm audit)

#### Backend
- **Vulnerabilities Found:** $BACKEND_NPM_VULNS
- Report: \`npm-audit-backend-$DATE.txt\`
- JSON: \`npm-audit-backend-$DATE.json\`

#### Frontend
- **Vulnerabilities Found:** $FRONTEND_NPM_VULNS
- Report: \`npm-audit-frontend-$DATE.txt\`
- JSON: \`npm-audit-frontend-$DATE.json\`

### Container Security (Trivy)

#### Backend
- **Vulnerabilities Found:** $BACKEND_TRIVY_VULNS
- Report: \`trivy-backend-$DATE.txt\`
- JSON: \`trivy-backend-$DATE.json\`

#### Frontend
- **Vulnerabilities Found:** $FRONTEND_TRIVY_VULNS
- Report: \`trivy-frontend-$DATE.txt\`
- JSON: \`trivy-frontend-$DATE.json\`

### Snyk Scan
- **Status:** $(if [ "$SNYK_STATUS" = "success" ]; then echo "✅ Success"; elif [ "$SNYK_STATUS" = "auth_required" ]; then echo "⚠️ Authentication required - Run \`snyk auth\`"; else echo "❌ Not executed"; fi)
- Report: \`snyk-backend-$DATE.txt\`
- JSON: \`snyk-backend-$DATE.json\`

### Application Security (OWASP ZAP)
$(if [ -f "$PROJECT_ROOT/$REPORT_DIR/zap-baseline-$DATE.txt" ]; then echo "- **Status:** ✅ Scan completed"; else echo "- **Status:** ⚠️ Not executed (tool not installed or application not running)"; fi)
- Report: \`zap-baseline-$DATE.txt\`
- JSON: \`zap-baseline-$DATE.json\`

## Next Steps

1. Review all scan reports for detailed findings
2. Prioritize critical and high severity vulnerabilities
3. Create tickets for remediation
4. Schedule follow-up scans after fixes
$(if [ "$SNYK_STATUS" = "auth_required" ] && [ ! -f "$PROJECT_ROOT/$REPORT_DIR/zap-baseline-$DATE.txt" ]; then 
    echo "5. Authenticate Snyk: Run \`snyk auth\` in the backend directory"
    echo "6. Consider installing OWASP ZAP for application security testing"
elif [ "$SNYK_STATUS" = "auth_required" ]; then
    echo "5. Authenticate Snyk: Run \`snyk auth\` in the backend directory"
elif [ ! -f "$PROJECT_ROOT/$REPORT_DIR/zap-baseline-$DATE.txt" ]; then
    echo "5. Consider installing OWASP ZAP for application security testing"
fi)

## Notes

- All reports are saved in: \`$REPORT_DIR/\`
- Review JSON files for programmatic analysis
- Schedule next scan: $(if [[ "$OSTYPE" == "darwin"* ]]; then date -v+7d +%Y-%m-%d; else date -d "+7 days" +%Y-%m-%d; fi)
- For Snyk: Run \`snyk auth\` to authenticate and enable scanning

EOF

echo -e "${GREEN}✓ Summary report generated: $SUMMARY_FILE${NC}"

# Final summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Security scan complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Reports saved to: $REPORT_DIR/"
echo "Summary: $SUMMARY_FILE"
echo ""

# Check for missing optional tools
MISSING_TOOLS=()
if ! command_exists snyk; then
    MISSING_TOOLS+=("Snyk")
fi
if ! command_exists trivy; then
    MISSING_TOOLS+=("Trivy")
fi
if ! command_exists zap-baseline.py; then
    MISSING_TOOLS+=("OWASP ZAP")
fi

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
    echo -e "${YELLOW}Optional tools not installed (for more comprehensive scans):${NC}"
    for tool in "${MISSING_TOOLS[@]}"; do
        echo -e "  - $tool"
    done
    echo ""
fi

echo "Next steps:"
echo "1. Review all scan reports"
echo "2. Prioritize vulnerabilities"
echo "3. Create remediation tickets"
if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
    echo "4. Consider installing optional tools for enhanced security scanning"
fi
echo ""

