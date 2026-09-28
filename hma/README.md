# Exchange credentials

HMA stores one set of credentials per exchange type for the entire deployment.
Coop users, including organization administrators, cannot set or update them.
Deployment operators must configure credentials directly through HMA's existing
configuration interface. Existing credentials and banks need no migration.

Keep HMA's curator API private: it has no tenant authorization and must only be
reachable by Coop and trusted deployment operators. Do not expose it to tenants
or the public Internet. This restriction prevents credential overwrites through
Coop; it does not provide per-organization credentials or isolate HMA itself.
