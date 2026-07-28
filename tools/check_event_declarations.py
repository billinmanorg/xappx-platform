#!/usr/bin/env python3
"""Fails CI when a service publishes an event it did not declare in service.yaml,
or consumes one nobody publishes. Undeclared events are how event-driven systems
rot: the contract stops describing the traffic."""
import glob, re, sys, yaml

declared_pub, declared_con, manifests = set(), [], {}

for f in glob.glob("services/*/service.yaml"):
    doc = yaml.safe_load(open(f).read().split("\n", 3)[-1])
    manifests[doc["name"]] = doc
    declared_pub |= set(doc.get("publishes") or [])
    for e in (doc.get("consumes") or []):
        if e != "*":
            declared_con.append((doc["name"], e))

errors = []

# Consumed events must be published by someone.
for svc, event in declared_con:
    if event not in declared_pub:
        errors.append(f"{svc} consumes {event}, which no service publishes")

# Events emitted in code must be declared.
for f in glob.glob("services/*/src/**/*.ts", recursive=True):
    svc = f.split("/")[1]
    for m in re.finditer(r"com\.xappx\.[a-z0-9.]+", open(f).read()):
        if m.group(0) not in (manifests[svc].get("publishes") or []) + (manifests[svc].get("consumes") or []):
            errors.append(f"{svc} references undeclared event {m.group(0)} in {f}")

for e in errors:
    print(f"::error::{e}")
sys.exit(1 if errors else 0)
