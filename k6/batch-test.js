import http from "k6/http";
import { check } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const batchLatency = new Trend("batch_latency", true);
const textsPerSecond = new Counter("texts_encoded");

// ---------------------------------------------------------------------------
// Configuration
// Batch sizes to test: k6 run --env BATCH_SIZE=16 k6/batch-test.js
// ---------------------------------------------------------------------------
const BATCH_SIZE = parseInt(__ENV.BATCH_SIZE || "16");
const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const HEADERS = { "Content-Type": "application/json" };

export const options = {
  scenarios: {
    default: {
      executor: "constant-vus",
      vus: 10,
      duration: "60s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
  },
};

// ---------------------------------------------------------------------------
// Payloads — same distribution as load-test.js
// ---------------------------------------------------------------------------
const TEXTS = {
  short:
    "2024-10-10 14:32:15 ERROR Database connection timeout after 30 seconds - retrying connection pool",
  medium:
    "2024-10-10 14:32:15 WARN [RequestId:abc-123] Slow query detected on UserService.findByEmail took 2847ms. Query: SELECT u.*, p.* FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.email = ? LIMIT 1. Connection pool: 8/20 active.",
  long: "2024-10-10 14:32:15 ERROR [com.app.service.DatabaseService] Database connection timeout after 30 seconds - retrying connection pool. Stack trace: java.sql.SQLTimeoutException: Connection timed out after 30000ms at com.mysql.cj.jdbc.ConnectionImpl.createNewIO(ConnectionImpl.java:828) at com.mysql.cj.jdbc.ConnectionImpl.connectOneTryOnly(ConnectionImpl.java:948) at com.app.service.DatabaseService.getConnection(DatabaseService.java:142) at com.app.repository.UserRepository.findById(UserRepository.java:56) at com.app.controller.UserController.getUser(UserController.java:33). Previous failures: 3 consecutive timeouts in last 60s. Circuit breaker status: HALF_OPEN.",
};

function pickText() {
  const r = Math.random();
  if (r < 0.6) return TEXTS.short;
  if (r < 0.9) return TEXTS.medium;
  return TEXTS.long;
}

function buildBatch(size) {
  const texts = [];
  for (let i = 0; i < size; i++) {
    texts.push(pickText());
  }
  return { texts };
}

// ---------------------------------------------------------------------------
// Test logic
// ---------------------------------------------------------------------------
export default function () {
  const payload = buildBatch(BATCH_SIZE);
  const res = http.post(
    `${BASE_URL}/vectorize/batch`,
    JSON.stringify(payload),
    { headers: HEADERS }
  );

  batchLatency.add(res.timings.duration);
  textsPerSecond.add(BATCH_SIZE);

  const passed = check(res, {
    "status is 200": (r) => r.status === 200,
    "has vectors field": (r) => {
      try {
        return JSON.parse(r.body).vectors !== undefined;
      } catch {
        return false;
      }
    },
    [`batch returns ${BATCH_SIZE} vectors`]: (r) => {
      try {
        return JSON.parse(r.body).vectors.length === BATCH_SIZE;
      } catch {
        return false;
      }
    },
    "each vector has 384 dims": (r) => {
      try {
        return JSON.parse(r.body).vectors[0].length === 384;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!passed);
}

// ---------------------------------------------------------------------------
// Health gate
// ---------------------------------------------------------------------------
export function setup() {
  const healthRes = http.get(`${BASE_URL}/healthz`);
  const healthy = check(healthRes, {
    "service is healthy": (r) => r.status === 200,
  });
  if (!healthy) {
    throw new Error("Service is not healthy — aborting test run");
  }
  console.log(
    `Batch test: ${BATCH_SIZE} texts/request, 10 VUs, 60s against ${BASE_URL}`
  );
}

export function handleSummary(data) {
  const reqs = data.metrics.http_reqs.values.rate.toFixed(1);
  const textsPerSec = (
    data.metrics.http_reqs.values.rate * BATCH_SIZE
  ).toFixed(0);
  const avg = data.metrics.batch_latency.values.avg.toFixed(1);
  const p95 = data.metrics.batch_latency.values["p(95)"].toFixed(1);

  const summary = `
────────────────────────────────────────
  BATCH SUMMARY (batch_size=${BATCH_SIZE})
  Requests/s:    ${reqs}
  Texts/s:       ${textsPerSec}
  Avg latency:   ${avg}ms
  p95 latency:   ${p95}ms
────────────────────────────────────────
`;
  return { stdout: summary };
}
