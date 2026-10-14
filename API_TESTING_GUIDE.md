# API Integration Testing Guide

## 1. Start PostgreSQL Database

```bash
docker compose up -d
```

Verify database is ready:
```bash
docker ps
docker logs student-debt-tracker-db
```

Expected output: "ready to accept connections"

---

## 2. Start Backend Server

Once database is running:

```bash
cd backend
./mvnw spring-boot:run
```

Wait for: `Started StudentDebtTrackerApplication in X seconds`
Server runs on: http://localhost:8080

---

## 3. API Endpoints to Test

### Health Check
```bash
curl http://localhost:8080/actuator/health
```
Expected: `{"status":"UP"}`

### Authentication
```bash
curl http://localhost:8080/api/auth/me
```
Expected: Current user profile

### Reference Data
```bash
curl http://localhost:8080/api/meta
```
Expected: Funding sources, arrangements, decision actions

### Case List
```bash
curl http://localhost:8080/api/debtors?page=0&size=10
```
Expected: Array of cases with signals[], evidence[], activity[]

### Case Detail
```bash
curl http://localhost:8080/api/debtors/CASE_KEY
```
Expected: Single case with all details

### Summary Dashboard
```bash
curl http://localhost:8080/api/summary
```
Expected: Dashboard metrics and summary data

### Ageing Analysis
```bash
curl http://localhost:8080/api/ageing
```
Expected: Age bucket breakdown

### Make Decision (POST)
```bash
curl -X POST http://localhost:8080/api/debtors/CASE_KEY/decision \
  -H "Content-Type: application/json" \
  -d '{
    "action": "APPROVE",
    "rationale": "Good payment history",
    "autonomyLevel": "OFFICER"
  }'
```
Expected: Updated case with new decision

---

## 4. Test Results

All endpoints should return:
- HTTP 200 OK
- Valid JSON response
- Signals/Evidence/Activity data populated

