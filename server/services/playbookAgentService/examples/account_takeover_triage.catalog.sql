-- catalog_id: login_patterns
-- version: 1.0.0
-- description: Login frequency and geographic anomaly analysis

SELECT
    DATE(login_timestamp) AS login_date,
    COUNT(*) AS login_count,
    SUM(CASE WHEN success = false THEN 1 ELSE 0 END) AS failed_logins,
    COUNT(DISTINCT ip_address) AS distinct_ips,
    COUNT(DISTINCT country_code) AS distinct_countries
FROM account_logins
WHERE account_id = :account_id
  AND login_timestamp >= DATEADD(day, -:lookback_days, CURRENT_TIMESTAMP)
GROUP BY DATE(login_timestamp)
ORDER BY login_date DESC
LIMIT 30;
