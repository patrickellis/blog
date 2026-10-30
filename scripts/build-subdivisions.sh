#!/usr/bin/env bash
# Builds src/data/geo/subdivisions.json (TopoJSON) from Natural Earth 10m admin-1 boundaries (public domain).
# Feature ids are ISO 3166-2 codes; Spanish provinces are dissolved into autonomous communities.
# Usage: npm run build:geo
set -euo pipefail

SRC_URL="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_1_states_provinces.geojson"
OUT="$(cd "$(dirname "$0")/.." && pwd)/src/data/geo/subdivisions.json"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL -o "$TMP/admin1.geojson" "$SRC_URL"
mkdir -p "$(dirname "$OUT")"

npx -y mapshaper@0.7.97 -i "$TMP/admin1.geojson" \
  -filter '["US","CA","CH","ES"].indexOf(iso_a2) > -1' \
  -each 'id = (iso_a2 == "ES" && region_cod && iso_3166_2 != "ES-CE" && iso_3166_2 != "ES-ML") ? "ES-" + ({AN:"AN",AR:"AR",AS:"AS",CB:"CB",CL:"CL",CM:"CM",CN:"CN",CT:"CT",EX:"EX",GA:"GA",PM:"IB",LO:"RI",MD:"MD",MU:"MC",NA:"NC",PV:"PV",VC:"VC"})[region_cod.slice(3)] : iso_3166_2' \
  -each 'name = iso_a2 == "ES" && region ? region : name' \
  -dissolve id copy-fields=name \
  -simplify 4% keep-shapes \
  -filter-islands min-area=40km2 \
  -filter-fields id,name \
  -rename-layers subdivisions \
  -o format=topojson id-field=id quantization=100000 "$OUT"
