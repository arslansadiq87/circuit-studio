"""Export the original user-supplied STEP assembly in millimeters."""
import hashlib,json
from pathlib import Path
import cadquery as cq
source=Path('Custom Components/USB Type A Female Breakout Board.step')
assembly=cq.Assembly.load(str(source),unit='MM')
def bounds(s):
 b=s.BoundingBox()
 return {'min':[b.xmin,b.ymin,b.zmin],'max':[b.xmax,b.ymax,b.zmax],'size':[b.xlen,b.ylen,b.zlen]}
report={'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'boundsMm':bounds(assembly.toCompound()),'parts':[{'name':n,'boundsMm':bounds(e.obj),'solids':[bounds(s) for s in e.obj.Solids()]} for n,e in assembly.traverse() if e.obj]}
housing=next(e.obj for n,e in assembly.traverse() if n=='Plastic Housing003')
front=next(f for f in housing.Faces() if f.BoundingBox().ylen<.00001 and abs(f.Center().y-housing.BoundingBox().ymax)<.001)
entries=[bounds(w) for w in front.Wires() if abs(w.BoundingBox().xlen-2.4)<.001]
assert len(entries)==4, 'Expected four terminal wire-entry apertures'
report['terminalEntriesCadMm']=sorted(entries,key=lambda e:e['min'][0])
assembly.export('artifacts/usb-breakout-source.glb',exportType='GLTF',unit='MM',tolerance=.03,angularTolerance=.15)
Path('artifacts/usb-breakout-cad.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'sourceSha256':report['sourceSha256'],'boundsMm':report['boundsMm']},indent=2))
