#!/bin/sh
# Recalculate every .xlsx in <inDir> with LibreOffice (headless) and write the results to <outDir>.
# Uses a throwaway LibreOffice profile set to "always recalculate" Excel files on load, so every
# formula is recomputed from the Inputs sheet rather than read from Tenor's cached values.
# Usage: sh tenor/tests/lo-recalc.sh <inDir> <outDir>
set -e
IN="$(cd "$1" && pwd)"; mkdir -p "$2"; OUT="$(cd "$2" && pwd)"
PROFILE="$OUT/.lo-profile"
mkdir -p "$PROFILE/user"
cat > "$PROFILE/user/registrymodifications.xcu" <<'XCU'
<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item>
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="ODFRecalcMode" oor:op="fuse"><value>0</value></prop></item>
</oor:items>
XCU
SOFFICE="${SOFFICE:-/Applications/LibreOffice.app/Contents/MacOS/soffice}"
"$SOFFICE" --headless --norestore "-env:UserInstallation=file://$PROFILE" --convert-to "xlsx:Calc MS Excel 2007 XML" --outdir "$OUT" "$IN"/*.xlsx >/dev/null 2>&1
echo "Recalculated $(ls "$OUT"/*.xlsx | wc -l | tr -d ' ') workbooks into $OUT"
