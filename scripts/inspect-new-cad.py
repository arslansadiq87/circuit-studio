"""Measure the three supplied STEP files and export inspection GLBs."""
import hashlib
import json
from pathlib import Path
import cadquery as cq

FILES = {'stepper-24byj-48':'stepper 24BYJ-48 .STEP','dvr8825':'DVR8825.stp','sonoff-cam-s3w':'sonoff-cam-s3w.step'}
def bounds(b):
    return {'min':[round(b.xmin,6),round(b.ymin,6),round(b.zmin,6)],'max':[round(b.xmax,6),round(b.ymax,6),round(b.zmax,6)],'size':[round(b.xlen,6),round(b.ylen,6),round(b.zlen,6)]}
for slug,filename in FILES.items():
    source=Path('Custom Components')/filename
    shape=cq.importers.importStep(str(source)).val()
    report={'source':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'boundsMm':bounds(shape.BoundingBox()),
            'solids':[{'boundsMm':bounds(s.BoundingBox()),'volume':round(s.Volume(),6)} for s in shape.Solids()],
            'faces':[{'type':f.geomType(),'boundsMm':bounds(f.BoundingBox()),'center':[round(v,6) for v in f.Center().toTuple()],'area':round(f.Area(),6)} for f in shape.Faces()]}
    Path(f'artifacts/{slug}-cad.json').write_text(json.dumps(report,indent=2))
    # Run export-colored-step.py after inspection to preserve STEP appearance data.
    print(json.dumps({'slug':slug,'boundsMm':report['boundsMm'],'solidCount':len(report['solids']),'faceCount':len(report['faces']),'solids':report['solids'][:40]},indent=2),flush=True)
