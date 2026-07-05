# Rules

- Never generate placeholder coordinates.
- Never invent station order.
- If topology is missing, search public GIS sources.
- Preserve uploaded station coordinates.
- Validate every generated GeoJSON using RFC 7946.
- Ensure all JSON is syntactically valid.
- Automatically split files if they exceed 10 MB.
- Prefer accuracy over speed.