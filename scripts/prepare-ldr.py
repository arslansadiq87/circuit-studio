"""Inspect and export the supplied LDR STEP without altering the source."""
import hashlib
import json
from pathlib import Path
import cadquery as cq

source = Path('Custom Components/LDR12.step')
shape = cq.importers.importStep(str(source)).val()
box = shape.BoundingBox()
def bounds(b):
    return {'min':[b.xmin,b.ymin,b.zmin], 'max':[b.xmax,b.ymax,b.zmax], 'size':[b.xlen,b.ylen,b.zlen]}
report = {'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(), 'boundsMm':bounds(box),
          'solids':[bounds(s.BoundingBox()) for s in shape.Solids()],
          'faces':[{'type':f.geomType(),'boundsMm':bounds(f.BoundingBox()),'center':f.Center().toTuple(),'area':f.Area()} for f in shape.Faces()]}
Path('artifacts/ldr-cad.json').write_text(json.dumps(report,indent=2))
# Run export-colored-step.py after inspection to preserve the STEP part colors.
print(json.dumps({k:v for k,v in report.items() if k!='faces'},indent=2))
