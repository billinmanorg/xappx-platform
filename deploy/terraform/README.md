# Terraform

Skeleton. Three modules are referenced and not yet written: `database`,
`broker`, `storage`. Write them against whichever cloud is chosen — nothing
above depends on a specific provider yet.

Order of standing up an environment:

1. `terraform apply` — databases, broker, buckets, secrets
2. Run each service's migrations (CI does this per service)
3. `kubectl apply -f deploy/k8s/`
4. Point the gateway at the cluster

Per-service databases are deliberate: they are what make the extraction
promise in the blueprint achievable without a data untangling project.
