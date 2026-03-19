import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const vectorizeLatency = new Trend("vectorize_latency", true);

// ---------------------------------------------------------------------------
// Configuration — choose a scenario via: k6 run --env SCENARIO=load load-test.js
// Default: "load"
// ---------------------------------------------------------------------------
const SCENARIOS = {
  // Quick sanity check — is the service alive and correct?
  smoke: {
    executor: "shared-iterations",
    vus: 1,
    iterations: 10,
    maxDuration: "30s",
  },

  // Sustained normal traffic — match the ab baseline (c10 for 60s)
  load: {
    executor: "constant-vus",
    vus: 10,
    duration: "60s",
  },

  // Ramp up to find the throughput ceiling
  stress: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "15s", target: 10 },
      { duration: "30s", target: 20 },
      { duration: "30s", target: 50 },
      { duration: "30s", target: 100 },
      { duration: "15s", target: 0 },
    ],
  },

  // Sudden traffic burst — tests recovery behaviour
  spike: {
    executor: "ramping-vus",
    startVUs: 5,
    stages: [
      { duration: "10s", target: 5 },   // warm baseline
      { duration: "5s", target: 80 },    // spike
      { duration: "30s", target: 80 },   // hold spike
      { duration: "5s", target: 5 },     // drop back
      { duration: "20s", target: 5 },    // recovery
    ],
  },

  // Longer soak to detect memory leaks or degradation
  soak: {
    executor: "constant-vus",
    vus: 15,
    duration: "5m",
  },
};

const scenario = __ENV.SCENARIO || "load";

export const options = {
  scenarios: {
    default: SCENARIOS[scenario],
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],              // <1% errors
    http_req_duration: ["p(95)<500"],            // 95th pct under 500ms
    vectorize_latency: ["p(95)<500", "avg<300"], // custom metric thresholds
  },
};

// ---------------------------------------------------------------------------
// Payloads — realistic log messages of varying lengths
// ---------------------------------------------------------------------------
const PAYLOADS = {
  short: {
    text: "2024-10-10 14:32:15 ERROR Database connection timeout after 30 seconds - retrying connection pool",
  },
  medium: {
    text: "2024-10-10 14:32:15 WARN [RequestId:abc-123] Slow query detected on UserService.findByEmail took 2847ms. Query: SELECT u.*, p.* FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.email = ? LIMIT 1. Connection pool: 8/20 active.",
  },
  long: {
    text: "2024-10-10 14:32:15 ERROR [com.app.service.DatabaseService] Database connection timeout after 30 seconds - retrying connection pool. Stack trace: java.sql.SQLTimeoutException: Connection timed out after 30000ms at com.mysql.cj.jdbc.ConnectionImpl.createNewIO(ConnectionImpl.java:828) at com.mysql.cj.jdbc.ConnectionImpl.connectOneTryOnly(ConnectionImpl.java:948) at com.app.service.DatabaseService.getConnection(DatabaseService.java:142) at com.app.repository.UserRepository.findById(UserRepository.java:56) at com.app.controller.UserController.getUser(UserController.java:33). Previous failures: 3 consecutive timeouts in last 60s. Circuit breaker status: HALF_OPEN.",
  },
};

// Weighted distribution: 60% short, 30% medium, 10% long (mirrors real log traffic)
function pickPayload() {
  const r = Math.random();
  if (r < 0.6) return PAYLOADS.short;
  if (r < 0.9) return PAYLOADS.medium;
  return PAYLOADS.long;
}

// ---------------------------------------------------------------------------
// Test logic
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const HEADERS = { "Content-Type": "application/json" };

export default function () {
  // Vectorize request with random payload
  const payload = pickPayload();
  const res = http.post(`${BASE_URL}/vectorize`, JSON.stringify(payload), {
    headers: HEADERS,
  });

  // Track custom latency metric
  vectorizeLatency.add(res.timings.duration);

  // Validate response
  const passed = check(res, {
    "status is 200": (r) => r.status === 200,
    "has vector field": (r) => {
      try {
        return JSON.parse(r.body).vector !== undefined;
      } catch {
        return false;
      }
    },
    "vector has 384 dimensions": (r) => {
      try {
        return JSON.parse(r.body).vector.length === 384;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!passed);

  // Small think time to simulate realistic client behaviour
  // Skip for smoke/stress to measure raw throughput
  if (scenario === "load" || scenario === "soak") {
    sleep(0.1);
  }
}

// ---------------------------------------------------------------------------
// Health check before the run
// ---------------------------------------------------------------------------
export function setup() {
  const healthRes = http.get(`${BASE_URL}/healthz`);
  const healthy = check(healthRes, {
    "service is healthy": (r) => r.status === 200,
    "model is loaded": (r) => {
      try {
        return JSON.parse(r.body).status === "healthy";
      } catch {
        return false;
      }
    },
  });

  if (!healthy) {
    throw new Error("Service is not healthy — aborting test run");
  }

  console.log(`Running "${scenario}" scenario against ${BASE_URL}`);
}
