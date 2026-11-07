"""Flag installed npm packages whose exact version was published less than N days ago.

Fresh releases are where most npm supply-chain attacks land, so anything new gets a human look.
Usage: npm ls --all --json | python3 scripts/check-package-age.py [days]
"""
import concurrent.futures as cf
import datetime as dt
import json
import sys
import urllib.parse
import urllib.request

days = int(sys.argv[1]) if len(sys.argv) > 1 else 14
cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)).isoformat()

seen: dict[str, str] = {}


def walk(node: dict) -> None:
    for name, dep in (node.get("dependencies") or {}).items():
        if "version" in dep:
            seen[name] = dep["version"]
        walk(dep)


walk(json.load(sys.stdin))


def published(item: tuple[str, str]) -> tuple[str, str, str]:
    name, version = item
    url = "https://registry.npmjs.org/" + urllib.parse.quote(name, safe="@")
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return name, version, json.load(r)["time"].get(version, "unknown")
    except Exception as e:  # noqa: BLE001
        return name, version, f"error: {e}"


with cf.ThreadPoolExecutor(16) as ex:
    results = list(ex.map(published, seen.items()))

flagged = [r for r in results if not r[2][:4].isdigit() or r[2] > cutoff]
print(f"checked {len(results)} packages; published within {days} days or unknown: {len(flagged)}")
for name, version, when in flagged:
    print(f"  {name}@{version}  {when}")
sys.exit(1 if flagged else 0)
