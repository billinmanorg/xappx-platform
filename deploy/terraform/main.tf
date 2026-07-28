# Skeleton only. Fill in the provider block for the chosen cloud before use.

terraform {
  required_version = ">= 1.6"
  required_providers {
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 2.30" }
    helm       = { source = "hashicorp/helm",       version = "~> 2.13" }
  }
}

variable "environment" {
  type        = string
  description = "dev | staging | prod"
}

variable "services" {
  type        = list(string)
  description = "Service names. Each gets its own database and secret."
  default = [
    "clients-service", "identity-service", "vault-service", "media-service",
    "twins-service", "agents-service", "ai-orchestrator", "communities-service",
    "campaigns-service", "rewards-service", "referrals-service", "billing-service",
    "events-service", "export-service", "audit-service",
  ]
}

# One database per service. This is the property that makes per-client
# extraction tractable later - a service's data is already isolated.
module "databases" {
  source   = "./modules/database"
  for_each = toset(var.services)

  name        = replace("xappx_${each.value}", "-", "_")
  environment = var.environment
}

module "broker" {
  source      = "./modules/broker"
  environment = var.environment
  # JetStream persistence: events must survive a broker restart, or the outbox
  # relay has nothing to reconcile against.
  persistent  = true
}

module "object_storage" {
  source      = "./modules/storage"
  environment = var.environment
  versioning  = true
}
