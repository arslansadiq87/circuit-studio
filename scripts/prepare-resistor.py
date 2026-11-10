"""Import the supplied resistor without changing its STEP source."""
import hashlib
import json
from pathlib import Path
import cadquery as cq
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TDocStd import TDocStd_Document
from OCP.TCollection import TCollection_ExtendedString
from OCP.TDF import TDF_LabelSequence
from OCP.XCAFDoc import XCAFDoc_DocumentTool, XCAFDoc_ColorSurf, XCAFDoc_ColorGen
from OCP.Quantity import Quantity_ColorRGBA

source = Path('Custom Components/Resistor.step')
reader = STEPCAFControl_Reader()
reader.SetColorMode(True)
reader.ReadFile(str(source))
doc = TDocStd_Document(TCollection_ExtendedString('XmXCAF'))
reader.Transfer(doc)
shapes = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
colors = XCAFDoc_DocumentTool.ColorTool_s(doc.Main())
labels = TDF_LabelSequence()
shapes.GetFreeShapes(labels)
assert labels.Length() == 1, 'Expected one resistor part'
shape = cq.Shape.cast(shapes.GetShape_s(labels.Value(1)))
def color_of(shape):
    value = Quantity_ColorRGBA()
    for kind in (XCAFDoc_ColorSurf, XCAFDoc_ColorGen):
        if colors.GetColor(shape.wrapped,kind,value):
            rgb=value.GetRGB()
            return cq.Color(rgb.Red(),rgb.Green(),rgb.Blue(),value.Alpha(),False)
assembly = cq.Assembly(shape, name='Resistor', color=color_of(shape))
for face in shape.Faces():
    color=color_of(face)
    if color: assembly.addSubshape(face,color=color)
shape = assembly.toCompound()
box = shape.BoundingBox()
def bounds(b):
    return {'min': [b.xmin,b.ymin,b.zmin], 'max': [b.xmax,b.ymax,b.zmax], 'size': [b.xlen,b.ylen,b.zlen]}
assembly.export('artifacts/resistor-source.glb', exportType='GLTF', unit='MM', tolerance=0.01, angularTolerance=0.1)
report = {'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'boundsMm': bounds(box), 'solids': [bounds(s.BoundingBox()) for s in shape.Solids()]}
report['faces']=[{'boundsMm':bounds(f.BoundingBox()),'center':f.Center().toTuple(),'color':color_of(f).toTuple() if color_of(f) else None} for f in shape.Faces()]
Path('artifacts/resistor-cad.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k != 'faces'},indent=2))
