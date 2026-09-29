"""Package an already-built static site, excluding project and reference files."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path('dist')
if not (root / 'index.html').is_file():
    raise SystemExit('Run npm run build first.')
with ZipFile('vihaan-invitation.zip', 'w', ZIP_DEFLATED) as archive:
    for path in sorted(root.rglob('*')):
        if path.is_file():
            archive.write(path, path.relative_to(root))
print('Updated vihaan-invitation.zip from dist/.')
