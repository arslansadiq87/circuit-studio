"""Read the original STEP directly through OpenCascade XCAF, retaining placements and colors."""
import hashlib,json
from pathlib import Path
import cadquery as cq
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TDocStd import TDocStd_Document
from OCP.TCollection import TCollection_ExtendedString,TCollection_AsciiString
from OCP.TDF import TDF_LabelSequence
from OCP.XCAFDoc import XCAFDoc_DocumentTool
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.RWGltf import RWGltf_CafWriter
from OCP.TColStd import TColStd_IndexedDataMapOfStringString
from OCP.Message import Message_ProgressRange
source=Path('Custom Components/esp32_30pin.step')
def bounds(s):
 b=s.BoundingBox()
 return {'min':[b.xmin,b.ymin,b.zmin],'max':[b.xmax,b.ymax,b.zmax],'size':[b.xlen,b.ylen,b.zlen]}
reader=STEPCAFControl_Reader()
reader.SetColorMode(True)
reader.SetNameMode(True)
reader.ReadFile(str(source))
doc=TDocStd_Document(TCollection_ExtendedString('XmXCAF'))
reader.Transfer(doc)
tool=XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
labels=TDF_LabelSequence()
tool.GetFreeShapes(labels)
shapes=[cq.Shape.cast(tool.GetShape_s(labels.Value(i))) for i in range(1,labels.Length()+1)]
shape=cq.Compound.makeCompound(shapes)
report={'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'boundsMm':bounds(shape),'solids':[bounds(s) for s in shape.Solids()]}
cylinders=[]
planes=[]
for face in shape.Faces():
 b=face.BoundingBox()
 if face.geomType()=='CYLINDER':
  cylinder=face._geomAdaptor().Cylinder()
  direction=cylinder.Axis().Direction()
  if .3<cylinder.Radius()<1.2:
   cylinders.append({'radius':cylinder.Radius(),'axis':[direction.X(),direction.Y(),direction.Z()],'boundsMm':bounds(face)})
 if face.geomType()=='PLANE' and b.zlen<.00001 and 3<b.xmin<15 and b.ymin<5 and b.xlen>1 and b.ylen>1:
  planes.append({'boundsMm':bounds(face),'center':face.Center().toTuple()})
report['pcbCylinders']=cylinders
report['batteryPlaneCandidates']=planes
for s in shapes:BRepMesh_IncrementalMesh(s.wrapped,.03,False,.15,True).Perform()
writer=RWGltf_CafWriter(TCollection_AsciiString('artifacts/esp30-source.glb'),True)
assert writer.Perform(doc,TColStd_IndexedDataMapOfStringString(),Message_ProgressRange())
Path('artifacts/esp30-cad.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'sourceSha256':report['sourceSha256'],'boundsMm':report['boundsMm'],'solids':len(report['solids'])},indent=2))
