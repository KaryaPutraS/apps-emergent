#!/usr/bin/env python3
"""
ChatBot Manager Backend API Test Suite
Tests all endpoints for the WhatsApp AI ChatBot Manager Dashboard
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL
BASE_URL = "https://design-studio-app-14.preview.emergentagent.com/api"

# Test credentials
ADMIN_PASSWORD = "admin123"
WRONG_PASSWORD = "wrongpassword"

# Global token storage
auth_token: Optional[str] = None

# Test results tracking
test_results = {
    "passed": [],
    "failed": [],
    "total": 0
}

def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    test_results["total"] += 1
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   Details: {details}")
    
    if passed:
        test_results["passed"].append(name)
    else:
        test_results["failed"].append({"name": name, "details": details})

def make_request(method: str, endpoint: str, data: Optional[Dict] = None, 
                 use_auth: bool = True, params: Optional[Dict] = None) -> tuple:
    """Make HTTP request and return (success, response_data, status_code)"""
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    
    if use_auth and auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, params=params, timeout=10)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=10)
        elif method == "PUT":
            response = requests.put(url, headers=headers, json=data, timeout=10)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=10)
        else:
            return False, {"error": "Invalid method"}, 0
        
        try:
            response_data = response.json()
        except:
            response_data = {"text": response.text}
        
        return response.status_code < 400, response_data, response.status_code
    except Exception as e:
        return False, {"error": str(e)}, 0

# ============================================================
# AUTH TESTS
# ============================================================

def test_auth_login_success():
    """Test login with correct password"""
    global auth_token
    success, data, status = make_request("POST", "/auth/login", 
                                         {"password": ADMIN_PASSWORD}, use_auth=False)
    
    if success and data.get("success") and data.get("token"):
        auth_token = data["token"]
        log_test("Auth - Login with correct password", True, f"Token received: {auth_token[:20]}...")
        return True
    else:
        log_test("Auth - Login with correct password", False, 
                f"Status: {status}, Response: {data}")
        return False

def test_auth_login_failure():
    """Test login with wrong password"""
    success, data, status = make_request("POST", "/auth/login", 
                                         {"password": WRONG_PASSWORD}, use_auth=False)
    
    if data.get("success") == False:
        log_test("Auth - Login with wrong password (should fail)", True, 
                "Correctly rejected wrong password")
        return True
    else:
        log_test("Auth - Login with wrong password (should fail)", False, 
                f"Should have rejected wrong password. Response: {data}")
        return False

def test_auth_check():
    """Test session check with Bearer token"""
    success, data, status = make_request("GET", "/auth/check")
    
    if success and data.get("valid") == True:
        log_test("Auth - Session check with Bearer token", True, "Session is valid")
        return True
    else:
        log_test("Auth - Session check with Bearer token", False, 
                f"Status: {status}, Response: {data}")
        return False

def test_auth_logout():
    """Test logout"""
    success, data, status = make_request("POST", "/auth/logout")
    
    if success and data.get("success") == True:
        log_test("Auth - Logout", True, "Logout successful")
        return True
    else:
        log_test("Auth - Logout", False, f"Status: {status}, Response: {data}")
        return False

# ============================================================
# DASHBOARD TESTS
# ============================================================

def test_dashboard_stats():
    """Test dashboard stats endpoint"""
    success, data, status = make_request("GET", "/dashboard/stats")
    
    required_fields = ["totalMessages", "totalContacts", "activeRules", "aiCalls", 
                      "tokensUsed", "botActive"]
    has_all_fields = all(field in data for field in required_fields)
    
    if success and has_all_fields:
        log_test("Dashboard - Get stats", True, 
                f"Stats: {data.get('totalMessages')} messages, {data.get('totalContacts')} contacts")
        return True
    else:
        log_test("Dashboard - Get stats", False, 
                f"Status: {status}, Missing fields or error: {data}")
        return False

def test_dashboard_chart():
    """Test dashboard chart endpoint"""
    success, data, status = make_request("GET", "/dashboard/chart")
    
    if success and isinstance(data, list) and len(data) == 7:
        log_test("Dashboard - Get chart data", True, f"Received 7 days of chart data")
        return True
    else:
        log_test("Dashboard - Get chart data", False, 
                f"Status: {status}, Expected 7 days array, got: {type(data)}")
        return False

# ============================================================
# CONFIG TESTS
# ============================================================

def test_config_get():
    """Test get config"""
    success, data, status = make_request("GET", "/config")
    
    if success and isinstance(data, dict) and len(data) > 0:
        log_test("Config - Get config", True, f"Received {len(data)} config keys")
        return True
    else:
        log_test("Config - Get config", False, f"Status: {status}, Response: {data}")
        return False

def test_config_update():
    """Test update config"""
    success, data, status = make_request("PUT", "/config", 
                                         {"updates": {"isBotActive": True}})
    
    if success and data.get("success") == True:
        log_test("Config - Update config", True, "Config updated successfully")
        return True
    else:
        log_test("Config - Update config", False, f"Status: {status}, Response: {data}")
        return False

def test_config_ai_agent_get():
    """Test get AI agent config"""
    success, data, status = make_request("GET", "/config/ai-agent")
    
    expected_keys = ["systemPrompt", "businessInfo", "aiTemperature", "aiMaxTokens", 
                    "memoryLimit", "memoryTimeoutMinutes", "ruleAiEnabled"]
    has_keys = all(key in data for key in expected_keys)
    
    if success and has_keys:
        log_test("Config - Get AI agent config", True, "All AI config keys present")
        return True
    else:
        log_test("Config - Get AI agent config", False, 
                f"Status: {status}, Missing keys or error: {data}")
        return False

def test_config_ai_agent_update():
    """Test update AI agent config"""
    success, data, status = make_request("PUT", "/config/ai-agent", 
                                         {"systemPrompt": "Test prompt", "aiTemperature": 0.8})
    
    if success and data.get("success") == True:
        log_test("Config - Update AI agent config", True, 
                f"Updated keys: {data.get('updated_keys')}")
        return True
    else:
        log_test("Config - Update AI agent config", False, 
                f"Status: {status}, Response: {data}")
        return False

# ============================================================
# RULES CRUD TESTS
# ============================================================

created_rule_id = None

def test_rules_get():
    """Test get all rules"""
    success, data, status = make_request("GET", "/rules")
    
    if success and isinstance(data, list):
        log_test("Rules - Get all rules", True, f"Received {len(data)} rules")
        return True
    else:
        log_test("Rules - Get all rules", False, f"Status: {status}, Response: {data}")
        return False

def test_rules_create():
    """Test create rule"""
    global created_rule_id
    rule_data = {
        "name": "Test Rule",
        "triggerType": "contains",
        "triggerValue": "test|hello",
        "response": "Hello! This is a test response.",
        "isActive": True,
        "priority": 99,
        "responseMode": "direct"
    }
    
    success, data, status = make_request("POST", "/rules", rule_data)
    
    if success and data.get("success") and data.get("rule", {}).get("id"):
        created_rule_id = data["rule"]["id"]
        log_test("Rules - Create rule", True, f"Rule created with ID: {created_rule_id}")
        return True
    else:
        log_test("Rules - Create rule", False, f"Status: {status}, Response: {data}")
        return False

def test_rules_delete():
    """Test delete rule"""
    if not created_rule_id:
        log_test("Rules - Delete rule", False, "No rule ID available (create test failed)")
        return False
    
    success, data, status = make_request("DELETE", f"/rules/{created_rule_id}")
    
    if success and data.get("success") == True:
        log_test("Rules - Delete rule", True, f"Rule {created_rule_id} deleted")
        return True
    else:
        log_test("Rules - Delete rule", False, f"Status: {status}, Response: {data}")
        return False

# ============================================================
# KNOWLEDGE CRUD TESTS
# ============================================================

created_knowledge_id = None

def test_knowledge_get():
    """Test get all knowledge"""
    success, data, status = make_request("GET", "/knowledge")
    
    if success and isinstance(data, list):
        log_test("Knowledge - Get all knowledge", True, f"Received {len(data)} knowledge items")
        return True
    else:
        log_test("Knowledge - Get all knowledge", False, f"Status: {status}, Response: {data}")
        return False

def test_knowledge_create():
    """Test create knowledge"""
    global created_knowledge_id
    knowledge_data = {
        "category": "Test Category",
        "keyword": "test|demo",
        "content": "This is test knowledge content for testing purposes.",
        "isActive": True
    }
    
    success, data, status = make_request("POST", "/knowledge", knowledge_data)
    
    if success and data.get("success") and data.get("item", {}).get("id"):
        created_knowledge_id = data["item"]["id"]
        log_test("Knowledge - Create knowledge", True, f"Knowledge created with ID: {created_knowledge_id}")
        return True
    else:
        log_test("Knowledge - Create knowledge", False, f"Status: {status}, Response: {data}")
        return False

def test_knowledge_delete():
    """Test delete knowledge"""
    if not created_knowledge_id:
        log_test("Knowledge - Delete knowledge", False, "No knowledge ID available")
        return False
    
    success, data, status = make_request("DELETE", f"/knowledge/{created_knowledge_id}")
    
    if success and data.get("success") == True:
        log_test("Knowledge - Delete knowledge", True, f"Knowledge {created_knowledge_id} deleted")
        return True
    else:
        log_test("Knowledge - Delete knowledge", False, f"Status: {status}, Response: {data}")
        return False

# ============================================================
# TEMPLATES CRUD TESTS
# ============================================================

created_template_id = None

def test_templates_get():
    """Test get all templates"""
    success, data, status = make_request("GET", "/templates")
    
    if success and isinstance(data, list):
        log_test("Templates - Get all templates", True, f"Received {len(data)} templates")
        return True
    else:
        log_test("Templates - Get all templates", False, f"Status: {status}, Response: {data}")
        return False

def test_templates_create():
    """Test create template"""
    global created_template_id
    template_data = {
        "name": "Test Template",
        "content": "Hello {nama}! This is a test template.",
        "category": "Test"
    }
    
    success, data, status = make_request("POST", "/templates", template_data)
    
    if success and data.get("success") and data.get("item", {}).get("id"):
        created_template_id = data["item"]["id"]
        log_test("Templates - Create template", True, f"Template created with ID: {created_template_id}")
        return True
    else:
        log_test("Templates - Create template", False, f"Status: {status}, Response: {data}")
        return False

def test_templates_delete():
    """Test delete template"""
    if not created_template_id:
        log_test("Templates - Delete template", False, "No template ID available")
        return False
    
    success, data, status = make_request("DELETE", f"/templates/{created_template_id}")
    
    if success and data.get("success") == True:
        log_test("Templates - Delete template", True, f"Template {created_template_id} deleted")
        return True
    else:
        log_test("Templates - Delete template", False, f"Status: {status}, Response: {data}")
        return False

# ============================================================
# CONTACTS TESTS
# ============================================================

def test_contacts_get():
    """Test get all contacts"""
    success, data, status = make_request("GET", "/contacts")
    
    if success and isinstance(data, list):
        log_test("Contacts - Get all contacts", True, f"Received {len(data)} contacts")
        return True
    else:
        log_test("Contacts - Get all contacts", False, f"Status: {status}, Response: {data}")
        return False

def test_contacts_search():
    """Test search contacts"""
    success, data, status = make_request("GET", "/contacts", params={"search": "test"})
    
    if success and isinstance(data, list):
        log_test("Contacts - Search contacts", True, f"Search returned {len(data)} results")
        return True
    else:
        log_test("Contacts - Search contacts", False, f"Status: {status}, Response: {data}")
        return False

# ============================================================
# MESSAGES & LOGS TESTS
# ============================================================

def test_messages_get():
    """Test get messages"""
    success, data, status = make_request("GET", "/messages")
    
    if success and isinstance(data, list):
        log_test("Messages - Get messages", True, f"Received {len(data)} messages")
        return True
    else:
        log_test("Messages - Get messages", False, f"Status: {status}, Response: {data}")
        return False

def test_logs_get():
    """Test get logs"""
    success, data, status = make_request("GET", "/logs")
    
    if success and isinstance(data, list):
        log_test("Logs - Get logs", True, f"Received {len(data)} log entries")
        return True
    else:
        log_test("Logs - Get logs", False, f"Status: {status}, Response: {data}")
        return False

# ============================================================
# TEST CENTER TESTS
# ============================================================

def test_test_rule():
    """Test rule matching"""
    success, data, status = make_request("POST", "/test/rule", {"message": "halo apa kabar"})
    
    if success and data.get("type") == "Rule Match":
        log_test("Test Center - Test rule matching", True, 
                f"Status: {data.get('status')}, Detail: {data.get('detail', '')[:80]}")
        return True
    else:
        log_test("Test Center - Test rule matching", False, f"Status: {status}, Response: {data}")
        return False

def test_test_knowledge():
    """Test knowledge matching"""
    success, data, status = make_request("POST", "/test/knowledge", {"message": "harga menu"})
    
    if success and data.get("type") == "Knowledge Match":
        log_test("Test Center - Test knowledge matching", True, 
                f"Status: {data.get('status')}, Detail: {data.get('detail', '')[:80]}")
        return True
    else:
        log_test("Test Center - Test knowledge matching", False, f"Status: {status}, Response: {data}")
        return False

def test_test_full_flow():
    """Test full flow"""
    success, data, status = make_request("POST", "/test/full-flow", {"message": "buka jam berapa"})
    
    if success and data.get("type") == "Full Flow":
        log_test("Test Center - Test full flow", True, 
                f"Status: {data.get('status')}, Detail: {data.get('detail', '')[:80]}")
        return True
    else:
        log_test("Test Center - Test full flow", False, f"Status: {status}, Response: {data}")
        return False

# ============================================================
# LICENSE TESTS
# ============================================================

def test_license_get():
    """Test get license"""
    success, data, status = make_request("GET", "/license")
    
    if success and "valid" in data:
        log_test("License - Get license", True, f"License status: {data.get('status')}")
        return True
    else:
        log_test("License - Get license", False, f"Status: {status}, Response: {data}")
        return False

def test_license_activate():
    """Test activate license"""
    success, data, status = make_request("POST", "/license/activate", 
                                         {"licenseKey": "TEST-KEY-123"})
    
    if success and data.get("valid") == True:
        log_test("License - Activate license", True, 
                f"License activated: {data.get('licenseKey')}")
        return True
    else:
        log_test("License - Activate license", False, f"Status: {status}, Response: {data}")
        return False

def test_license_clear():
    """Test clear license"""
    success, data, status = make_request("DELETE", "/license")
    
    if success and data.get("success") == True:
        log_test("License - Clear license", True, "License cleared")
        return True
    else:
        log_test("License - Clear license", False, f"Status: {status}, Response: {data}")
        return False

# ============================================================
# BROADCAST TESTS
# ============================================================

def test_broadcast_check():
    """Test broadcast check"""
    success, data, status = make_request("POST", "/broadcast/check", {"target": "all"})
    
    if success and "count" in data:
        log_test("Broadcast - Check broadcast", True, f"Target count: {data.get('count')}")
        return True
    else:
        log_test("Broadcast - Check broadcast", False, f"Status: {status}, Response: {data}")
        return False

def test_broadcast_send():
    """Test broadcast send"""
    success, data, status = make_request("POST", "/broadcast/send", 
                                         {"target": "all", "message": "Test broadcast message"})
    
    if success and data.get("success") == True:
        log_test("Broadcast - Send broadcast", True, f"Sent to {data.get('sent')} contacts")
        return True
    else:
        log_test("Broadcast - Send broadcast", False, f"Status: {status}, Response: {data}")
        return False

# ============================================================
# RESET TESTS
# ============================================================

def test_reset_dashboard():
    """Test reset dashboard"""
    success, data, status = make_request("POST", "/reset/dashboard")
    
    if success and data.get("success") == True:
        log_test("Reset - Reset dashboard", True, "Dashboard reset successful")
        return True
    else:
        log_test("Reset - Reset dashboard", False, f"Status: {status}, Response: {data}")
        return False

def test_reset_messages():
    """Test reset messages"""
    success, data, status = make_request("POST", "/reset/messages")
    
    if success and data.get("success") == True:
        log_test("Reset - Reset messages", True, data.get("message", "Messages reset"))
        return True
    else:
        log_test("Reset - Reset messages", False, f"Status: {status}, Response: {data}")
        return False

# ============================================================
# MAIN TEST RUNNER
# ============================================================

def run_all_tests():
    """Run all tests in sequence"""
    print("=" * 80)
    print("ChatBot Manager Backend API Test Suite")
    print("=" * 80)
    print(f"Testing backend at: {BASE_URL}")
    print("=" * 80)
    print()
    
    # Auth tests (must run first to get token)
    print("🔐 AUTH TESTS")
    print("-" * 80)
    if not test_auth_login_success():
        print("\n❌ CRITICAL: Login failed. Cannot proceed with other tests.")
        return
    test_auth_login_failure()
    test_auth_check()
    print()
    
    # Dashboard tests
    print("📊 DASHBOARD TESTS")
    print("-" * 80)
    test_dashboard_stats()
    test_dashboard_chart()
    print()
    
    # Config tests
    print("⚙️  CONFIG TESTS")
    print("-" * 80)
    test_config_get()
    test_config_update()
    test_config_ai_agent_get()
    test_config_ai_agent_update()
    print()
    
    # Rules CRUD tests
    print("📋 RULES CRUD TESTS")
    print("-" * 80)
    test_rules_get()
    test_rules_create()
    test_rules_delete()
    print()
    
    # Knowledge CRUD tests
    print("📚 KNOWLEDGE CRUD TESTS")
    print("-" * 80)
    test_knowledge_get()
    test_knowledge_create()
    test_knowledge_delete()
    print()
    
    # Templates CRUD tests
    print("📝 TEMPLATES CRUD TESTS")
    print("-" * 80)
    test_templates_get()
    test_templates_create()
    test_templates_delete()
    print()
    
    # Contacts tests
    print("👥 CONTACTS TESTS")
    print("-" * 80)
    test_contacts_get()
    test_contacts_search()
    print()
    
    # Messages & Logs tests
    print("💬 MESSAGES & LOGS TESTS")
    print("-" * 80)
    test_messages_get()
    test_logs_get()
    print()
    
    # Test Center tests
    print("🧪 TEST CENTER TESTS")
    print("-" * 80)
    test_test_rule()
    test_test_knowledge()
    test_test_full_flow()
    print()
    
    # License tests
    print("🔑 LICENSE TESTS")
    print("-" * 80)
    test_license_get()
    test_license_activate()
    test_license_clear()
    print()
    
    # Broadcast tests
    print("📢 BROADCAST TESTS")
    print("-" * 80)
    test_broadcast_check()
    test_broadcast_send()
    print()
    
    # Reset tests
    print("🔄 RESET TESTS")
    print("-" * 80)
    test_reset_dashboard()
    test_reset_messages()
    print()
    
    # Logout test (last)
    print("🔐 LOGOUT TEST")
    print("-" * 80)
    test_auth_logout()
    print()
    
    # Summary
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {test_results['total']}")
    print(f"Passed: {len(test_results['passed'])} ✅")
    print(f"Failed: {len(test_results['failed'])} ❌")
    print()
    
    if test_results['failed']:
        print("FAILED TESTS:")
        print("-" * 80)
        for failed in test_results['failed']:
            print(f"❌ {failed['name']}")
            if failed['details']:
                print(f"   {failed['details']}")
        print()
    
    success_rate = (len(test_results['passed']) / test_results['total'] * 100) if test_results['total'] > 0 else 0
    print(f"Success Rate: {success_rate:.1f}%")
    print("=" * 80)
    
    return len(test_results['failed']) == 0

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
